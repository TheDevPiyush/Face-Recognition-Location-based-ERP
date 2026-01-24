/**
 * Types for dashboard / home APIs
 */

export interface AttendanceAnalyticsResponse {
  daily_attendance: Array<{
    date: string;
    present: number;
    absent: number;
    total_classes: number;
  }>;
  monthly_percentage: {
    month: string;
    total_classes: number;
    present_count: number;
    absent_count: number;
    percentage: number;
  } | null;
  summary: {
    total_present: number;
    total_absent: number;
    total_classes: number;
    total_days: number;
    overall_percentage: number;
    date_range: { start_date: string; end_date: string };
  };
}

export interface SubjectItem {
  id: number;
  name: string | null;
  code: string | null;
  batch: number;
}
