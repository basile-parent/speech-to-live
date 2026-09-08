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
    setAudioSensitivity: jest.fn(async () => undefined),
    getAudioSensitivity: jest.fn(async () => 0.5),
    getSystemInsets: jest.fn(async () => ({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    })),
    setDarkMode: jest.fn(async () => undefined),
    isDarkModeEnabled: jest.fn(async () => true),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
