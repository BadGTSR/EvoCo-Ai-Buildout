// EvoCo Timesheet App — Manual Site Select Screen
// Fallback for the QR scan: broken camera, damaged code, no permission,
// or the worker just can't get a scan to register. Picks the same
// path into the H&S questionnaire that a successful scan would.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { getAllSites } from '../services/attendanceService';
import { colors, spacing } from '../theme';

export default function ManualSiteSelectScreen({ navigation }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllSites()
      .then((data) => {
        setSites(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load sites. Check your connection and try again.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select your site</Text>
      <Text style={styles.subheader}>
        Only use this if you can't scan the QR code posted at the site entrance.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !error && (
            <Text style={styles.empty}>No sites found. Ask your manager to check the site list.</Text>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.siteCard}
            onPress={() => navigation.navigate('HsQuestionnaire', { site: item })}
          >
            <Text style={styles.siteName}>{item.siteName}</Text>
            {item.qrCode ? <Text style={styles.siteCode}>{item.qrCode}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  subheader: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  siteCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  siteName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  siteCode: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  error: { color: colors.error, textAlign: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md },
});
