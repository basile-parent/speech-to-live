import {useCallback, useMemo, useRef} from 'react';
import {
  AccessibilityInfo,
  Button,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import {getAppTheme} from '../../../shared/theme/appTheme';
import {AudioWaveform} from '../components/AudioWaveform';
import {useSpeechRecognition} from '../hooks/useSpeechRecognition';

/** Distance from bottom (px) under which sticky auto-scroll stays active. */
const STICKY_BOTTOM_THRESHOLD_PX = 56;

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
  darkMode: boolean;
  speakerMode: boolean;
  audioSensitivity: number;
  bottomInset?: number;
  onOpenSettings: () => void;
};

export function SpeechScreen({
  darkMode,
  speakerMode,
  audioSensitivity,
  bottomInset = 0,
  onOpenSettings,
}: SpeechScreenProps) {
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);
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

  const scrollRef = useRef<ScrollViewInstance>(null);
  const stickyToBottomRef = useRef(true);

  const onTranscriptScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      stickyToBottomRef.current =
        distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
    },
    [],
  );

  const onTranscriptContentSizeChange = useCallback(() => {
    if (!stickyToBottomRef.current) {
      return;
    }
    scrollRef.current?.scrollToEnd({animated: false});
  }, []);

  const openSettings = useCallback(async () => {
    try {
      if (isListening) {
        await stop();
      }
    } catch (err) {
      AccessibilityInfo.announceForAccessibility(
        err instanceof Error
          ? err.message
          : 'Impossible d’arrêter la transcription',
      );
    } finally {
      onOpenSettings();
    }
  }, [isListening, onOpenSettings, stop]);

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
      style={[
        styles.container,
        {paddingTop: topInset, backgroundColor: theme.background},
      ]}
      accessibilityRole="summary">
      <View style={styles.header}>
        <Text
          style={[styles.title, {color: theme.text}]}
          accessibilityRole="header">
          Speech to Live
        </Text>
        <Pressable
          onPress={() => {
            openSettings().catch(() => undefined);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les paramètres"
          hitSlop={12}
          style={styles.settingsButton}>
          <Text style={[styles.settingsButtonText, {color: theme.accent}]}>
            Paramètres
          </Text>
        </Pressable>
      </View>

      {speakerMode ? (
        <Text
          style={[styles.modeBadge, {color: theme.accent}]}
          accessibilityLabel="Mode locuteur actif">
          Mode locuteur
        </Text>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        onScroll={onTranscriptScroll}
        onContentSizeChange={onTranscriptContentSizeChange}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Transcription: ${accessibilityTranscript || 'vide'}`}>
        {hasContent ? (
          <View>
            {finalSegments.map((segment, index) => (
              <View
                key={`${index}-${segment.speakerLabel ?? 'plain'}-${segment.text}`}
                style={styles.segment}>
                {speakerMode && segment.speakerLabel ? (
                  <Text style={[styles.speakerLabel, {color: theme.accent}]}>
                    {segment.speakerLabel}
                  </Text>
                ) : null}
                <Text style={[styles.finalText, {color: theme.text}]}>
                  {segment.text}
                </Text>
              </View>
            ))}
            {partialTranscript.length > 0 ? (
              <Text
                style={[
                  styles.partialText,
                  {color: theme.textMuted},
                  finalSegments.length > 0 ? styles.partialSpacing : null,
                ]}>
                {partialTranscript}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.placeholder, {color: theme.textMuted}]}>
            —
          </Text>
        )}
      </ScrollView>

      {error ? (
        <Text
          style={[styles.error, {color: theme.error}]}
          accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={isListening ? 'Arrêter' : 'Commencer'}
          color={theme.accent}
          onPress={onPress}
          accessibilityLabel={
            isListening
              ? 'Arrêter la transcription'
              : 'Commencer la transcription'
          }
        />
      </View>

      <AudioWaveform
        level={audioLevel}
        active={isListening}
        sensitivity={audioSensitivity}
        bottomInset={bottomInset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  settingsButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  modeBadge: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finalText: {
    fontSize: 22,
    lineHeight: 30,
    fontStyle: 'normal',
  },
  partialText: {
    fontSize: 22,
    lineHeight: 30,
    fontStyle: 'italic',
  },
  partialSpacing: {
    marginTop: 4,
  },
  placeholder: {
    fontSize: 22,
    lineHeight: 30,
  },
  actions: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  error: {
    fontSize: 14,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
