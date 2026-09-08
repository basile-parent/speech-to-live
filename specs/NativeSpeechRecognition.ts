import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): Promise<boolean>;
  setLanguage(language: string): Promise<void>;
  setModel(path: string): Promise<void>;
  setSpeakerMode(enabled: boolean): Promise<void>;
  isSpeakerModeEnabled(): Promise<boolean>;
  /** 0 = low gain, 1 = high gain. Can be changed while listening. */
  setAudioSensitivity(sensitivity: number): Promise<void>;
  getAudioSensitivity(): Promise<number>;
  /** Navigation-bar insets in dp (left/right/bottom/top; side shifts in landscape). */
  getSystemInsets(): Promise<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>;
  setDarkMode(enabled: boolean): Promise<void>;
  isDarkModeEnabled(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'NativeSpeechRecognition',
);
