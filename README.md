# PayMo - Payment Link Platform

A full-stack, production-ready payment link platform built with Next.js and NestJS. Enables merchants to create shareable payment links for products, accept Mobile Money payments via Mansa Transfers API, and manage their business through an intuitive dashboard.

## 🚀 Features

### Core Features
- **User Authentication**: Secure JWT-based authentication with role-based access control (USER/ADMIN)
- **Product Management**: Full CRUD operations for products with image uploads to AWS S3
- **Payment Links**: Generate unique, shareable payment links with expiration (6 hours default)
- **Payment Processing**: Integration with Mansa Transfers API for Mobile Money payments
- **Receipt Generation**: Automatic PDF receipt generation and download after successful payments
- **Email Notifications**: Automated email notifications for customers and merchants on successful payments
- **Real-time Updates**: Live quantity updates and payment status polling
- **Redis Caching**: Performance optimization with Redis caching layer

### Technical Features
- **Type Safety**: Full TypeScript implementation across frontend and backend
- **Docker Support**: Complete Docker Compose setup for easy deployment
- **Database Migrations**: Prisma ORM with automated migrations
- **Input Validation**: Comprehensive validation with class-validator
- **Error Handling**: Production-ready error handling and logging
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Configuration**: Secure cross-origin resource sharing
- **Health Checks**: Health check endpoints for monitoring

## 📁 Project Structure

```
payment-link-platform/
├── frontend/                 # Next.js frontend application
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/          # Authentication routes
│   │   ├── (dashboard)/     # Protected dashboard routes
│   │   └── pay/             # Public payment pages
│   ├── components/          # React components
│   ├── lib/                 # Utilities and API clients
│   ├── types/               # TypeScript type definitions
│   └── Dockerfile           # Frontend Docker configuration
│
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # Authentication module
│   │   │   ├── products/   # Product management
│   │   │   ├── payments/   # Payment processing
│   │   │   ├── receipts/   # Receipt generation
│   │   │   ├── email/      # Email service
│   │   │   ├── admin/      # Admin dashboard
│   │   │   └── users/      # User management
│   │   ├── config/         # Configuration files
│   │   ├── common/         # Shared utilities
│   │   ├── prisma/         # Prisma service
│   │   └── redis/          # Redis service
│   ├── prisma/             # Database schema and migrations
│   ├── docker-compose.yml  # Docker Compose configuration
│   └── Dockerfile          # Backend Docker configuration
│
└── README.md               # This file
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16.1.1 (App Router)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5.0.10
- **Type Safety**: TypeScript 5

### Backend
- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (ioredis)
- **Authentication**: JWT (Passport.js)
- **File Storage**: AWS S3
- **Email**: Nodemailer
- **PDF Generation**: PDFKit
- **Payment Gateway**: Mansa Transfers API

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

## 🏗️ Architecture

### Frontend Architecture

**Routing Structure:**
- `(auth)` - Public authentication pages (login, signup)
- `(dashboard)` - Protected user dashboard and admin panel
- `pay/[linkCode]` - Public payment pages (no auth required)

**State Management:**
- Zustand store for global authentication state
- Local component state for UI interactions
- Server state via API calls

**API Integration:**
- Centralized API configuration (`lib/config/api.ts`)
- Environment-based API URLs
- Type-safe API clients with TypeScript interfaces

### Backend Architecture

**Module Structure:**
- **Auth Module**: JWT authentication, user signup/login
- **Products Module**: Product CRUD, payment link generation, S3 integration
- **Payments Module**: Payment initiation, status checking, Mansa API integration
- **Receipts Module**: PDF generation and download
- **Email Module**: Transactional email notifications
- **Users Module**: User profile management

**Design Patterns:**
- **Module Pattern**: Feature-based module organization
- **Service Layer**: Business logic separation
- **DTO Pattern**: Data Transfer Objects for validation
- **Guard Pattern**: Route protection and authorization
- **Repository Pattern**: Prisma service abstraction

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (for containerized setup)
- PostgreSQL (if running locally)
- Redis (optional, app works without it)

### Option 1: Docker Setup (Recommended)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create environment file:**
   Create `backend/.env.docker` with required variables (see Environment Variables section)

3. **Start all services:**
   ```bash
   docker compose --env-file .env.docker up -d --build
   ```

4. **Run database migrations:**
   ```bash
   docker compose exec backend npx prisma migrate deploy
   ```

5. **Access the application:**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3002/api/v1
   - Health Check: http://localhost:3002/api/v1/health

### Option 2: Local Development

**Backend:**
```bash
cd backend
npm install
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📝 Environment Variables

