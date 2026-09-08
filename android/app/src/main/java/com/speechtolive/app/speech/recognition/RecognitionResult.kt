package com.speechtolive.app.speech.recognition

sealed class RecognitionResult {
  data class Partial(val text: String) : RecognitionResult()

  data class Final(val text: String) : RecognitionResult()
}

fun interface RecognitionResultListener {
  fun onRecognitionResult(result: RecognitionResult)
}
