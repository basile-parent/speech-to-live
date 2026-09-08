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

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [screen, setScreen] = useState<AppScreen>('speech');
  const [speakerMode, setSpeakerMode] = useState(false);
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
  }, []);

  const onSpeakerModeChange = useCallback(async (enabled: boolean) => {
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

      // Optimistic UI so the choice feels immediate.
      setSpeakerMode(enabled);
      setSettingsBusy(true);
      await settingsPort.setSpeakerMode(enabled);
    } catch (error) {
      // Revert if native call fails.
      setSpeakerMode(!enabled);
      setSettingsError(
        error instanceof Error
          ? error.message
          : 'Impossible de changer de mode',
      );
    } finally {
      setSettingsBusy(false);
    }
  }, [settingsBusy]);

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
