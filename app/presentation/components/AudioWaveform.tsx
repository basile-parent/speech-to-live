import {useEffect, useMemo, useRef, useState} from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  clampSensitivity,
  LEVEL_DISPLAY_SCALE,
  snapSensitivity,
  trackPositionToSensitivity,
} from '../../../shared/audio/sensitivity';

const SEGMENT_COUNT = 36;
const GREEN_UNTIL = 0.62;
const YELLOW_UNTIL = 0.82;

type AudioWaveformProps = {
  level: number;
  active: boolean;
  /** Effective detection threshold (snapped tranche). */
  sensitivity?: number;
  /** horizontal = bottom bar; vertical = right-side bar (landscape). */
  layout?: 'horizontal' | 'vertical';
  /**
   * Extra padding on the trailing edge for Android nav controls (dp):
   * bottom in portrait, right in landscape.
   */
  edgeInset?: number;
  onSensitivityChange?: (sensitivity: number) => void | Promise<void>;
  onSensitivityDragStart?: () => void;
  onSensitivityDragEnd?: () => void;
};

function segmentColor(index: number, lit: boolean): string {
  const ratio = (index + 0.5) / SEGMENT_COUNT;
  if (ratio < GREEN_UNTIL) {
    return lit ? '#2EE65A' : '#143D22';
  }
  if (ratio < YELLOW_UNTIL) {
    return lit ? '#F5C518' : '#4A3C0A';
  }
  return lit ? '#FF3B30' : '#4A1210';
}

function normalizeLevel(level: number, active: boolean): number {
  if (!active) {
    return 0;
  }
  return Math.min(1, Math.max(0, level * LEVEL_DISPLAY_SCALE));
}

