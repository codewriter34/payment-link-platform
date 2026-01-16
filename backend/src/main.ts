import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get('app.nodeEnv') || process.env.NODE_ENV || 'development';
  

  // Enable CORS FIRST - before other middleware
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        configService.get('app.frontendUrl'),
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        // Allow all localhost variations for development
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ].filter(Boolean);

      // Check if origin matches any allowed origin
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      // Log for debugging
      console.warn(`[CORS] Rejected origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set global prefix for API routes
  app.setGlobalPrefix(configService.get('app.apiPrefix') || 'api/v1');

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable trust proxy for proper IP detection (optional)
  // app.set('trust proxy', 1);

  const port = configService.get('app.port') || process.env.PORT || 3002;
  // Always bind to 0.0.0.0 to accept connections from outside the container
  // This is safe because Docker port mapping handles external access
  const host = '0.0.0.0';
  await app.listen(port, host);
}
bootstrap();
