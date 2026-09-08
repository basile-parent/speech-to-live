import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {SpeechRecognitionPort} from '../../domain/speech/SpeechRecognitionPort';
import {NativeSpeechRecognitionAdapter} from '../../infrastructure/speech/NativeSpeechRecognitionAdapter';
import type {
  FinalTranscriptSegment,
  TranscriptBlock,
} from '../../../shared/types';

type UseSpeechRecognitionResult = {
  isListening: boolean;
  partialTranscript: string;
  finalTranscript: string;
  finalSegments: FinalTranscriptSegment[];
  transcriptBlocks: TranscriptBlock[];
  audioLevel: number;
  error: string | null;
  speakerMode: boolean;
  setSpeakerMode: (enabled: boolean) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Starts a fresh view below history (does not delete past text). */
  insertViewBreak: () => void;
  clearTranscript: () => void;
};

type UseSpeechRecognitionOptions = {
  port?: SpeechRecognitionPort;
  language?: string;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const portRef = useRef<SpeechRecognitionPort>(
    options.port ?? new NativeSpeechRecognitionAdapter(),
  );
  const blockIdRef = useRef(0);
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcriptBlocks, setTranscriptBlocks] = useState<TranscriptBlock[]>(
    [],
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [speakerMode, setSpeakerModeState] = useState(false);

  const nextBlockId = useCallback((prefix: string) => {
    blockIdRef.current += 1;
    return `${prefix}-${blockIdRef.current}`;
  }, []);

  useEffect(() => {
    const port = portRef.current;
    const unsubscribe = port.subscribe(event => {
      switch (event.type) {
        case 'partial':
          setPartialTranscript(event.text);
          break;
        case 'final':
          setTranscriptBlocks(previous => [
            ...previous,
            {
              type: 'segment',
              id: nextBlockId('segment'),
              text: event.text,
              speakerLabel: event.speakerLabel ?? null,
            },
          ]);
          setPartialTranscript('');
          break;
        case 'audioLevel':
          setAudioLevel(event.level);
          break;
        case 'error':
          setError(event.message);
          setIsListening(false);
          setAudioLevel(0);
          break;
      }
    });

    return () => {
      unsubscribe();
      // Leaving the screen must release the native session even if JS state
      // already looks idle (e.g. navigating to settings mid-transcription).
      void port.stopListening().catch(() => undefined);
    };
  }, [nextBlockId]);

  useEffect(() => {
    if (!options.language) {
      return;
    }

    let cancelled = false;
    const language = options.language;

    void (async () => {
      try {
        // Avoid clobbering an active session; stop first if needed.
        if (await portRef.current.isListening()) {
          await portRef.current.stopListening();
          if (!cancelled) {
            setIsListening(false);
            setAudioLevel(0);
          }
        }
        if (cancelled) {
          return;
        }
        await portRef.current.setLanguage(language);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.language]);

  useEffect(() => {
    portRef.current
      .isSpeakerModeEnabled()
      .then(enabled => {
        setSpeakerModeState(enabled);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPartialTranscript('');
    setAudioLevel(0);
    // Recover from a desynced native session (e.g. UI stopped but native did not).
    if (await portRef.current.isListening()) {
      await portRef.current.stopListening();
    }
    await portRef.current.startListening();
    setIsListening(true);
  }, []);

  const stop = useCallback(async () => {
    try {
      await portRef.current.stopListening();
    } finally {
      setIsListening(false);
      setAudioLevel(0);
    }
  }, []);

  const setSpeakerMode = useCallback(async (enabled: boolean) => {
    setError(null);
    await portRef.current.setSpeakerMode(enabled);
    setSpeakerModeState(enabled);
  }, []);

  const insertViewBreak = useCallback(() => {
    setPartialTranscript('');
    setTranscriptBlocks(previous => [
      ...previous,
      {
        type: 'break',
        id: nextBlockId('break'),
      },
    ]);
  }, [nextBlockId]);

  const clearTranscript = useCallback(() => {
    setTranscriptBlocks([]);
    setPartialTranscript('');
  }, []);

  const finalSegments = useMemo(
    () =>
      transcriptBlocks
        .filter(
          (block): block is Extract<TranscriptBlock, {type: 'segment'}> =>
            block.type === 'segment',
        )
        .map(({text, speakerLabel}) => ({text, speakerLabel})),
    [transcriptBlocks],
  );

  const finalTranscript = useMemo(
    () =>
      finalSegments
        .map(segment =>
          segment.speakerLabel
            ? `${segment.speakerLabel}: ${segment.text}`
            : segment.text,
        )
        .join('\n'),
    [finalSegments],
  );

  return {
    isListening,
    partialTranscript,
    finalTranscript,
    finalSegments,
    transcriptBlocks,
    audioLevel,
    error,
    speakerMode,
    setSpeakerMode,
    start,
    stop,
    insertViewBreak,
    clearTranscript,
  };
}
