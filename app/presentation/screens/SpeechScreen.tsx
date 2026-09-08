import {useCallback} from 'react';
import {
  AccessibilityInfo,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSpeechRecognition} from '../hooks/useSpeechRecognition';

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Permission microphone',
      message:
        'Speech to Live a besoin du microphone pour transcrire la parole hors ligne.',
      buttonPositive: 'Autoriser',
      buttonNegative: 'Refuser',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function formatAudioLevel(level: number): string {
  const percent = Math.min(100, Math.round(level * 400));
  return `${percent}%`;
}

export function SpeechScreen() {
  const {
    isListening,
    partialTranscript,
    finalTranscript,
    audioLevel,
    error,
    start,
    stop,
  } = useSpeechRecognition({language: 'fr'});

  const onPress = useCallback(async () => {
    try {
      if (isListening) {
        await stop();
        return;
      }

      const granted = await requestMicrophonePermission();
      if (!granted) {
        AccessibilityInfo.announceForAccessibility(
          'Permission microphone refusée',
        );
        return;
      }

      await start();
    } catch (err) {
      AccessibilityInfo.announceForAccessibility(
        err instanceof Error ? err.message : 'Erreur de transcription',
      );
    }
  }, [isListening, start, stop]);

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        Speech to Live
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Texte final</Text>
        <Text
          style={styles.finalText}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Texte final: ${finalTranscript || 'vide'}`}>
          {finalTranscript || '—'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Texte partiel</Text>
        <Text
          style={styles.partialText}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Texte partiel: ${partialTranscript || 'vide'}`}>
          {partialTranscript || '—'}
        </Text>
      </View>

      {isListening ? (
        <Text
          style={styles.level}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Niveau micro ${formatAudioLevel(audioLevel)}`}>
          Niveau micro : {formatAudioLevel(audioLevel)}
          {audioLevel < 0.01 ? ' (silence — activez le micro hôte de l’émulateur)' : ''}
        </Text>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button
        title={isListening ? 'Arrêter' : 'Commencer'}
        onPress={onPress}
        accessibilityLabel={
          isListening ? 'Arrêter la transcription' : 'Commencer la transcription'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111111',
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
  },
  finalText: {
    fontSize: 22,
    lineHeight: 30,
    color: '#111111',
    minHeight: 60,
  },
  partialText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#666666',
    fontStyle: 'italic',
    minHeight: 48,
  },
  level: {
    fontSize: 14,
    color: '#333333',
  },
  error: {
    color: '#B00020',
    fontSize: 14,
  },
});
