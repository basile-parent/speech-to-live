import {useCallback, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Button,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import type {SystemInsets, TranscriptBlock} from '../../../shared/types';
import {formatSpeakerLabel} from '../../../shared/speaker/emojis';
import {getAppTheme} from '../../../shared/theme/appTheme';
import {AudioWaveform} from '../components/AudioWaveform';
import {BroomIcon} from '../components/BroomIcon';
import {
  TRANSCRIPT_FONT_SIZE_DEFAULT,
  usePinchFontSize,
} from '../hooks/usePinchFontSize';
import {useSpeechRecognition} from '../hooks/useSpeechRecognition';

/** Distance from bottom (px) under which sticky auto-scroll stays active. */
const STICKY_BOTTOM_THRESHOLD_PX = 56;

type TranscriptPage = {
  key: string;
  isFreshSession: boolean;
  segments: Extract<TranscriptBlock, {type: 'segment'}>[];
};

function buildTranscriptPages(blocks: TranscriptBlock[]): TranscriptPage[] {
  const pages: TranscriptPage[] = [
    {key: 'page-initial', isFreshSession: false, segments: []},
  ];

  for (const block of blocks) {
    if (block.type === 'break') {
      pages.push({
        key: block.id,
        isFreshSession: true,
        segments: [],
      });
      continue;
    }
    pages[pages.length - 1].segments.push(block);
  }

  return pages;
}

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
  onAudioSensitivityChange: (sensitivity: number) => void | Promise<void>;
  systemInsets?: SystemInsets;
  onOpenSettings: () => void;
};

