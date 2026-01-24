export interface User {
  id: number;
  name: string;
  email: string;
  is_staff: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}