### Backend (.env.docker or .env)

```env
# Database
DATABASE_URL="postgresql://postgres:1234@postgres:5432/paymo"

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Redis (optional)
REDIS_HOST=redis
REDIS_PORT=6379

# Mansa Transfers API
MANSA_BASE_URL=https://api-stage.mansatransfers.com
MANSA_CLIENT_KEY=your-client-key
MANSA_CLIENT_SECRET=your-client-secret
MANSA_ENVIRONMENT=test

# AWS S3 (for image uploads)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# App Configuration
NODE_ENV=production
PORT=3002
FRONTEND_URL=http://localhost:3001
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
```

## 🔐 Security Best Practices

### Implemented Security Features

1. **Authentication & Authorization**
   - JWT-based authentication with secure token storage
   - Role-based access control (USER/ADMIN)
   - Password hashing with bcrypt (12 rounds)
   - Email normalization to prevent duplicate accounts

2. **Input Validation**
   - Server-side validation with class-validator
   - DTO pattern for type-safe data transfer
   - SQL injection prevention via Prisma ORM
   - XSS protection with React's built-in escaping

3. **API Security**
   - Rate limiting (ThrottlerGuard)
   - CORS configuration
   - Environment variable protection
   - No sensitive data in logs

4. **Database Security**
   - Parameterized queries (Prisma)
   - Connection pooling
   - SSL support for production

5. **File Upload Security**
   - File type validation
   - File size limits (5MB)
   - Secure S3 bucket configuration

## 🎯 Key Implementation Details

### Payment Flow

1. **Link Generation**: Merchant creates product → generates unique payment link
2. **Customer Access**: Customer visits public payment link (no auth required)
3. **Payment Initiation**: Customer enters details → payment initiated via Mansa API
4. **Status Polling**: Frontend polls payment status every 3 seconds
5. **Success Handling**: On success → quantity decremented, receipt generated, emails sent
6. **Idempotency**: Database-level idempotency prevents double processing

### Idempotent Payment Processing

The system uses atomic database operations to prevent race conditions:

```typescript
// Only one request can transition PENDING → SUCCESS
await tx.transaction.updateMany({
  where: { id: transactionId, status: 'PENDING' },
  data: { status: 'SUCCESS', completedAt: new Date() },
});
```

### Caching Strategy

- **Product Lists**: 5-minute TTL
- **Payment Links**: 5-minute TTL
- **User Data**: 10-minute TTL
- **Statistics**: 2-minute TTL
- **Transaction Status**: 30 seconds (pending), 5 minutes (completed)

### Error Handling

- **Global Exception Filter**: Consistent error response format
- **Validation Pipe**: Automatic DTO validation
- **User-Friendly Messages**: Production-ready error messages
- **Graceful Degradation**: App continues without Redis/caching

## 📊 Database Schema

**Key Models:**
- `User`: Authentication and user profiles (with role: USER/ADMIN)
- `Product`: Product information with quantity tracking
- `PaymentLink`: Shareable payment links with expiration
- `Transaction`: Payment records with status tracking

**Relationships:**
- User → Products (one-to-many)
- Product → PaymentLinks (one-to-many)
- PaymentLink → Transactions (one-to-many)

## 🧪 Testing & Quality

### Code Quality
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Type-safe API contracts

### Production Readiness
- Optimized logging (no sensitive data)
- Error handling
- Input validation
- Rate limiting
- Health check endpoints

## 🐳 Docker Commands

```bash
# Start all services
docker compose --env-file .env.docker up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Rebuild specific service
docker compose up -d --build backend

# Execute commands in container
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run create-admin
```




## 🤝 Contributing

1. Follow TypeScript best practices
2. Maintain type safety
3. Write clean, readable code
4. Test thoroughly
5. Follow existing code patterns

## 📄 License

Private - All rights reserved

## 🎯 Project Goals

This platform was built with production-readiness in mind:
- ✅ Type-safe codebase
- ✅ Comprehensive error handling
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Scalable architecture
- ✅ Docker containerization
- ✅ Production-ready logging
- ✅ Idempotent operations
- ✅ Rate limiting
- ✅ Input validation

---

**Built with ❤️ using Next.js, NestJS, TypeScript, and Docker codewriter34**

