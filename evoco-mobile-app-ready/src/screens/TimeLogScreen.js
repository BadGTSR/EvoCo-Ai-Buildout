import React, { useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../theme';
import { logTimeEntry, uploadTimesheetPhoto } from '../services/timesheetService';
import { useAuth } from '../context/AuthContext';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatEntryDate(date) {
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Applies entryDate's year/month/day onto time's hour/minute. */
function combineDateAndTime(entryDate, time) {
  const combined = new Date(entryDate);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

export default function TimeLogScreen({ navigation, route }) {
  const { site, project, stage } = route.params;
  const { user } = useAuth();

  const [entryDate, setEntryDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]); // local URIs, uploaded on save
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

  const handleSave = async () => {
    if (!endTime) {
      Alert.alert('End time needed', 'Set an end time before saving this entry.');
      return;
    }
    setSaving(true);
    try {
      const photoUrls = [];
      for (const localUri of photos) {
        const url = await uploadTimesheetPhoto({
          projectCode: project.projectCode,
          userId: user.uid,
          localUri,
        });
        photoUrls.push(url);
      }

      logTimeEntry({
        userId: user.uid,
        projectId: project.id,
        stageId: stage.id,
        entryType: 'work',
        startTime: combineDateAndTime(entryDate, startTime).toISOString(),
        endTime: combineDateAndTime(entryDate, endTime).toISOString(),
        notes,
        photoUrls,
      });

      navigation.navigate('DailySummary', { site, justLoggedEntry: true });
    } catch (err) {
      Alert.alert('Couldn\u2019t save', err.message || 'Something went wrong saving this entry.');
    } finally {
      setSaving(false);
    }
  };

  const onChangeDate = (event, selected) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setEntryDate(selected);
  };

  const onChangeStart = (event, selected) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setStartTime(selected);
  };

  const onChangeEnd = (event, selected) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setEndTime(selected);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{project.projectCode} · {stage.stageName}</Text>

      <Text style={styles.fieldLabel}>Date</Text>
      <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateValue}>{formatEntryDate(entryDate)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <>
          <DateTimePicker
            value={entryDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onChangeDate}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.timeRow}>
        <TouchableOpacity style={styles.timeBlock} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.timeLabel}>Start</Text>
          <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
        </TouchableOpacity>
        <Text style={styles.timeSeparator}>→</Text>
        <TouchableOpacity style={styles.timeBlock} onPress={() => setShowEndPicker(true)}>
          <Text style={styles.timeLabel}>End</Text>
          <Text style={[styles.timeValue, !endTime && styles.timeValuePlaceholder]}>
            {endTime ? formatTime(endTime) : 'Tap to set'}
          </Text>
        </TouchableOpacity>
      </View>
      {showStartPicker && (
        <>
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeStart}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowStartPicker(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      {showEndPicker && (
        <>
          <DateTimePicker
            value={endTime || new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeEnd}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowEndPicker(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </>
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
          <Text style={styles.saveButtonText}>Save Entry</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { color: colors.accent, fontSize: 15, fontWeight: '700', marginBottom: spacing.lg },
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
  pickerDoneButton: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  pickerDoneText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
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
