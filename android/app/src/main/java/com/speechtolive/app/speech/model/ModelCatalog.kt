package com.speechtolive.app.speech.model

import android.content.Context
import android.content.res.AssetManager
import java.io.File

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

data class RecognitionModelInfo(
  val id: String,
  val title: String,
  /** Short pros/cons for transcription quality UX. */
  val description: String,
  val archiveFileName: String,
  val archiveUrl: String,
  /** Approximate download size in bytes (for confirmation UI). */
  val sizeBytes: Long,
  val bundled: Boolean,
  val directoryName: String,
  val encoderFileName: String,
  val decoderFileName: String,
  val joinerFileName: String,
  val tokensFileName: String = "tokens.txt",
  val modelType: String = "zipformer",
)

object ModelCatalog {
  const val DEFAULT_LANGUAGE = "fr"
  const val DEFAULT_MODEL_ID = "fr-kroko"
  const val SPEAKER_EMBEDDING_ASSET =
    "speaker-embedding/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"

  private const val RELEASE_BASE =
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

  val models: List<RecognitionModelInfo> =
    listOf(
      RecognitionModelInfo(
        id = "fr-kroko",
        title = "Français Kroko (défaut)",
        description =
          "+ Léger et réactif en direct. − Moins à l’aise sur bruit fort ou diction très soutenue.",
        archiveFileName = "sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06.tar.bz2",
        archiveUrl =
          "$RELEASE_BASE/sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06.tar.bz2",
        sizeBytes = 57_200_000L,
        bundled = true,
        directoryName = "sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06",
        encoderFileName = "encoder.onnx",
        decoderFileName = "decoder.onnx",
        joinerFileName = "joiner.onnx",
        modelType = "zipformer2",
      ),
      RecognitionModelInfo(
        id = "fr-zipformer-2023",
        title = "Français Zipformer 2023",
        description =
          "+ Souvent plus précis / vocabulaire plus large. − Très lourd et plus lent sur mobile.",
        archiveFileName = "sherpa-onnx-streaming-zipformer-fr-2023-04-14.tar.bz2",
        archiveUrl =
          "$RELEASE_BASE/sherpa-onnx-streaming-zipformer-fr-2023-04-14.tar.bz2",
        sizeBytes = 398_000_000L,
        bundled = false,
        directoryName = "sherpa-onnx-streaming-zipformer-fr-2023-04-14",
        encoderFileName = "encoder-epoch-29-avg-9-with-averaged-model.onnx",
        decoderFileName = "decoder-epoch-29-avg-9-with-averaged-model.onnx",
        joinerFileName = "joiner-epoch-29-avg-9-with-averaged-model.onnx",
        modelType = "zipformer",
      ),
      RecognitionModelInfo(
        id = "fr-zipformer-2023-mobile",
        title = "Français Zipformer Mobile",
        description =
          "+ Meilleur compromis précision / usage mobile que le Zipformer complet. − Encore volumineux à télécharger.",
        archiveFileName = "sherpa-onnx-streaming-zipformer-fr-2023-04-14-mobile.tar.bz2",
        archiveUrl =
          "$RELEASE_BASE/sherpa-onnx-streaming-zipformer-fr-2023-04-14-mobile.tar.bz2",
        sizeBytes = 367_000_000L,
        bundled = false,
        directoryName = "sherpa-onnx-streaming-zipformer-fr-2023-04-14-mobile",
        // Mobile package often ships int8 encoder + fp32 decoder/joiner with the same epoch names.
        encoderFileName = "encoder-epoch-29-avg-9-with-averaged-model.int8.onnx",
        decoderFileName = "decoder-epoch-29-avg-9-with-averaged-model.onnx",
        joinerFileName = "joiner-epoch-29-avg-9-with-averaged-model.onnx",
        modelType = "zipformer",
      ),
    )

  fun requireModel(id: String): RecognitionModelInfo =
    models.firstOrNull { it.id == id }
      ?: throw IllegalArgumentException(
        "Unknown model '$id'. Supported: ${models.joinToString { it.id }}",
      )

  fun requireLanguage(language: String): ModelDescriptor {
    val normalized = language.trim().lowercase()
    if (normalized != DEFAULT_LANGUAGE) {
      throw IllegalArgumentException(
        "Unsupported language '$language'. Supported: $DEFAULT_LANGUAGE",
      )
    }
    return toDescriptor(requireModel(DEFAULT_MODEL_ID), bundledRoot = true, filesDir = null)
  }

  fun modelsDir(context: Context): File = File(context.filesDir, "recognition-models")

  fun modelInstallDir(context: Context, model: RecognitionModelInfo): File =
    File(modelsDir(context), model.id)

  fun isAvailable(context: Context, model: RecognitionModelInfo): Boolean {
    if (model.bundled) {
      return isBundledPresent(context.assets, model)
    }
    return isInstalledOnDisk(modelInstallDir(context, model), model)
  }

  fun deleteInstalled(context: Context, modelId: String) {
    val model = requireModel(modelId)
    if (model.bundled) {
      throw IllegalStateException("Cannot delete the default bundled model")
    }
    val installDir = modelInstallDir(context, model)
    if (installDir.exists()) {
      installDir.deleteRecursively()
    }
    // Clean leftover archives / staging for this model.
    val archive = File(modelsDir(context), model.archiveFileName)
    if (archive.exists()) {
      archive.delete()
    }
    File(modelsDir(context), ".staging-${model.id}").deleteRecursively()
    File(modelsDir(context), ".install-${model.id}").deleteRecursively()
  }

  fun resolveDescriptor(context: Context, modelId: String): ModelDescriptor {
    val model = requireModel(modelId)
    if (model.bundled && isBundledPresent(context.assets, model)) {
      return toDescriptor(model, bundledRoot = true, filesDir = null)
    }
    val installDir = modelInstallDir(context, model)
    if (!isInstalledOnDisk(installDir, model)) {
      throw IllegalStateException("Model '${model.id}' is not downloaded")
    }
    return toDescriptor(model, bundledRoot = false, filesDir = installDir)
  }

  private fun toDescriptor(
    model: RecognitionModelInfo,
    bundledRoot: Boolean,
    filesDir: File?,
  ): ModelDescriptor {
    val directory =
      if (bundledRoot) {
        model.directoryName
      } else {
        requireNotNull(filesDir).absolutePath
      }
    return ModelDescriptor(
      directory = directory,
      encoderFileName = model.encoderFileName,
      decoderFileName = model.decoderFileName,
      joinerFileName = model.joinerFileName,
      tokensFileName = model.tokensFileName,
      modelType = model.modelType,
    )
  }

  private fun isBundledPresent(assets: AssetManager, model: RecognitionModelInfo): Boolean {
    val entries = assets.list(model.directoryName) ?: return false
    val required =
      setOf(
        model.encoderFileName,
        model.decoderFileName,
        model.joinerFileName,
        model.tokensFileName,
      )
    return required.all { it in entries }
  }

  private fun isInstalledOnDisk(dir: File, model: RecognitionModelInfo): Boolean {
    if (!dir.isDirectory) {
      return false
    }
    return listOf(
        model.encoderFileName,
        model.decoderFileName,
        model.joinerFileName,
        model.tokensFileName,
      )
      .all { File(dir, it).isFile }
  }
}
