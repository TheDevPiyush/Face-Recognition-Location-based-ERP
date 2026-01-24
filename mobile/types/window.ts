/**
 * Types for attendance window APIs
 */

export interface AttendanceWindow {
  id: number;
  target_batch: number;
  target_subject: number;
  start_time: string; // ISO datetime
  duration: number; // seconds
  is_active: boolean;
  last_interacted_by?: number | null;
  created_at?: string;
}
