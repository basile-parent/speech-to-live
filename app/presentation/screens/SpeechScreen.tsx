import {useCallback} from 'react';
import {
  AccessibilityInfo,
  Button,
  PermissionsAndroid,
  Platform,
  Pressable,
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

type SpeechScreenProps = {
  speakerMode: boolean;
  onOpenSettings: () => void;
};

export function SpeechScreen({
  speakerMode,
  onOpenSettings,
}: SpeechScreenProps) {
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;
  const {
    isListening,
    partialTranscript,
    finalSegments,
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

  const hasContent = finalSegments.length > 0 || partialTranscript.length > 0;
  const accessibilityTranscript = [finalTranscript, partialTranscript]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      style={[styles.container, {paddingTop: topInset}]}
      accessibilityRole="summary">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Speech to Live
        </Text>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les paramètres"
          hitSlop={12}
          style={styles.settingsButton}>
          <Text style={styles.settingsButtonText}>Paramètres</Text>
        </Pressable>
      </View>

      {speakerMode ? (
        <Text style={styles.modeBadge} accessibilityLabel="Mode locuteur actif">
          Mode locuteur
        </Text>
      ) : null}

      <ScrollView
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Transcription: ${accessibilityTranscript || 'vide'}`}>
        {hasContent ? (
          <View>
            {finalSegments.map((segment, index) => (
              <View
                key={`${index}-${segment.speakerLabel ?? 'plain'}-${segment.text}`}
                style={styles.segment}>
                {speakerMode && segment.speakerLabel ? (
                  <Text style={styles.speakerLabel}>{segment.speakerLabel}</Text>
                ) : null}
                <Text style={styles.finalText}>{segment.text}</Text>
              </View>
            ))}
            {partialTranscript.length > 0 ? (
              <Text
                style={[
                  styles.partialText,
                  finalSegments.length > 0 ? styles.partialSpacing : null,
                ]}>
                {partialTranscript}
              </Text>
            ) : null}
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  settingsButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F6B3A',
  },
  modeBadge: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F6B3A',
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
  segment: {
    marginBottom: 14,
  },
  speakerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F6B3A',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finalText: {
    fontSize: 22,
    lineHeight: 30,
    color: '#111111',
    fontStyle: 'normal',
  },
  partialText: {
    fontSize: 22,
    lineHeight: 30,
    color: '#888888',
    fontStyle: 'italic',
  },
  partialSpacing: {
    marginTop: 4,
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
