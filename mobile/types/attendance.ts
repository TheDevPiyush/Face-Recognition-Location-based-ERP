/**
 * Types for attendance calendar API
 */

export interface StudentCalendarResponse {
  month: string; // "YYYY-MM"
  year: number;
  month_number: number;
  days_in_month: number;
  batch: {
    id: number;
    name: string | null;
  };
  calendar: Array<{
    subject: {
      id: number;
      name: string | null;
      code: string | null;
    };
    dates: Record<string, 'P' | 'A' | 'NA'>; // "YYYY-MM-DD" -> P=Present, A=Absent, NA=No class
  }>;
}
