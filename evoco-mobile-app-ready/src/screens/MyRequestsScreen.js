import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { getMyBackdateRequests } from '../services/timesheetService';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLES = {
  pending: { label: 'Pending', color: colors.accent },
};

export default function MyRequestsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getMyBackdateRequests(user.uid).then((data) => {
        if (active) {
          // Once a manager actions a request on the dashboard it's no longer
          // this screen's concern — only pending ones need the worker's eyes.
          setRequests(data.filter((r) => r.status === 'pending'));
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [user])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Pending Backdate Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const status = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.date}>{item.requestedDate}</Text>
                <Text style={[styles.statusBadge, { color: status.color, borderColor: status.color }]}>
                  {status.label}
                </Text>
              </View>
              <Text style={styles.duration}>{(item.durationMinutes / 60).toFixed(1)}h requested</Text>
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No pending backdate requests.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  list: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  duration: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  reason: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
