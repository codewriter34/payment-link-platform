# Docker Setup Guide

This guide will help you run the PayMo platform using Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

## Quick Start

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Start all services:**
   ```bash
   docker compose --env-file .env.docker up -d --build
   ```

3. **Check service status:**
   ```bash
   docker compose ps
   ```

4. **View logs:**
   ```bash
   # All services
   docker compose logs -f
   
   # Specific service
   docker compose logs -f backend
   docker compose logs -f frontend
   ```

## Services

The Docker Compose setup includes:

- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Caching
- **Backend** (port 3002) - NestJS API
- **Frontend** (port 3001) - Next.js app

## Access the Application

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3002/api/v1
- **Health Check:** http://localhost:3002/api/v1/health

## Environment Variables

Create a `.env.docker` file in the `backend` directory with the following variables:

```env
NODE_ENV=production
PORT=3002

DATABASE_URL="postgresql://postgres:1234@postgres:5432/paymo"

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

MANSA_BASE_URL=https://api-stage.mansatransfers.com
MANSA_CLIENT_KEY=your-client-key
MANSA_CLIENT_SECRET=your-client-secret
MANSA_ENVIRONMENT=test

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=PayMo

FRONTEND_URL=http://localhost:3001
```

## Common Commands

### Start Services
```bash
docker compose --env-file .env.docker up -d
```

### Stop Services
```bash
docker compose down
```

### Rebuild and Start
```bash
docker compose --env-file .env.docker up -d --build
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f redis
```

### Restart a Service
```bash
docker compose restart backend
docker compose restart frontend
```

### Stop and Remove Everything (including volumes)
```bash
docker compose down -v
```

### Execute Commands in Containers
```bash
# Backend container
docker compose exec backend sh

# Run Prisma migrations
docker compose exec backend npx prisma migrate deploy

# Create admin user
docker compose exec backend npm run create-admin
```

## Database Management

### Run Migrations
```bash
docker compose exec backend npx prisma migrate deploy
```

### Access PostgreSQL
```bash
docker compose exec postgres psql -U postgres -d paymo
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U postgres paymo > backup.sql
```

### Restore Database
```bash
docker compose exec -T postgres psql -U postgres paymo < backup.sql
```

## Troubleshooting

### Services Won't Start

1. **Check if ports are already in use:**
   ```bash
   # Windows PowerShell
   netstat -ano | findstr :3002
   netstat -ano | findstr :3001
   netstat -ano | findstr :5432
   ```

2. **Check Docker logs:**
   ```bash
   docker compose logs
   ```

3. **Rebuild containers:**
   ```bash
   docker compose down
   docker compose --env-file .env.docker up -d --build
   ```

### Database Connection Issues

1. **Check if PostgreSQL is healthy:**
   ```bash
   docker compose ps postgres
   ```

2. **Check database logs:**
   ```bash
   docker compose logs postgres
   ```

3. **Verify DATABASE_URL in .env.docker:**
   - Should be: `postgresql://postgres:1234@postgres:5432/paymo`
   - Note: Host is `postgres` (service name), not `localhost`

### Backend Build Fails

1. **Clear Docker cache:**
   ```bash
   docker compose build --no-cache
   ```

2. **Check for TypeScript errors:**
   ```bash
   docker compose exec backend npm run build
   ```

### Frontend Not Loading

1. **Check frontend logs:**
   ```bash
   docker compose logs frontend
   ```

2. **Verify NEXT_PUBLIC_API_URL:**
   - Should be: `http://localhost:3002` (for local access)
   - Or: `http://backend:3002` (for container-to-container)

### Redis Connection Issues

- Redis is optional - the app will continue without it
- Check logs: `docker compose logs redis`

## Development Workflow

### Making Code Changes

1. **Backend changes:**
   - Edit files in `backend/src/`
   - Rebuild: `docker compose up -d --build backend`

2. **Frontend changes:**
   - Edit files in `frontend/`
   - Rebuild: `docker compose up -d --build frontend`

### Hot Reload (Development)

For development with hot reload, run services locally instead of Docker:

**Backend:**
```bash
cd backend
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Production Deployment

For production, ensure:

1. **Strong secrets:** Use strong, random values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
2. **Secure database:** Change default PostgreSQL password
3. **HTTPS:** Use a reverse proxy (nginx/traefik) with SSL certificates
4. **Environment variables:** All sensitive values in `.env.docker`
5. **Backup strategy:** Regular database backups

## Clean Up

### Remove All Containers and Volumes
```bash
docker compose down -v
```

### Remove Images
```bash
docker rmi paylink_backend paylink_frontend
```

### Full Cleanup
```bash
docker compose down -v --rmi all
```

## Support

For issues:
- Check Docker logs: `docker compose logs`
- Verify environment variables in `.env.docker`
- Ensure Docker Desktop is running
- Check port availability

