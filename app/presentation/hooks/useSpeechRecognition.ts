import {useCallback, useEffect, useRef, useState} from 'react';
import type {SpeechRecognitionPort} from '../../domain/speech/SpeechRecognitionPort';
import {NativeSpeechRecognitionAdapter} from '../../infrastructure/speech/NativeSpeechRecognitionAdapter';

type UseSpeechRecognitionResult = {
  isListening: boolean;
  partialTranscript: string;
  finalTranscript: string;
  audioLevel: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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
  const [finalTranscript, setFinalTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const port = portRef.current;
    const unsubscribe = port.subscribe(event => {
      switch (event.type) {
        case 'partial':
          setPartialTranscript(event.text);
          break;
        case 'final':
          setFinalTranscript(previous =>
            previous.length === 0 ? event.text : `${previous}\n${event.text}`,
          );
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

  return {
    isListening,
    partialTranscript,
    finalTranscript,
    audioLevel,
    error,
    start,
    stop,
  };
}
