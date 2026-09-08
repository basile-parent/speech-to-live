package com.speechtolive.app.speech.audio

interface PcmAudioSource {
  val sampleRate: Int

  fun start(listener: PcmAudioListener)

  fun stop()

  fun isRunning(): Boolean

  fun release()
}
