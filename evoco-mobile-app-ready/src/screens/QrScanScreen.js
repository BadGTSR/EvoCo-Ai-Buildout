// EvoCo Timesheet App — QR Scan Screen
// First screen workers see each day: scan the site QR to begin check-in

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { resolveSiteFromQr } from '../services/attendanceService';
import { colors, spacing } from '../theme';

export default function QrScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  async function handleScan({ data }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setError('');

    try {
      const site = await resolveSiteFromQr(data);
      navigation.navigate('HsQuestionnaire', { site });
    } catch (err) {
      setError(err.message);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is needed to scan the site QR code.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualLink}
          onPress={() => navigation.navigate('ManualSiteSelect')}
        >
          <Text style={styles.manualLinkText}>Can't scan? Choose your site instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Site QR Code</Text>
      <View style={styles.scannerFrame}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>Point your camera at the QR code posted at the site entrance</Text>
      <TouchableOpacity
        style={styles.manualLink}
        onPress={() => navigation.navigate('ManualSiteSelect')}
      >
        <Text style={styles.manualLinkText}>Can't scan? Choose your site instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  scannerFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  manualLink: { marginTop: spacing.lg, padding: spacing.sm },
  manualLinkText: { color: colors.accent, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  message: { color: '#fff', textAlign: 'center', marginBottom: spacing.lg },
  error: { color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#141414', fontWeight: '700' },
});
