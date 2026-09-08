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

  const hasContent =
    finalTranscript.length > 0 || partialTranscript.length > 0;
  const accessibilityTranscript = [finalTranscript, partialTranscript]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      style={[styles.container, {paddingTop: topInset}]}
      accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        Speech to Live
      </Text>

      <ScrollView
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Transcription: ${accessibilityTranscript || 'vide'}`}>
        {hasContent ? (
          <Text style={styles.transcript}>
            {finalTranscript.length > 0 ? (
              <Text style={styles.finalText}>{finalTranscript}</Text>
            ) : null}
            {finalTranscript.length > 0 && partialTranscript.length > 0
              ? '\n'
              : null}
            {partialTranscript.length > 0 ? (
              <Text style={styles.partialText}>{partialTranscript}</Text>
            ) : null}
          </Text>
        ) : (
          <Text style={styles.placeholder}>—</Text>
        )}
      </ScrollView>

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
  transcriptScroll: {
    flex: 1,
    paddingHorizontal: 24,
    minHeight: 0,
  },
  transcriptContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  transcript: {
    fontSize: 22,
    lineHeight: 30,
  },
  finalText: {
    color: '#111111',
    fontStyle: 'normal',
  },
  partialText: {
    color: '#888888',
    fontStyle: 'italic',
  },
  placeholder: {
    fontSize: 22,
    lineHeight: 30,
    color: '#111111',
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
