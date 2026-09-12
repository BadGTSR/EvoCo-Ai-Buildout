import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { getStagesForProject } from '../services/projectService';

export default function StageSelectorScreen({ navigation, route }) {
  const { site, project } = route.params;
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStagesForProject(project.id).then((data) => {
      setStages(data);
      setLoading(false);
    });
  }, [project.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{project.projectCode}</Text>
      <Text style={styles.subheader}>Select a stage</Text>

      <FlatList
        data={stages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.stageCard, item.isVariation && styles.stageCardVariation]}
            onPress={() => navigation.navigate('TimeLog', { site, project, stage: item })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.stageCode}>{item.stageCode}</Text>
              <Text style={styles.stageName}>{item.stageName}</Text>
            </View>
            {item.isVariation && <Text style={styles.variationBadge}>Variation</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No stages set up for this project yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subheader: { color: '#fff', fontSize: 20, fontWeight: '700', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageCardVariation: { borderColor: colors.accent },
  stageCode: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  stageName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  variationBadge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
