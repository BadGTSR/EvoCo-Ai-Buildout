import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../theme';
import { logTimeEntry, updateTimeEntry, uploadTimesheetPhoto, getEntriesForDate } from '../services/timesheetService';
import { useAuth } from '../context/AuthContext';
import { formatEntryDate, combineDateAndTime, localDateString } from '../utils/dateUtils';
import { findOverlappingEntry, latestEndTime } from '../utils/timeOverlap';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TimeLogScreen({ navigation, route }) {
  const { site, project, stage, entry, breakOption } = route.params;
  const isEditing = !!entry;
  const isBreak = !!breakOption;
  const { user } = useAuth();

  const [entryDate, setEntryDate] = useState(entry ? new Date(entry.startTime) : new Date());
  const [startTime, setStartTime] = useState(entry ? new Date(entry.startTime) : new Date());
  const [endTime, setEndTime] = useState(entry ? new Date(entry.endTime) : null);
  const [durationMinutes, setDurationMinutes] = useState(
    entry ? Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / 60000) : (breakOption?.defaultMinutes || 30)
  );
  const [notes, setNotes] = useState(entry?.notes ?? (isBreak ? breakOption.label : ''));
  const [photos, setPhotos] = useState([]); // newly-added local URIs, uploaded on save
  const [existingPhotoUrls, setExistingPhotoUrls] = useState(entry?.photoUrls || []); // already-uploaded, kept unless removed
  const [saving, setSaving] = useState(false);
  // Which field's picker is open — only ever one at a time.
  const [activePicker, setActivePicker] = useState(null); // null | 'date' | 'start' | 'end'

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Entry' : isBreak ? 'Log Break' : 'Log Time' });
  }, [isEditing, isBreak]);

  // A break's end time is derived from its length, not picked directly.
  useEffect(() => {
    if (isBreak) setEndTime(new Date(startTime.getTime() + durationMinutes * 60000));
  }, [isBreak, startTime, durationMinutes]);

  // New (non-edit) entries default their start to right after whatever was
  // logged last today, so times naturally chain instead of overlapping.
  useEffect(() => {
    if (isEditing) return;
    getEntriesForDate(user.uid, localDateString(entryDate)).then((todays) => {
      const chained = latestEndTime(todays);
      if (chained) setStartTime(chained);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Enable camera access to attach a site photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (uri) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const removeExistingPhoto = (url) => {
    setExistingPhotoUrls((prev) => prev.filter((p) => p !== url));
  };

  const adjustDuration = (deltaMinutes) => {
    setDurationMinutes((m) => Math.max(5, m + deltaMinutes));
  };

  const handleSave = async () => {
    if (!endTime) {
      Alert.alert('End time needed', 'Set an end time before saving this entry.');
      return;
    }
    setSaving(true);
    try {
      const finalStart = combineDateAndTime(entryDate, startTime);
      const finalEnd = combineDateAndTime(entryDate, endTime);

      if (finalEnd <= finalStart) {
        Alert.alert('Check the times', 'End time must be after the start time.');
        setSaving(false);
        return;
      }

      const daysEntries = await getEntriesForDate(user.uid, localDateString(entryDate));
      const conflict = findOverlappingEntry(finalStart, finalEnd, daysEntries, entry?.id);
      if (conflict) {
        Alert.alert(
          'Times overlap',
          `This overlaps with ${formatTime(new Date(conflict.startTime))} – ${formatTime(new Date(conflict.endTime))}. Adjust the times so they don’t double up.`
        );
        setSaving(false);
        return;
      }

      const newPhotoUrls = [];
      for (const localUri of photos) {
        const url = await uploadTimesheetPhoto({
          projectCode: project.projectCode,
          userId: user.uid,
          localUri,
        });
        newPhotoUrls.push(url);
      }
      const photoUrls = [...existingPhotoUrls, ...newPhotoUrls];

      if (isEditing) {
        await updateTimeEntry(entry, {
          startTime: finalStart.toISOString(),
          endTime: finalEnd.toISOString(),
          notes,
          photoUrls,
        });
        navigation.goBack();
      } else {
        logTimeEntry({
          userId: user.uid,
          projectId: project.id,
          stageId: isBreak ? null : stage.id,
          entryType: isBreak ? breakOption.entryType : 'work',
          startTime: finalStart.toISOString(),
          endTime: finalEnd.toISOString(),
          notes,
          photoUrls,
        });
        navigation.navigate('DailySummary', { site, justLoggedEntry: true });
      }
    } catch (err) {
      Alert.alert('Couldn’t save', err.message || 'Something went wrong saving this entry.');
    } finally {
      setSaving(false);
    }
  };

  // Android's dialog closes itself; iOS's spinner stays open until "Done".
  const onChangeActivePicker = (event, selected) => {
    if (Platform.OS === 'android') setActivePicker(null);
    if (event.type === 'dismissed' || !selected) return;
    if (activePicker === 'date') setEntryDate(selected);
    else if (activePicker === 'start') setStartTime(selected);
    else if (activePicker === 'end') setEndTime(selected);
  };

  const activePickerConfig =
    activePicker === 'date'
      ? { value: entryDate, mode: 'date', maximumDate: new Date(), title: 'Date' }
      : activePicker === 'start'
        ? { value: startTime, mode: 'time', title: 'Start Time' }
        : activePicker === 'end'
          ? { value: endTime || new Date(), mode: 'time', title: 'End Time' }
          : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>{project.projectCode} · {project.projectName}</Text>
      <Text style={styles.subHeader}>{isBreak ? breakOption.label : stage.stageName}</Text>

      <Text style={styles.fieldLabel}>Date</Text>
      <TouchableOpacity style={styles.dateRow} onPress={() => setActivePicker('date')}>
        <Text style={styles.dateValue}>{formatEntryDate(entryDate)}</Text>
      </TouchableOpacity>

      {isBreak ? (
        <View style={styles.timeRow}>
          <TouchableOpacity style={styles.timeBlock} onPress={() => setActivePicker('start')}>
            <Text style={styles.timeLabel}>Start</Text>
            <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
          </TouchableOpacity>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Length</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => adjustDuration(-5)}>
                <Text style={styles.stepperButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.durationValue}>{durationMinutes} min</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => adjustDuration(5)}>
                <Text style={styles.stepperButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.timeRow}>
          <TouchableOpacity style={styles.timeBlock} onPress={() => setActivePicker('start')}>
            <Text style={styles.timeLabel}>Start</Text>
            <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
          </TouchableOpacity>
          <Text style={styles.timeSeparator}>→</Text>
          <TouchableOpacity style={styles.timeBlock} onPress={() => setActivePicker('end')}>
            <Text style={styles.timeLabel}>End</Text>
            <Text style={[styles.timeValue, !endTime && styles.timeValuePlaceholder]}>
              {endTime ? formatTime(endTime) : 'Tap to set'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {Platform.OS === 'android' && activePickerConfig && (
        <DateTimePicker
          value={activePickerConfig.value}
          mode={activePickerConfig.mode}
          display="default"
          maximumDate={activePickerConfig.maximumDate}
          onChange={onChangeActivePicker}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          transparent
          animationType="fade"
          visible={activePicker !== null}
          onRequestClose={() => setActivePicker(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {activePickerConfig && (
                <>
                  <Text style={styles.modalTitle}>{activePickerConfig.title}</Text>
                  <DateTimePicker
                    value={activePickerConfig.value}
                    mode={activePickerConfig.mode}
                    display="spinner"
                    maximumDate={activePickerConfig.maximumDate}
                    onChange={onChangeActivePicker}
                    textColor="#ffffff"
                  />
                </>
              )}
              <TouchableOpacity style={styles.modalDoneButton} onPress={() => setActivePicker(null)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        placeholder="What did you get done?"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
      />

      <Text style={styles.fieldLabel}>Photos (optional)</Text>
      <View style={styles.photoRow}>
        {existingPhotoUrls.map((url) => (
          <TouchableOpacity key={url} onPress={() => removeExistingPhoto(url)} style={styles.photoThumbWrap}>
            <Image source={{ uri: url }} style={styles.photoThumb} />
            <View style={styles.photoRemoveBadge}>
              <Text style={styles.photoRemoveText}>×</Text>
            </View>
          </TouchableOpacity>
        ))}
        {photos.map((uri) => (
          <TouchableOpacity key={uri} onPress={() => removePhoto(uri)} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <View style={styles.photoRemoveBadge}>
              <Text style={styles.photoRemoveText}>×</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addPhotoButton} onPress={addPhoto}>
          <Text style={styles.addPhotoPlus}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#141414" />
        ) : (
          <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Save Entry'}</Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  subHeader: { color: '#fff', fontSize: 13, fontWeight: '500', marginBottom: spacing.lg },
  dateRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  modalDoneButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.md,
  },
  modalDoneText: { color: '#141414', fontWeight: '700', fontSize: 15 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  timeValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  timeValuePlaceholder: { color: colors.textMuted, fontSize: 14, fontWeight: '400' },
  timeSeparator: { color: colors.textMuted, fontSize: 18, paddingHorizontal: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { color: colors.accent, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  durationValue: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 56, textAlign: 'center' },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs, textTransform: 'uppercase' },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: '#fff',
    padding: spacing.md,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 8 },
  photoRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontWeight: '700', fontSize: 13, lineHeight: 14 },
  addPhotoButton: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: { color: colors.textMuted, fontSize: 28, lineHeight: 28 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#141414', fontWeight: '700', fontSize: 16 },
});
