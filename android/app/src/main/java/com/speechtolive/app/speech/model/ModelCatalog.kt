package com.speechtolive.app.speech.model

data class ModelDescriptor(
  val directory: String,
  val encoderFileName: String,
  val decoderFileName: String,
  val joinerFileName: String,
  val tokensFileName: String = "tokens.txt",
) {
  val encoderPath: String get() = "$directory/$encoderFileName"
  val decoderPath: String get() = "$directory/$decoderFileName"
  val joinerPath: String get() = "$directory/$joinerFileName"
  val tokensPath: String get() = "$directory/$tokensFileName"
}

object ModelCatalog {
  const val DEFAULT_LANGUAGE = "fr"

  private val languageModels =
    mapOf(
      "fr" to
        ModelDescriptor(
          directory = "sherpa-onnx-streaming-zipformer-fr-2023-04-14",
          encoderFileName = "encoder-epoch-29-avg-9-with-averaged-model.int8.onnx",
          decoderFileName = "decoder-epoch-29-avg-9-with-averaged-model.onnx",
          joinerFileName = "joiner-epoch-29-avg-9-with-averaged-model.onnx",
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
