import type {
  RecognitionModelInfo,
  SystemInsets,
  TranscriptEvent,
} from '../../../shared/types';

export type TranscriptListener = (event: TranscriptEvent) => void;

export interface SpeechRecognitionPort {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): Promise<boolean>;
  setLanguage(language: string): Promise<void>;
  setModel(path: string): Promise<void>;
  setSpeakerMode(enabled: boolean): Promise<void>;
  isSpeakerModeEnabled(): Promise<boolean>;
  setAudioSensitivity(sensitivity: number): Promise<void>;
  getAudioSensitivity(): Promise<number>;
  getSystemInsets(): Promise<SystemInsets>;
  setDarkMode(enabled: boolean): Promise<void>;
  isDarkModeEnabled(): Promise<boolean>;
  getRecognitionModels(): Promise<RecognitionModelInfo[]>;
  setRecognitionModel(id: string): Promise<void>;
  downloadRecognitionModel(id: string): Promise<void>;
  deleteRecognitionModel(id: string): Promise<void>;
  subscribeModelDownload(
    listener: (event: {
      modelId: string;
      progress: number;
      phase: string;
    }) => void,
  ): () => void;
  subscribe(listener: TranscriptListener): () => void;
}
