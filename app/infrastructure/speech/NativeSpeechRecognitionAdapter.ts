import {DeviceEventEmitter} from 'react-native';
import type {TranscriptEvent} from '../../../shared/types';
import type {
  SpeechRecognitionPort,
  TranscriptListener,
} from '../../domain/speech/SpeechRecognitionPort';
import NativeSpeechRecognition from '../../../specs/NativeSpeechRecognition';

const EVENT_NAME = 'SpeechRecognitionTranscript';

type NativeTranscriptPayload = {
  type: 'partial' | 'final' | 'audioLevel' | 'error';
  text?: string;
  message?: string;
  level?: number;
};

function toTranscriptEvent(payload: NativeTranscriptPayload): TranscriptEvent {
  switch (payload.type) {
    case 'partial':
      return {type: 'partial', text: payload.text ?? ''};
    case 'final':
      return {type: 'final', text: payload.text ?? ''};
    case 'audioLevel':
      return {type: 'audioLevel', level: payload.level ?? 0};
    case 'error':
      return {type: 'error', message: payload.message ?? 'Unknown native error'};
    default: {
      const exhaustive: never = payload.type;
      throw new Error(`Unsupported transcript event: ${exhaustive}`);
    }
  }
}

export class NativeSpeechRecognitionAdapter implements SpeechRecognitionPort {
  startListening(): Promise<void> {
    return NativeSpeechRecognition.startListening();
  }

  stopListening(): Promise<void> {
    return NativeSpeechRecognition.stopListening();
  }

  isListening(): Promise<boolean> {
    return NativeSpeechRecognition.isListening();
  }

  setLanguage(language: string): Promise<void> {
    return NativeSpeechRecognition.setLanguage(language);
  }

  setModel(path: string): Promise<void> {
    return NativeSpeechRecognition.setModel(path);
  }

  subscribe(listener: TranscriptListener): () => void {
    const subscription = DeviceEventEmitter.addListener(
      EVENT_NAME,
      (payload: NativeTranscriptPayload) => {
        listener(toTranscriptEvent(payload));
      },
    );

    return () => {
      subscription.remove();
    };
  }
}
