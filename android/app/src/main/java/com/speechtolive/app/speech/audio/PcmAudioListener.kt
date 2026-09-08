package com.speechtolive.app.speech.audio

fun interface PcmAudioListener {
  fun onPcmFrame(samples: FloatArray, sampleRate: Int)
}
