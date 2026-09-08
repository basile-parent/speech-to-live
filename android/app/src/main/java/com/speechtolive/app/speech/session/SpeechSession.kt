package com.speechtolive.app.speech.session

import android.util.Log
import com.speechtolive.app.speech.audio.AudioRecorder
import com.speechtolive.app.speech.audio.PcmAudioSource
import com.speechtolive.app.speech.model.ModelCatalog
import com.speechtolive.app.speech.model.ModelDescriptor
import com.speechtolive.app.speech.recognition.SpeechRecognitionEngine
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

class SpeechSession(
  private val audioSource: PcmAudioSource,
  private val recognitionEngine: SpeechRecognitionEngine,
  private val onError: (Throwable) -> Unit,
  private val onAudioLevel: ((Float) -> Unit)? = null,
  private val decodeExecutor: ExecutorService = Executors.newSingleThreadExecutor(),
) {
  private val listening = AtomicBoolean(false)
  private var currentModel: ModelDescriptor =
    ModelCatalog.requireLanguage(ModelCatalog.DEFAULT_LANGUAGE)
  private var modelLoaded = false
  private var lastAudioLevelEmitMs = 0L

  init {
    if (audioSource is AudioRecorder) {
      audioSource.setErrorListener { error ->
        listening.set(false)
        onError(error)
      }
    }
  }

  @Synchronized
  fun setLanguage(language: String) {
    ensureIdle("setLanguage")
    currentModel = ModelCatalog.requireLanguage(language)
    recognitionEngine.loadModel(currentModel)
    modelLoaded = true
  }

  @Synchronized
  fun setModel(path: String) {
    ensureIdle("setModel")
    currentModel = resolveModelFromPath(path)
    recognitionEngine.loadModel(currentModel)
    modelLoaded = true
  }

  @Synchronized
  fun startListening() {
    if (!listening.compareAndSet(false, true)) {
      throw IllegalStateException("SpeechSession is already listening")
    }

    try {
      if (!modelLoaded) {
        recognitionEngine.loadModel(currentModel)
        modelLoaded = true
      }
      recognitionEngine.start()
      audioSource.start { samples, sampleRate ->
        maybeEmitAudioLevel(samples)
        decodeExecutor.execute {
          try {
            recognitionEngine.acceptWaveform(samples, sampleRate)
          } catch (error: Throwable) {
            listening.set(false)
            onError(error)
          }
        }
      }
    } catch (error: Throwable) {
      listening.set(false)
      safeStopEngine()
      throw error
    }
  }

  @Synchronized
  fun stopListening() {
    if (!listening.compareAndSet(true, false)) {
      return
    }

    try {
      audioSource.stop()
    } finally {
      safeStopEngine()
    }
  }

  fun isListening(): Boolean = listening.get()

  fun release() {
    stopListening()
    audioSource.release()
    recognitionEngine.release()
    modelLoaded = false
    decodeExecutor.shutdownNow()
  }

  private fun maybeEmitAudioLevel(samples: FloatArray) {
    val listener = onAudioLevel ?: return
    val now = System.currentTimeMillis()
    if (now - lastAudioLevelEmitMs < AUDIO_LEVEL_EMIT_INTERVAL_MS) {
      return
    }
    lastAudioLevelEmitMs = now

    var sumSquares = 0.0
    for (sample in samples) {
      sumSquares += sample * sample
    }
    val rms = if (samples.isEmpty()) 0f else sqrt(sumSquares / samples.size).toFloat()
    Log.d(TAG, "pcmRms=$rms samples=${samples.size}")
    listener(rms)
  }

  private fun ensureIdle(operation: String) {
    if (listening.get()) {
      throw IllegalStateException("Cannot $operation while listening")
    }
  }

  private fun safeStopEngine() {
    try {
      recognitionEngine.stop()
    } catch (error: Throwable) {
      onError(error)
    }
  }

  private fun resolveModelFromPath(path: String): ModelDescriptor {
    val directory = File(path)
    if (!directory.isDirectory) {
      throw IllegalArgumentException("Model path must be a directory: $path")
    }

    val files = directory.listFiles()?.toList().orEmpty()
    val encoder =
      files.firstOrNull {
        it.name.contains("encoder", ignoreCase = true) && it.name.endsWith(".onnx")
      } ?: throw IllegalArgumentException("No encoder .onnx found in $path")
    val decoder =
      files.firstOrNull {
        it.name.contains("decoder", ignoreCase = true) && it.name.endsWith(".onnx")
      } ?: throw IllegalArgumentException("No decoder .onnx found in $path")
    val joiner =
      files.firstOrNull {
        it.name.contains("joiner", ignoreCase = true) && it.name.endsWith(".onnx")
      } ?: throw IllegalArgumentException("No joiner .onnx found in $path")
    val tokens =
      files.firstOrNull { it.name == "tokens.txt" }
        ?: throw IllegalArgumentException("No tokens.txt found in $path")

    return ModelDescriptor(
      directory = directory.absolutePath,
      encoderFileName = encoder.name,
      decoderFileName = decoder.name,
      joinerFileName = joiner.name,
      tokensFileName = tokens.name,
    )
  }

  companion object {
    private const val TAG = "SpeechToLive"
    private const val AUDIO_LEVEL_EMIT_INTERVAL_MS = 50L
  }
}
