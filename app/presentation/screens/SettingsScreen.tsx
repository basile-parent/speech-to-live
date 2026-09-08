import {Pressable, StyleSheet, Text, View} from 'react-native';

type TranscriptionMode = 'simple' | 'speaker';

const SENSITIVITY_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

function nearestSensitivityStep(value: number): number {
  let best: number = SENSITIVITY_STEPS[0];
  let bestDistance = Math.abs(value - best);
  for (const step of SENSITIVITY_STEPS) {
    const distance = Math.abs(value - step);
    if (distance < bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}

function sensitivityLabel(value: number): string {
  if (value <= 0.125) {
    return 'Faible';
  }
  if (value <= 0.375) {
    return 'Modérée';
  }
  if (value <= 0.625) {
    return 'Normale';
  }
  if (value <= 0.875) {
    return 'Élevée';
  }
  return 'Maximale';
}

type SettingsScreenProps = {
  speakerMode: boolean;
  onSpeakerModeChange: (enabled: boolean) => void;
  audioSensitivity: number;
  onAudioSensitivityChange: (sensitivity: number) => void;
  onBack: () => void;
  disabled?: boolean;
  error?: string | null;
};

export function SettingsScreen({
  speakerMode,
  onSpeakerModeChange,
  audioSensitivity,
  onAudioSensitivityChange,
  onBack,
  disabled = false,
  error = null,
}: SettingsScreenProps) {
  const selected: TranscriptionMode = speakerMode ? 'speaker' : 'simple';
  const selectedSensitivity = nearestSensitivityStep(audioSensitivity);

  const selectMode = (mode: TranscriptionMode) => {
    if (disabled) {
      return;
    }
    const enabled = mode === 'speaker';
    if (enabled === speakerMode) {
      return;
    }
    onSpeakerModeChange(enabled);
  };

  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}>
          <Text style={styles.back}>Retour</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Paramètres
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mode de transcription</Text>
        <Text style={styles.sectionHint}>
          Choisissez comment afficher la transcription. Le mode locuteur
          étiquette chaque segment finalisé (Locuteur 1, Locuteur 2, …).
        </Text>

        <View style={styles.options}>
          <ModeOption
            title="Mode simple"
            description="Un seul flux de texte, sans séparation."
            selected={selected === 'simple'}
            disabled={disabled}
            onPress={() => selectMode('simple')}
          />
          <ModeOption
            title="Mode locuteur"
            description="Chaque tour de parole finalisé est étiqueté."
            selected={selected === 'speaker'}
            disabled={disabled}
            onPress={() => selectMode('speaker')}
          />
        </View>
      </View>

      <View style={[styles.section, styles.sectionSpacing]}>
        <Text style={styles.sectionTitle}>Sensibilité du micro</Text>
        <Text style={styles.sectionHint}>
          Augmentez si vous devez parler trop fort pour être compris. Un
          réglage trop élevé peut capter davantage de bruit.
        </Text>

        <View
          style={styles.sensitivityRow}
          accessibilityRole="adjustable"
          accessibilityLabel={`Sensibilité ${sensitivityLabel(selectedSensitivity)}`}
          accessibilityValue={{
            min: 0,
            max: SENSITIVITY_STEPS.length - 1,
            now: SENSITIVITY_STEPS.indexOf(
              selectedSensitivity as (typeof SENSITIVITY_STEPS)[number],
            ),
            text: sensitivityLabel(selectedSensitivity),
          }}>
          {SENSITIVITY_STEPS.map(step => {
            const active = step <= selectedSensitivity + 0.001;
            const selected = Math.abs(step - selectedSensitivity) < 0.001;
            return (
              <Pressable
                key={step}
                disabled={disabled}
                onPress={() => onAudioSensitivityChange(step)}
                accessibilityRole="button"
                accessibilityState={{selected, disabled}}
                accessibilityLabel={`Sensibilité ${sensitivityLabel(step)}`}
                style={({pressed}) => [
                  styles.sensitivityStep,
                  active ? styles.sensitivityStepActive : null,
                  selected ? styles.sensitivityStepSelected : null,
                  pressed && !disabled ? styles.optionPressed : null,
                  disabled ? styles.optionDisabled : null,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.sensitivityLabels}>
          <Text style={styles.sensitivityEdge}>Faible</Text>
          <Text style={styles.sensitivityCurrent}>
            {sensitivityLabel(selectedSensitivity)}
          </Text>
          <Text style={styles.sensitivityEdge}>Maximale</Text>
        </View>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ModeOption({
  title,
  description,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      accessibilityLabel={title}
      style={({pressed}) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed && !disabled ? styles.optionPressed : null,
        disabled ? styles.optionDisabled : null,
      ]}>
      <View style={styles.optionHeader}>
        <View
          style={[styles.radio, selected ? styles.radioSelected : null]}
        />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  header: {
    paddingBottom: 24,
    gap: 8,
  },
  back: {
    fontSize: 16,
    color: '#1F6B3A',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  section: {
    gap: 12,
  },
  sectionSpacing: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },
  sectionHint: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555555',
  },
  options: {
    marginTop: 8,
    gap: 12,
  },
  option: {
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: '#1F6B3A',
    backgroundColor: '#F2F8F4',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#888888',
  },
  radioSelected: {
    borderColor: '#1F6B3A',
    backgroundColor: '#1F6B3A',
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111111',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    paddingLeft: 28,
  },
  sensitivityRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sensitivityStep: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E6E6E6',
  },
  sensitivityStepActive: {
    backgroundColor: '#7FB392',
  },
  sensitivityStepSelected: {
    backgroundColor: '#1F6B3A',
  },
  sensitivityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensitivityEdge: {
    fontSize: 13,
    color: '#777777',
  },
  sensitivityCurrent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F6B3A',
  },
  error: {
    marginTop: 16,
    color: '#B00020',
    fontSize: 14,
    lineHeight: 20,
  },
});
