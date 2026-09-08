package com.speechtolive.app.speech.model

data class ModelDescriptor(
  val directory: String,
  val encoderFileName: String,
  val decoderFileName: String,
  val joinerFileName: String,
  val tokensFileName: String = "tokens.txt",
  val modelType: String = "zipformer",
) {
  val encoderPath: String get() = "$directory/$encoderFileName"
  val decoderPath: String get() = "$directory/$decoderFileName"
  val joinerPath: String get() = "$directory/$joinerFileName"
  val tokensPath: String get() = "$directory/$tokensFileName"
}

object ModelCatalog {
  const val DEFAULT_LANGUAGE = "fr"
  const val SPEAKER_EMBEDDING_ASSET =
    "speaker-embedding/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"

  private val languageModels =
    mapOf(
      "fr" to
        ModelDescriptor(
          directory = "sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06",
          encoderFileName = "encoder.onnx",
          decoderFileName = "decoder.onnx",
          joinerFileName = "joiner.onnx",
          modelType = "zipformer2",
        ),
    )

  fun requireLanguage(language: String): ModelDescriptor {
    val normalized = language.trim().lowercase()
    return languageModels[normalized]
      ?: throw IllegalArgumentException(
        "Unsupported language '$language'. Supported: ${languageModels.keys.joinToString()}",
      )
  }
}
