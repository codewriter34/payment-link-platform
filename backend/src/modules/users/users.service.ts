import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async findOne(id: string) {
    const cacheKey = `user:${id}`;
    
    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password for security
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cache for 10 minutes
    await this.redisService.set(cacheKey, user, 600);

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate user cache
    await this.redisService.del(`user:${id}`);
    await this.redisService.invalidatePattern(`stats:user:${id}*`);

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async getUserStats(userId: string) {
    const cacheKey = `stats:user:${userId}`;
    
    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [productCount, totalSales, activeLinks] = await Promise.all([
      this.prisma.product.count({
        where: { merchantId: userId },
      }),
      this.prisma.transaction.aggregate({
        where: {
          paymentLink: {
            product: {
              merchantId: userId,
            },
          },
          status: 'SUCCESS',
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.paymentLink.count({
        where: {
          product: {
            merchantId: userId,
          },
          isActive: true,
        },
      }),
    ]);

    const stats = {
      totalProducts: productCount,
      totalRevenue: totalSales._sum.amount || 0,
      activeLinks,
    };

    // Cache stats for 2 minutes
    await this.redisService.set(cacheKey, stats, 120);

    return stats;
  }
}
