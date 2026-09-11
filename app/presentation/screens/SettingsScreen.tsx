import {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {getAppTheme, type AppThemeColors} from '../../../shared/theme/appTheme';
import {
  formatModelSize,
  type RecognitionModelInfo,
} from '../../../shared/types';

type TranscriptionMode = 'simple' | 'speaker';

type SettingsScreenProps = {
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  speakerMode: boolean;
  onSpeakerModeChange: (enabled: boolean) => void;
  recognitionModels: RecognitionModelInfo[];
  downloadingModelId: string | null;
  downloadProgress: number;
  onSelectRecognitionModel: (id: string) => void;
  onConfirmDownloadModel: (id: string) => void;
  onDeleteRecognitionModel: (id: string) => void;
  onBack: () => void;
  disabled?: boolean;
  error?: string | null;
};

export function SettingsScreen({
  darkMode,
  onDarkModeChange,
  speakerMode,
  onSpeakerModeChange,
  recognitionModels,
  downloadingModelId,
  downloadProgress,
  onSelectRecognitionModel,
  onConfirmDownloadModel,
  onDeleteRecognitionModel,
  onBack,
  disabled = false,
  error = null,
}: SettingsScreenProps) {
  const theme = useMemo(() => getAppTheme(darkMode), [darkMode]);
  const selected: TranscriptionMode = speakerMode ? 'speaker' : 'simple';
  const selectedModelId =
    recognitionModels.find(model => model.selected)?.id ??
    recognitionModels[0]?.id ??
    null;

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

  const requestModelSelection = useCallback(
    (model: RecognitionModelInfo) => {
      if (disabled || downloadingModelId) {
        return;
      }
      if (model.selected) {
        return;
      }
      if (model.downloaded || model.bundled) {
        onSelectRecognitionModel(model.id);
        return;
      }

      Alert.alert(
        'Télécharger le modèle ?',
        `« ${model.title} » n’est pas encore installé.\n\nTaille du téléchargement : environ ${formatModelSize(model.sizeBytes)}.\n\nVoulez-vous le télécharger maintenant ?`,
        [
          {
            text: 'Non',
            style: 'cancel',
          },
          {
            text: 'Oui',
            onPress: () => {
              onConfirmDownloadModel(model.id);
            },
          },
        ],
      );
    },
    [disabled, downloadingModelId, onConfirmDownloadModel, onSelectRecognitionModel],
  );

  const requestModelDeletion = useCallback(
    (model: RecognitionModelInfo) => {
      if (disabled || downloadingModelId) {
        return;
      }
      if (model.bundled || !model.downloaded) {
        return;
      }

      Alert.alert(
        'Supprimer le modèle ?',
        `« ${model.title} » sera retiré de l’appareil (~${formatModelSize(model.sizeBytes)} libérés).\n\nVous pourrez le télécharger à nouveau plus tard.`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => {
              onDeleteRecognitionModel(model.id);
            },
          },
        ],
      );
    },
    [disabled, downloadingModelId, onDeleteRecognitionModel],
  );

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
            Modèle de reconnaissance
          </Text>
          {downloadingModelId ? (
            <View
              style={styles.downloadProgressBlock}
              accessibilityRole="progressbar"
              accessibilityLabel={`Téléchargement ${Math.round(downloadProgress * 100)} pourcent`}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(downloadProgress * 100),
              }}>
              <View
                style={[
                  styles.downloadProgressTrack,
                  {backgroundColor: theme.stepTrack},
                ]}>
                <View
                  style={[
                    styles.downloadProgressFill,
                    {
                      backgroundColor: theme.accent,
                      width: `${Math.round(Math.min(1, Math.max(0, downloadProgress)) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.downloadProgressLabel, {color: theme.textMuted}]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          ) : null}
          <Text style={[styles.sectionHint, {color: theme.textSecondary}]}>
            Seul le modèle par défaut est inclus. Les autres doivent être
            téléchargés avant utilisation.
          </Text>

          <View style={styles.options}>
            {recognitionModels.map(model => {
              const isDownloading = downloadingModelId === model.id;
              const needsDownload = !model.downloaded && !model.bundled;
              const canDelete = model.downloaded && !model.bundled && !isDownloading;
              const description = isDownloading
                ? 'Téléchargement en cours…'
                : model.description;
              return (
                <View key={model.id} style={styles.modelRow}>
                  <View style={styles.modelOptionGrow}>
                    <ModeOption
                      theme={theme}
                      title={model.title}
                      description={description}
                      selected={model.id === selectedModelId}
                      disabled={disabled || Boolean(downloadingModelId)}
                      showDownloadIcon={needsDownload && !isDownloading}
                      onPress={() => {
                        requestModelSelection(model);
                      }}
                    />
                  </View>
                  {canDelete ? (
                    <Pressable
                      onPress={() => {
                        requestModelDeletion(model);
                      }}
                      disabled={disabled || Boolean(downloadingModelId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer ${model.title}`}
                      hitSlop={8}
                      style={({pressed}) => [
                        styles.deleteButton,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                          opacity:
                            disabled || downloadingModelId
                              ? 0.45
                              : pressed
                                ? 0.7
                                : 1,
                        },
                      ]}>
                      <Text style={[styles.deleteIcon, {color: theme.error}]}>
                        🗑
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
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
  showDownloadIcon = false,
  onPress,
}: {
  theme: AppThemeColors;
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  showDownloadIcon?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      accessibilityLabel={
        showDownloadIcon ? `${title}, téléchargement requis` : title
      }
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
        <Text style={[styles.optionTitle, {color: theme.text, flex: 1}]}>
          {title}
        </Text>
        {showDownloadIcon ? (
          <Text
            style={[styles.downloadIcon, {color: theme.accent}]}
            accessibilityElementsHidden
            importantForAccessibility="no">
            ⬇
          </Text>
        ) : null}
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
  downloadProgressBlock: {
    gap: 6,
  },
  downloadProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  downloadProgressLabel: {
    fontSize: 12,
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
  modelRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  modelOptionGrow: {
    flex: 1,
    minWidth: 0,
  },
  deleteButton: {
    width: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 18,
    lineHeight: 22,
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
  downloadIcon: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
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
