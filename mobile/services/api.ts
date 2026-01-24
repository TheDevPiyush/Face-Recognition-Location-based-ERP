import { API_BASE_URL, STORAGE_KEYS } from '@/constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { copyAsync, cacheDirectory } from 'expo-file-system/legacy';
import { LoginRequest, LoginResponse } from '@/types/auth';
import { CurrentUser } from '@/types/user';
import type { AttendanceAnalyticsResponse, SubjectItem } from '@/types/dashboard';
import type { StudentCalendarResponse } from '@/types/attendance';
import type { AttendanceWindow } from '@/types/window';

export type { LoginRequest, LoginResponse };

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = (API_BASE_URL || '').trim();
  }

  private async getAuthHeaders(json = true): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    return {
      ...(json && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    } as HeadersInit;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseURL}/token/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Invalid credentials' }));
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<{ access: string }> {
    const response = await fetch(`${this.baseURL}/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    const headers = await this.getAuthHeaders(true);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (refreshToken) {
          try {
            const { access } = await this.refreshToken(refreshToken);
            await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
            const newHeaders = await this.getAuthHeaders(true);
            const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
              method: 'GET',
              headers: newHeaders,
            });
            if (!retryResponse.ok) {
              throw new Error('Request failed after token refresh');
            }
            return retryResponse.json();
          } catch {
            throw new Error('Session expired. Please login again.');
          }
        }
      }
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const headers = await this.getAuthHeaders(true);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<CurrentUser> {
    return this.get<CurrentUser>('/me/');
  }

  async getAttendanceAnalytics(params: {
    month?: string;
    batch_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<AttendanceAnalyticsResponse> {
    const sp = new URLSearchParams();
    if (params.month) sp.set('month', params.month);
    if (params.batch_id != null) sp.set('batch_id', String(params.batch_id));
    if (params.start_date) sp.set('start_date', params.start_date);
    if (params.end_date) sp.set('end_date', params.end_date);
    const qs = sp.toString();
    const endpoint = qs ? `/attendance/analytics/?${qs}` : '/attendance/analytics/';
    return this.get<AttendanceAnalyticsResponse>(endpoint);
  }

  async getSubjects(): Promise<SubjectItem[]> {
    return this.get<SubjectItem[]>('/subjects/');
  }

  async getStudentCalendar(params?: { month?: string; batch_id?: number }): Promise<StudentCalendarResponse> {
    const sp = new URLSearchParams();
    if (params?.month) sp.set('month', params.month);
    if (params?.batch_id != null) sp.set('batch_id', String(params.batch_id));
    const qs = sp.toString();
    const endpoint = qs ? `/attendance/student-calendar/?${qs}` : '/attendance/student-calendar/';
    return this.get<StudentCalendarResponse>(endpoint);
  }

  async getWindow(target_batch: number, target_subject: number): Promise<AttendanceWindow> {
    const qs = `target_batch=${String(target_batch)}&target_subject=${String(target_subject)}`;
    const endpoint = `/attendance/window/?${qs}`;

    let headers = await this.getAuthHeaders(true);
    let res = await fetch(`${this.baseURL}${endpoint}`, { method: 'GET', headers });

    if (res.status === 401) {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        const { access } = await this.refreshToken(refreshToken);
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
        headers = await this.getAuthHeaders(true);
        res = await fetch(`${this.baseURL}${endpoint}`, { method: 'GET', headers });
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? `Request failed: ${res.statusText}`;
      throw new Error(typeof msg === 'string' ? msg : 'Window request failed');
    }

    return res.json();
  }

  async upsertWindow(params: {
    target_batch: number;
    target_subject: number;
    is_active: boolean;
    duration?: number;
  }): Promise<AttendanceWindow> {
    return this.post<AttendanceWindow>('/attendance/window/', params);
  }

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

  private buildMarkAttendanceForm(attendance_window: number, imageUri: string): FormData {
    const formData = new FormData();
    (formData as unknown as { append: (k: string, v: unknown) => void }).append('student_picture', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'student-picture.jpg',
    });
    formData.append('attendance_window', String(attendance_window));
    return formData;
  }

  async markAttendance(attendance_window: number, imageUri: string): Promise<unknown> {
    const uploadUri = await this.ensureFileUri(imageUri);
    let token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const url = `${this.baseURL}/attendance/record/`;

    const parseBackendError = (body: string): string => {
      try {
        const data = JSON.parse(body) as { error?: string; message?: string; detail?: string };
        const msg = (data.error || data.message || data.detail || '').trim();
        return msg || 'Request failed';
      } catch {
        return 'Request failed';
      }
    };

    const send = (authToken: string | null): Promise<{ status: number; body: string }> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = this.buildMarkAttendanceForm(attendance_window, uploadUri);
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({ status: xhr.status, body: xhr.responseText || '' });
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) finish();
        };
        xhr.onerror = () => {
          if (settled) return;
          settled = true;
          reject(new Error('Network request failed'));
        };
        xhr.ontimeout = () => {
          if (settled) return;
          settled = true;
          reject(new Error('Request timed out'));
        };

        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken || ''}`);
        xhr.timeout = 60_000;
        xhr.send(formData);
      });

    let result = await send(token);

    if (result.status === 401) {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        try {
          const { access } = await this.refreshToken(refreshToken);
          await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
          result = await send(access);
        } catch {
          throw new Error(parseBackendError(result.body) || 'Session expired');
        }
      } else {
        throw new Error(parseBackendError(result.body) || 'Session expired');
      }
    }

    if (result.status === 0) {
      throw new Error('Network request failed');
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(parseBackendError(result.body));
    }

    try {
      return result.body ? JSON.parse(result.body) : {};
    } catch {
      return {};
    }
  }

  async getBatches(): Promise<Array<{ id: number; name: string | null }>> {
    return this.get<Array<{ id: number; name: string | null }>>('/batches/');
  }
}

export const apiService = new ApiService();
