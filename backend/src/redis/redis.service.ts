import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(private configService: ConfigService) {
    const redisConfig = this.configService.get('redis');
    this.keyPrefix = redisConfig?.keyPrefix || 'paymo:';
    this.defaultTTL = redisConfig?.ttl || 3600;

    this.client = new Redis({
      host: redisConfig?.host || 'localhost',
      port: redisConfig?.port || 6379,
      password: redisConfig?.password,
      db: redisConfig?.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Don't queue commands when offline
      lazyConnect: true, // Don't connect immediately
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      await this.client.ping();
    } catch (error: any) {
      // Don't fail the app if Redis is unavailable - just log and continue
      this.logger.warn(`Redis connection failed: ${error.message}. App will continue without caching.`);
      this.client.disconnect();
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return null; // Redis not available, skip cache
      }
      const value = await this.client.get(this.getKey(key));
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error: any) {
      // Silently fail - return null so app continues without cache
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return; // Redis not available, skip cache
      }
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;
      await this.client.setex(this.getKey(key), expiration, serialized);
    } catch (error: any) {
      // Silently fail - app continues without cache
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return; // Redis not available, skip cache
      }
      await this.client.del(this.getKey(key));
    } catch (error: any) {
      // Silently fail
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return; // Redis not available, skip cache
      }
      const keys = await this.client.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error: any) {
      // Silently fail
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return false;
      }
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error: any) {
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      if (!this.client || !this.client.status || this.client.status !== 'ready') {
        return -1;
      }
      return await this.client.ttl(this.getKey(key));
    } catch (error: any) {
      return -1;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    await this.delPattern(pattern);
  }
}

