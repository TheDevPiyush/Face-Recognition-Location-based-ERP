import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { CustomHeader } from '@/components/CustomHeader';
import { apiService } from '@/services/api';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import type { StudentCalendarResponse } from '@/types/attendance';

function getCurrentMonthYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || '';
}

function getYearRange(): number[] {
  const current = new Date().getFullYear();
  const start = current - 5;
  return Array.from({ length: 10 }, (_, i) => start + i);
}

export default function AttendanceScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthYYYYMM());
  const [calendarData, setCalendarData] = useState<StudentCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<number>(() => {
    const [, m] = getCurrentMonthYYYYMM().split('-').map(Number);
    return m;
  });
  const [pickerYear, setPickerYear] = useState<number>(() => new Date().getFullYear());

  const openPicker = useCallback(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    setPickerYear(y);
    setPickerMonth(m);
    setPickerVisible(true);
  }, [selectedMonth]);


  const fetchForMonth = useCallback(async (month: string) => {
    try {
      setError(null);
      const data = await apiService.getStudentCalendar({ month });
      setCalendarData(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load attendance';
      setError(msg);
      setCalendarData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchForMonth(selectedMonth);
    }, [selectedMonth, fetchForMonth])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchForMonth(selectedMonth);
  }, [selectedMonth, fetchForMonth]);

  const changeMonth = useCallback((direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      newMonth -= 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
    } else {
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    }

    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setLoading(true);
    fetchForMonth(newMonthStr);
  }, [selectedMonth, fetchForMonth]);

  const applyPicker = useCallback(() => {
    const newMonth = `${pickerYear}-${String(pickerMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
    setPickerVisible(false);
    setLoading(true);
    fetchForMonth(newMonth);
  }, [pickerYear, pickerMonth, fetchForMonth]);

  if (loading && !calendarData) {
    return (
      <View style={styles.screen}>
        <CustomHeader title="Attendance" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary[600]} />
          <Text style={styles.loadingText}>Loading attendance…</Text>
        </View>
      </View>
    );
  }

  let days: number[] = [];
  let monthName = '';
  let year = new Date().getFullYear();
  let monthNumber = new Date().getMonth() + 1;

  if (calendarData?.month) {
    const [y, m] = calendarData.month.split('-').map(Number);
    year = y;
    monthNumber = m;

    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    monthName = getMonthName(monthNumber);
  }


  return (
    <View style={styles.screen}>
      <CustomHeader title="Attendance" />
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

        {calendarData && (
          <>
            {/* Month Selector */}
            <View style={styles.monthSelector}>
              <TouchableOpacity
                onPress={() => changeMonth('prev')}
                style={styles.monthButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={AppColors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openPicker}
                style={styles.monthPickerTrigger}
                activeOpacity={0.7}
              >
                <Text style={styles.monthText}>
                  {monthName} {year}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={AppColors.text.link} style={styles.monthPickerIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => changeMonth('next')}
                style={styles.monthButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-forward" size={20} color={AppColors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Month/Year Picker Modal */}
            <Modal
              visible={pickerVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setPickerVisible(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setPickerVisible(false)}>
                <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.pickerTitle}>Select month & year</Text>

                  <Text style={styles.pickerLabel}>Month</Text>
                  <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((name, i) => {
                      const value = i + 1;
                      const selected = pickerMonth === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.monthChip, selected && styles.monthChipSelected]}
                          onPress={() => setPickerMonth(value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.monthChipText, selected && styles.monthChipTextSelected]}>
                            {name.slice(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.pickerLabel}>Year</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.yearRow}
                  >
                    {getYearRange().map((y) => {
                      const selected = pickerYear === y;
                      return (
                        <TouchableOpacity
                          key={y}
                          style={[styles.yearChip, selected && styles.yearChipSelected]}
                          onPress={() => setPickerYear(y)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.yearChipText, selected && styles.yearChipTextSelected]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.pickerApply}
                    onPress={applyPicker}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pickerApplyText}>Apply</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Calendar Table Card */}
            <View style={styles.card}>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendPresent]} />
                  <Text style={styles.legendText}>Present</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendAbsent]} />
                  <Text style={styles.legendText}>Absent</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendNoClass]} />
                  <Text style={styles.legendText}>No class</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header Row */}
                  <View style={styles.tableHeader}>
                    <View style={styles.subjectHeader}>
                      <Text style={styles.headerText}>Subject</Text>
                    </View>
                    <View style={styles.datesHeader}>
                      {days.map((day) => (
                        <View key={day} style={styles.dateHeader}>
                          <Text style={styles.dateHeaderText}>{day}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Subject Rows */}
                  {calendarData.calendar.map((item) => {
                    const subjectLabel = item.subject.name || item.subject.code || `#${item.subject.id}`;
                    return (
                      <View key={item.subject.id} style={styles.tableRow}>
                        <View style={styles.subjectCell}>
                          <Text style={styles.subjectText} numberOfLines={1}>
                            {subjectLabel}
                          </Text>
                        </View>
                        <View style={styles.datesRow}>
                          {days.map((day) => {
                            const dateKey = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const status = item.dates[dateKey];
                            return (
                              <View key={day} style={styles.dateCell}>
                                {status === 'P' ? (
                                  <View style={[styles.statusBadge, styles.statusPresent]}>
                                    <Text style={[styles.statusText, { color: AppColors.status.success }]}>P</Text>
                                  </View>
                                ) : status === 'A' ? (
                                  <View style={[styles.statusBadge, styles.statusAbsent]}>
                                    <Text style={[styles.statusText, { color: AppColors.status.error }]}>A</Text>
                                  </View>
                                ) : (
                                  <View style={[styles.statusBadge, styles.statusNA]}>
                                    <Text style={[styles.statusText, { color: AppColors.text.tertiary }]}>NA</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background.primary,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
  },
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
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.status.error,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  monthButton: {
    padding: 4,
  },
  monthPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  monthPickerIcon: {
    marginLeft: 2,
  },
  monthText: {
    fontSize: 17,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: AppColors.surface.card,
    borderRadius: 20,
    padding: 24,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerLabel: {
    fontSize: 13,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.secondary,
    marginBottom: 10,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  monthChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  monthChipSelected: {
    backgroundColor: AppColors.primary[600],
  },
  monthChipText: {
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.primary,
  },
  monthChipTextSelected: {
    color: AppColors.text.inverse,
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingRight: 8,
  },
  yearChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: AppColors.background.secondary,
  },
  yearChipSelected: {
    backgroundColor: AppColors.primary[600],
  },
  yearChipText: {
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.primary,
  },
  yearChipTextSelected: {
    color: AppColors.text.inverse,
  },
  pickerApply: {
    backgroundColor: AppColors.primary[600],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickerApplyText: {
    fontSize: 16,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.inverse,
  },
  card: {
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 20,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.light,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendPresent: {
    backgroundColor: AppColors.status.success,
  },
  legendAbsent: {
    backgroundColor: AppColors.status.error,
  },
  legendNoClass: {
    backgroundColor: AppColors.border.light,
  },
  legendText: {
    fontSize: 13,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: AppColors.border.default,
    paddingBottom: 8,
    marginBottom: 8,
  },
  subjectHeader: {
    width: 100,
    paddingRight: 12,
  },
  headerText: {
    fontSize: 13,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
  },
  datesHeader: {
    flexDirection: 'row',
    gap: 4,
  },
  dateHeader: {
    width: 32,
    alignItems: 'center',
  },
  dateHeaderText: {
    fontSize: 11,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.light,
  },
  subjectCell: {
    width: 100,
    paddingRight: 12,
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 13,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.primary,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dateCell: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPresent: {
    backgroundColor: AppColors.status.success + '20',
  },
  statusAbsent: {
    backgroundColor: AppColors.status.error + '20',
  },
  statusNA: {
    backgroundColor: AppColors.background.secondary,
  },
  statusBadgeEmpty: {
    width: 24,
    height: 24,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.Helix.Bold,
  },
});
