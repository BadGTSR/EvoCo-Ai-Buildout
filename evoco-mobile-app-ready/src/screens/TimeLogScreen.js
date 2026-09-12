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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../theme';
import { logTimeEntry, uploadTimesheetPhoto } from '../services/timesheetService';
import { useAuth } from '../context/AuthContext';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TimeLogScreen({ navigation, route }) {
  const { site, project, stage } = route.params;
  const { user } = useAuth();

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]); // local URIs, uploaded on save
  const [saving, setSaving] = useState(false);

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
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
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

  const bumpEndTimeNow = () => setEndTime(new Date());

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{project.projectCode} · {stage.stageName}</Text>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Start</Text>
          <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
        </View>
        <Text style={styles.timeSeparator}>→</Text>
        <TouchableOpacity style={styles.timeBlock} onPress={bumpEndTimeNow}>
          <Text style={styles.timeLabel}>End</Text>
          <Text style={[styles.timeValue, !endTime && styles.timeValuePlaceholder]}>
            {endTime ? formatTime(endTime) : 'Tap to set'}
          </Text>
        </TouchableOpacity>
      </View>

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
