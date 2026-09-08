package com.speechtolive.app.speech.audio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class AudioRecorder(
  private val context: ReactApplicationContext,
  override val sampleRate: Int = DEFAULT_SAMPLE_RATE,
  private val frameDurationSeconds: Double = DEFAULT_FRAME_DURATION_SECONDS,
) : PcmAudioSource {
  private val running = AtomicBoolean(false)
  private var audioRecord: AudioRecord? = null
  private var captureThread: Thread? = null
  private var errorListener: ((Throwable) -> Unit)? = null

  fun setErrorListener(listener: ((Throwable) -> Unit)?) {
    errorListener = listener
  }

  override fun start(listener: PcmAudioListener) {
    if (!running.compareAndSet(false, true)) {
      throw IllegalStateException("AudioRecorder is already running")
    }

    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
        PackageManager.PERMISSION_GRANTED
    ) {
      running.set(false)
      throw SecurityException("RECORD_AUDIO permission is not granted")
    }

    val minBufferSize =
      AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT)
    if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
      running.set(false)
      throw IllegalStateException("Unable to determine AudioRecord buffer size")
    }

    val record =
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        CHANNEL_CONFIG,
        AUDIO_FORMAT,
        minBufferSize * 2,
      )

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      running.set(false)
      throw IllegalStateException("AudioRecord failed to initialize")
    }

    audioRecord = record
    record.startRecording()

    val frameSize = (frameDurationSeconds * sampleRate).toInt().coerceAtLeast(1)
    captureThread =
      thread(start = true, name = "SpeechToLive-AudioRecorder", isDaemon = true) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        val shortBuffer = ShortArray(frameSize)

        try {
          while (running.get()) {
            val read = record.read(shortBuffer, 0, shortBuffer.size)
            if (read > 0) {
              val samples = FloatArray(read) { index -> shortBuffer[index] / PCM_NORMALIZE }
              listener.onPcmFrame(samples, sampleRate)
            } else if (read < 0) {
              throw IllegalStateException("AudioRecord.read failed with code $read")
            }
          }
        } catch (error: Throwable) {
          running.set(false)
          errorListener?.invoke(error)
        }
      }
  }

  override fun stop() {
    if (!running.compareAndSet(true, false)) {
      return
    }

    captureThread?.join(JOIN_TIMEOUT_MS)
    captureThread = null

    audioRecord?.run {
      try {
        stop()
      } finally {
        release()
      }
    }
    audioRecord = null
  }

  override fun isRunning(): Boolean = running.get()

  override fun release() {
    stop()
  }

  companion object {
    const val DEFAULT_SAMPLE_RATE = 16_000
    private const val DEFAULT_FRAME_DURATION_SECONDS = 0.1
    private const val JOIN_TIMEOUT_MS = 1_000L
    private const val PCM_NORMALIZE = 32768.0f
    private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
  }
}
