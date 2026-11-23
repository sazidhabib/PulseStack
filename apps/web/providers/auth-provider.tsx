'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { UserPayload } from '@pulsestack/shared';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AuthContextType {
  user: UserPayload | null;
  org: OrgInfo | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; orgName: string }) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiClient.get<{ user: UserPayload; organization: OrgInfo }>('/api/auth/me');
      if (res.success && res.data) {
        setUser(res.data.user);
        setOrg(res.data.organization);
      } else {
        setUser(null);
        setOrg(null);
      }
    } catch {
      setUser(null);
      setOrg(null);
    }
  }, []);

  // Initialize session on mount via refresh token cookie
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      apiClient.onAuthFailure(() => {
        if (isMounted) {
          setUser(null);
          setOrg(null);
          setAccessToken(null);
        }
      });

      const token = await apiClient.refreshToken();
      if (token && isMounted) {
        setAccessToken(token);
        await fetchProfile();
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ user: UserPayload; accessToken: string }>('/api/auth/login', credentials);
      if (!res.success || !res.data) {
        return { success: false, error: res.error?.message || 'Invalid credentials' };
      }

      apiClient.setAccessToken(res.data.accessToken);
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      await fetchProfile();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; password: string; orgName: string }) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ user: UserPayload; accessToken: string }>('/api/auth/register', data);
      if (!res.success || !res.data) {
        return { success: false, error: res.error?.message || 'Registration failed' };
      }

      apiClient.setAccessToken(res.data.accessToken);
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      await fetchProfile();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ user: UserPayload; accessToken: string }>('/api/auth/demo');
      if (!res.success || !res.data) {
        return { success: false, error: res.error?.message || 'Demo login failed' };
      }

      apiClient.setAccessToken(res.data.accessToken);
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      await fetchProfile();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Demo login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Continue cleanup regardless
    } finally {
      apiClient.setAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setOrg(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        org,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginDemo,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
