import {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {getAppTheme, type AppThemeColors} from '../../../shared/theme/appTheme';

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
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  speakerMode: boolean;
  onSpeakerModeChange: (enabled: boolean) => void;
  audioSensitivity: number;
  onAudioSensitivityChange: (sensitivity: number) => void;
  onBack: () => void;
  disabled?: boolean;
  error?: string | null;
};

export function SettingsScreen({
  darkMode,
  onDarkModeChange,
  speakerMode,
  onSpeakerModeChange,
  audioSensitivity,
  onAudioSensitivityChange,
  onBack,
  disabled = false,
  error = null,
}: SettingsScreenProps) {
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);
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
    <View
      style={[styles.container, {backgroundColor: theme.background}]}
      accessibilityRole="summary">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={styles.backButton}>
            <Text style={[styles.back, {color: theme.accent}]}>Retour</Text>
          </Pressable>
          <Text
            style={[styles.title, {color: theme.text}]}
            accessibilityRole="header">
            Paramètres
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Apparence
          </Text>
          <Text style={[styles.sectionHint, {color: theme.textSecondary}]}>
            Le mode sombre est activé par défaut.
          </Text>
          <View style={styles.options}>
            <ModeOption
              theme={theme}
              title="Mode sombre"
              description="Fond sombre, texte clair."
              selected={darkMode}
              disabled={disabled}
              onPress={() => onDarkModeChange(true)}
            />
            <ModeOption
              theme={theme}
              title="Mode clair"
              description="Fond clair, texte sombre."
              selected={!darkMode}
              disabled={disabled}
              onPress={() => onDarkModeChange(false)}
            />
          </View>
        </View>

        <View style={[styles.section, styles.sectionSpacing]}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Mode de transcription
          </Text>
          <Text style={[styles.sectionHint, {color: theme.textSecondary}]}>
            Choisissez comment afficher la transcription. Le mode locuteur
            étiquette chaque segment finalisé (Locuteur 1, Locuteur 2, …).
          </Text>

          <View style={styles.options}>
            <ModeOption
              theme={theme}
              title="Mode simple"
              description="Un seul flux de texte, sans séparation."
              selected={selected === 'simple'}
              disabled={disabled}
              onPress={() => selectMode('simple')}
            />
            <ModeOption
              theme={theme}
              title="Mode locuteur"
              description="Chaque tour de parole finalisé est étiqueté."
              selected={selected === 'speaker'}
              disabled={disabled}
              onPress={() => selectMode('speaker')}
            />
          </View>
        </View>

        <View style={[styles.section, styles.sectionSpacing]}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Sensibilité du micro
          </Text>
          <Text style={[styles.sectionHint, {color: theme.textSecondary}]}>
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
              const selectedStep = Math.abs(step - selectedSensitivity) < 0.001;
              return (
                <Pressable
                  key={step}
                  disabled={disabled}
                  onPress={() => onAudioSensitivityChange(step)}
                  accessibilityRole="button"
                  accessibilityState={{selected: selectedStep, disabled}}
                  accessibilityLabel={`Sensibilité ${sensitivityLabel(step)}`}
                  style={({pressed}) => [
                    styles.sensitivityStep,
                    {backgroundColor: theme.stepTrack},
                    active ? {backgroundColor: theme.stepActive} : null,
                    selectedStep ? {backgroundColor: theme.stepSelected} : null,
                    pressed && !disabled ? styles.optionPressed : null,
                    disabled ? styles.optionDisabled : null,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.sensitivityLabels}>
            <Text style={[styles.sensitivityEdge, {color: theme.textMuted}]}>
              Faible
            </Text>
            <Text style={[styles.sensitivityCurrent, {color: theme.accent}]}>
              {sensitivityLabel(selectedSensitivity)}
            </Text>
            <Text style={[styles.sensitivityEdge, {color: theme.textMuted}]}>
              Maximale
            </Text>
          </View>
        </View>

        {error ? (
          <Text
            style={[styles.error, {color: theme.error}]}
            accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ModeOption({
  theme,
  title,
  description,
  selected,
  disabled,
  onPress,
}: {
  theme: AppThemeColors;
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
        {
          borderColor: selected ? theme.borderSelected : theme.border,
          backgroundColor: selected ? theme.surfaceSelected : theme.surface,
        },
        pressed && !disabled ? styles.optionPressed : null,
        disabled ? styles.optionDisabled : null,
      ]}>
      <View style={styles.optionHeader}>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? theme.accent : theme.textMuted,
              backgroundColor: selected ? theme.accent : 'transparent',
            },
          ]}
        />
        <Text style={[styles.optionTitle, {color: theme.text}]}>{title}</Text>
      </View>
      <Text style={[styles.optionDescription, {color: theme.textSecondary}]}>
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingBottom: 24,
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    justifyContent: 'center',
  },
  back: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
  },
  sectionHint: {
    fontSize: 15,
    lineHeight: 22,
  },
  options: {
    marginTop: 8,
    gap: 12,
  },
  option: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
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
  },
  sensitivityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensitivityEdge: {
    fontSize: 13,
  },
  sensitivityCurrent: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
});
