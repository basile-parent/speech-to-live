package com.speechtolive.app.speech.session

import android.util.Log
import com.speechtolive.app.speech.audio.AudioRecorder
import com.speechtolive.app.speech.audio.PcmAudioSource
import com.speechtolive.app.speech.model.ModelCatalog
import com.speechtolive.app.speech.model.ModelDescriptor
import com.speechtolive.app.speech.recognition.SpeechRecognitionEngine
import com.speechtolive.app.speech.speaker.SpeakerTracker
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.sqrt

class SpeechSession(
  private val audioSource: PcmAudioSource,
  private val recognitionEngine: SpeechRecognitionEngine,
  private val onError: (Throwable) -> Unit,
  private val onAudioLevel: ((Float) -> Unit)? = null,
  private val speakerTracker: SpeakerTracker? = null,
  private val decodeExecutor: ExecutorService = Executors.newSingleThreadExecutor(),
) {
  private val listening = AtomicBoolean(false)
  private val audioSensitivity = AtomicReference(DEFAULT_AUDIO_SENSITIVITY)
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
    val nextModel = ModelCatalog.requireLanguage(language)
    if (modelLoaded && currentModel == nextModel) {
      return
    }
    ensureIdle("setLanguage")
    currentModel = nextModel
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
  fun setSpeakerMode(enabled: Boolean) {
    ensureIdle("setSpeakerMode")
    // Only flip the preference here. The embedding model is loaded lazily
    // when listening starts, so changing mode stays instant and reliable.
    speakerTracker?.setEnabled(enabled)
  }

  fun isSpeakerModeEnabled(): Boolean = speakerTracker?.isEnabled() == true

  fun setAudioSensitivity(sensitivity: Float) {
    val clamped = sensitivity.coerceIn(SENSITIVITY_MIN, SENSITIVITY_MAX)
    audioSensitivity.set(clamped)
    Log.i(TAG, "detectionThreshold=$clamped")
  }

  fun getAudioSensitivity(): Float = audioSensitivity.get()

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
        // VU meter always reflects raw mic level (independent of the cursor).
        maybeEmitAudioLevel(samples)
        val threshold = audioSensitivity.get()
        val forRecognizer = gateAtThreshold(samples, threshold)
        decodeExecutor.execute {
          try {
            recognitionEngine.acceptWaveform(forRecognizer, sampleRate)
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
    speakerTracker?.release()
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
      modelType =
        if (directory.name.contains("kroko", ignoreCase = true) ||
          directory.name.contains("zipformer2", ignoreCase = true)
        ) {
          "zipformer2"
        } else {
          "zipformer"
        },
    )
  }

  companion object {
    private const val TAG = "SpeechToLive"
    private const val AUDIO_LEVEL_EMIT_INTERVAL_MS = 50L
    /** Must stay aligned with JS `shared/audio/sensitivity.ts`. */
    const val SENSITIVITY_MIN = 0.1f
    const val SENSITIVITY_MAX = 0.85f
    const val DEFAULT_AUDIO_SENSITIVITY = 0.4f
    /**
     * Same scale factor as the JS VU meter (`LEVEL_DISPLAY_SCALE` in
     * `shared/audio/sensitivity.ts`).
     */
    private const val LEVEL_DISPLAY_SCALE = 14.0f

    /**
     * Cursor position = detection threshold on the VU scale.
     * Low cursor (10%) => quiet sounds pass. High cursor (85%) => only loud sounds.
     * Meter level itself is never modified by this threshold.
     */
    private fun gateAtThreshold(samples: FloatArray, threshold: Float): FloatArray {
      val displayLevel = (computeRms(samples) * LEVEL_DISPLAY_SCALE).coerceIn(0f, 1f)
      val gate = threshold.coerceIn(SENSITIVITY_MIN, SENSITIVITY_MAX)
      if (displayLevel >= gate) {
        return samples
      }
      return FloatArray(samples.size)
    }

    private fun computeRms(samples: FloatArray): Float {
      if (samples.isEmpty()) {
        return 0f
      }
      var sumSquares = 0.0
      for (sample in samples) {
        sumSquares += sample * sample
      }
      return sqrt(sumSquares / samples.size).toFloat()
    }
  }
}
