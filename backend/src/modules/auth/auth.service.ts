import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, firstName, lastName } = signupDto;

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with normalized email
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    // Generate JWT token
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email - try normalized first, then try original (for backward compatibility)
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If not found with normalized email, try original email (case-sensitive)
    // This handles cases where users were created before email normalization
    if (!user && email !== normalizedEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: email.trim() },
      });
    }

    if (!user) {
      this.logger.warn(`[Login] User not found for email: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    const isPasswordHashed = user.password.startsWith('$2');
    
    if (!isPasswordHashed) {
      this.logger.error(`Password for user ${normalizedEmail} is not hashed. This is a security issue.`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (error) {
      this.logger.error(`[Login] Error comparing password for ${normalizedEmail}: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!isPasswordValid) {
      this.logger.warn(`[Login] Invalid password for email: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: (user as any).role || 'USER' 
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: (user as any).role || 'USER',
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
