package com.speechtolive.app.speech.speaker

import android.content.res.AssetManager
import android.util.Log
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractor
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractorConfig
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingManager
import com.speechtolive.app.speech.model.ModelCatalog
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Anonymous online speaker clustering for finalized utterances.
 * Assigns labels like "Locuteur 1", "Locuteur 2" via embedding search.
 */
class SpeakerTracker(
  private val assetManager: AssetManager,
  private val modelAssetPath: String = ModelCatalog.SPEAKER_EMBEDDING_ASSET,
  private val threshold: Float = DEFAULT_THRESHOLD,
  private val numThreads: Int = DEFAULT_NUM_THREADS,
) {
  private val enabled = AtomicBoolean(false)
  private var extractor: SpeakerEmbeddingExtractor? = null
  private var manager: SpeakerEmbeddingManager? = null

  fun setEnabled(value: Boolean) {
    enabled.set(value)
  }

  fun isEnabled(): Boolean = enabled.get()

  @Synchronized
  fun ensureLoaded() {
    if (extractor != null && manager != null) {
      return
    }

    requireAsset(modelAssetPath)
    Log.i(TAG, "Loading speaker embedding model=$modelAssetPath")
    val createdExtractor =
      SpeakerEmbeddingExtractor(
        assetManager = assetManager,
        config =
          SpeakerEmbeddingExtractorConfig(
            model = modelAssetPath,
            numThreads = numThreads,
            debug = false,
            provider = "cpu",
          ),
      )
    extractor = createdExtractor
    manager = SpeakerEmbeddingManager(dim = createdExtractor.dim())
  }

  @Synchronized
  fun resetSession() {
    val activeExtractor = extractor ?: return
    manager?.release()
    manager = SpeakerEmbeddingManager(dim = activeExtractor.dim())
  }

  @Synchronized
  fun identify(samples: FloatArray, sampleRate: Int): String? {
    if (!enabled.get()) {
      return null
    }
    if (samples.size < MIN_SAMPLES) {
      return null
    }

    ensureLoaded()
    val activeExtractor =
      extractor ?: throw IllegalStateException("Speaker embedding extractor is not loaded")
    val activeManager =
      manager ?: throw IllegalStateException("Speaker embedding manager is not loaded")

    val stream = activeExtractor.createStream()
    try {
      stream.acceptWaveform(samples, sampleRate = sampleRate)
      stream.inputFinished()
      if (!activeExtractor.isReady(stream)) {
        return null
      }
      val embedding = activeExtractor.compute(stream)
      val matched = activeManager.search(embedding, threshold).trim()
      if (matched.isNotEmpty()) {
        return matched
      }

      val label = "Locuteur ${activeManager.numSpeakers() + 1}"
      activeManager.add(label, embedding)
      return label
    } finally {
      stream.release()
    }
  }

  @Synchronized
  fun release() {
    manager?.release()
    extractor?.release()
    manager = null
    extractor = null
  }

  private fun requireAsset(path: String) {
    val dir = path.substringBeforeLast('/', missingDelimiterValue = "")
    val fileName = path.substringAfterLast('/')
    val entries = assetManager.list(dir) ?: emptyArray()
    if (!entries.contains(fileName)) {
      throw IllegalArgumentException("Missing speaker embedding asset: $path")
    }
  }

  companion object {
    private const val TAG = "SpeechToLive"
    private const val DEFAULT_THRESHOLD = 0.55f
    private const val DEFAULT_NUM_THREADS = 2
    /** ~0.4 s at 16 kHz — below this, embeddings are unreliable. */
    private const val MIN_SAMPLES = 6_400
  }
}
