package com.speechtolive.app.speech

import android.content.Context
import android.util.Log
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.speechtolive.app.NativeSpeechRecognitionSpec
import com.speechtolive.app.speech.audio.AudioRecorder
import com.speechtolive.app.speech.recognition.RecognitionResult
import com.speechtolive.app.speech.recognition.SpeechRecognizer
import com.speechtolive.app.speech.session.SpeechSession
import com.speechtolive.app.speech.speaker.SpeakerTracker
import kotlin.math.ceil

class NativeSpeechRecognitionModule(
  reactContext: ReactApplicationContext,
) : NativeSpeechRecognitionSpec(reactContext) {
  private val sessionLock = Any()
  private var session: SpeechSession? = null
  private var speakerTracker: SpeakerTracker? = null

  override fun getName(): String = NAME

  override fun startListening(promise: Promise) {
    try {
      synchronized(sessionLock) {
        val activeSession = ensureSession()
        activeSession.startListening()
      }
      Log.i(TAG, "startListening ok")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "startListening failed", error)
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun stopListening(promise: Promise) {
    try {
      synchronized(sessionLock) {
        session?.stopListening()
      }
      Log.i(TAG, "stopListening ok")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "stopListening failed", error)
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun isListening(promise: Promise) {
    try {
      val listening = synchronized(sessionLock) { session?.isListening() == true }
      promise.resolve(listening)
    } catch (error: Throwable) {
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun setLanguage(language: String, promise: Promise) {
    try {
      synchronized(sessionLock) {
        ensureSession().setLanguage(language)
      }
      Log.i(TAG, "setLanguage ok language=$language")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "setLanguage failed", error)
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun setModel(path: String, promise: Promise) {
    try {
      synchronized(sessionLock) {
        ensureSession().setModel(path)
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun setSpeakerMode(enabled: Boolean, promise: Promise) {
    try {
      synchronized(sessionLock) {
        ensureSession().setSpeakerMode(enabled)
        persistSpeakerMode(enabled)
      }
      Log.i(TAG, "setSpeakerMode ok enabled=$enabled")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "setSpeakerMode failed", error)
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun isSpeakerModeEnabled(promise: Promise) {
    try {
      val enabled =
        synchronized(sessionLock) {
          session?.isSpeakerModeEnabled() ?: readPersistedSpeakerMode()
        }
      promise.resolve(enabled)
    } catch (error: Throwable) {
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun setAudioSensitivity(sensitivity: Double, promise: Promise) {
    try {
      val clamped = sensitivity.toFloat().coerceIn(0f, 1f)
      synchronized(sessionLock) {
        ensureSession().setAudioSensitivity(clamped)
        persistAudioSensitivity(clamped)
      }
      Log.i(TAG, "setAudioSensitivity ok sensitivity=$clamped")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "setAudioSensitivity failed", error)
      emitError(error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun getAudioSensitivity(promise: Promise) {
    try {
      val sensitivity =
        synchronized(sessionLock) {
          session?.getAudioSensitivity() ?: readPersistedAudioSensitivity()
        }
      promise.resolve(sensitivity.toDouble())
    } catch (error: Throwable) {
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun getSystemInsets(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        promise.resolve(readSystemInsetsDp())
      } catch (error: Throwable) {
        promise.reject(ERROR_CODE, error.message, error)
      }
    }
  }

  override fun setDarkMode(enabled: Boolean, promise: Promise) {
    try {
      persistDarkMode(enabled)
      Log.i(TAG, "setDarkMode ok enabled=$enabled")
      promise.resolve(null)
    } catch (error: Throwable) {
      Log.e(TAG, "setDarkMode failed", error)
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun isDarkModeEnabled(promise: Promise) {
    try {
      promise.resolve(readPersistedDarkMode())
    } catch (error: Throwable) {
      promise.reject(ERROR_CODE, error.message, error)
    }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  override fun invalidate() {
    synchronized(sessionLock) {
      session?.release()
      session = null
      speakerTracker = null
    }
    super.invalidate()
  }

  private fun ensureSession(): SpeechSession {
    session?.let {
      return it
    }

    val tracker =
      SpeakerTracker(assetManager = reactApplicationContext.assets).also {
        it.setEnabled(readPersistedSpeakerMode())
        speakerTracker = it
      }

    val recognizer =
      SpeechRecognizer(
        assetManager = reactApplicationContext.assets,
        resultListener = { result ->
          Log.i(TAG, "recognition result=$result")
          emitResult(result)
        },
        speakerTracker = tracker,
      )

    val created =
      SpeechSession(
        audioSource = AudioRecorder(reactApplicationContext),
        recognitionEngine = recognizer,
        onError = { error ->
          Log.e(TAG, "session error", error)
          emitError(error)
        },
        onAudioLevel = { level -> emitAudioLevel(level) },
        speakerTracker = tracker,
      ).also {
        it.setAudioSensitivity(readPersistedAudioSensitivity())
      }
    session = created
    return created
  }

  private fun emitResult(result: RecognitionResult) {
    val payload =
      when (result) {
        is RecognitionResult.Partial ->
          Arguments.createMap().apply {
            putString("type", "partial")
            putString("text", result.text)
          }
        is RecognitionResult.Final ->
          Arguments.createMap().apply {
            putString("type", "final")
            putString("text", result.text)
            result.speakerLabel?.let { putString("speakerLabel", it) }
          }
      }
    sendEvent(payload)
  }

  private fun emitAudioLevel(level: Float) {
    val payload =
      Arguments.createMap().apply {
        putString("type", "audioLevel")
        putDouble("level", level.toDouble())
      }
    sendEvent(payload)
  }

  private fun emitError(error: Throwable) {
    val payload =
      Arguments.createMap().apply {
        putString("type", "error")
        putString("message", error.message ?: error.javaClass.simpleName)
      }
    sendEvent(payload)
  }

  private fun sendEvent(payload: WritableMap) {
    val emit = {
      if (reactApplicationContext.hasActiveReactInstance()) {
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, payload)
      }
    }

    if (reactApplicationContext.isOnJSQueueThread) {
      emit()
    } else {
      reactApplicationContext.runOnJSQueueThread(emit)
    }
  }

  private fun preferences() =
    reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun readPersistedSpeakerMode(): Boolean =
    preferences().getBoolean(PREF_SPEAKER_MODE, false)

  private fun persistSpeakerMode(enabled: Boolean) {
    preferences().edit().putBoolean(PREF_SPEAKER_MODE, enabled).apply()
  }

  private fun readPersistedAudioSensitivity(): Float =
    preferences()
      .getFloat(PREF_AUDIO_SENSITIVITY, SpeechSession.DEFAULT_AUDIO_SENSITIVITY)
      .coerceIn(0f, 1f)

  private fun persistAudioSensitivity(sensitivity: Float) {
    preferences().edit().putFloat(PREF_AUDIO_SENSITIVITY, sensitivity).apply()
  }

  private fun readPersistedDarkMode(): Boolean =
    preferences().getBoolean(PREF_DARK_MODE, DEFAULT_DARK_MODE)

  private fun persistDarkMode(enabled: Boolean) {
    preferences().edit().putBoolean(PREF_DARK_MODE, enabled).apply()
  }

  private fun readSystemInsetsDp(): WritableMap {
    val density = reactApplicationContext.resources.displayMetrics.density.coerceAtLeast(0.1f)
    fun pxToDp(px: Int): Double = ceil(px / density).toDouble()

    val activity = reactApplicationContext.currentActivity
    val root: View? = activity?.window?.decorView ?: activity?.findViewById(android.R.id.content)
    if (root != null) {
      val insets = ViewCompat.getRootWindowInsets(root)
      val nav = insets?.getInsets(WindowInsetsCompat.Type.navigationBars())
      if (nav != null && (nav.left > 0 || nav.right > 0 || nav.top > 0 || nav.bottom > 0)) {
        return Arguments.createMap().apply {
          putDouble("left", pxToDp(nav.left))
          putDouble("right", pxToDp(nav.right))
          putDouble("top", pxToDp(nav.top))
          putDouble("bottom", pxToDp(nav.bottom))
        }
      }
    }

    // Fallback when insets are not ready yet (common just after launch).
    val resourceId =
      reactApplicationContext.resources.getIdentifier(
        "navigation_bar_height",
        "dimen",
        "android",
      )
    val fallbackDp =
      if (resourceId > 0) {
        pxToDp(reactApplicationContext.resources.getDimensionPixelSize(resourceId))
      } else {
        0.0
      }
    val landscape =
      reactApplicationContext.resources.configuration.orientation ==
        android.content.res.Configuration.ORIENTATION_LANDSCAPE

    return Arguments.createMap().apply {
      putDouble("left", 0.0)
      putDouble("right", if (landscape) fallbackDp else 0.0)
      putDouble("top", 0.0)
      putDouble("bottom", if (landscape) 0.0 else fallbackDp)
    }
  }

  companion object {
    const val NAME = "NativeSpeechRecognition"
    const val EVENT_NAME = "SpeechRecognitionTranscript"
    private const val TAG = "SpeechToLive"
    private const val ERROR_CODE = "SPEECH_RECOGNITION_ERROR"
    private const val PREFS_NAME = "speech_to_live_settings"
    private const val PREF_SPEAKER_MODE = "speaker_mode"
    private const val PREF_AUDIO_SENSITIVITY = "audio_sensitivity"
    private const val PREF_DARK_MODE = "dark_mode"
    private const val DEFAULT_DARK_MODE = true
  }
}
