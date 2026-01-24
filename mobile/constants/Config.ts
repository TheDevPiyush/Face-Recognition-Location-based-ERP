// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
} as const;
