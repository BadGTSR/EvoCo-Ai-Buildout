import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { getEntriesForDate } from '../services/timesheetService';
import { useAuth } from '../context/AuthContext';

const ENTRY_TYPE_LABELS = {
  work: 'Work',
  paid_break: 'Paid Break',
  unpaid_break: 'Unpaid Break',
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DailySummaryScreen({ navigation, route }) {
  const { site } = route.params || {};
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;
    const data = await getEntriesForDate(user.uid, today);
    setEntries(data.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    setLoading(false);
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const totalMinutes = entries
    .filter((e) => e.entryType === 'work')
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Today's Entries</Text>
        <Text style={styles.totalHours}>{(totalMinutes / 60).toFixed(1)}h</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.entryCard}>
              <View style={styles.entryTimeCol}>
                <Text style={styles.entryTime}>{formatTime(item.startTime)}</Text>
                <Text style={styles.entryTimeMuted}>{formatTime(item.endTime)}</Text>
              </View>
              <View style={styles.entryDetailsCol}>
                <Text style={styles.entryType}>{ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType}</Text>
                {item.notes ? <Text style={styles.entryNotes}>{item.notes}</Text> : null}
                {item.isBackdated && (
                  <Text style={styles.backdatedTag}>Pending approval</Text>
                )}
                {item._pending && (
                  <Text style={styles.backdatedTag}>Syncing…</Text>
                )}
              </View>
              {item.photoUrls?.length > 0 && (
                <Text style={styles.photoCount}>📷 {item.photoUrls.length}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No entries logged yet today.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('ProjectSelector', { site })}
      >
        <Text style={styles.addButtonText}>+ Add another entry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  header: { color: '#fff', fontSize: 20, fontWeight: '700' },
  totalHours: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  list: { paddingBottom: spacing.md },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryTimeCol: { width: 60, marginRight: spacing.md },
  entryTime: { color: '#fff', fontSize: 13, fontWeight: '600' },
  entryTimeMuted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  entryDetailsCol: { flex: 1 },
  entryType: { color: '#fff', fontSize: 15, fontWeight: '600' },
  entryNotes: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  backdatedTag: { color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 4 },
  photoCount: { color: colors.textMuted, fontSize: 12, alignSelf: 'flex-start' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  addButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: { color: colors.accent, fontWeight: '700' },
});
