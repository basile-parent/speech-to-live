import type {SpeechRecognitionPort} from '../../domain/speech/SpeechRecognitionPort';
import type {TranscriptEvent} from '../../../shared/types';

type Listener = (event: TranscriptEvent) => void;

export class FakeSpeechRecognitionAdapter implements SpeechRecognitionPort {
  private listening = false;
  private speakerMode = false;
  private audioSensitivity = 0.5;
  private readonly listeners = new Set<Listener>();
  language = 'fr';
  modelPath: string | null = null;

  async startListening(): Promise<void> {
    this.listening = true;
  }

  async stopListening(): Promise<void> {
    this.listening = false;
  }

  async isListening(): Promise<boolean> {
    return this.listening;
  }

  async setLanguage(language: string): Promise<void> {
    this.language = language;
  }

  async setModel(path: string): Promise<void> {
    this.modelPath = path;
  }

  async setSpeakerMode(enabled: boolean): Promise<void> {
    this.speakerMode = enabled;
  }

  async isSpeakerModeEnabled(): Promise<boolean> {
    return this.speakerMode;
  }

  async setAudioSensitivity(sensitivity: number): Promise<void> {
    this.audioSensitivity = Math.min(1, Math.max(0, sensitivity));
  }

  async getAudioSensitivity(): Promise<number> {
    return this.audioSensitivity;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: TranscriptEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}
