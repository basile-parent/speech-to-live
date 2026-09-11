package com.speechtolive.app.speech.model

import android.content.Context
import android.util.Log
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class ModelInstaller(
  private val context: Context,
) {
  private val executor = Executors.newSingleThreadExecutor()
  private val downloading = AtomicBoolean(false)

  fun isDownloading(): Boolean = downloading.get()

  fun downloadAsync(
    modelId: String,
    onProgress: (progress: Float, phase: String) -> Unit = { _, _ -> },
    onComplete: (Result<Unit>) -> Unit,
  ) {
    if (!downloading.compareAndSet(false, true)) {
      onComplete(Result.failure(IllegalStateException("Un téléchargement est déjà en cours")))
      return
    }

    executor.execute {
      try {
        downloadBlocking(modelId, onProgress)
        onProgress(1f, "done")
        onComplete(Result.success(Unit))
      } catch (error: Throwable) {
        Log.e(TAG, "download failed model=$modelId", error)
        onComplete(Result.failure(error))
      } finally {
        downloading.set(false)
      }
    }
  }

  private fun downloadBlocking(
    modelId: String,
    onProgress: (progress: Float, phase: String) -> Unit,
  ) {
    val model = ModelCatalog.requireModel(modelId)
    if (model.bundled) {
      return
    }
    if (ModelCatalog.isAvailable(context, model)) {
      return
    }

    val modelsRoot = ModelCatalog.modelsDir(context)
    modelsRoot.mkdirs()
    val archiveFile = File(modelsRoot, model.archiveFileName)
    val stagingDir = File(modelsRoot, ".staging-${model.id}")
    val targetDir = ModelCatalog.modelInstallDir(context, model)

    try {
      if (stagingDir.exists()) {
        stagingDir.deleteRecursively()
      }
      stagingDir.mkdirs()

      Log.i(TAG, "Downloading ${model.archiveUrl}")
      onProgress(0f, "download")
      downloadToFile(model.archiveUrl, archiveFile, model.sizeBytes, onProgress)
      Log.i(TAG, "Extracting ${archiveFile.name}")
      onProgress(0.9f, "extract")
      extractTarBz2(archiveFile, stagingDir)
      onProgress(0.96f, "install")

      val extractedRoot =
        findExtractedModelDir(stagingDir, model)
          ?: throw IllegalStateException("Archive extracted but model folder was not found")

      val installStaging = File(modelsRoot, ".install-${model.id}")
      if (installStaging.exists()) {
        installStaging.deleteRecursively()
      }
      installStaging.mkdirs()
      copyRequiredFiles(extractedRoot, installStaging, model)

      if (targetDir.exists()) {
        targetDir.deleteRecursively()
      }
      if (!installStaging.renameTo(targetDir)) {
        installStaging.copyRecursively(targetDir, overwrite = true)
        installStaging.deleteRecursively()
      }
      stagingDir.deleteRecursively()

      if (!ModelCatalog.isAvailable(context, model)) {
        throw IllegalStateException("Model files missing after install")
      }
      onProgress(1f, "done")
    } catch (error: Throwable) {
      targetDir.deleteRecursively()
      stagingDir.deleteRecursively()
      File(modelsRoot, ".install-${model.id}").deleteRecursively()
      throw error
    } finally {
      archiveFile.delete()
    }
  }

  private fun downloadToFile(
    urlString: String,
    destination: File,
    estimatedBytes: Long,
    onProgress: (progress: Float, phase: String) -> Unit,
  ) {
    destination.parentFile?.mkdirs()
    if (destination.exists()) {
      destination.delete()
    }

    var currentUrl = urlString
    var redirects = 0
    while (redirects < 8) {
      val connection = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 30_000
        readTimeout = 60_000
        requestMethod = "GET"
      }
      try {
        val code = connection.responseCode
        if (code in 300..399) {
          val location = connection.getHeaderField("Location")
            ?: throw IllegalStateException("Redirect without Location ($code)")
          currentUrl =
            if (location.startsWith("http")) {
              location
            } else {
              URL(URL(currentUrl), location).toString()
            }
          redirects++
          continue
        }
        if (code !in 200..299) {
          throw IllegalStateException("Download failed with HTTP $code")
        }

        val contentLength = connection.contentLengthLong.takeIf { it > 0 } ?: estimatedBytes
        connection.inputStream.use { input ->
          FileOutputStream(destination).use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER)
            var totalRead = 0L
            var lastEmittedProgress = -1
            while (true) {
              val read = input.read(buffer)
              if (read < 0) {
                break
              }
              output.write(buffer, 0, read)
              totalRead += read
              if (contentLength > 0) {
                // Reserve 0..0.9 for network download; install uses the rest.
                val ratio = (totalRead.toDouble() / contentLength.toDouble()).coerceIn(0.0, 1.0)
                val progress = (ratio * 0.9).toFloat()
                val percent = (progress * 100).toInt()
                if (percent != lastEmittedProgress) {
                  lastEmittedProgress = percent
                  onProgress(progress, "download")
                }
              }
            }
          }
        }
        onProgress(0.9f, "download")
        return
      } finally {
        connection.disconnect()
      }
    }
    throw IllegalStateException("Too many redirects while downloading model")
  }

  private fun extractTarBz2(archive: File, destination: File) {
    BufferedInputStream(archive.inputStream()).use { fileStream ->
      BZip2CompressorInputStream(fileStream).use { bzip ->
        TarArchiveInputStream(bzip).use { tar ->
          var entry: TarArchiveEntry? = tar.nextEntry
          while (entry != null) {
            val outFile = File(destination, entry.name)
            if (entry.isDirectory) {
              outFile.mkdirs()
            } else {
              outFile.parentFile?.mkdirs()
              FileOutputStream(outFile).use { output ->
                tar.copyTo(output, bufferSize = DEFAULT_BUFFER)
              }
            }
            entry = tar.nextEntry
          }
        }
      }
    }
  }

  private fun findExtractedModelDir(
    stagingDir: File,
    model: RecognitionModelInfo,
  ): File? {
    val direct = File(stagingDir, model.directoryName)
    if (direct.isDirectory) {
      return direct
    }
    return stagingDir
      .walkTopDown()
      .maxDepth(3)
      .firstOrNull { file ->
        file.isDirectory &&
          File(file, model.tokensFileName).isFile &&
          (
            File(file, model.encoderFileName).isFile ||
              file.list()?.any { it.startsWith("encoder") && it.endsWith(".onnx") } == true
            )
      }
  }

  private fun copyRequiredFiles(
    extractedRoot: File,
    targetDir: File,
    model: RecognitionModelInfo,
  ) {
    targetDir.mkdirs()
    val roles =
      listOf(
        Triple("encoder", model.encoderFileName, true),
        Triple("decoder", model.decoderFileName, true),
        Triple("joiner", model.joinerFileName, true),
        Triple("tokens", model.tokensFileName, false),
      )

    for ((role, expectedName, isOnnx) in roles) {
      val source =
        resolveModelFile(extractedRoot, expectedName)
          ?: if (isOnnx) {
            resolveModelFileByRole(extractedRoot, role)
          } else {
            resolveModelFileByRole(extractedRoot, "tokens")
          }
          ?: throw IllegalStateException("Missing expected model file: $expectedName")
      source.copyTo(File(targetDir, expectedName), overwrite = true)
      Log.i(TAG, "Installed $role <- ${source.name} as $expectedName")
    }
  }

  private fun resolveModelFileByRole(root: File, role: String): File? {
    if (role == "tokens") {
      return root.walkTopDown().firstOrNull { it.isFile && it.name == "tokens.txt" }
    }
    val onnxFiles =
      root
        .walkTopDown()
        .filter { it.isFile && it.name.startsWith(role) && it.name.endsWith(".onnx") }
        .toList()
    if (onnxFiles.isEmpty()) {
      return null
    }
    return onnxFiles.firstOrNull { it.name.contains("int8", ignoreCase = true) }
      ?: onnxFiles.first()
  }

  private fun resolveModelFile(root: File, fileName: String): File? {
    val exact = File(root, fileName)
    if (exact.isFile) {
      return exact
    }
    return root
      .walkTopDown()
      .firstOrNull { it.isFile && it.name == fileName }
  }

  companion object {
    private const val TAG = "SpeechToLive"
    private const val DEFAULT_BUFFER = 64 * 1024
  }
}
