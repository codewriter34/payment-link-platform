import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, User, SignupData, LoginData, isTokenExpired } from '@/lib/auth/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  signup: (data: SignupData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

// Initialize auth check on app startup
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('auth_token');
  if (token && !isTokenExpired(token)) {
    // Token exists and is not expired, checkAuth will validate it
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false, // Will be set by checkAuth
      isLoading: true, // Start as loading to show spinner while checking auth
      error: null,

      signup: async (data: SignupData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authAPI.signup(data);
          const { accessToken, user } = response;

          set({
            user,
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Store token in localStorage for API requests
          localStorage.setItem('auth_token', accessToken);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Signup failed',
            isLoading: false,
          });
          throw error;
        }
      },

      login: async (data: LoginData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authAPI.login(data);
          const { accessToken, user } = response;

          set({
            user,
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Store token in localStorage for API requests
          localStorage.setItem('auth_token', accessToken);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
        localStorage.removeItem('auth_token');
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token');

        if (!token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
          return;
        }

        // Check if token is expired before making API call
        if (isTokenExpired(token)) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
          localStorage.removeItem('auth_token');
          return;
        }

        set({ isLoading: true });

        try {
          const user = await authAPI.getProfile(token);
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Token is invalid, clear auth state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          localStorage.removeItem('auth_token');
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        // Don't persist isAuthenticated - it will be computed from token validity
      }),
    }
  )
);