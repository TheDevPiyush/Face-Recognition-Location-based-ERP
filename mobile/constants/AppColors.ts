/**
 * Application Color Palette
 * Professional and minimal color scheme for the ERP application
 */

export const AppColors = {
  // Background colors
  background: {
    primary: '#FAFBFC',
    secondary: '#F5F7FA',
    tertiary: '#FFFFFF',
  },

  // Surface colors
  surface: {
    primary: '#FFFFFF',
    elevated: '#FFFFFF',
    card: '#FFFFFF',
  },

  // Border colors
  border: {
    light: '#E1E4E8',
    default: '#D1D5DB',
    focus: '#2563EB',
    error: '#EF4444',
  },

  // Text colors
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    link: '#2563EB',
  },

  // Primary brand colors
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Status colors
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Accent colors
  accent: {
    blue: '#2563EB',
    indigo: '#4F46E5',
    purple: '#7C3AED',
    pink: '#EC4899',
  },

  // Overlay
  overlay: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },

  // Shadows
  shadow: {
    sm: 'rgba(0, 0, 0, 0.05)',
    md: 'rgba(0, 0, 0, 0.1)',
    lg: 'rgba(0, 0, 0, 0.15)',
  },
} as const;

export default AppColors;
