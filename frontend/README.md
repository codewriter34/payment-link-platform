# PayMo Frontend

A modern, production-ready Next.js frontend application for the PayMo payment link platform. Built with React 19, Next.js 16, TypeScript, and Tailwind CSS.

## 🚀 Features

- **User Authentication**: Secure signup/login with JWT token management
- **Product Management**: Create, edit, delete, and manage products with images
- **Payment Links**: Generate shareable payment links for products
- **Public Payment Pages**: Customer-facing payment pages (no authentication required)
- **Dashboard**: Real-time statistics and product overview
- **Admin Dashboard**: Role-based admin access with comprehensive metrics
- **Receipt Generation**: Download PDF receipts after successful payments
- **Responsive Design**: Mobile-first, fully responsive UI
- **State Management**: Zustand for global state management
- **Type Safety**: Full TypeScript implementation

## 📁 Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── (auth)/                   # Authentication route group
│   │   ├── login/                # Login page
│   │   └── signup/               # Signup page
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/                # Admin dashboard
│   │   └── dashboard/            # User dashboard
│   │       ├── create-product/   # Product creation page
│   │       └── page.tsx           # Dashboard home
│   ├── (public)/                 # Public route group
│   ├── pay/                      # Public payment pages
│   │   └── [linkCode]/          # Dynamic payment link page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── auth/                     # Authentication components
│   │   ├── AuthGuard.tsx         # Route protection guard
│   │   ├── AuthProvider.tsx      # Auth context provider
│   │   ├── LoginForm.tsx         # Login form component
│   │   └── SignupForm.tsx        # Signup form component
│   ├── dashboard/                # Dashboard components
│   │   ├── DashboardHeader.tsx   # Dashboard header
│   │   ├── ProductCard.tsx       # Product card display
│   │   ├── ProductForm.tsx        # Product create/edit form
│   │   ├── ProductGrid.tsx        # Products grid layout
│   │   └── StatsCards.tsx        # Statistics cards
│   ├── home/                     # Home page components
│   │   ├── CTA.tsx               # Call-to-action section
│   │   ├── Features.tsx          # Features showcase
│   │   ├── Hero.tsx              # Hero section
│   │   └── HowItWorks.tsx        # How it works section
│   ├── layout/                   # Layout components
│   │   ├── Footer.tsx            # Footer component
│   │   └── Navbar.tsx            # Navigation bar
│   ├── payment/                  # Payment components
│   └── ui/                       # Reusable UI components
│
├── lib/                          # Utility libraries
│   ├── api/                      # API client utilities
│   ├── auth/                     # Authentication utilities
│   │   └── auth.ts               # Auth API client & helpers
│   ├── config/                   # Configuration
│   │   └── api.ts                # API endpoint configuration
│   └── store/                    # State management
│       └── auth.ts                # Zustand auth store
│
├── types/                        # TypeScript type definitions
│   └── index.ts                  # Shared types
│
├── hooks/                        # Custom React hooks
│
├── public/                       # Static assets
│   └── *.svg                     # SVG icons and images
│
├── Dockerfile                    # Docker configuration
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
└── tailwind.config.js            # Tailwind CSS configuration
```

## 🛠️ Technologies

- **Framework**: Next.js 16.1.1 (App Router)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5.0.10
- **Type Safety**: TypeScript 5
- **HTTP Client**: Native Fetch API
- **Form Handling**: Native React forms with validation
- **Routing**: Next.js App Router with route groups

## 🏗️ Implementation Details

### Authentication Flow

1. **Signup/Login**: Users authenticate via `/api/v1/auth/signup` or `/api/v1/auth/login`
2. **Token Storage**: JWT tokens stored in `localStorage` for persistence
3. **Protected Routes**: `AuthGuard` component protects dashboard routes
4. **Role-Based Access**: Admin users redirected to `/admin`, regular users to `/dashboard`
5. **Auto-Redirect**: Authenticated users redirected away from login/signup pages

### State Management

- **Zustand Store** (`lib/store/auth.ts`): Manages authentication state globally
  - User information
  - Authentication status
  - Token management
  - Login/logout actions

### API Integration

- **Centralized Config** (`lib/config/api.ts`): Single source of truth for API URLs
- **Environment Variables**: `NEXT_PUBLIC_API_URL` for backend connection
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript interfaces for all API responses

### Payment Flow

1. **Public Access**: Payment links accessible without authentication
2. **Real-time Status**: Polling mechanism for payment status updates
3. **Receipt Download**: PDF receipt generation and download
4. **Error Handling**: User-friendly error messages for payment failures

### Product Management

- **CRUD Operations**: Full create, read, update, delete functionality
- **Image Upload**: AWS S3 integration for product images
- **Quantity Management**: Real-time quantity updates after purchases
- **Payment Link Generation**: One-click payment link creation

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-first approach, works on all devices
- **Modern UI**: Clean, professional design with Tailwind CSS
- **Loading States**: Skeleton loaders and loading indicators
- **Error States**: Clear error messages and recovery options
- **Success Feedback**: Toast notifications and success messages
- **Accessibility**: Semantic HTML and ARIA labels

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn
- Backend API running (see backend README)

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### Development

```bash
# Start dev server (runs on http://localhost:3000)
npm run dev

# Lint code
npm run lint
```

## 📦 Docker Deployment

See `Dockerfile` for containerization. The frontend runs on port 3001 in Docker.

```bash
# Build Docker image
docker build -t paymo-frontend .

# Run container
docker run -p 3001:3001 paymo-frontend
```

## 🔒 Security Best Practices

1. **Environment Variables**: All sensitive config via environment variables
2. **Token Storage**: JWT tokens in `localStorage` (consider httpOnly cookies for production)
3. **Input Validation**: Client-side validation with server-side verification
4. **CORS**: Backend handles CORS configuration
5. **XSS Protection**: React's built-in XSS protection
6. **Type Safety**: TypeScript prevents many runtime errors

## 🧪 Testing

```bash
# Run linter
npm run lint

# Type checking (via TypeScript)
npm run build  # Will fail on type errors
```

## 📝 Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Next.js recommended rules
- **Components**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions
- **File Structure**: Feature-based organization

## 🔄 State Management Pattern

```typescript
// Zustand store pattern
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (data) => { /* ... */ },
  logout: () => { /* ... */ },
}));
```

## 🌐 API Integration Pattern

```typescript
// Centralized API config
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Type-safe API calls
const response = await fetch(`${API_BASE_URL}/api/v1/endpoint`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

## 📱 Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## 🎯 Performance Optimizations

- **Next.js Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic code splitting by Next.js
- **Static Generation**: Static pages where possible
- **Lazy Loading**: Components loaded on demand
- **Minimal Logging**: Production-ready with minimal console logs

## 🐛 Troubleshooting

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is running and accessible
- Verify CORS settings on backend

### Authentication Issues
- Clear `localStorage` and try again
- Check token expiration
- Verify backend JWT configuration

### Build Errors
- Run `npm install` to ensure dependencies are installed
- Check TypeScript errors: `npm run build`
- Verify Node.js version (20+)

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use functional components and hooks
3. Maintain type safety
4. Write clean, readable code
5. Test on multiple devices/browsers

## 📄 License

Private - All rights reserved
