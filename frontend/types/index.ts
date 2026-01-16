// Core types for PayMo platform

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  quantity: number | null; // null = unlimited
  soldQuantity: number;
  imageUrl: string;
  supportEmail?: string;
  supportPhone?: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  merchantId: string;
}

export interface PaymentLink {
  id: string;
  productId: string;
  shortCode: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface Transaction {
  id: string;
  paymentLinkId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  reference: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProductForm {
  title: string;
  description?: string;
  price: number;
  quantity: number | null;
  image: File | null;
  supportEmail?: string;
  supportPhone?: string;
}

export interface PaymentForm {
  fullName: string;
  email: string;
  phoneNumber: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth context
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginForm) => Promise<void>;
  signup: (data: SignupForm) => Promise<void>;
  logout: () => void;
}
