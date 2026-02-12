import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiService } from '@/services/api';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import type { CurrentUser } from '@/types/user';
import type { SubjectItem } from '@/types/dashboard';
import type { AttendanceWindow } from '@/types/window';

const DURATION_OPTS = [30, 60, 120, 300];

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MarkAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [batches, setBatches] = useState<Array<{ id: number; name: string | null }>>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(60);
  const [windowInfo, setWindowInfo] = useState<AttendanceWindow | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdownRefresh = useRef(false);

  const myBatchId = me?.batch?.id ?? null;
  const mySubjects = subjects.filter((s) => (myBatchId != null ? s.batch === myBatchId : true));
  const filteredSubjects = batchId != null ? subjects.filter((s) => s.batch === batchId) : subjects;
  const isAdmin = me?.role === 'admin' || me?.role === 'teacher';

  const loadInitial = useCallback(async () => {
    try {
      setError(null);
      const [user, subs] = await Promise.all([
        apiService.getCurrentUser(),
        apiService.getSubjects(),
      ]);
      setMe(user);
      setSubjects(subs);
      if (user?.batch?.id) setBatchId(user.batch.id);
      const adminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';
      if (adminOrTeacher) {
        const bats = await apiService.getBatches();
        setBatches(bats as Array<{ id: number; name: string | null }>);
        if (bats.length && !user?.batch?.id) setBatchId((bats[0] as any).id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (myBatchId != null && mySubjects.length && subjectId == null) {
      setSubjectId(mySubjects[0].id);
    }
  }, [myBatchId, mySubjects, subjectId]);

  useEffect(() => {
    if (isAdmin && batchId != null && filteredSubjects.length && subjectId == null) {
      setSubjectId(filteredSubjects[0].id);
    }
  }, [isAdmin, batchId, filteredSubjects, subjectId]);

  const handleBatchChange = useCallback((b: { id: number }) => {
    const next = subjects.filter((s) => s.batch === b.id);
    setBatchId(b.id);
    setSubjectId(next[0]?.id ?? null);
    setWindowInfo(null);
  }, [subjects]);

  const handleSubjectChange = useCallback((s: { id: number }) => {
    setSubjectId(s.id);
    setWindowInfo(null);
  }, []);

  const checkWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    const subj = subjectId;
    if (batch == null || subj == null) {
      Alert.alert('Select subject', 'Please select a subject first.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const w = await apiService.getWindow(batch, subj);
      setWindowInfo(w);
    } catch (e: any) {
      setWindowInfo(null);
      const msg = e?.message ?? 'Failed to check window';
      if (!msg.toLowerCase().includes('not found') && !msg.toLowerCase().includes('closed')) {
        setError(msg);
      }
    } finally {
      setActionLoading(false);
    }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  const refreshWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    const subj = subjectId;
    if (batch == null || subj == null) return;
    try {
      const w = await apiService.getWindow(batch, subj);
      setWindowInfo(w);
    } catch {
      setWindowInfo(null);
    }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  useEffect(() => {
    const compute = () => {
      if (!windowInfo?.is_active) return 0;
      const dur = Number(windowInfo.duration ?? 0);
      const start = windowInfo.start_time ? new Date(windowInfo.start_time).getTime() : NaN;
      if (!dur || Number.isNaN(start)) return 0;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      return Math.max(0, dur - elapsed);
    };
    setRemainingSec(compute());
    if (!windowInfo?.is_active) return;
    const t = setInterval(() => {
      const r = compute();
      setRemainingSec(r);
      if (r === 0 && !countdownRefresh.current) {
        countdownRefresh.current = true;
        refreshWindow();
      } else if (r > 0) countdownRefresh.current = false;
    }, 1000);
    return () => clearInterval(t);
  }, [windowInfo?.id, windowInfo?.is_active, windowInfo?.duration, windowInfo?.start_time, refreshWindow]);

  const openWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    const subj = subjectId;
    if (batch == null || subj == null) {
      Alert.alert('Select batch & subject', 'Please select both.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const w = await apiService.upsertWindow({
        target_batch: batch,
        target_subject: subj,
        is_active: true,
        duration: durationSec,
      });
      setWindowInfo(w);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to open window');
    } finally {
      setActionLoading(false);
    }
  }, [isAdmin, batchId, myBatchId, subjectId, durationSec]);

  const closeWindow = useCallback(async () => {
    const batch = isAdmin ? batchId : myBatchId;
    const subj = subjectId;
    if (batch == null || subj == null) return;
    setActionLoading(true);
    setError(null);
    try {
      const w = await apiService.upsertWindow({
        target_batch: batch,
        target_subject: subj,
        is_active: false,
      });
      setWindowInfo(w);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to close window');
    } finally {
      setActionLoading(false);
    }
  }, [isAdmin, batchId, myBatchId, subjectId]);

  const markMe = useCallback(async () => {
    if (!windowInfo?.id || !windowInfo?.is_active) {
      Alert.alert('Window inactive', 'Check window status first and ensure it is active.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Allow camera access to mark attendance.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploading(true);
    setError(null);
    try {
      const response = await apiService.markAttendance(windowInfo.id, result.assets[0].uri);
      console.log(response);
      Alert.alert('Success', 'Attendance marked successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to mark attendance');
    } finally {
      setUploading(false);
    }
  }, [windowInfo?.id, windowInfo?.is_active, router]);

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
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={AppColors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subject</Text>
          {(!isAdmin ? mySubjects : filteredSubjects).length === 0 ? (
            <Text style={styles.muted}>No subjects available.</Text>
          ) : (
            <View style={styles.verticalList}>
              {(isAdmin ? filteredSubjects : mySubjects).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.listRow, subjectId === s.id && styles.listRowActive]}
                  onPress={() => handleSubjectChange(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.listRowText, subjectId === s.id && styles.listRowTextActive]} numberOfLines={1}>
                    {s.name || s.code || `#${s.id}`}
                  </Text>
                  {subjectId === s.id && (
                    <Ionicons name="checkmark-circle" size={22} color={AppColors.primary[600]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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
                    {batchId === b.id && (
                      <Ionicons name="checkmark-circle" size={22} color={AppColors.primary[600]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Duration (seconds)</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durChip, durationSec === d && styles.chipActive]}
                  onPress={() => setDurationSec(d)}
                >
                  <Text style={[styles.chipText, durationSec === d && styles.chipTextActive]}>{d}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Window</Text>
          <View style={styles.windowRow}>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={checkWindow}
              disabled={actionLoading || subjectId == null}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={AppColors.primary[600]} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={AppColors.primary[600]} />
                  <Text style={styles.outlineBtnText}>Check status</Text>
                </>
              )}
            </TouchableOpacity>
            {isAdmin && (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.btnOpen]}
                  onPress={openWindow}
                  disabled={actionLoading || subjectId == null}
                >
                  <Text style={styles.primaryBtnText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.outlineBtn, styles.btnClose]}
                  onPress={closeWindow}
                  disabled={actionLoading || subjectId == null}
                >
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
                  <Text style={styles.windowValue}>{formatMMSS(remainingSec)}</Text>
                </View>
              )}
              <View style={styles.windowStatusRow}>
                <Text style={styles.windowLabel}>Window ID</Text>
                <Text style={styles.windowValue}>#{windowInfo.id}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.windowEmpty}>
              <Ionicons name="calendar-outline" size={32} color={AppColors.text.tertiary} />
              <Text style={styles.windowEmptyText}>No active window. Check status or open one.</Text>
            </View>
          )}

          {!isAdmin && windowInfo?.is_active && (
            <TouchableOpacity
              style={styles.markBtn}
              onPress={markMe}
              disabled={uploading || !windowInfo?.id}
              activeOpacity={0.85}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={AppColors.text.inverse} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color={AppColors.text.inverse} />
                  <Text style={styles.markBtnText}>Mark via photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background.primary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: AppColors.border.light,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.status.error + '15',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.status.error },
  card: {
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary, marginBottom: 12 },
  verticalList: { gap: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  listRowActive: { backgroundColor: AppColors.primary[50] },
  listRowText: { fontSize: 15, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary, flex: 1 },
  listRowTextActive: { fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },
  muted: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  chipActive: { backgroundColor: AppColors.primary[600] },
  chipText: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary },
  chipTextActive: { color: AppColors.text.inverse },
  durChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  windowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AppColors.primary[600],
  },
  outlineBtnText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: AppColors.primary[600],
  },
  btnOpen: {},
  btnClose: {},
  primaryBtnText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.inverse },
  windowStatus: { paddingTop: 16, borderTopWidth: 1, borderTopColor: AppColors.border.light },
  windowStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  windowLabel: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },
  windowValue: { fontSize: 14, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: AppColors.background.secondary },
  badgeActive: { backgroundColor: AppColors.status.success + '25' },
  badgeInactive: {},
  badgeText: { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.secondary },
  badgeTextActive: { color: AppColors.status.success },
  windowEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  windowEmptyText: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: AppColors.primary[600],
  },
  markBtnText: { fontSize: 16, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.inverse },
});
