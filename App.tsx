import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {NativeSpeechRecognitionAdapter} from './app/infrastructure/speech/NativeSpeechRecognitionAdapter';
import {SettingsScreen} from './app/presentation/screens/SettingsScreen';
import {SpeechScreen} from './app/presentation/screens/SpeechScreen';
import {
  DEFAULT_AUDIO_SENSITIVITY,
  snapSensitivity,
} from './shared/audio/sensitivity';
import {getAppTheme} from './shared/theme/appTheme';
import {
  ZERO_SYSTEM_INSETS,
  type RecognitionModelInfo,
  type SystemInsets,
} from './shared/types';

type AppScreen = 'speech' | 'settings';

const settingsPort = new NativeSpeechRecognitionAdapter();
const DEFAULT_DARK_MODE = true;

function App() {
  const [screen, setScreen] = useState<AppScreen>('speech');
  const [speakerMode, setSpeakerMode] = useState(false);
  const [darkMode, setDarkMode] = useState(DEFAULT_DARK_MODE);
  const [audioSensitivity, setAudioSensitivity] = useState(
    DEFAULT_AUDIO_SENSITIVITY,
  );
  const [recognitionModels, setRecognitionModels] = useState<
    RecognitionModelInfo[]
  >([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [systemInsets, setSystemInsets] =
    useState<SystemInsets>(ZERO_SYSTEM_INSETS);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);

  const refreshRecognitionModels = useCallback(async () => {
    const models = await settingsPort.getRecognitionModels();
    setRecognitionModels(models);
    return models;
  }, []);

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
      .then(value => {
        setAudioSensitivity(snapSensitivity(value));
      })
      .catch(() => {
        setAudioSensitivity(DEFAULT_AUDIO_SENSITIVITY);
      });
    refreshRecognitionModels().catch(() => {
      setRecognitionModels([]);
    });
  }, [refreshRecognitionModels]);

  useEffect(() => {
    const unsubscribe = settingsPort.subscribeModelDownload(event => {
      if (event.modelId) {
        setDownloadingModelId(event.modelId);
      }
      setDownloadProgress(event.progress);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const refreshInsets = () => {
      settingsPort
        .getSystemInsets()
        .then(setSystemInsets)
        .catch(() => {
          setSystemInsets(ZERO_SYSTEM_INSETS);
        });
    };

    refreshInsets();
    const subscription = Dimensions.addEventListener('change', refreshInsets);
    return () => {
      subscription.remove();
    };
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
      const next = snapSensitivity(sensitivity);
      const previous = audioSensitivity;
      setAudioSensitivity(next);
      try {
        await settingsPort.setAudioSensitivity(next);
      } catch {
        setAudioSensitivity(previous);
      }
    },
    [audioSensitivity],
  );

  const onSelectRecognitionModel = useCallback(
    async (id: string) => {
      if (settingsBusy || downloadingModelId) {
        return;
      }
      setSettingsError(null);
      const previous = recognitionModels;
      setRecognitionModels(models =>
        models.map(model => ({...model, selected: model.id === id})),
      );
      setSettingsBusy(true);
      try {
        if (await settingsPort.isListening()) {
          throw new Error(
            'Arrêtez la transcription avant de changer de modèle.',
          );
        }
        await settingsPort.setRecognitionModel(id);
        await refreshRecognitionModels();
      } catch (error) {
        setRecognitionModels(previous);
        setSettingsError(
          error instanceof Error
            ? error.message
            : 'Impossible de changer de modèle',
        );
      } finally {
        setSettingsBusy(false);
      }
    },
    [downloadingModelId, recognitionModels, refreshRecognitionModels, settingsBusy],
  );

  const onConfirmDownloadModel = useCallback(
    async (id: string) => {
      if (settingsBusy || downloadingModelId) {
        return;
      }
      setSettingsError(null);
      const previous = recognitionModels;
      setRecognitionModels(models =>
        models.map(model => ({...model, selected: model.id === id})),
      );
      setDownloadProgress(0);
      setDownloadingModelId(id);
      try {
        await settingsPort.downloadRecognitionModel(id);
        await settingsPort.setRecognitionModel(id);
        await refreshRecognitionModels();
      } catch (error) {
        setRecognitionModels(previous);
        await refreshRecognitionModels().catch(() => undefined);
        setSettingsError(
          error instanceof Error
            ? error.message
            : 'Téléchargement du modèle impossible',
        );
      } finally {
        setDownloadingModelId(null);
        setDownloadProgress(0);
      }
    },
    [
      downloadingModelId,
      recognitionModels,
      refreshRecognitionModels,
      settingsBusy,
    ],
  );

  const onDeleteRecognitionModel = useCallback(
    async (id: string) => {
      if (settingsBusy || downloadingModelId) {
        return;
      }
      setSettingsError(null);
      setSettingsBusy(true);
      try {
        if (await settingsPort.isListening()) {
          throw new Error(
            'Arrêtez la transcription avant de supprimer un modèle.',
          );
        }
        await settingsPort.deleteRecognitionModel(id);
        await refreshRecognitionModels();
      } catch (error) {
        setSettingsError(
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer le modèle',
        );
      } finally {
        setSettingsBusy(false);
      }
    },
    [downloadingModelId, refreshRecognitionModels, settingsBusy],
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
    refreshRecognitionModels().catch(() => undefined);
    setScreen('settings');
  }, [refreshRecognitionModels]);

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      {screen === 'speech' ? (
        <SpeechScreen
          darkMode={darkMode}
          speakerMode={speakerMode}
          audioSensitivity={audioSensitivity}
          onAudioSensitivityChange={onAudioSensitivityChange}
          systemInsets={systemInsets}
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
              paddingLeft: systemInsets.left,
              paddingRight: systemInsets.right,
              paddingBottom: systemInsets.bottom,
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
            recognitionModels={recognitionModels}
            downloadingModelId={downloadingModelId}
            downloadProgress={downloadProgress}
            onSelectRecognitionModel={id => {
              onSelectRecognitionModel(id).catch(() => undefined);
            }}
            onConfirmDownloadModel={id => {
              onConfirmDownloadModel(id).catch(() => undefined);
            }}
            onDeleteRecognitionModel={id => {
              onDeleteRecognitionModel(id).catch(() => undefined);
            }}
            onBack={() => {
              setSettingsError(null);
              setScreen('speech');
            }}
            disabled={settingsBusy || Boolean(downloadingModelId)}
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
