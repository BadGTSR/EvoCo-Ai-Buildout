import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { getEntriesForDate } from '../services/timesheetService';
import { getMyProjects, getStagesForProject } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { localDateString } from '../utils/dateUtils';

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
  const [projectsById, setProjectsById] = useState({});
  const [stagesById, setStagesById] = useState({});
  const [loading, setLoading] = useState(true);

  const today = localDateString();

  const load = useCallback(async () => {
    if (!user) return;
    const data = await getEntriesForDate(user.uid, today);
    const sorted = data.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    setEntries(sorted);

    const projects = await getMyProjects(user.uid);
    setProjectsById(Object.fromEntries(projects.map((p) => [p.id, p])));

    const projectIds = [...new Set(sorted.map((e) => e.projectId).filter(Boolean))];
    const stageLists = await Promise.all(projectIds.map((id) => getStagesForProject(id)));
    const stageEntries = stageLists.flat().map((s) => [s.id, s]);
    setStagesById(Object.fromEntries(stageEntries));

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
      <Text style={styles.header}>Today's Entries</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const project = projectsById[item.projectId];
            const stage = stagesById[item.stageId];
            const title = project
              ? `${project.projectCode} · ${stage ? stage.stageName : ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType}`
              : ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType;

            return (
              <View style={styles.entryCard}>
                <View style={styles.entryTopRow}>
                  <Text style={styles.entryTitle}>{title}</Text>
                  <Text style={styles.entryHours}>{((item.durationMinutes || 0) / 60).toFixed(1)}h</Text>
                </View>
                <Text style={styles.entryTimeRange}>
                  {formatTime(item.startTime)} → {formatTime(item.endTime)}
                </Text>
                {item.notes ? <Text style={styles.entryNotes}>{item.notes}</Text> : null}
                {item.isBackdated && <Text style={styles.backdatedTag}>Pending approval</Text>}
                {item._pending && <Text style={styles.backdatedTag}>Syncing…</Text>}
                {item.photoUrls?.length > 0 && (
                  <Text style={styles.photoCount}>📷 {item.photoUrls.length}</Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No entries logged yet today.</Text>
          }
        />
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total for today</Text>
        <Text style={styles.totalHours}>{(totalMinutes / 60).toFixed(1)}h</Text>
      </View>

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
  header: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  list: { paddingBottom: spacing.md },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  entryHours: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  entryTimeRange: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  entryNotes: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  backdatedTag: { color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 4 },
  photoCount: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.md,
  },
  totalLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  totalHours: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  addButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: { color: colors.accent, fontWeight: '700' },
});
