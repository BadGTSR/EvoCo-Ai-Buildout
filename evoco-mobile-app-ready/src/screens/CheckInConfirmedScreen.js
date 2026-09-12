import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../theme';

export default function CheckInConfirmedScreen({ route, navigation }) {
  const { site } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.title}>You're checked in</Text>
      <Text style={styles.siteName}>{site.siteName}</Text>
      <Text style={styles.subtext}>
        You'll be automatically checked out when you leave site. Log in below to start
        recording your time.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace('AppLogin', { site })}
      >
        <Text style={styles.buttonText}>Continue to Timesheet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkMark: { color: '#fff', fontSize: 44, fontWeight: '700' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  siteName: { color: colors.accent, fontSize: 16, marginBottom: spacing.lg },
  subtext: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#141414', fontWeight: '700', fontSize: 16 },
});
