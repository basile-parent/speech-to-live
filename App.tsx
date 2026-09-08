import {useCallback, useEffect, useState} from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import {NativeSpeechRecognitionAdapter} from './app/infrastructure/speech/NativeSpeechRecognitionAdapter';
import {SettingsScreen} from './app/presentation/screens/SettingsScreen';
import {SpeechScreen} from './app/presentation/screens/SpeechScreen';

type AppScreen = 'speech' | 'settings';

const settingsPort = new NativeSpeechRecognitionAdapter();
const DEFAULT_AUDIO_SENSITIVITY = 0.5;

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [screen, setScreen] = useState<AppScreen>('speech');
  const [speakerMode, setSpeakerMode] = useState(false);
  const [audioSensitivity, setAudioSensitivity] = useState(
    DEFAULT_AUDIO_SENSITIVITY,
  );
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;

  useEffect(() => {
    settingsPort
      .isSpeakerModeEnabled()
      .then(setSpeakerMode)
      .catch(() => {
        setSpeakerMode(false);
      });
    settingsPort
      .getAudioSensitivity()
      .then(setAudioSensitivity)
      .catch(() => {
        setAudioSensitivity(DEFAULT_AUDIO_SENSITIVITY);
      });
  }, []);

  const onSpeakerModeChange = useCallback(
    async (enabled: boolean) => {
      if (settingsBusy) {
        return;
      }

      setSettingsError(null);

      try {
        if (await settingsPort.isListening()) {
          setSettingsError(
            'Arrêtez la transcription avant de changer de mode.',
          );
          return;
        }

        setSpeakerMode(enabled);
        setSettingsBusy(true);
        await settingsPort.setSpeakerMode(enabled);
      } catch (error) {
        setSpeakerMode(!enabled);
        setSettingsError(
          error instanceof Error
            ? error.message
            : 'Impossible de changer de mode',
        );
      } finally {
        setSettingsBusy(false);
      }
    },
    [settingsBusy],
  );

  const onAudioSensitivityChange = useCallback(
    async (sensitivity: number) => {
      const previous = audioSensitivity;
      setSettingsError(null);
      setAudioSensitivity(sensitivity);
      try {
        await settingsPort.setAudioSensitivity(sensitivity);
      } catch (error) {
        setAudioSensitivity(previous);
        setSettingsError(
          error instanceof Error
            ? error.message
            : 'Impossible de changer la sensibilité',
        );
      }
    },
    [audioSensitivity],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {screen === 'speech' ? (
        <SpeechScreen
          speakerMode={speakerMode}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : (
        <View style={[styles.settingsScreen, {paddingTop: topInset}]}>
          <SettingsScreen
            speakerMode={speakerMode}
            onSpeakerModeChange={value => {
              onSpeakerModeChange(value).catch(() => undefined);
            }}
            audioSensitivity={audioSensitivity}
            onAudioSensitivityChange={value => {
              onAudioSensitivityChange(value).catch(() => undefined);
            }}
            onBack={() => {
              setSettingsError(null);
              setScreen('speech');
            }}
            disabled={settingsBusy}
            error={settingsError}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  settingsScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default App;
