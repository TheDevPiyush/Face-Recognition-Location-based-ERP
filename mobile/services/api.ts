import { API_BASE_URL, STORAGE_KEYS } from '@/constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, copyAsync } from 'expo-file-system/legacy';
import type { CurrentUser } from '@/types/user';
import type { AttendanceWindow } from '@/types/window';
import type { SubjectItem } from '@/types/dashboard';
import type { StudentCalendarResponse } from '@/types/attendance';

// ─── Auth types ───────────────────────────────────────────────────────────────
export interface SendCodeResponse { message: string }
export interface VerifyCodeResponse { token: string; user: CurrentUser }

// ─── Helper ───────────────────────────────────────────────────────────────────
const parseError = (body: string, fallback = 'Request failed'): string => {
  try {
    const d = JSON.parse(body) as { error?: string; message?: string; detail?: string };
    return (d.error || d.message || d.detail || fallback).trim();
  } catch {
    return fallback;
  }
};

// ─── Service ──────────────────────────────────────────────────────────────────
class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = `${(API_BASE_URL || '').trim()}/api`;
  }

  // ── Token helpers ────────────────────────────────────────────────────────

  private async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  private async getAuthHeaders(json = true): Promise<HeadersInit> {
    const token = await this.getToken();
    return {
      ...(json && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    } as HeadersInit;
  }

  // ── Core methods ─────────────────────────────────────────────────────────

  async get<T>(endpoint: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseURL}${endpoint}`, { method: 'GET', headers });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) throw new Error('Session expired. Please login again.');
      throw new Error(parseError(body, `GET ${endpoint} failed`));
    }
    return res.json();
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) throw new Error('Session expired. Please login again.');
      throw new Error(parseError(body, `POST ${endpoint} failed`));
    }
    return res.json();
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) throw new Error('Session expired. Please login again.');
      throw new Error(parseError(body, `PATCH ${endpoint} failed`));
    }
    return res.json();
  }

  async delete(endpoint: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseURL}${endpoint}`, { method: 'DELETE', headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(parseError(body, `DELETE ${endpoint} failed`));
    }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** Step 1 — POST /api/auth/send-code */
  async sendCode(email: string): Promise<SendCodeResponse> {
    return this.post<SendCodeResponse>('/auth/send-code', { email });
  }

  /** Step 2 — POST /api/auth/verify-code → returns JWT + user */
  async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    return this.post<VerifyCodeResponse>('/auth/verify-code', { email, code });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  /** GET /api/users/me */
  async getCurrentUser(): Promise<CurrentUser> {
    return this.get<CurrentUser>('/users/me');
  }

  /** PATCH /api/users/me — JSON fields only */
  async updateCurrentUser(data: Partial<CurrentUser>): Promise<CurrentUser> {
    return this.patch<CurrentUser>('/users/me', data);
  }

  /** PATCH /api/users/me — with profile_picture (multipart) */
  async patchCurrentUser(formData: FormData): Promise<CurrentUser> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseURL}/users/me`, {
      method: 'PATCH',
      // Do NOT set Content-Type — fetch sets multipart/form-data + boundary automatically
      headers: { Authorization: `Bearer ${token || ''}` },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(parseError(body, 'Profile update failed'));
    }
    return res.json();
  }

  /** PATCH /api/users/location */
  async updateLocation(latitude: number, longitude: number): Promise<void> {
    await this.patch('/users/location', { latitude, longitude });
  }

  // ── Batches ───────────────────────────────────────────────────────────────

  /** GET /api/batch */
  async getBatches(): Promise<Array<{ id: string; name: string | null }>> {
    return this.get('/batch');
  }

  // ── Subjects ──────────────────────────────────────────────────────────────

  /** GET /api/subject */
  async getSubjects(): Promise<SubjectItem[]> {
    return this.get<SubjectItem[]>('/subject');
  }

  // ── Attendance window ─────────────────────────────────────────────────────

  /** GET /api/attendance/window?target_batch=&target_subject= */
  async getWindow(target_batch: string, target_subject: string): Promise<AttendanceWindow> {
    return this.get<AttendanceWindow>(
      `/attendance/window?target_batch=${target_batch}&target_subject=${target_subject}`
    );
  }

  /** POST /api/attendance/window */
  async upsertWindow(params: {
    target_batch: string;
    target_subject: string;
    is_active: boolean;
    duration?: number;
  }): Promise<AttendanceWindow> {
    return this.post<AttendanceWindow>('/attendance/window', params);
  }

  // ── Attendance record ─────────────────────────────────────────────────────

  private async ensureFileUri(uri: string): Promise<string> {
    if (uri.startsWith('file://')) return uri;
    const dir = cacheDirectory;
    if (!dir) return uri;
    try {
      const dest = `${dir}student-picture-${Date.now()}.jpg`;
      await copyAsync({ from: uri, to: dest });
      return dest;
    } catch {
      return uri;
    }
  }

  /** POST /api/attendance/record — multipart: student_picture + attendance_window */
  async markAttendance(attendance_window: string, imageUri: string): Promise<unknown> {
    const uploadUri = await this.ensureFileUri(imageUri);
    const token = await this.getToken();
    const url = `${this.baseURL}/attendance/record`;

    const formData = new FormData();
    (formData as unknown as { append: (k: string, v: unknown) => void }).append('student_picture', {
      uri: uploadUri,
      type: 'image/jpeg',
      name: 'student-picture.jpg',
    });
    formData.append('attendance_window', attendance_window);

    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({ status: xhr.status, body: xhr.responseText || '' });
      };

      xhr.onreadystatechange = () => { if (xhr.readyState === 4) finish(); };
      xhr.onerror = () => { if (!settled) { settled = true; reject(new Error('Network request failed')); } };
      xhr.ontimeout = () => { if (!settled) { settled = true; reject(new Error('Request timed out')); } };

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token || ''}`);
      xhr.timeout = 60000;
      xhr.send(formData);
    });

    if (result.status === 0) throw new Error('Network request failed');
    if (result.status === 401) throw new Error('Session expired. Please login again.');
    if (result.status < 200 || result.status >= 300) throw new Error(parseError(result.body));

    try { return result.body ? JSON.parse(result.body) : {}; } catch { return {}; }
  }
}

export const apiService = new ApiService();