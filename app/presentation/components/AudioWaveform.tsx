import {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

const SEGMENT_COUNT = 36;
const GREEN_UNTIL = 0.62;
const YELLOW_UNTIL = 0.82;

type AudioWaveformProps = {
  level: number;
  active: boolean;
  /** 0 = low sensitivity (cursor right), 1 = high (cursor left). */
  sensitivity?: number;
  /** Extra bottom padding for Android navigation controls (dp). */
  bottomInset?: number;
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
  // RMS is typically small; amplify for a readable meter after mic gain.
  return Math.min(1, Math.max(0, level * 6));
}

export function AudioWaveform({
  level,
  active,
  sensitivity = 0.5,
  bottomInset = 0,
}: AudioWaveformProps) {
  const fillRatio = normalizeLevel(level, active);
  const litCount = Math.round(fillRatio * SEGMENT_COUNT);
  const cursorRatio = 0.8 - Math.min(0.8, Math.max(0, sensitivity * 0.75));

  const segments = useMemo(
    () =>
      Array.from({length: SEGMENT_COUNT}, (_, index) => ({
        color: segmentColor(index, index < litCount),
      })),
    [litCount],
  );

  const percent = Math.round(fillRatio * 100);
  const sensitivityPercent = Math.round(sensitivity * 100);

  return (
    <View
      style={[styles.container, {paddingBottom: 14 + bottomInset}]}
      accessibilityRole="progressbar"
      accessibilityLabel={
        active
          ? `Niveau micro ${percent} pourcent, sensibilité ${sensitivityPercent} pourcent`
          : `Niveau micro inactif, sensibilité ${sensitivityPercent} pourcent`
      }
      accessibilityValue={{min: 0, max: 100, now: percent}}>
      <View style={styles.meterTrack}>
        <View style={styles.segments}>
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
            styles.cursor,
            {left: `${Math.round(cursorRatio * 100)}%`},
          ]}>
          <View style={styles.cursorHead} />
          <View style={styles.cursorLine} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  meterTrack: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 22,
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 2,
  },
  cursor: {
    position: 'absolute',
    top: -6,
    bottom: -4,
    width: 14,
    marginLeft: -7,
    alignItems: 'center',
  },
  cursorHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  cursorLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    marginTop: 1,
  },
});
