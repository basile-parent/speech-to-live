package com.speechtolive.app.speech.recognition

import com.speechtolive.app.speech.model.ModelDescriptor

interface SpeechRecognitionEngine {
  fun loadModel(model: ModelDescriptor)

  fun start()

  fun acceptWaveform(samples: FloatArray, sampleRate: Int)

  fun stop()

  fun release()

  fun isRunning(): Boolean
}
