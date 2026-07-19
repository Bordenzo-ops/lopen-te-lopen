/**
 * HeartRateMonitorSheet
 *
 * Bottom sheet om een Bluetooth-hartslagmeter (borstband of horloge dat het
 * standaard BLE Heart Rate-profiel uitzendt) te koppelen of te ontkoppelen.
 * Verschijnt vanuit Instellingen. Werkt volledig zonder BLE-module,
 * -toestemming of gekoppelde meter: dan zie je alleen de lege-staat-tekst.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { X, HeartPulse, Bluetooth, Link2 } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import {
  isBleAvailable,
  requestBlePermissions,
  scanForHeartRateMonitors,
  connectToMonitor,
  disconnectMonitor,
  type ScannedHeartRateDevice,
} from '../../services/bleHeartRateService';

const SCAN_TIMEOUT_MS = 12000;

interface HeartRateMonitorSheetProps {
  visible: boolean;
  /** Id/naam van de al gekoppelde meter, of null als er nog geen koppeling is. */
  deviceId: string | null;
  deviceName: string | null;
  onClose: () => void;
  /** Slaat de gekozen meter op in de store (deviceId + naam). */
  onPair: (deviceId: string, deviceName: string) => void;
  /** Wist de koppeling in de store. */
  onUnpair: () => void;
}

export function HeartRateMonitorSheet({
  visible, deviceId, deviceName, onClose, onPair, onUnpair,
}: HeartRateMonitorSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedHeartRateDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [testBpm, setTestBpm] = useState<number | null>(null);
  const stopScanRef = useRef<() => void>(() => {});
  const bleAvailable = isBleAvailable();

  // Ruim scan/testverbinding netjes op zodra de sheet sluit.
  useEffect(() => {
    if (!visible) {
      stopScanRef.current();
      void disconnectMonitor();
      setScanning(false);
      setDevices([]);
      setScanError(null);
      setConnectingId(null);
      setTestBpm(null);
    }
    return () => {
      stopScanRef.current();
    };
  }, [visible]);

  async function handleScan() {
    setScanError(null);
    setDevices([]);

    if (!bleAvailable) {
      setScanError('Bluetooth-koppeling is nog niet beschikbaar in deze app-versie. Hiervoor is een nieuwe app-build nodig.');
      return;
    }

    const granted = await requestBlePermissions();
    if (!granted) {
      setScanError('Geen toestemming voor Bluetooth gekregen. Geef toegang via je toestelinstellingen.');
      return;
    }

    setScanning(true);
    stopScanRef.current = scanForHeartRateMonitors((found) => {
      setDevices(prev => (prev.some(d => d.id === found.id) ? prev : [...prev, found]));
    }, SCAN_TIMEOUT_MS);

    setTimeout(() => setScanning(false), SCAN_TIMEOUT_MS);
  }

  async function handleSelectDevice(device: ScannedHeartRateDevice) {
    stopScanRef.current();
    setScanning(false);
    setConnectingId(device.id);
    setTestBpm(null);

    const ok = await connectToMonitor(
      device.id,
      (bpm) => setTestBpm(bpm),
      () => setConnectingId(null),
    );

    if (ok) {
      onPair(device.id, device.name);
    } else {
      setScanError('Verbinden met deze meter is niet gelukt. Probeer het opnieuw.');
      setConnectingId(null);
    }
  }

  function handleUnpair() {
    void disconnectMonitor();
    onUnpair();
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.sheetTop}>
          <View style={styles.handle} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Sluiten">
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Hartslagmeter</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {deviceId ? (
            <View style={styles.pairedCard}>
              <View style={styles.pairedIconBox}>
                <HeartPulse size={22} color={colors.success} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pairedName}>{deviceName ?? 'Gekoppelde hartslagmeter'}</Text>
                <Text style={styles.pairedSub}>Gekoppeld — wordt verbonden bij de start van een run</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Bluetooth size={28} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Nog geen hartslagmeter gekoppeld</Text>
              <Text style={styles.emptySub}>
                Werkt met een borstband of horloge dat hartslag via Bluetooth uitzendt.
                Heb je een Apple Watch? Met een gratis app zoals HeartCast kun je die
                ook als hartslagmeter gebruiken.
              </Text>
            </View>
          )}

          {!!scanError && <Text style={styles.errorText}>{scanError}</Text>}

          {connectingId && (
            <View style={styles.testRow}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={styles.testText}>
                {testBpm != null ? `Verbonden — ${testBpm} bpm` : 'Verbinden...'}
              </Text>
            </View>
          )}

          {scanning && (
            <View style={styles.testRow}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={styles.testText}>Zoeken naar hartslagmeters...</Text>
            </View>
          )}

          {devices.length > 0 && (
            <View style={styles.deviceList}>
              {devices.map(device => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceRow}
                  onPress={() => handleSelectDevice(device)}
                  activeOpacity={0.8}
                  disabled={!!connectingId}
                  accessibilityRole="button"
                  accessibilityLabel={`Koppel met ${device.name}`}
                >
                  <Bluetooth size={16} color={colors.brandLight} strokeWidth={2} />
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Link2 size={14} color={colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {deviceId ? (
            <TouchableOpacity
              style={styles.unpairBtn}
              onPress={handleUnpair}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ontkoppelen"
            >
              <Text style={styles.unpairBtnText}>Ontkoppelen</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
              onPress={handleScan}
              activeOpacity={0.8}
              disabled={scanning}
              accessibilityRole="button"
              accessibilityLabel="Zoek hartslagmeters"
            >
              <Text style={styles.scanBtnText}>
                {scanning ? 'Bezig met zoeken...' : 'Zoek hartslagmeters'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    ...shadows.lg,
  },
  sheetTop: {
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: colors.borderDefault,
    borderRadius: radius.full,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing[2],
    top: spacing[1],
    padding: 4,
  },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing[1],
    paddingHorizontal: spacing[3],
  },
  scroll: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    gap: spacing[2],
  },
  pairedCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[2],
  },
  pairedIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${colors.success}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  pairedName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  pairedSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[3],
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary, textAlign: 'center', marginTop: spacing[1],
  },
  emptySub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  errorText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.error, textAlign: 'center',
  },
  testRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1],
    paddingVertical: spacing[1],
  },
  testText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  deviceList: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  deviceName: {
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  actions: {
    paddingHorizontal: spacing[3], paddingTop: spacing[2],
  },
  scanBtn: {
    minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.xl, backgroundColor: colors.brandPrimary,
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: '#fff',
  },
  unpairBtn: {
    minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.error,
  },
  unpairBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.error,
  },
});
