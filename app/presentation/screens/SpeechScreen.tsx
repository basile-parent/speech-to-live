import {useCallback} from 'react';
import {
  AccessibilityInfo,
  Button,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AudioWaveform} from '../components/AudioWaveform';
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

export function SpeechScreen() {
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;
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
    <View
      style={[styles.container, {paddingTop: topInset}]}
      accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        Speech to Live
      </Text>

      <View style={styles.finalSection}>
        <Text style={styles.label}>Texte final</Text>
        <ScrollView
          style={styles.finalScroll}
          contentContainerStyle={styles.finalScrollContent}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Texte final: ${finalTranscript || 'vide'}`}>
          <Text style={styles.finalText}>{finalTranscript || '—'}</Text>
        </ScrollView>
      </View>

      <View style={styles.partialSection}>
        <Text style={styles.label}>Texte partiel</Text>
        <Text
          style={styles.partialText}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Texte partiel: ${partialTranscript || 'vide'}`}>
          {partialTranscript || '—'}
        </Text>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={isListening ? 'Arrêter' : 'Commencer'}
          onPress={onPress}
          accessibilityLabel={
            isListening
              ? 'Arrêter la transcription'
              : 'Commencer la transcription'
          }
        />
      </View>

      <AudioWaveform level={audioLevel} active={isListening} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  finalSection: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 8,
    minHeight: 0,
  },
  finalScroll: {
    flex: 1,
  },
  finalScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
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
  },
  partialSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 4,
  },
  partialText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#666666',
    fontStyle: 'italic',
    minHeight: 44,
  },
  actions: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  error: {
    color: '#B00020',
    fontSize: 14,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
