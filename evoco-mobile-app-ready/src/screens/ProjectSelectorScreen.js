import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { getMyProjects, getBreakOptions } from '../services/projectService';
import { useAuth } from '../context/AuthContext';

export default function ProjectSelectorScreen({ navigation, route }) {
  const { site } = route.params || {};
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProjects(user?.uid).then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, [user]);

  const handleBreak = (breakOption) => {
    const project = projects.find((p) => p.id === site?.projectId) || {
      id: site?.projectId ?? 'evoco-internal',
      projectCode: 'EVOCO',
      projectName: 'EvoCo Internal',
    };
    navigation.navigate('TimeLog', { site, project, breakOption });
  };

  const breakOptions = getBreakOptions();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a project</Text>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.projectCard}
            onPress={() => navigation.navigate('StageSelector', { site, project: item })}
          >
            <Text style={styles.projectCode}>{item.projectCode}</Text>
            <Text style={styles.projectName}>{item.projectName}</Text>
            {item.client ? <Text style={styles.projectClient}>{item.client}</Text> : null}
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={styles.breaksSection}>
            <Text style={styles.breaksHeader}>Breaks</Text>
            {breakOptions.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.breakCard}
                onPress={() => handleBreak(b)}
              >
                <Text style={styles.breakLabel}>{b.label}</Text>
                <Text style={styles.breakArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 20, fontWeight: '700', padding: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  projectCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectCode: { color: colors.accent, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  projectName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  projectClient: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  breaksSection: { marginTop: spacing.lg },
  breaksHeader: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase' },
  breakCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakLabel: { color: '#fff', fontSize: 15 },
  breakArrow: { color: colors.textMuted, fontSize: 20 },
});
