import {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';

const BAR_COUNT = 48;
const MIN_BAR_RATIO = 0.06;

type AudioWaveformProps = {
  level: number;
  active: boolean;
};

function createIdleBars(): number[] {
  return Array.from({length: BAR_COUNT}, () => MIN_BAR_RATIO);
}

export function AudioWaveform({level, active}: AudioWaveformProps) {
  const [bars, setBars] = useState<number[]>(createIdleBars);
  const levelRef = useRef(level);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    if (!active) {
      setBars(createIdleBars());
      return;
    }

    const normalized = Math.min(1, Math.max(0, levelRef.current * 8));
    setBars(previous => {
      const next = previous.slice(1);
      const jitter = 0.85 + Math.random() * 0.3;
      next.push(Math.max(MIN_BAR_RATIO, normalized * jitter));
      return next;
    });
  }, [active, level]);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={
        active
          ? `Visualisation micro, niveau ${Math.round(Math.min(1, level * 8) * 100)} pourcent`
          : 'Visualisation micro inactive'
      }>
      <View style={styles.bars}>
        {bars.map((value, index) => (
          <View key={index} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: `${Math.round(value * 100)}%`,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 88,
    backgroundColor: '#1F6B3A',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    minHeight: 4,
  },
});
