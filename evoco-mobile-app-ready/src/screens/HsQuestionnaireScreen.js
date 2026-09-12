// EvoCo Timesheet App — H&S Questionnaire
// Shown immediately after a successful QR scan, before check-in is recorded.
// NOTE: placeholder questions — Andre to confirm final wording per open item.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { checkIn, startGeofenceWatch } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

const QUESTIONS = [
  { key: 'fitForWork', text: 'Are you fit and well to work today?' },
  { key: 'noHazards', text: 'Have you checked the site for new hazards?' },
  { key: 'ppeReady', text: 'Do you have all required PPE with you?' },
  { key: 'noAlcoholDrugs', text: 'Are you free from alcohol or drug impairment?' },
];

export default function HsQuestionnaireScreen({ route, navigation }) {
  const { site } = route.params;
  const { user, setActiveSite } = useAuth();
  const [answers, setAnswers] = useState({});

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== undefined);
  const allYes = QUESTIONS.every((q) => answers[q.key] === true);

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    setActiveSite(site);
    checkIn({ userId: user.uid, site, hsAnswers: answers });
    startGeofenceWatch(site, () => {
      // Auto-checkout fires from here when the worker leaves the geofence.
      // Handled globally — see App.js for the active-site watcher setup.
    });
    navigation.replace('CheckInConfirmed', { site });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.siteTag}>{site.siteName}</Text>
      <Text style={styles.title}>Daily Health & Safety Check</Text>

      {QUESTIONS.map((q) => (
        <View key={q.key} style={styles.questionCard}>
          <Text style={styles.questionText}>{q.text}</Text>
          <View style={styles.answerRow}>
            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[q.key] === true && styles.answerButtonSelectedYes,
              ]}
              onPress={() => setAnswer(q.key, true)}
            >
              <Text style={styles.answerText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[q.key] === false && styles.answerButtonSelectedNo,
              ]}
              onPress={() => setAnswer(q.key, false)}
            >
              <Text style={styles.answerText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {allAnswered && !allYes && (
        <Text style={styles.warning}>
          A "No" answer has been flagged. Please speak to your site supervisor before starting work.
        </Text>
      )}

      <TouchableOpacity
        style={[styles.submitButton, !allAnswered && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!allAnswered}
      >
        <Text style={styles.submitText}>Confirm & Check In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 60 },
  siteTag: { color: colors.accent, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  questionText: { color: '#fff', fontSize: 15, marginBottom: spacing.sm },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  answerButtonSelectedYes: { backgroundColor: colors.success },
  answerButtonSelectedNo: { backgroundColor: colors.error },
  answerText: { color: '#fff', fontWeight: '600' },
  warning: {
    color: colors.error,
    backgroundColor: 'rgba(255,107,107,0.1)',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { color: '#141414', fontWeight: '700', fontSize: 16 },
});