export function SpeechScreen({
  darkMode,
  speakerMode,
  audioSensitivity,
  onAudioSensitivityChange,
  systemInsets = {left: 0, right: 0, top: 0, bottom: 0},
  onOpenSettings,
}: SpeechScreenProps) {
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);
  const {width, height} = useWindowDimensions();
  const isLandscape = width > height;
  const topInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) : 12;
  const {
    isListening,
    partialTranscript,
    transcriptBlocks,
    finalTranscript,
    audioLevel,
    error,
    start,
    stop,
    insertViewBreak,
  } = useSpeechRecognition({language: 'fr'});

  const scrollRef = useRef<ScrollViewInstance>(null);
  const stickyToBottomRef = useRef(true);
  const resumeAfterSensitivityDragRef = useRef(false);
  const sensitivityStopPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const [viewportHeight, setViewportHeight] = useState(0);
  const {
    fontSize,
    lineHeight,
    isPinching,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  } = usePinchFontSize(TRANSCRIPT_FONT_SIZE_DEFAULT);
  const speakerLabelSize = fontSize * (13 / 22);
  const speakerLabelLineHeight = speakerLabelSize * 1.2;

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

  const onTranscriptLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const onResetView = useCallback(() => {
    stickyToBottomRef.current = true;
    insertViewBreak();
    AccessibilityInfo.announceForAccessibility(
      'Affichage remis à zéro. L’historique reste disponible en haut.',
    );
  }, [insertViewBreak]);

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

  const onSensitivityDragStart = useCallback(() => {
    resumeAfterSensitivityDragRef.current = isListening;
    if (!isListening) {
      sensitivityStopPromiseRef.current = Promise.resolve();
      return;
    }
    sensitivityStopPromiseRef.current = stop().catch(() => undefined);
  }, [isListening, stop]);

  const onSensitivityDragEnd = useCallback(() => {
    const shouldResume = resumeAfterSensitivityDragRef.current;
    resumeAfterSensitivityDragRef.current = false;
    sensitivityStopPromiseRef.current
      .then(() => {
        if (!shouldResume) {
          return;
        }
        return start();
      })
      .catch(err => {
        AccessibilityInfo.announceForAccessibility(
          err instanceof Error
            ? err.message
            : 'Impossible de reprendre la transcription',
        );
      });
  }, [start]);

  const hasHistory = transcriptBlocks.length > 0;
  const hasContent = hasHistory || partialTranscript.length > 0;
  const canResetView = hasContent;
  const accessibilityTranscript = [finalTranscript, partialTranscript]
    .filter(Boolean)
    .join(' ');
  const pages = useMemo(
    () => buildTranscriptPages(transcriptBlocks),
    [transcriptBlocks],
  );
  const sessionMinHeight = viewportHeight > 0 ? viewportHeight : undefined;

  const meter = (
    <AudioWaveform
      level={audioLevel}
      active={isListening}
      sensitivity={audioSensitivity}
      layout={isLandscape ? 'vertical' : 'horizontal'}
      edgeInset={isLandscape ? systemInsets.right : systemInsets.bottom}
      onSensitivityChange={onAudioSensitivityChange}
      onSensitivityDragStart={onSensitivityDragStart}
      onSensitivityDragEnd={onSensitivityDragEnd}
    />
  );

  const transcript = (
    <ScrollView
      ref={scrollRef}
      style={styles.transcriptScroll}
      contentContainerStyle={styles.transcriptContent}
      scrollEnabled={!isPinching}
      onLayout={onTranscriptLayout}
      onScroll={onTranscriptScroll}
      onContentSizeChange={onTranscriptContentSizeChange}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Transcription: ${accessibilityTranscript || 'vide'}`}>
      {hasContent ? (
        <View>
          {pages.map((page, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const showPartial = isLastPage && partialTranscript.length > 0;
            const pageBody = (
              <>
                {page.segments.map(segment => (
                  <View key={segment.id} style={styles.segment}>
                    {speakerMode && segment.speakerLabel ? (
                      <Text
                        style={[
                          styles.speakerLabel,
                          {
                            color: theme.accent,
                            fontSize: speakerLabelSize,
                            lineHeight: speakerLabelLineHeight,
                          },
                        ]}>
                        {formatSpeakerLabel(segment.speakerLabel)}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.finalText,
                        {
                          color: theme.text,
                          fontSize,
                          lineHeight,
                        },
                      ]}>
                      {segment.text}
                    </Text>
                  </View>
                ))}
                {showPartial ? (
                  <Text
                    style={[
                      styles.partialText,
                      {
                        color: theme.textMuted,
                        fontSize,
                        lineHeight,
                      },
                      page.segments.length > 0 ? styles.partialSpacing : null,
                    ]}>
                    {partialTranscript}
                  </Text>
                ) : null}
              </>
            );

            if (page.isFreshSession && isLastPage) {
              return (
                <View
                  key={page.key}
                  style={
                    sessionMinHeight
                      ? {minHeight: sessionMinHeight}
                      : undefined
                  }>
                  {pageBody}
                </View>
              );
            }

            return <View key={page.key}>{pageBody}</View>;
          })}
        </View>
      ) : (
        <Text
          style={[
            styles.placeholder,
            {color: theme.textMuted, fontSize, lineHeight},
          ]}>
          —
        </Text>
      )}
    </ScrollView>
  );

  const errorBanner = error ? (
    <Text
      style={[styles.error, {color: theme.error}]}
      accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  const actions = (
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
  );

  const chrome = (
    <>
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

      <View style={styles.transcriptToolbar}>
        <Pressable
          onPress={onResetView}
          disabled={!canResetView}
          accessibilityRole="button"
          accessibilityLabel="Nettoyer l’affichage sans effacer l’historique"
          accessibilityState={{disabled: !canResetView}}
          hitSlop={8}
          style={({pressed}) => [
            styles.trashButton,
            {
              borderColor: theme.border,
              opacity: !canResetView ? 0.35 : pressed ? 0.7 : 1,
            },
          ]}>
          <BroomIcon darkMode={darkMode} size={22} />
        </Pressable>
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.container,
        isLandscape && styles.containerLandscape,
        {
          paddingTop: topInset,
          paddingLeft: systemInsets.left,
          // In landscape the vertical meter owns the right inset.
          paddingRight: isLandscape ? 0 : systemInsets.right,
          paddingBottom: isLandscape ? systemInsets.bottom : 0,
          backgroundColor: theme.background,
        },
      ]}
      accessibilityRole="summary">
      {isLandscape ? (
        <>
          <View style={styles.landscapeMain}>
            {chrome}
            {transcript}
            {errorBanner}
            {actions}
          </View>
          {meter}
        </>
      ) : (
        <>
          {chrome}
          {transcript}
          {errorBanner}
          {actions}
          {meter}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  transcriptToolbar: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  trashButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
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
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finalText: {
    fontStyle: 'normal',
  },
  partialText: {
    fontStyle: 'italic',
  },
  partialSpacing: {
    marginTop: 4,
  },
  placeholder: {},
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
