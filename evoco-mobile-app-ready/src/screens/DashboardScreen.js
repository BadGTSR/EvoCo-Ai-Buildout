import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { colors, spacing } from '../theme';
import { getEntriesForDate } from '../services/timesheetService';
import { getPendingCount } from '../services/offlineSync';
import { useAuth } from '../context/AuthContext';

function minutesToHours(mins) {
  return (mins / 60).toFixed(1);
}

export default function DashboardScreen({ navigation }) {
  const { user, activeSite: site } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const loadEntries = useCallback(async () => {
    if (!user) return;
    const data = await getEntriesForDate(user.uid, today);
    setEntries(data);
    setPendingCount(getPendingCount());
  }, [user, today]);

  useEffect(() => {
    setLoading(true);
    loadEntries().finally(() => setLoading(false));
  }, [loadEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const workedMinutes = entries
    .filter((e) => e.entryType === 'work')
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  const paidBreakTaken = entries.some((e) => e.entryType === 'paid_break');
  const unpaidBreakTaken = entries.some((e) => e.entryType === 'unpaid_break');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.greeting}>G'day{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</Text>
      <Text style={styles.siteLabel}>{site?.siteName || 'On site'}</Text>

      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync
          </Text>
        </View>
      )}

      <View style={styles.hoursCard}>
        <Text style={styles.hoursLabel}>Hours today</Text>
        <Text style={styles.hoursValue}>{loading ? '—' : minutesToHours(workedMinutes)}</Text>
      </View>

      <View style={styles.breaksRow}>
        <View style={[styles.breakPill, paidBreakTaken && styles.breakPillDone]}>
          <Text style={styles.breakPillText}>{paidBreakTaken ? '✓ ' : ''}Paid Break</Text>
        </View>
        <View style={[styles.breakPill, unpaidBreakTaken && styles.breakPillDone]}>
          <Text style={styles.breakPillText}>{unpaidBreakTaken ? '✓ ' : ''}Unpaid Break</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('ProjectSelector', { site })}
      >
        <Text style={styles.primaryButtonText}>+ Log Time</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('DailySummary', { site })}
      >
        <Text style={styles.secondaryButtonText}>View Today's Entries ({entries.length})</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('MyRequests')}
      >
        <Text style={styles.linkButtonText}>My Backdate Requests</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '700' },
  siteLabel: { color: colors.accent, fontSize: 14, marginTop: 2, marginBottom: spacing.lg },
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
  hoursCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hoursLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  hoursValue: { color: '#fff', fontSize: 40, fontWeight: '700' },
  breaksRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  breakPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  breakPillDone: { borderColor: colors.success },
  breakPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: { color: '#141414', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: { color: '#fff', fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: spacing.sm },
  linkButtonText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
