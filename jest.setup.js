jest.mock('./specs/NativeSpeechRecognition', () => ({
  __esModule: true,
  default: {
    startListening: jest.fn(async () => undefined),
    stopListening: jest.fn(async () => undefined),
    isListening: jest.fn(async () => false),
    setLanguage: jest.fn(async () => undefined),
    setModel: jest.fn(async () => undefined),
    setSpeakerMode: jest.fn(async () => undefined),
    isSpeakerModeEnabled: jest.fn(async () => false),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
