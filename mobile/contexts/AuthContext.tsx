import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { STORAGE_KEYS } from '@/constants/Config';
import { apiService } from '@/services/api';
import type { CurrentUser } from '@/types/user';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextType {
    user: CurrentUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    sendCode: (email: string) => Promise<void>;
    verifyCode: (email: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Session helpers ──────────────────────────────────────────────────────

    const saveSession = async (token: string, userData: CurrentUser) => {
        await AsyncStorage.multiSet([
            [STORAGE_KEYS.ACCESS_TOKEN, token],
            [STORAGE_KEYS.USER_DATA, JSON.stringify(userData)],
        ]);
        setUser(userData);
    };

    const clearSession = async () => {
        await AsyncStorage.multiRemove([
            STORAGE_KEYS.ACCESS_TOKEN,
            STORAGE_KEYS.USER_DATA,
        ]);
        setUser(null);
    };

    // ── Bootstrap — restore session on app launch ────────────────────────────

    useEffect(() => {
        const restore = async () => {
            try {
                const [[, token], [, userData]] = await AsyncStorage.multiGet([
                    STORAGE_KEYS.ACCESS_TOKEN,
                    STORAGE_KEYS.USER_DATA,
                ]);

                if (token && userData) {
                    setUser(JSON.parse(userData) as CurrentUser);
                } else {
                    setUser(null);
                }
            } catch {
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        restore();
    }, []);

    // ── Auth actions ─────────────────────────────────────────────────────────

    /** Step 1 — just sends the code, no session changes */
    const sendCode = async (email: string): Promise<void> => {
        await apiService.sendCode(email);
    };

    /** Step 2 — verifies code, persists token + user, navigates into app */
    const verifyCode = async (email: string, code: string): Promise<void> => {
        const { token, user: userData } = await apiService.verifyCode(email, code);
        await saveSession(token, userData);
        router.replace('/(tabs)');
    };

    const logout = async (): Promise<void> => {
        await clearSession();
        router.replace('/login');
    };

    /** Re-fetch user from server — useful after profile updates */
    const refreshUser = async (): Promise<void> => {
        const fresh = await apiService.getCurrentUser();
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(fresh));
        setUser(fresh);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                sendCode,
                verifyCode,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};