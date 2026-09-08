import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {SpeechRecognitionPort} from '../../domain/speech/SpeechRecognitionPort';
import {NativeSpeechRecognitionAdapter} from '../../infrastructure/speech/NativeSpeechRecognitionAdapter';
import type {FinalTranscriptSegment} from '../../../shared/types';

type UseSpeechRecognitionResult = {
  isListening: boolean;
  partialTranscript: string;
  finalTranscript: string;
  finalSegments: FinalTranscriptSegment[];
  audioLevel: number;
  error: string | null;
  speakerMode: boolean;
  setSpeakerMode: (enabled: boolean) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalSegments, setFinalSegments] = useState<FinalTranscriptSegment[]>(
    [],
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [speakerMode, setSpeakerModeState] = useState(false);

  useEffect(() => {
    const port = portRef.current;
    const unsubscribe = port.subscribe(event => {
      switch (event.type) {
        case 'partial':
          setPartialTranscript(event.text);
          break;
        case 'final':
          setFinalSegments(previous => [
            ...previous,
            {
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

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!options.language) {
      return;
    }

    portRef.current.setLanguage(options.language).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
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
    await portRef.current.startListening();
    setIsListening(true);
  }, []);

  const stop = useCallback(async () => {
    await portRef.current.stopListening();
    setIsListening(false);
    setAudioLevel(0);
  }, []);

  const setSpeakerMode = useCallback(async (enabled: boolean) => {
    setError(null);
    await portRef.current.setSpeakerMode(enabled);
    setSpeakerModeState(enabled);
  }, []);

  const clearTranscript = useCallback(() => {
    setFinalSegments([]);
    setPartialTranscript('');
  }, []);

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
    audioLevel,
    error,
    speakerMode,
    setSpeakerMode,
    start,
    stop,
    clearTranscript,
  };
}
