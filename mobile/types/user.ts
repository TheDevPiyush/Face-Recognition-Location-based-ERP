/**
 * Types for /me/ (current user) API response
 */

export interface BatchInfo {
  id: number;
  name: string | null;
  code?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  course_detail?: { id: number; name: string } | null;
}

export interface CurrentUser {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  batch: BatchInfo | null;
  profile_picture: string | null;
  can_update_picture: boolean;
  batchId: string
}
