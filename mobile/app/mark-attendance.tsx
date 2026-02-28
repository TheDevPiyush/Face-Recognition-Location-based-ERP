import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiService } from '@/services/api';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import type { CurrentUser } from '@/types/user';
import type { SubjectItem } from '@/types/dashboard';
import type { AttendanceWindow } from '@/types/window';

// ─── Toggle this to false when going to production ────────────────────────────
const IS_TEST_MODE = true;

const DURATION_OPTS = [30, 60, 120, 300];

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Scanning overlay ─────────────────────────────────────────────────────────
type ScanStep = 'idle' | 'camera' | 'face' | 'location' | 'uploading' | 'done' | 'error';

function ScanOverlay({ step, errorMsg }: { step: ScanStep; errorMsg?: string }) {
  const scanLine  = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  // Scan line sweep
  useEffect(() => {
    if (step !== 'face') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [step]);

  // Pulsing ring for location
  useEffect(() => {
    if (step !== 'location') return;
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale,   { toValue: 1.4, duration: 900, useNativeDriver: true }),
          Animated.timing(ringScale,   { toValue: 1,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.1, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [step]);

  // Uploading dots
  useEffect(() => {
    if (step !== 'uploading') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 1,   duration: 400, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [step]);

  // Success pop
  useEffect(() => {
    if (step !== 'done') return;
    Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [step]);

  const scanTranslate = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });

  const stepLabel: Record<ScanStep, string> = {
    idle:      '',
    camera:    'Opening camera…',
    face:      'Scanning face…',
    location:  'Getting location…',
    uploading: 'Verifying & marking…',
    done:      'Attendance marked!',
    error:     errorMsg ?? 'Something went wrong',
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={ov.backdrop}>
        <View style={ov.card}>

          {/* Face scan */}
          {step === 'face' && (
            <View style={ov.faceBox}>
              {/* Corner brackets */}
              <View style={[ov.corner, ov.tl]} />
              <View style={[ov.corner, ov.tr]} />
              <View style={[ov.corner, ov.bl]} />
              <View style={[ov.corner, ov.br]} />
              {/* Scan line */}
              <Animated.View style={[ov.scanLine, { transform: [{ translateY: scanTranslate }] }]} />
              <Ionicons name="person-outline" size={64} color="rgba(255,255,255,0.15)" />
            </View>
          )}

          {/* Location pulse */}
          {step === 'location' && (
            <View style={ov.locWrap}>
              <Animated.View style={[ov.locRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
              <View style={ov.locDot}>
                <Ionicons name="location" size={28} color={AppColors.primary[600]} />
              </View>
            </View>
          )}

          {/* Uploading */}
          {step === 'uploading' && (
            <View style={ov.uploadWrap}>
              <ActivityIndicator size="large" color={AppColors.primary[600]} />
              <Animated.View style={{ opacity: dotOpacity, marginTop: 8 }}>
                <Text style={ov.dotText}>● ● ●</Text>
              </Animated.View>
            </View>
          )}

          {/* Success */}
          {step === 'done' && (
            <Animated.View style={[ov.successCircle, { transform: [{ scale: checkScale }] }]}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </Animated.View>
          )}

          {/* Error */}
          {step === 'error' && (
            <View style={ov.errorCircle}>
              <Ionicons name="close" size={48} color="#fff" />
            </View>
          )}

          {/* Step label */}
          <Text style={[
            ov.label,
            step === 'done'  && ov.labelSuccess,
            step === 'error' && ov.labelError,
          ]}>
            {stepLabel[step]}
          </Text>

          {/* Step pills */}
          {(step === 'face' || step === 'location' || step === 'uploading') && (
            <View style={ov.pills}>
              {(['face', 'location', 'uploading'] as ScanStep[]).map((s) => (
                <View key={s} style={[ov.pill, step === s && ov.pillActive]} />
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MarkAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [me, setMe]               = useState<CurrentUser | null>(null);
  const [subjects, setSubjects]   = useState<SubjectItem[]>([]);
  const [batches, setBatches]     = useState<Array<{ id: string; name: string | null }>>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [batchId, setBatchId]     = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(60);
  const [windowInfo, setWindowInfo]   = useState<AttendanceWindow | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const countdownRefresh              = useRef(false);

  // Scan overlay state
  const [scanStep, setScanStep]     = useState<ScanStep>('idle');
  const [scanError, setScanError]   = useState<string>();

  const myBatchId       = (me as any)?.batchId ?? null;
  const mySubjects      = subjects.filter((s: any) => myBatchId ? (s.batchId ?? s.batch_id) === myBatchId : true);
  const filteredSubjects = batchId ? subjects.filter((s: any) => (s.batchId ?? s.batch_id) === batchId) : subjects;
  const isAdmin         = me?.role === 'admin' || me?.role === 'teacher';

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    try {
      setError(null);
      const [user, subs] = await Promise.all([
        apiService.getCurrentUser(),
        apiService.getSubjects(),
      ]);
      setMe(user as any);
      setSubjects(subs);

      const uid = (user as any).batchId ?? null;
      if (uid) setBatchId(uid);

      if (user?.role === 'admin' || user?.role === 'teacher') {
        const bats = await apiService.getBatches();
        setBatches(bats);
        if (bats.length && !uid) setBatchId(bats[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Auto-select first subject
  useEffect(() => {
    if (myBatchId && mySubjects.length && subjectId == null) setSubjectId((mySubjects[0] as any).id);
  }, [myBatchId, mySubjects.length]);

  useEffect(() => {
    if (isAdmin && batchId && filteredSubjects.length && subjectId == null) setSubjectId((filteredSubjects[0] as any).id);
  }, [isAdmin, batchId, filteredSubjects.length]);

  const handleBatchChange = useCallback((b: { id: string }) => {
    setBatchId(b.id);
    const next = subjects.filter((s: any) => (s.batchId ?? s.batch_id) === b.id);
    setSubjectId((next[0] as any)?.id ?? null);
    setWindowInfo(null);
  }, [subjects]);

  const handleSubjectChange = useCallback((s: { id: string }) => {
    setSubjectId(s.id);
    setWindowInfo(null);
  }, []);

  // ── Window ───────────────────────────────────────────────────────────────
  const checkWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    if (!batch || !subjectId) { Alert.alert('Select subject', 'Please select a subject first.'); return; }
    setActionLoading(true); setError(null);
    try {
      setWindowInfo(await apiService.getWindow(batch, subjectId));
    } catch (e: any) {
      setWindowInfo(null);
      const msg = e?.message ?? '';
      if (!msg.toLowerCase().includes('not found') && !msg.toLowerCase().includes('closed')) setError(msg);
    } finally { setActionLoading(false); }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  const refreshWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    if (!batch || !subjectId) return;
    try { setWindowInfo(await apiService.getWindow(batch, subjectId)); }
    catch { setWindowInfo(null); }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  // Countdown timer
  useEffect(() => {
    const compute = () => {
      if (!windowInfo?.is_active) return 0;
      const dur   = Number(windowInfo.duration ?? 0);
      const start = windowInfo.start_time ? new Date(windowInfo.start_time).getTime() : NaN;
      if (!dur || Number.isNaN(start)) return 0;
      return Math.max(0, dur - Math.floor((Date.now() - start) / 1000));
    };
    setRemainingSec(compute());
    if (!windowInfo?.is_active) return;
    const t = setInterval(() => {
      const r = compute();
      setRemainingSec(r);
      if (r === 0 && !countdownRefresh.current) { countdownRefresh.current = true; refreshWindow(); }
      else if (r > 0) countdownRefresh.current = false;
    }, 1000);
    return () => clearInterval(t);
  }, [windowInfo?.id, windowInfo?.is_active, windowInfo?.duration, windowInfo?.start_time, refreshWindow]);

  const openWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    if (!batch || !subjectId) { Alert.alert('Select batch & subject', 'Please select both.'); return; }
    setActionLoading(true); setError(null);
    try { setWindowInfo(await apiService.upsertWindow({ target_batch: batch, target_subject: subjectId, is_active: true, duration: durationSec })); }
    catch (e: any) { setError(e?.message ?? 'Failed to open window'); }
    finally { setActionLoading(false); }
  }, [isAdmin, batchId, myBatchId, subjectId, durationSec]);

  const closeWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    if (!batch || !subjectId) return;
    setActionLoading(true); setError(null);
    try { setWindowInfo(await apiService.upsertWindow({ target_batch: batch, target_subject: subjectId, is_active: false })); }
    catch (e: any) { setError(e?.message ?? 'Failed to close window'); }
    finally { setActionLoading(false); }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  // ── Mark attendance ──────────────────────────────────────────────────────
  const markMe = useCallback(async () => {
    if (!windowInfo?.id || !windowInfo?.is_active) {
      Alert.alert('Window inactive', 'Check window status and ensure it is active.');
      return;
    }

    // Step 1 — camera permission + capture
    setScanStep('camera');
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== 'granted') {
      setScanStep('idle');
      Alert.alert('Camera required', 'Allow camera access to mark attendance.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      setScanStep('idle');
      return;
    }

    const imageUri = result.assets[0].uri;

    // Step 2 — face scan animation
    setScanStep('face');
    await new Promise((r) => setTimeout(r, 2000)); // let animation play

    // Step 3 — location (skip in test mode)
    let location: { latitude: number; longitude: number } | null = null;

    if (!IS_TEST_MODE) {
      setScanStep('location');
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          setScanStep('error');
          setScanError('Location permission is required in production mode.');
          setTimeout(() => setScanStep('idle'), 2500);
          return;
        }
        const coords = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        location = {
          latitude:  coords.coords.latitude,
          longitude: coords.coords.longitude,
        };
      } catch {
        setScanStep('error');
        setScanError('Failed to get location. Please try again.');
        setTimeout(() => setScanStep('idle'), 2500);
        return;
      }
    }

    // Step 4 — upload + verify
    setScanStep('uploading');
    setError(null);
    try {
      await apiService.markAttendance(windowInfo.id as any, imageUri, location);
      setScanStep('done');
      await new Promise((r) => setTimeout(r, 1800));
      setScanStep('idle');
      Alert.alert('✓ Attendance Marked', 'Your attendance has been recorded successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to mark attendance';
      setScanStep('error');
      setScanError(msg);
      setTimeout(() => {
        setScanStep('idle');
        setError(msg);
      }, 2500);
    }
  }, [windowInfo?.id, windowInfo?.is_active, router]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <View style={styles.backBtn} />
          <Text style={styles.headerTitle}>Mark Attendance</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary[600]} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Scan overlay modal */}
      {scanStep !== 'idle' && <ScanOverlay step={scanStep} errorMsg={scanError} />}

      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        {/* Test mode badge */}
        {IS_TEST_MODE && (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>TEST</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={AppColors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Test mode notice */}
        {IS_TEST_MODE && (
          <View style={styles.testNotice}>
            <Ionicons name="flask-outline" size={16} color={AppColors.status.warning} />
            <Text style={styles.testNoticeText}>Test mode — location verification disabled</Text>
          </View>
        )}

        {/* Subject */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subject</Text>
          {(isAdmin ? filteredSubjects : mySubjects).length === 0 ? (
            <Text style={styles.muted}>No subjects available.</Text>
          ) : (
            <View style={styles.verticalList}>
              {(isAdmin ? filteredSubjects : mySubjects).map((s: any) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.listRow, subjectId === s.id && styles.listRowActive]}
                  onPress={() => handleSubjectChange(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.listRowText, subjectId === s.id && styles.listRowTextActive]} numberOfLines={1}>
                    {s.name || s.code || `#${s.id}`}
                  </Text>
                  {subjectId === s.id && <Ionicons name="checkmark-circle" size={22} color={AppColors.primary[600]} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Batch (admin only) */}
        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Batch</Text>
            {batches.length === 0 ? (
              <Text style={styles.muted}>No batches available.</Text>
            ) : (
              <View style={styles.verticalList}>
                {batches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.listRow, batchId === b.id && styles.listRowActive]}
                    onPress={() => handleBatchChange(b)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.listRowText, batchId === b.id && styles.listRowTextActive]} numberOfLines={1}>
                      {b.name || `Batch ${b.id}`}
                    </Text>
                    {batchId === b.id && <Ionicons name="checkmark-circle" size={22} color={AppColors.primary[600]} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Duration (admin only) */}
        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durChip, durationSec === d && styles.chipActive]}
                  onPress={() => setDurationSec(d)}
                >
                  <Text style={[styles.chipText, durationSec === d && styles.chipTextActive]}>
                    {d < 60 ? `${d}s` : `${d / 60}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Window */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attendance Window</Text>
          <View style={styles.windowRow}>
            <TouchableOpacity style={styles.outlineBtn} onPress={checkWindow} disabled={actionLoading || !subjectId}>
              {actionLoading
                ? <ActivityIndicator size="small" color={AppColors.primary[600]} />
                : <><Ionicons name="refresh-outline" size={18} color={AppColors.primary[600]} /><Text style={styles.outlineBtnText}>Check</Text></>
              }
            </TouchableOpacity>
            {isAdmin && (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={openWindow} disabled={actionLoading || !subjectId}>
                  <Text style={styles.primaryBtnText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={closeWindow} disabled={actionLoading || !subjectId}>
                  <Text style={styles.outlineBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {windowInfo ? (
            <View style={styles.windowStatus}>
              <View style={styles.windowStatusRow}>
                <Text style={styles.windowLabel}>Status</Text>
                <View style={[styles.badge, windowInfo.is_active ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.badgeText, windowInfo.is_active && styles.badgeTextActive]}>
                    {windowInfo.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              {windowInfo.is_active && (
                <View style={styles.windowStatusRow}>
                  <Text style={styles.windowLabel}>Time left</Text>
                  <Text style={[styles.windowValue, remainingSec < 10 && styles.windowValueWarning]}>
                    {formatMMSS(remainingSec)}
                  </Text>
                </View>
              )}
              {/* <View style={styles.windowStatusRow}>
                <Text style={styles.windowLabel}>Window ID</Text>
                <Text style={styles.windowValueMono}>#{windowInfo.id.slice(-8)}</Text>
              </View> */}
            </View>
          ) : (
            <View style={styles.windowEmpty}>
              <Ionicons name="calendar-outline" size={32} color={AppColors.text.tertiary} />
              <Text style={styles.windowEmptyText}>No active window found</Text>
            </View>
          )}

          {/* Mark button — students only, window must be active */}
          {!isAdmin && windowInfo?.is_active && (
            <TouchableOpacity style={styles.markBtn} onPress={markMe} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={22} color="#fff" />
              <Text style={styles.markBtnText}>Scan Face & Mark Attendance</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Overlay styles ───────────────────────────────────────────────────────────
const ov = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 280,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 20,
  },
  // Face scan box
  faceBox: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: AppColors.primary[600],
    borderWidth: 3,
  },
  tl: { top: 0,    left: 0,    borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0,    right: 0,   borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0,    borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0,   borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: AppColors.primary[600],
    shadowColor: AppColors.primary[600],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  // Location pulse
  locWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: AppColors.primary[600],
  },
  locDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primary[600] + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Uploading
  uploadWrap: { alignItems: 'center', gap: 8 },
  dotText: { color: AppColors.primary[600], fontSize: 18, letterSpacing: 4 },
  // Done
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: AppColors.status.success,
    alignItems: 'center', justifyContent: 'center',
  },
  // Error
  errorCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: AppColors.status.error,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: Fonts.Helix.SemiBold,
    color: '#fff',
    textAlign: 'center',
  },
  labelSuccess: { color: AppColors.status.success },
  labelError:   { color: AppColors.status.error },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  pillActive: { backgroundColor: AppColors.primary[600], width: 24 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: AppColors.background.primary },
  container:  { flex: 1 },
  content:    { padding: 20, paddingBottom: 40 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: AppColors.border.light,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  testBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: AppColors.status.warning + '30',
    borderRadius: 6,
  },
  testBadgeText: { fontSize: 11, fontFamily: Fonts.Helix.Bold, color: AppColors.status.warning },

  testNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: AppColors.status.warning + '15',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 16,
  },
  testNoticeText: { fontSize: 13, fontFamily: Fonts.Helix.Medium, color: AppColors.status.warning },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: AppColors.status.error + '15',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.status.error },

  card:      { backgroundColor: AppColors.surface.card, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary, marginBottom: 12 },

  verticalList: { gap: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  listRowActive:    { backgroundColor: AppColors.primary[50] },
  listRowText:      { fontSize: 15, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary, flex: 1 },
  listRowTextActive: { fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },
  muted: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durChip:     { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: AppColors.background.secondary },
  chipActive:  { backgroundColor: AppColors.primary[600] },
  chipText:    { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary },
  chipTextActive: { color: AppColors.text.inverse },

  windowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1.5, borderColor: AppColors.primary[600],
  },
  outlineBtnText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: AppColors.primary[600] },
  primaryBtnText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.inverse },

  windowStatus:    { paddingTop: 16, borderTopWidth: 1, borderTopColor: AppColors.border.light },
  windowStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  windowLabel:     { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },
  windowValue:     { fontSize: 14, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  windowValueWarning: { color: AppColors.status.error },
  windowValueMono: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: AppColors.text.secondary },

  badge:          { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: AppColors.background.secondary },
  badgeActive:    { backgroundColor: AppColors.status.success + '25' },
  badgeInactive:  {},
  badgeText:      { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.secondary },
  badgeTextActive: { color: AppColors.status.success },

  windowEmpty:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  windowEmptyText: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },

  markBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 20, paddingVertical: 16, borderRadius: 12,
    backgroundColor: AppColors.primary[600],
    ...Platform.select({
      ios:     { shadowColor: AppColors.primary[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  markBtnText: { fontSize: 16, fontFamily: Fonts.Helix.SemiBold, color: '#fff' },
});