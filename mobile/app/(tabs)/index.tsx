import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { CustomHeader } from '@/components/CustomHeader';
import { apiService } from '@/services/api';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import { useAuth } from '@/contexts/AuthContext';
import type { SubjectItem } from '@/types/dashboard';

function getCurrentMonthYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [freshUser, setFreshUser]                 = useState<any>(null);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [subjects, setSubjects]                   = useState<SubjectItem[]>([]);
  const [announcements, setAnnouncements]         = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const month = getCurrentMonthYYYYMM();

      // Always fetch fresh user so we get the enriched batch object
      const me = await apiService.getCurrentUser();
      setFreshUser(me);

      const batchId = me.batchId ?? null;

      const [analyticsRes, subjectsRes, announcementsRes] = await Promise.all([
        apiService.getAttendanceAnalytics({ month, ...(batchId && { batch_id: batchId }) }),
        apiService.getSubjects(),
        apiService.getAnnouncements(),
      ]);

      setAttendancePercent(
        analyticsRes.monthly?.percentage ?? analyticsRes.summary?.overall_percentage ?? null
      );

      // Filter subjects to only those belonging to the student's batch
      setSubjects(
        batchId
          ? subjectsRes.filter((s: any) => s.batchId === batchId || s.batch_id === batchId)
          : subjectsRes
      );

      setAnnouncements(announcementsRes.slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.batchId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // Use freshUser (has enriched batch) — fall back to cached user while loading
  const activeUser = freshUser ?? user;
  const batchInfo  = freshUser?.batch;
  const batchLabel = batchInfo
    ? [
        batchInfo.course?.university?.code,
        batchInfo.course?.code,
        batchInfo.code ?? batchInfo.name,
      ].filter(Boolean).join(' · ')
    : '—';

  const enrolledAt = freshUser?.enrolledAt ?? freshUser?.enrolled_at
    ? new Date(freshUser.enrolledAt ?? freshUser.enrolled_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  if (loading && !user) {
    return (
      <View style={styles.screen}>
        <CustomHeader title="Home" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary[600]} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CustomHeader title="Home" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppColors.primary[600]}
          />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={AppColors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => router.push(activeUser?.role === 'student' ? '/mark-attendance' : '/record-attendance')}
          activeOpacity={0.85}
        >
          <View style={styles.ctaInner}>
            <View style={styles.ctaIconWrap}>
              <Ionicons name="add" size={28} color={AppColors.text.inverse} />
            </View>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>
                {activeUser?.role === 'student' ? 'Mark Attendance' : 'Record Attendance'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
          </View>
        </TouchableOpacity>

        {/* Batch */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="school-outline" size={20} color={AppColors.text.link} />
            <Text style={styles.cardTitle}>Batch</Text>
          </View>
          <Text style={styles.cardValue} numberOfLines={1}>{batchLabel}</Text>
          {enrolledAt && (
            <Text style={styles.cardSubValue}>Enrolled {enrolledAt}</Text>
          )}
        </View>

        {/* Subjects */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="book-outline" size={20} color={AppColors.text.link} />
            <Text style={styles.cardTitle}>Subjects</Text>
          </View>
          {subjects.length === 0 ? (
            <Text style={styles.cardValueMuted}>No subjects</Text>
          ) : (
            <View style={styles.chipWrap}>
              {subjects.slice(0, 8).map((s) => (
                <View key={s.id} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {s.name || s.code || `#${s.id}`}
                  </Text>
                </View>
              ))}
              {subjects.length > 8 && (
                <Text style={styles.chipMore}>+{subjects.length - 8} more</Text>
              )}
            </View>
          )}
        </View>

        {/* Attendance */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="calendar-outline" size={20} color={AppColors.text.link} />
            <Text style={styles.cardTitle}>Attendance (this month)</Text>
          </View>
          <View style={styles.attendanceRow}>
            <Text style={[
              styles.attendancePercent,
              attendancePercent != null && attendancePercent < 75 && styles.attendanceLow,
            ]}>
              {attendancePercent != null ? `${Math.round(Math.min(100, attendancePercent))}%` : '—'}
            </Text>
            {attendancePercent != null && (
              <Text style={styles.attendanceSub}>
                {getCurrentMonthYYYYMM().replace('-', ' / ')}
              </Text>
            )}
          </View>
        </View>

        {/* Announcements */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="megaphone-outline" size={20} color={AppColors.text.link} />
            <Text style={styles.cardTitle}>Latest Announcements</Text>
          </View>
          {announcements.length === 0 ? (
            <View style={styles.emptyPlaceholder}>
              <Ionicons name="newspaper-outline" size={32} color={AppColors.text.tertiary} />
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          ) : (
            <View style={styles.announcementList}>
              {announcements.map((a) => (
                <View key={a.id} style={styles.announcementItem}>
                  <View style={styles.announcementDot} />
                  <View style={styles.announcementContent}>
                    <Text style={styles.announcementTitle} numberOfLines={1}>{a.title}</Text>
                    {a.description ? (
                      <Text style={styles.announcementDesc} numberOfLines={2}>{a.description}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background.primary },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: AppColors.status.error + '15',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 16, gap: 8,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.status.error },

  ctaCard: { backgroundColor: AppColors.primary[600], borderRadius: 16, padding: 24, marginBottom: 20 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ctaIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTextWrap: { flex: 1 },
  ctaTitle: { fontSize: 18, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.inverse, marginBottom: 2 },

  card: { backgroundColor: AppColors.surface.card, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary },
  cardValue: { fontSize: 16, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary },
  cardValueMuted: { fontSize: 15, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },
  cardSubValue: { fontSize: 12, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary, marginTop: 4 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: AppColors.background.secondary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  chipText: { fontSize: 13, fontFamily: Fonts.Helix.Medium, color: AppColors.text.primary, maxWidth: 120 },
  chipMore: { fontSize: 13, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary, alignSelf: 'center' },

  attendanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  attendancePercent: { fontSize: 28, fontFamily: Fonts.Helix.Bold, color: AppColors.text.primary },
  attendanceLow: { color: AppColors.status.error },
  attendanceSub: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary },

  emptyPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: Fonts.Helix.Medium, color: AppColors.text.tertiary },

  announcementList: { gap: 12 },
  announcementItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  announcementDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: AppColors.primary[600],
    marginTop: 5,
  },
  announcementContent: { flex: 1 },
  announcementTitle: { fontSize: 14, fontFamily: Fonts.Helix.SemiBold, color: AppColors.text.primary, marginBottom: 2 },
  announcementDesc: { fontSize: 13, fontFamily: Fonts.Helix.Medium, color: AppColors.text.secondary, lineHeight: 18 },
});