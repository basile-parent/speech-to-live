import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): Promise<boolean>;
  setLanguage(language: string): Promise<void>;
  setModel(path: string): Promise<void>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'NativeSpeechRecognition',
);
