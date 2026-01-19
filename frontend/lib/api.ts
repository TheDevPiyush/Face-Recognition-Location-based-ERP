"use client";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type LoginResponse = {
  access: string;
  refresh: string;
  user: { id: number; name: string | null; email: string | null; is_staff: boolean };
};

function getStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setStored(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function setTokens(access: string, refresh: string) {
  setStored("accessToken", access);
  setStored("refreshToken", refresh);
}

export function getAccessToken(): string | null {
  const token = getStored<string>("accessToken");
  return token;
}

export function getRefreshToken(): string | null {
  const token = getStored<string>("refreshToken");
  return token;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem("currentUser");
}

export function setCurrentUser(user: unknown) {
  setStored("currentUser", user);
}

export function getCurrentUserStored<T = any>(): T | null {
  return getStored<T>("currentUser");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.access) {
    setTokens(data.access, refresh);
    return data.access as string;
  }
  return null;
}

export async function apiFetch<T = any>(
  path: string,
  options: { method?: HttpMethod; body?: any; headers?: Record<string, string> } = {}
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      const retryRes = await fetch(`${API_URL}${path}`, {
        method,
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (!retryRes.ok) {
        const msg = await parseErrorMessage(retryRes);
        throw new Error(msg);
      }
      return (await retryRes.json()) as T;
    }
    const msg = await parseErrorMessage(res);
    throw new Error(msg || "Unauthorized");
  }

  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(msg || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (!data) return "";
      if (typeof data === "string") return data;
      if (typeof data.detail === "string") return data.detail;
      if (typeof data.message === "string") return data.message;
      const aggregate = flattenErrorObjectToMessage(data);
      if (aggregate) return aggregate;
      return JSON.stringify(data);
    }
    const text = await res.text();
    return text;
  } catch {
    return "";
  }
}

function flattenErrorObjectToMessage(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const parts: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val == null) continue;
    if (Array.isArray(val)) {
      parts.push(`${key}: ${val.join(", ")}`);
    } else if (typeof val === "string") {
      parts.push(`${key}: ${val}`);
    } else if (typeof val === "object") {
      const nested = flattenErrorObjectToMessage(val);
      if (nested) parts.push(`${key}: ${nested}`);
    }
  }
  return parts.join("\n");
}

// API helpers
export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/token/login/", {
    method: "POST",
    body: { email, password },
  });
  setTokens(data.access, data.refresh);
  setCurrentUser(data.user);
  return data;
}

export async function fetchMe() {
  return apiFetch("/me/");
}

export async function fetchBatches() {
  return apiFetch("/batches/");
}

export async function createBatch(payload: {
  course: number;
  code?: string | null;
  start_year?: number | null;
  end_year?: number | null;
}) {
  return apiFetch("/batches/", { method: "POST", body: payload });
}

export async function fetchSubjects() {
  return apiFetch("/subjects/");
}

export async function createSubject(payload: {
  batch: number;
  code: string;
  faculty?: number | null;
}) {
  return apiFetch("/subjects/", { method: "POST", body: payload });
}

export async function fetchStudents() {
  return apiFetch("/users/students/");
}

export async function fetchStudentsByBatch(batchId: number) {
  return apiFetch(`/users/students/${batchId}/`);
}

export async function getWindow(target_batch: number, target_subject: number) {
  const query = new URLSearchParams({ target_batch: String(target_batch), target_subject: String(target_subject) });
  return apiFetch(`/attendance/window/?${query.toString()}`);
}

export async function upsertWindow(params: {
  target_batch: number;
  target_subject: number;
  duration?: number;
  is_active?: boolean;
}) {
  return apiFetch("/attendance/window/", { method: "POST", body: params });
}

