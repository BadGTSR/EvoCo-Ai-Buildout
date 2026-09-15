import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { getEntriesForDate } from '../services/timesheetService';
import { getMyProjects, getStagesForProject } from '../services/projectService';
import { getPendingCount } from '../services/offlineSync';
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
  const { user, activeSite } = useAuth();
  const site = route.params?.site || activeSite;
  const [entries, setEntries] = useState([]);
  const [projectsById, setProjectsById] = useState({});
  const [stagesById, setStagesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const today = localDateString();

  const load = useCallback(async () => {
    if (!user) return;
    const data = await getEntriesForDate(user.uid, today);
    const sorted = data.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    setEntries(sorted);
    setPendingCount(getPendingCount());

    const projects = await getMyProjects(user.uid);
    setProjectsById(Object.fromEntries(projects.map((p) => [p.id, p])));

    const projectIds = [...new Set(sorted.map((e) => e.projectId).filter(Boolean))];
    const stageLists = await Promise.all(projectIds.map((id) => getStagesForProject(id)));
    const stageEntries = stageLists.flat().map((s) => [s.id, s]);
    setStagesById(Object.fromEntries(stageEntries));
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalMinutes = entries
    .filter((e) => e.entryType === 'work')
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  const editEntry = (item) => {
    const project = projectsById[item.projectId];
    const stage = stagesById[item.stageId];
    if (item.entryType !== 'work' || !project || !stage) return; // only real work entries, resolved, are editable
    navigation.navigate('TimeLog', { site, project, stage, entry: item });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Today's Entries</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MyRequests')}>
          <Text style={styles.headerLink}>My Requests</Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const project = projectsById[item.projectId];
            const stage = stagesById[item.stageId];
            const title = project
              ? `${project.projectCode} · ${stage ? stage.stageName : ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType}`
              : ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType;
            const editable = item.entryType === 'work' && project && stage;

            return (
              <TouchableOpacity
                style={styles.entryCard}
                onPress={() => editEntry(item)}
                disabled={!editable}
                activeOpacity={editable ? 0.6 : 1}
              >
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
                {editable && <Text style={styles.editHint}>Tap to edit</Text>}
              </TouchableOpacity>
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
        <Text style={styles.addButtonText}>+ Log Time</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  header: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerLink: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  syncBanner: {
    backgroundColor: 'rgba(242,169,31,0.1)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  syncBannerText: { color: colors.accent, fontSize: 12.5, fontWeight: '600' },
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
  editHint: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
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
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: { color: '#141414', fontWeight: '700', fontSize: 16 },
});
