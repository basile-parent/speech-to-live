import type {TranscriptEvent} from '../../../shared/types';

export type TranscriptListener = (event: TranscriptEvent) => void;

export interface SpeechRecognitionPort {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): Promise<boolean>;
  setLanguage(language: string): Promise<void>;
  setModel(path: string): Promise<void>;
  subscribe(listener: TranscriptListener): () => void;
}