export function AudioWaveform({
  level,
  active,
  sensitivity = 0.4,
  layout = 'horizontal',
  edgeInset = 0,
  onSensitivityChange,
  onSensitivityDragStart,
  onSensitivityDragEnd,
}: AudioWaveformProps) {
  const isVertical = layout === 'vertical';
  const fillRatio = normalizeLevel(level, active);
  const litCount = Math.round(fillRatio * SEGMENT_COUNT);
  /** Visual cursor — stays where the user dropped it. */
  const [cursorPosition, setCursorPosition] = useState(() =>
    clampSensitivity(sensitivity),
  );
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const trackSizeRef = useRef(0);
  const dragPositionRef = useRef<number | null>(null);
  const hasUserPositionedRef = useRef(false);
  const displayedCursor = dragPosition ?? cursorPosition;
  const effectiveThreshold = snapSensitivity(displayedCursor);

  // Follow persisted threshold until the user places the cursor themselves.
  useEffect(() => {
    if (!hasUserPositionedRef.current) {
      setCursorPosition(clampSensitivity(sensitivity));
    }
  }, [sensitivity]);

  const callbacksRef = useRef({
    onSensitivityChange,
    onSensitivityDragStart,
    onSensitivityDragEnd,
    isVertical,
    cursorPosition,
  });
  callbacksRef.current = {
    onSensitivityChange,
    onSensitivityDragStart,
    onSensitivityDragEnd,
    isVertical,
    cursorPosition,
  };

  const segments = useMemo(
    () =>
      Array.from({length: SEGMENT_COUNT}, (_, index) => ({
        color: segmentColor(index, index < litCount),
      })),
    [litCount],
  );

  const positionFromEvent = (locationX: number, locationY: number) => {
    const size = trackSizeRef.current;
    if (size <= 0) {
      return callbacksRef.current.cursorPosition;
    }
    const raw = callbacksRef.current.isVertical
      ? 1 - locationY / size
      : locationX / size;
    return trackPositionToSensitivity(raw);
  };

  const commitPosition = (raw: number) => {
    const clamped = clampSensitivity(raw);
    const snapped = snapSensitivity(clamped);
    hasUserPositionedRef.current = true;
    dragPositionRef.current = null;
    setDragPosition(null);
    setCursorPosition(clamped);
    return Promise.resolve(callbacksRef.current.onSensitivityChange?.(snapped))
      .catch(() => undefined)
      .finally(() => {
        callbacksRef.current.onSensitivityDragEnd?.();
      });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: event => {
          callbacksRef.current.onSensitivityDragStart?.();
          const next = positionFromEvent(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
          dragPositionRef.current = next;
          setDragPosition(next);
        },
        onPanResponderMove: event => {
          const next = positionFromEvent(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
          dragPositionRef.current = next;
          setDragPosition(next);
        },
        onPanResponderRelease: () => {
          const raw =
            dragPositionRef.current ?? callbacksRef.current.cursorPosition;
          commitPosition(raw);
        },
        onPanResponderTerminate: () => {
          const raw =
            dragPositionRef.current ?? callbacksRef.current.cursorPosition;
          commitPosition(raw);
        },
      }),
    [],
  );

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    trackSizeRef.current = isVertical ? height : width;
  };

  const percent = Math.round(fillRatio * 100);
  const thresholdPercent = Math.round(effectiveThreshold * 100);
  const cursorPercent = Math.round(displayedCursor * 100);

  return (
    <View
      style={[
        styles.container,
        isVertical
          ? [styles.containerVertical, {paddingRight: 14 + edgeInset}]
          : [styles.containerHorizontal, {paddingBottom: 14 + edgeInset}],
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={
        active
          ? `Seuil de détection ${thresholdPercent} pourcent, niveau ${percent} pourcent`
          : `Seuil de détection ${thresholdPercent} pourcent`
      }
      accessibilityValue={{min: 10, max: 85, now: thresholdPercent}}>
      <View
        style={[styles.meterTrack, isVertical && styles.meterTrackVertical]}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}>
        <View
          pointerEvents="none"
          style={[styles.segments, isVertical && styles.segmentsVertical]}>
          {segments.map((segment, index) => (
            <View
              key={index}
              style={[styles.segment, {backgroundColor: segment.color}]}
            />
          ))}
        </View>

        <View
          pointerEvents="none"
          style={[
            isVertical ? styles.cursorVertical : styles.cursorHorizontal,
            isVertical
              ? {bottom: `${cursorPercent}%`}
              : {left: `${cursorPercent}%`},
          ]}>
          {isVertical ? (
            <>
              <View style={styles.cursorHeadRight} />
              <View style={styles.cursorLineHorizontal} />
            </>
          ) : (
            <>
              <View style={styles.cursorHeadDown} />
              <View style={styles.cursorLineVertical} />
            </>
          )}
        </View>
      </View>

      {/* DEBUG: temporary threshold readout in the black margin. */}
      <Text
        pointerEvents="none"
        style={[
          styles.debugSensitivity,
          isVertical ? styles.debugSensitivityVertical : null,
        ]}>
        seuil {thresholdPercent}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0A',
  },
  containerHorizontal: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  containerVertical: {
    alignSelf: 'stretch',
    height: '100%',
    paddingVertical: 16,
    paddingLeft: 14,
  },
  meterTrack: {
    height: 36,
    position: 'relative',
    justifyContent: 'center',
  },
  meterTrackVertical: {
    height: '100%',
    width: 36,
    flex: 1,
    alignSelf: 'center',
    alignItems: 'center',
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 22,
    gap: 2,
  },
  segmentsVertical: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
    height: '100%',
    width: 22,
    flex: 1,
  },
  segment: {
    flex: 1,
    borderRadius: 2,
  },
  cursorHorizontal: {
    position: 'absolute',
    top: -6,
    bottom: -4,
    width: 14,
    marginLeft: -7,
    alignItems: 'center',
  },
  cursorVertical: {
    position: 'absolute',
    left: -6,
    right: -4,
    height: 14,
    marginBottom: -7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cursorHeadDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  cursorHeadRight: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  cursorLineVertical: {
    flex: 1,
    width: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    marginTop: 1,
  },
  cursorLineHorizontal: {
    flex: 1,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    marginLeft: 1,
  },
  debugSensitivity: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },
  debugSensitivityVertical: {
    marginTop: 0,
    marginBottom: 8,
    position: 'absolute',
    left: 0,
    right: 14,
    bottom: 0,
  },
});
