import {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {getAppTheme, type AppThemeColors} from '../../../shared/theme/appTheme';

type TranscriptionMode = 'simple' | 'speaker';

type SettingsScreenProps = {
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  speakerMode: boolean;
  onSpeakerModeChange: (enabled: boolean) => void;
  onBack: () => void;
  disabled?: boolean;
  error?: string | null;
};

export function SettingsScreen({
  darkMode,
  onDarkModeChange,
  speakerMode,
  onSpeakerModeChange,
  onBack,
  disabled = false,
  error = null,
}: SettingsScreenProps) {
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);
  const selected: TranscriptionMode = speakerMode ? 'speaker' : 'simple';

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
  error: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
});
