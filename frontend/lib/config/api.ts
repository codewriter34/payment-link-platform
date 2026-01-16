/**
 * API Configuration
 * Centralized API base URL management
 */

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: `${API_BASE_URL}/api/v1/auth/signup`,
    LOGIN: `${API_BASE_URL}/api/v1/auth/login`,
    PROFILE: `${API_BASE_URL}/api/v1/auth/profile`,
  },
  PRODUCTS: {
    BASE: `${API_BASE_URL}/api/v1/products`,
    STATS: `${API_BASE_URL}/api/v1/products/stats`,
    BY_ID: (id: string) => `${API_BASE_URL}/api/v1/products/${id}`,
  },
  PAYMENT_LINKS: {
    BASE: `${API_BASE_URL}/api/v1/links`,
    BY_CODE: (code: string) => `${API_BASE_URL}/api/v1/links/${code}`,
  },
} as const;

export default API_BASE_URL;

