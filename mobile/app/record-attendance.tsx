import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiService } from '@/services/api';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import type { AttendanceWindow } from '@/types/window';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Course    { id: string; name: string | null; code: string | null }
interface Batch     { id: string; name: string | null; code: string | null; courseId?: string | null }
interface Subject   { id: string; name: string | null; code: string | null; batchId?: string | null; batch_id?: string | null }

const DURATION_OPTS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '2m',   value: 120 },
  { label: '5m',   value: 300 },
  { label: '10m',  value: 600 },
  { label: '15m',  value: 900 },
  { label: '30m',  value: 1800 },
  { label: '1h',   value: 3600 },
];

function formatMMSS(total: number) {
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Selection row ────────────────────────────────────────────────────────────
function SelectRow<T extends { id: string; name?: string | null; code?: string | null }>({
  items,
  selected,
  onSelect,
  emptyText = 'None available',
}: {
  items: T[];
  selected: string | null;
  onSelect: (item: T) => void;
  emptyText?: string;
}) {
  if (items.length === 0) return <Text style={styles.muted}>{emptyText}</Text>;
  return (
    <View style={styles.verticalList}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.listRow, selected === item.id && styles.listRowActive]}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <View style={styles.listRowInner}>
            <Text style={[styles.listRowText, selected === item.id && styles.listRowTextActive]} numberOfLines={1}>
              {item.name || item.code || item.id}
            </Text>
            {item.code && item.name && (
              <Text style={styles.listRowSub}>{item.code}</Text>
            )}
          </View>
          {selected === item.id && (
            <Ionicons name="checkmark-circle" size={22} color={AppColors.primary[600]} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.stepRow}>
      {steps.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                done   && styles.stepDotDone,
                active && styles.stepDotActive,
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RecordAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Data
  const [courses, setCourses]   = useState<Course[]>([]);
  const [batches, setBatches]   = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Selections
  const [courseId, setCourseId]   = useState<string | null>(null);
  const [batchId, setBatchId]     = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [duration, setDuration]   = useState(300); // default 5m

  // Window
  const [windowInfo, setWindowInfo]     = useState<AttendanceWindow | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const countdownRefresh = useRef(false);

  // UI
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Current step: 0=course, 1=batch, 2=subject, 3=window
  const currentStep = courseId == null ? 0 : batchId == null ? 1 : subjectId == null ? 2 : 3;

  // Derived filtered lists
  const filteredBatches  = batches.filter((b) => b.courseId === courseId);
  const filteredSubjects = subjects.filter((s) => (s.batchId ?? s.batch_id) === batchId);

  // ── Load all data upfront ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch batches and subjects in parallel; derive courses from batches
      const [bats, subs] = await Promise.all([
        apiService.getBatches() as Promise<Batch[]>,
        apiService.getSubjects() as Promise<any>,
      ]);

      // Extract unique courses from the batch objects (batch has course info if enriched)
      // Fall back to /api/course if available
      let courseList: Course[] = [];
      try {
        courseList = await (apiService as any).getCourses() as Course[];
      } catch {
        // If no getCourses endpoint, derive from batch data
        const seen = new Set<string>();
        bats.forEach((b: any) => {
          const cId   = b.courseId ?? b.course?.id;
          const cName = b.course?.name ?? b.course?.code ?? cId;
          const cCode = b.course?.code ?? null;
          if (cId && !seen.has(cId)) {
            seen.add(cId);
            courseList.push({ id: cId, name: cName, code: cCode });
          }
        });
      }

      setCourses(courseList);
      setBatches(bats);
      setSubjects(subs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Window countdown ──────────────────────────────────────────────────────
  const refreshWindow = useCallback(async () => {
    if (!batchId || !subjectId) return;
    try { setWindowInfo(await apiService.getWindow(batchId, subjectId)); }
    catch { setWindowInfo(null); }
  }, [batchId, subjectId]);

  useEffect(() => {
    const compute = () => {
      if (!windowInfo?.is_active) return 0;
      const dur   = Number(windowInfo.duration ?? 0);
      const start = windowInfo.start_time ? new Date(windowInfo.start_time).getTime() : NaN;
      if (!dur || isNaN(start)) return 0;
      return Math.max(0, dur - Math.floor((Date.now() - start) / 1000));
    };
    setRemainingSec(compute());
    if (!windowInfo?.is_active) return;
    const t = setInterval(() => {
      const r = compute();
      setRemainingSec(r);
      if (r === 0 && !countdownRefresh.current) {
        countdownRefresh.current = true;
        refreshWindow();
      } else if (r > 0) {
        countdownRefresh.current = false;
      }
    }, 1000);
    return () => clearInterval(t);
  }, [windowInfo?.id, windowInfo?.is_active, windowInfo?.duration, windowInfo?.start_time, refreshWindow]);

  // ── Selection handlers ────────────────────────────────────────────────────
  const selectCourse = (c: Course) => {
    if (courseId === c.id) return;
    setCourseId(c.id);
    setBatchId(null);
    setSubjectId(null);
    setWindowInfo(null);
  };

  const selectBatch = (b: Batch) => {
    if (batchId === b.id) return;
    setBatchId(b.id);
    setSubjectId(null);
    setWindowInfo(null);
  };

  const selectSubject = async (s: Subject) => {
    setSubjectId(s.id);
    setWindowInfo(null);
    // Auto-check window for this subject
    if (batchId) {
      setActionLoading(true);
      try {
        const w = await apiService.getWindow(batchId, s.id);
        setWindowInfo(w);
      } catch {
        setWindowInfo(null);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // ── Window actions ────────────────────────────────────────────────────────
  const openWindow = async () => {
    if (!batchId || !subjectId) return;
    setActionLoading(true); setError(null);
    try {
      const w = await apiService.upsertWindow({
        target_batch: batchId, target_subject: subjectId,
        is_active: true, duration,
      });
      setWindowInfo(w);
      Alert.alert('Window Opened', `Attendance window is now active for ${formatMMSS(duration)}.`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to open window');
    } finally {
      setActionLoading(false);
    }
  };

  const closeWindow = async () => {
    if (!batchId || !subjectId) return;
    Alert.alert('Close Window', 'Are you sure you want to close the attendance window?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive',
        onPress: async () => {
          setActionLoading(true); setError(null);
          try {
            const w = await apiService.upsertWindow({
              target_batch: batchId, target_subject: subjectId, is_active: false,
            });
            setWindowInfo(w);
          } catch (e: any) {
            setError(e?.message ?? 'Failed to close window');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedCourse  = courses.find((c) => c.id === courseId);
  const selectedBatch   = batches.find((b) => b.id === batchId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={AppColors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Attendance</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Attendance</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepContainer}>
        <StepIndicator
          steps={['Course', 'Batch', 'Subject', 'Window']}
          current={currentStep}
        />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={AppColors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Step 1: Course ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.stepBadge, courseId && styles.stepBadgeDone]}>
                {courseId
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Text style={styles.stepBadgeText}>1</Text>
                }
              </View>
              <Text style={styles.cardTitle}>Course</Text>
            </View>
            {selectedCourse && (
              <TouchableOpacity onPress={() => { setCourseId(null); setBatchId(null); setSubjectId(null); setWindowInfo(null); }}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedCourse && courseId ? (
            <View style={styles.selectedRow}>
              <Ionicons name="school" size={18} color={AppColors.primary[600]} />
              <Text style={styles.selectedText}>{selectedCourse.name || selectedCourse.code}</Text>
              {selectedCourse.code && selectedCourse.name && (
                <View style={styles.tag}><Text style={styles.tagText}>{selectedCourse.code}</Text></View>
              )}
            </View>
          ) : (
            <SelectRow items={courses} selected={courseId} onSelect={selectCourse} emptyText="No courses found" />
          )}
        </View>

        {/* ── Step 2: Batch ──────────────────────────────────────────────── */}
        {courseId && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.stepBadge, batchId && styles.stepBadgeDone]}>
                  {batchId
                    ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : <Text style={styles.stepBadgeText}>2</Text>
                  }
                </View>
                <Text style={styles.cardTitle}>Batch</Text>
              </View>
              {selectedBatch && (
                <TouchableOpacity onPress={() => { setBatchId(null); setSubjectId(null); setWindowInfo(null); }}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedBatch && batchId ? (
              <View style={styles.selectedRow}>
                <Ionicons name="people" size={18} color={AppColors.primary[600]} />
                <Text style={styles.selectedText}>{selectedBatch.name || selectedBatch.code}</Text>
                {selectedBatch.code && selectedBatch.name && (
                  <View style={styles.tag}><Text style={styles.tagText}>{selectedBatch.code}</Text></View>
                )}
              </View>
            ) : (
              <SelectRow
                items={filteredBatches}
                selected={batchId}
                onSelect={selectBatch}
                emptyText="No batches for this course"
              />
            )}
          </View>
        )}

        {/* ── Step 3: Subject ────────────────────────────────────────────── */}
        {batchId && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.stepBadge, subjectId && styles.stepBadgeDone]}>
                  {subjectId
                    ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : <Text style={styles.stepBadgeText}>3</Text>
                  }
                </View>
                <Text style={styles.cardTitle}>Subject</Text>
              </View>
              {selectedSubject && (
                <TouchableOpacity onPress={() => { setSubjectId(null); setWindowInfo(null); }}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {actionLoading && !subjectId ? (
              <ActivityIndicator size="small" color={AppColors.primary[600]} style={{ marginVertical: 8 }} />
            ) : selectedSubject && subjectId ? (
              <View style={styles.selectedRow}>
                <Ionicons name="book" size={18} color={AppColors.primary[600]} />
                <Text style={styles.selectedText}>{selectedSubject.name || selectedSubject.code}</Text>
                {selectedSubject.code && selectedSubject.name && (
                  <View style={styles.tag}><Text style={styles.tagText}>{selectedSubject.code}</Text></View>
                )}
              </View>
            ) : (
              <SelectRow
                items={filteredSubjects}
                selected={subjectId}
                onSelect={selectSubject}
                emptyText="No subjects for this batch"
              />
            )}
          </View>
        )}

        {/* ── Step 4: Window ─────────────────────────────────────────────── */}
        {subjectId && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.stepBadge, windowInfo?.is_active && styles.stepBadgeActive]}>
                  <Text style={styles.stepBadgeText}>4</Text>
                </View>
                <Text style={styles.cardTitle}>Attendance Window</Text>
              </View>
              <TouchableOpacity onPress={refreshWindow} disabled={actionLoading}>
                <Ionicons name="refresh" size={20} color={actionLoading ? AppColors.text.tertiary : AppColors.primary[600]} />
              </TouchableOpacity>
            </View>

            {/* Duration picker */}
            {(!windowInfo || !windowInfo.is_active) && (
              <View style={styles.durationSection}>
                <Text style={styles.durationLabel}>Duration</Text>
                <View style={styles.durationGrid}>
                  {DURATION_OPTS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.durChip, duration === opt.value && styles.durChipActive]}
                      onPress={() => setDuration(opt.value)}
                    >
                      <Text style={[styles.durChipText, duration === opt.value && styles.durChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Window status */}
            {windowInfo ? (
              <View style={styles.windowStatus}>
                <View style={styles.windowStatusRow}>
                  <Text style={styles.windowLabel}>Status</Text>
                  <View style={[styles.badge, windowInfo.is_active ? styles.badgeActive : styles.badgeInactive]}>
                    <Text style={[styles.badgeText, windowInfo.is_active && styles.badgeTextActive]}>
                      {windowInfo.is_active ? '● Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                {windowInfo.is_active && (
                  <View style={styles.windowStatusRow}>
                    <Text style={styles.windowLabel}>Time remaining</Text>
                    <Text style={[styles.windowValue, remainingSec < 30 && styles.windowValueWarning]}>
                      {formatMMSS(remainingSec)}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.windowEmpty}>
                <Ionicons name="calendar-outline" size={32} color={AppColors.text.tertiary} />
                <Text style={styles.windowEmptyText}>No active window for this subject</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {!windowInfo?.is_active ? (
                <TouchableOpacity
                  style={[styles.openBtn, actionLoading && styles.btnDisabled]}
                  onPress={openWindow}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  {actionLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="play-circle" size={20} color="#fff" />
                        <Text style={styles.openBtnText}>Open Window ({formatMMSS(duration)})</Text>
                      </>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.closeBtn, actionLoading && styles.btnDisabled]}
                  onPress={closeWindow}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  {actionLoading
                    ? <ActivityIndicator size="small" color={AppColors.status.error} />
                    : <>
                        <Ionicons name="stop-circle" size={20} color={AppColors.status.error} />
                        <Text style={styles.closeBtnText}>Close Window</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: AppColors.background.primary },
  container: { flex: 1 },
  content:   { padding: 20, paddingBottom: 40 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: AppColors.border.light,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },

  // Step indicator
  stepContainer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: AppColors.border.light,
    backgroundColor: AppColors.surface.card,
  },
  stepRow:    { flexDirection: 'row', alignItems: 'center' },
  stepItem:   { alignItems: 'center', gap: 4 },
  stepDot:    {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: AppColors.background.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: AppColors.border.light,
  },
  stepDotActive: { borderColor: AppColors.primary[600], backgroundColor: AppColors.primary[50] },
  stepDotDone:   { backgroundColor: AppColors.primary[600], borderColor: AppColors.primary[600] },
  stepDotText:   { fontSize: 12, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.tertiary },
  stepDotTextActive: { color: AppColors.primary[600] },
  stepLabel:     { fontSize: 10, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },
  stepLabelActive: { color: AppColors.primary[600], fontFamily: Fonts.Helix.SemiBold },
  stepLine:    { flex: 1, height: 1.5, backgroundColor: AppColors.border.light, marginBottom: 14 },
  stepLineDone: { backgroundColor: AppColors.primary[600] },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: AppColors.status.error + '15',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.status.error },

  card: { backgroundColor: AppColors.surface.card, borderRadius: 16, padding: 20, marginBottom: 16 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  changeText: { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },

  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: AppColors.background.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: AppColors.border.light,
  },
  stepBadgeDone:   { backgroundColor: AppColors.primary[600], borderColor: AppColors.primary[600] },
  stepBadgeActive: { backgroundColor: AppColors.status.success, borderColor: AppColors.status.success },
  stepBadgeText:   { fontSize: 12, fontFamily: Fonts.Helix.Bold, color: AppColors.text.secondary },

  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: AppColors.primary[50],
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12,
  },
  selectedText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600], flex: 1 },
  tag: { backgroundColor: AppColors.primary[600] + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: Fonts.Helix.Bold, color: AppColors.primary[600] },

  verticalList: { gap: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  listRowActive: { backgroundColor: AppColors.primary[50] },
  listRowInner:  { flex: 1, gap: 2 },
  listRowText:   { fontSize: 15, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary },
  listRowTextActive: { fontFamily: Fonts.Helix.SemiBold, color: AppColors.primary[600] },
  listRowSub:    { fontSize: 12, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },
  muted: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },

  durationSection: { marginBottom: 16 },
  durationLabel:   { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.secondary, marginBottom: 10 },
  durationGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durChip:         { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: AppColors.background.secondary },
  durChipActive:   { backgroundColor: AppColors.primary[600] },
  durChipText:     { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.secondary },
  durChipTextActive: { color: '#fff' },

  windowStatus:    { paddingTop: 12, marginBottom: 16 },
  windowStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: AppColors.border.light },
  windowLabel:     { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },
  windowValue:     { fontSize: 14, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  windowValueWarning: { color: AppColors.status.error },
  windowValueMono: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: AppColors.text.secondary },

  badge:          { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  badgeActive:    { backgroundColor: AppColors.status.success + '20' },
  badgeInactive:  { backgroundColor: AppColors.background.secondary },
  badgeText:      { fontSize: 13, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.secondary },
  badgeTextActive: { color: AppColors.status.success },

  windowEmpty:     { alignItems: 'center', paddingVertical: 20, gap: 8, marginBottom: 16 },
  windowEmptyText: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },

  actionRow: { gap: 10 },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: AppColors.primary[600],
    ...Platform.select({
      ios:     { shadowColor: AppColors.primary[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  openBtnText:  { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: '#fff' },
  closeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: AppColors.status.error,
  },
  closeBtnText: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.status.error },
  btnDisabled:  { opacity: 0.5 },
});