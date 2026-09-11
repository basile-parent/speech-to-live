import {DeviceEventEmitter} from 'react-native';
import type {TranscriptEvent} from '../../../shared/types';
import type {
  SpeechRecognitionPort,
  TranscriptListener,
} from '../../domain/speech/SpeechRecognitionPort';
import NativeSpeechRecognition from '../../../specs/NativeSpeechRecognition';

const EVENT_NAME = 'SpeechRecognitionTranscript';
const DOWNLOAD_EVENT_NAME = 'SpeechRecognitionModelDownload';

type NativeTranscriptPayload = {
  type: 'partial' | 'final' | 'audioLevel' | 'error';
  text?: string;
  speakerLabel?: string | null;
  message?: string;
  level?: number;
};

function toTranscriptEvent(payload: NativeTranscriptPayload): TranscriptEvent {
  switch (payload.type) {
    case 'partial':
      return {type: 'partial', text: payload.text ?? ''};
    case 'final':
      return {
        type: 'final',
        text: payload.text ?? '',
        speakerLabel: payload.speakerLabel ?? null,
      };
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

  setSpeakerMode(enabled: boolean): Promise<void> {
    return NativeSpeechRecognition.setSpeakerMode(enabled);
  }

  isSpeakerModeEnabled(): Promise<boolean> {
    return NativeSpeechRecognition.isSpeakerModeEnabled();
  }

  setAudioSensitivity(sensitivity: number): Promise<void> {
    return NativeSpeechRecognition.setAudioSensitivity(sensitivity);
  }

  getAudioSensitivity(): Promise<number> {
    return NativeSpeechRecognition.getAudioSensitivity();
  }

  async getSystemInsets() {
    const insets = await NativeSpeechRecognition.getSystemInsets();
    return {
      left: Number(insets.left) || 0,
      right: Number(insets.right) || 0,
      top: Number(insets.top) || 0,
      bottom: Number(insets.bottom) || 0,
    };
  }

  setDarkMode(enabled: boolean): Promise<void> {
    return NativeSpeechRecognition.setDarkMode(enabled);
  }

  isDarkModeEnabled(): Promise<boolean> {
    return NativeSpeechRecognition.isDarkModeEnabled();
  }

  getRecognitionModels() {
    return NativeSpeechRecognition.getRecognitionModels();
  }

  setRecognitionModel(id: string): Promise<void> {
    return NativeSpeechRecognition.setRecognitionModel(id);
  }

  downloadRecognitionModel(id: string): Promise<void> {
    return NativeSpeechRecognition.downloadRecognitionModel(id);
  }

  deleteRecognitionModel(id: string): Promise<void> {
    return NativeSpeechRecognition.deleteRecognitionModel(id);
  }

  subscribeModelDownload(
    listener: (event: {
      modelId: string;
      progress: number;
      phase: string;
    }) => void,
  ): () => void {
    const subscription = DeviceEventEmitter.addListener(
      DOWNLOAD_EVENT_NAME,
      (payload: {modelId?: string; progress?: number; phase?: string}) => {
        listener({
          modelId: payload.modelId ?? '',
          progress: Math.min(1, Math.max(0, Number(payload.progress) || 0)),
          phase: payload.phase ?? 'download',
        });
      },
    );
    return () => {
      subscription.remove();
    };
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
