package com.speechtolive.app.speech.recognition

import android.content.res.AssetManager
import com.k2fsa.sherpa.onnx.EndpointConfig
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizer
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.speechtolive.app.speech.model.ModelDescriptor
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class SpeechRecognizer(
  private val assetManager: AssetManager,
  private val resultListener: RecognitionResultListener,
  private val numThreads: Int = DEFAULT_NUM_THREADS,
) : SpeechRecognitionEngine {
  private val running = AtomicBoolean(false)
  private var recognizer: OnlineRecognizer? = null
  private var stream: OnlineStream? = null
  private var loadedModel: ModelDescriptor? = null

  override fun loadModel(model: ModelDescriptor) {
    if (running.get()) {
      throw IllegalStateException("Cannot load a model while recognition is running")
    }

    validateModel(model)
    releaseRecognizer()

    val config =
      OnlineRecognizerConfig(
        featConfig = FeatureConfig(sampleRate = DEFAULT_SAMPLE_RATE, featureDim = 80),
        modelConfig =
          OnlineModelConfig(
            transducer =
              OnlineTransducerModelConfig(
                encoder = model.encoderPath,
                decoder = model.decoderPath,
                joiner = model.joinerPath,
              ),
            tokens = model.tokensPath,
            numThreads = numThreads,
            provider = "cpu",
            modelType = "zipformer",
          ),
        endpointConfig = EndpointConfig(),
        enableEndpoint = true,
        decodingMethod = "greedy_search",
      )

    recognizer =
      OnlineRecognizer(
        assetManager = resolveAssetManager(model),
        config = config,
      )
    loadedModel = model
  }

  override fun start() {
    val activeRecognizer =
      recognizer
        ?: throw IllegalStateException("SpeechRecognizer model is not loaded")

    if (!running.compareAndSet(false, true)) {
      throw IllegalStateException("SpeechRecognizer is already running")
    }

    stream = activeRecognizer.createStream()
  }

  override fun acceptWaveform(samples: FloatArray, sampleRate: Int) {
    if (!running.get()) {
      return
    }

    val activeRecognizer =
      recognizer
        ?: throw IllegalStateException("SpeechRecognizer model is not loaded")
    val activeStream =
      stream
        ?: throw IllegalStateException("SpeechRecognizer stream is not started")

    activeStream.acceptWaveform(samples, sampleRate = sampleRate)

    while (activeRecognizer.isReady(activeStream)) {
      activeRecognizer.decode(activeStream)
    }

    val text = activeRecognizer.getResult(activeStream).text.trim()
    val endpoint = activeRecognizer.isEndpoint(activeStream)

    if (endpoint) {
      if (text.isNotEmpty()) {
        resultListener.onRecognitionResult(RecognitionResult.Final(text))
      }
      activeRecognizer.reset(activeStream)
    } else if (text.isNotEmpty()) {
      resultListener.onRecognitionResult(RecognitionResult.Partial(text))
    }
  }

  override fun stop() {
    if (!running.compareAndSet(true, false)) {
      return
    }

    val activeRecognizer = recognizer
    val activeStream = stream
    if (activeRecognizer != null && activeStream != null) {
      val text = activeRecognizer.getResult(activeStream).text.trim()
      if (text.isNotEmpty()) {
        resultListener.onRecognitionResult(RecognitionResult.Final(text))
      }
      activeStream.release()
    }
    stream = null
  }

  override fun release() {
    stop()
    releaseRecognizer()
  }

  override fun isRunning(): Boolean = running.get()

  private fun releaseRecognizer() {
    recognizer?.release()
    recognizer = null
    loadedModel = null
  }

  private fun resolveAssetManager(model: ModelDescriptor): AssetManager? {
    val directory = File(model.directory)
    return if (directory.isAbsolute) {
      null
    } else {
      assetManager
    }
  }

  private fun validateModel(model: ModelDescriptor) {
    val directory = File(model.directory)
    if (directory.isAbsolute) {
      requireFile(File(directory, model.encoderFileName))
      requireFile(File(directory, model.decoderFileName))
      requireFile(File(directory, model.joinerFileName))
      requireFile(File(directory, model.tokensFileName))
      return
    }

    requireAsset(model.encoderPath)
    requireAsset(model.decoderPath)
    requireAsset(model.joinerPath)
    requireAsset(model.tokensPath)
  }

  private fun requireFile(file: File) {
    if (!file.isFile) {
      throw IllegalArgumentException("Missing model file: ${file.absolutePath}")
    }
  }

  private fun requireAsset(path: String) {
    val dir = path.substringBeforeLast('/', missingDelimiterValue = "")
    val fileName = path.substringAfterLast('/')
    val entries = assetManager.list(dir) ?: emptyArray()
    if (!entries.contains(fileName)) {
      throw IllegalArgumentException("Missing model asset: $path")
    }
  }

  companion object {
    const val DEFAULT_SAMPLE_RATE = 16_000
    private const val DEFAULT_NUM_THREADS = 2
  }
}
