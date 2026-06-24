import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type AlarmThemePalette, alarmTypography, useAlarmTheme } from '@/components/alarms/theme';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { AppModal } from '@/components/ui/AppModal';
import { useAppToast } from '@/components/ui/AppToastProvider';
import {
  type AlarmCategory,
  type AlarmCategoryColorKey,
  createAlarmCategory,
  deleteAlarmCategory,
  findCustomCategory,
  updateAlarmCategory,
  useAlarmCategories,
} from '@/lib/alarm-categories';
import { CATEGORY_COLOR_OPTIONS, categoryColorTokens } from '@/lib/category-colors';

type CategoryManagerSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function blankDraft() {
  return { id: null as number | null, name: '', icon: '⭐', colorKey: 'purple' as AlarmCategoryColorKey };
}

export function CategoryManagerSheet({ visible, onClose }: CategoryManagerSheetProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { showToast } = useAppToast();
  const { categories, userId } = useAlarmCategories();
  const [draft, setDraft] = useState(blankDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlarmCategory | null>(null);

  const editing = draft.id != null;
  const canSave = userId != null && draft.name.trim().length > 0 && draft.icon.trim().length > 0 && !saving;

  const resetDraft = () => setDraft(blankDraft());

  const saveDraft = async () => {
    if (!canSave || userId == null) {
      return;
    }
    setSaving(true);
    try {
      if (draft.id == null) {
        await createAlarmCategory({
          userId,
          name: draft.name.trim(),
          icon: draft.icon.trim(),
          colorKey: draft.colorKey,
        });
        showToast('Category added');
      } else {
        await updateAlarmCategory({
          id: draft.id,
          userId,
          name: draft.name.trim(),
          icon: draft.icon.trim(),
          colorKey: draft.colorKey,
        });
        showToast('Category updated');
      }
      resetDraft();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || userId == null) {
      return;
    }
    setSaving(true);
    try {
      const reassignTo = findCustomCategory(categories);
      await deleteAlarmCategory({ id: deleteTarget.id, userId, reassignToCategoryId: reassignTo.id });
      if (draft.id === deleteTarget.id) {
        resetDraft();
      }
      setDeleteTarget(null);
      showToast('Category deleted');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Categories</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {categories.map((category) => {
              const swatch = categoryColorTokens(palette, category.colorKey);
              return (
              <View key={category.id} style={styles.row}>
                <View style={[styles.colorDot, { backgroundColor: swatch.dim, borderColor: swatch.main }]}>
                  <Text style={styles.rowIcon}>{category.icon}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{category.name}</Text>
                  <Text style={styles.rowMeta}>{category.isSystem ? 'Default category' : 'Custom category'}</Text>
                </View>
                {!category.isSystem ? (
                  <>
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() =>
                        setDraft({
                          id: category.id,
                          name: category.name,
                          icon: category.icon,
                          colorKey: category.colorKey,
                        })
                      }>
                      <Text style={styles.smallBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.smallBtn, styles.deleteBtn]} onPress={() => setDeleteTarget(category)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            );
            })}

            <View style={styles.form}>
              <Text style={styles.formTitle}>{editing ? 'Edit Category' : 'Add Category'}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft.icon}
                  onChangeText={(icon) => setDraft((prev) => ({ ...prev, icon }))}
                  placeholder="⭐"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, styles.iconInput]}
                  maxLength={4}
                />
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => setDraft((prev) => ({ ...prev, name }))}
                  placeholder="Category name"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, styles.nameInput]}
                  maxLength={40}
                />
              </View>
              <Text style={styles.formHint}>Color tints alarm cards and category chips.</Text>
              <View style={styles.colorRow}>
                {CATEGORY_COLOR_OPTIONS.map((option) => {
                  const selected = draft.colorKey === option.key;
                  return (
                  <Pressable
                    key={option.key}
                    style={[styles.colorBtn, selected ? styles.colorBtnActive : null]}
                    onPress={() => setDraft((prev) => ({ ...prev, colorKey: option.key }))}>
                    <View style={[styles.colorSwatch, { backgroundColor: option.sample }]} />
                    <Text style={[styles.colorText, selected ? styles.colorTextActive : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
                })}
              </View>
              <View style={styles.actions}>
                {editing ? (
                  <Pressable style={styles.cancelBtn} onPress={resetDraft}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                ) : null}
                <Pressable style={[styles.saveBtn, !canSave ? styles.disabledBtn : null]} disabled={!canSave} onPress={() => void saveDraft()}>
                  <Text style={styles.saveText}>{saving ? 'Saving...' : editing ? 'Update' : 'Add'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
      <AppConfirmModal
        visible={deleteTarget != null}
        title="Delete Category?"
        body={`Alarms using "${deleteTarget?.name ?? 'this category'}" will move to Custom. History keeps its original category label.`}
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setDeleteTarget(null) },
          { label: 'Delete', variant: 'danger', onPress: () => void confirmDelete() },
        ]}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </AppModal>
  );
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '86%',
      backgroundColor: alarmTheme.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      paddingTop: 18,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    title: {
      color: alarmTheme.text,
      fontSize: alarmTypography.titleSm,
      fontWeight: '800',
    },
    closeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    closeText: {
      color: alarmTheme.accentBright,
      fontWeight: '700',
    },
    list: {
      paddingHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    rowIcon: {
      fontSize: 20,
    },
    colorDot: {
      width: 38,
      height: 38,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowInfo: {
      flex: 1,
    },
    rowName: {
      color: alarmTheme.text,
      fontSize: alarmTypography.body,
      fontWeight: '700',
    },
    rowMeta: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      marginTop: 2,
    },
    smallBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: alarmTheme.surface2,
    },
    smallBtnText: {
      color: alarmTheme.text,
      fontWeight: '700',
      fontSize: alarmTypography.micro,
    },
    deleteBtn: {
      backgroundColor: 'rgba(220,38,38,0.18)',
    },
    deleteText: {
      color: alarmTheme.red,
      fontWeight: '700',
      fontSize: alarmTypography.micro,
    },
    form: {
      marginTop: 10,
      marginBottom: 28,
      padding: 14,
      borderRadius: 16,
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    formTitle: {
      color: alarmTheme.text,
      fontSize: alarmTypography.body,
      fontWeight: '800',
      marginBottom: 8,
    },
    formHint: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      marginBottom: 12,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    input: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface2,
      color: alarmTheme.text,
      paddingHorizontal: 12,
      fontSize: alarmTypography.body,
    },
    iconInput: {
      width: 62,
      textAlign: 'center',
    },
    nameInput: {
      flex: 1,
    },
    colorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    colorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface2,
    },
    colorSwatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    colorBtnActive: {
      borderColor: alarmTheme.accent,
      backgroundColor: alarmTheme.accentDim,
    },
    colorText: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      fontWeight: '700',
    },
    colorTextActive: {
      color: alarmTheme.accentBright,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 14,
    },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: alarmTheme.surface2,
    },
    cancelText: {
      color: alarmTheme.text,
      fontWeight: '700',
    },
    saveBtn: {
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: alarmTheme.accent,
    },
    disabledBtn: {
      opacity: 0.45,
    },
    saveText: {
      color: '#fff',
      fontWeight: '800',
    },
  });
}
