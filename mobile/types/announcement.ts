export interface Announcement {
  id: number;
  title: string;
  description?: string;
  announcement_type: 'text' | 'audio' | 'video';
  text_content?: string;
  audio_url?: string;
  video_url?: string;
  created_by: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  target_batch: number | null;
  target_university: number | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementCreatePayload {
  title: string;
  description?: string;
  announcement_type: 'text' | 'audio' | 'video';
  text_content?: string;
  audio_url?: string;
  video_url?: string;
  target_batch?: number | null;
  target_university?: number | null;
  is_published?: boolean;
  is_pinned?: boolean;
  published_at?: string;
  expires_at?: string | null;
}

export interface AnnouncementsResponse {
  count?: number;
  results: Announcement[];
}