export async function markAttendance(attendance_window: number, student_picture: File, user?: number) {
  const formData = new FormData();
  formData.append("student_picture", student_picture);
  formData.append("attendance_window", String(attendance_window));
  if (user) {
    formData.append("user", String(user));
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/attendance/record/`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      const retryRes = await fetch(`${API_URL}/attendance/record/`, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
        body: formData,
      });
      if (!retryRes.ok) {
        const msg = await parseErrorMessage(retryRes);
        throw new Error(msg);
      }
      return (await retryRes.json());
    }
    const msg = await parseErrorMessage(res);
    throw new Error(msg || "Unauthorized");
  }

  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(msg || `Request failed with status ${res.status}`);
  }
  return (await res.json());
}

export async function updateMyLocation(latitude: number, longitude: number) {
  return apiFetch("/me/location/", { method: "PATCH", body: { latitude, longitude } });
}

export async function updateProfile(payload: { name?: string | null; email?: string | null; phone?: string | null; profile_picture?: File }) {
  const formData = new FormData();
  
  if (payload.profile_picture) {
    formData.append("profile_picture", payload.profile_picture);
  }
  if (payload.name !== undefined) {
    formData.append("name", payload.name ?? "");
  }
  if (payload.email !== undefined) {
    formData.append("email", payload.email ?? "");
  }
  if (payload.phone !== undefined) {
    formData.append("phone", payload.phone ?? "");
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/me/`, {
    method: "PATCH",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      const retryRes = await fetch(`${API_URL}/me/`, {
        method: "PATCH",
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
        body: formData,
      });
      if (!retryRes.ok) {
        const msg = await parseErrorMessage(retryRes);
        throw new Error(msg);
      }
      return (await retryRes.json());
    }
    const msg = await parseErrorMessage(res);
    throw new Error(msg || "Unauthorized");
  }

  if (!res.ok) {
    const errorMessage = (await res.json())?.error;
    throw new Error(errorMessage || `Request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data;
}

// Universities
export async function fetchUniversities() {
  return apiFetch("/universities/");
}

export async function createUniversity(payload: { name: string; code?: string | null; address?: string | null }) {
  return apiFetch("/universities/", { method: "POST", body: payload });
}

// Courses
export async function fetchCourses() {
  return apiFetch("/courses/");
}

export async function createCourse(payload: { university: number; code?: string | null }) {
  return apiFetch("/courses/", { method: "POST", body: payload });
}

// Users (admin only)
export async function fetchUsersAll() {
  return apiFetch("/users/");
}

export async function createUser(payload: {
  name?: string | null;
  email: string;
  password: string;
  role: string;
  batch?: number | null;
}) {
  return apiFetch("/users/", { method: "POST", body: payload });
}

export async function createMultipleUsers(
  payload: Array<{
    name?: string | null;
    email: string;
    password: string;
    role?: string | null;
    batch?: number | null;
  }>
) {
  return apiFetch("/users/", {
    method: "POST",
    body: payload,
  });
}

// Attendance Analytics
export async function fetchAttendanceAnalytics(params: {
  batch_id?: number;
  subject_id?: number;
  student_id?: number;
  start_date?: string;
  end_date?: string;
  month?: string;
}) {
  const query = new URLSearchParams();
  if (params.batch_id) query.append("batch_id", String(params.batch_id));
  if (params.subject_id) query.append("subject_id", String(params.subject_id));
  if (params.student_id) query.append("student_id", String(params.student_id));
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.month) query.append("month", params.month);
  
  return apiFetch(`/attendance/analytics/?${query.toString()}`);
}

export async function fetchMonthlyPercentage(params: {
  batch_id?: number;
  subject_id?: number;
  student_id?: number;
  month?: string;
}) {
  const query = new URLSearchParams();
  if (params.batch_id) query.append("batch_id", String(params.batch_id));
  if (params.subject_id) query.append("subject_id", String(params.subject_id));
  if (params.student_id) query.append("student_id", String(params.student_id));
  if (params.month) query.append("month", params.month);
  
  return apiFetch(`/attendance/monthly-percentage/?${query.toString()}`);
}

export async function fetchStudentCalendar(params: {
  month?: string;
  batch_id?: number;
}) {
  const query = new URLSearchParams();
  if (params.month) query.append("month", params.month);
  if (params.batch_id) query.append("batch_id", String(params.batch_id));
  
  return apiFetch(`/attendance/student-calendar/?${query.toString()}`);
}

