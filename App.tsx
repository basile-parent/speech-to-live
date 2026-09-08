import {useCallback, useEffect, useMemo, useState} from 'react';
import {Platform, StatusBar, StyleSheet, View} from 'react-native';
import {NativeSpeechRecognitionAdapter} from './app/infrastructure/speech/NativeSpeechRecognitionAdapter';
import {SettingsScreen} from './app/presentation/screens/SettingsScreen';
import {SpeechScreen} from './app/presentation/screens/SpeechScreen';
import {getAppTheme} from './shared/theme/appTheme';

type AppScreen = 'speech' | 'settings';

const settingsPort = new NativeSpeechRecognitionAdapter();
const DEFAULT_AUDIO_SENSITIVITY = 0.5;
const DEFAULT_DARK_MODE = true;

function App() {
  const [screen, setScreen] = useState<AppScreen>('speech');
  const [speakerMode, setSpeakerMode] = useState(false);
  const [darkMode, setDarkMode] = useState(DEFAULT_DARK_MODE);
  const [audioSensitivity, setAudioSensitivity] = useState(
    DEFAULT_AUDIO_SENSITIVITY,
  );
  const [bottomInset, setBottomInset] = useState(0);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);

  useEffect(() => {
    settingsPort
      .isSpeakerModeEnabled()
      .then(setSpeakerMode)
      .catch(() => {
        setSpeakerMode(false);
      });
    settingsPort
      .isDarkModeEnabled()
      .then(setDarkMode)
      .catch(() => {
        setDarkMode(DEFAULT_DARK_MODE);
      });
    settingsPort
      .getAudioSensitivity()
      .then(setAudioSensitivity)
      .catch(() => {
        setAudioSensitivity(DEFAULT_AUDIO_SENSITIVITY);
      });
    settingsPort
      .getBottomInset()
      .then(setBottomInset)
      .catch(() => {
        setBottomInset(0);
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

  const onDarkModeChange = useCallback(async (enabled: boolean) => {
    const previous = darkMode;
    setSettingsError(null);
    setDarkMode(enabled);
    try {
      await settingsPort.setDarkMode(enabled);
    } catch (error) {
      setDarkMode(previous);
      setSettingsError(
        error instanceof Error
          ? error.message
          : 'Impossible de changer le thème',
      );
    }
  }, [darkMode]);

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

  const onOpenSettings = useCallback(async () => {
    setSettingsError(null);
    try {
      if (await settingsPort.isListening()) {
        await settingsPort.stopListening();
      }
    } catch {
      // Still open settings; SpeechScreen also stops on unmount.
    }
    setScreen('settings');
  }, []);

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      {screen === 'speech' ? (
        <SpeechScreen
          darkMode={darkMode}
          speakerMode={speakerMode}
          audioSensitivity={audioSensitivity}
          bottomInset={bottomInset}
          onOpenSettings={() => {
            onOpenSettings().catch(() => undefined);
          }}
        />
      ) : (
        <View
          style={[
            styles.settingsScreen,
            {
              backgroundColor: theme.background,
              paddingTop: topInset,
              paddingBottom: bottomInset,
            },
          ]}>
          <SettingsScreen
            darkMode={darkMode}
            onDarkModeChange={value => {
              onDarkModeChange(value).catch(() => undefined);
            }}
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
  },
  settingsScreen: {
    flex: 1,
  },
});

export default App;
