import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { AuditAction, Role } from '../generated/prisma/enums.js';
import { JwtPayload } from './strategies/jwt/jwt.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  twoFactorEnabled?: boolean;
  slug?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
    twoFactorCode?: string,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await argon2.verify(user.passwordHash, pass);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA Verification if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorCode) {
        throw new UnauthorizedException('2FA code is required');
      }

      const res = verifySync({
        token: twoFactorCode,
        secret: user.twoFactorSecret,
      });

      if (!res.valid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      slug: user.slug,
    };
  }

  async login(
    loginDto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string; requestId?: string },
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await this.validateUser(
      loginDto.email,
      loginDto.password,
      loginDto.twoFactorCode,
    );

    const tokens = await this.generateTokens(user);

    // Store session with refresh token (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN,
        entity: 'User',
        entityId: user.id,
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        meta: { userAgent: meta.userAgent },
      },
    });

    return { user, tokens };
  }

  async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user: UserResponse = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      twoFactorEnabled: session.user.twoFactorEnabled,
      slug: session.user.slug,
    };

    const tokens = await this.generateTokens(user);

    // Rotate refresh token in session
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: newExpiresAt,
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress,
      },
    });

    return { user, tokens };
  }

  async logout(refreshToken?: string, userId?: string, ipAddress?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.session.deleteMany({
        where: { refreshToken },
      }).catch(() => {});
    }

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.LOGOUT,
          entity: 'User',
          entityId: userId,
          ipAddress,
        },
      }).catch(() => {});
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        slug: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      slug: user.slug,
    };
  }

  // ─── TOTP 2FA Methods ──────────────────────────────────────────────────────

  async generate2FaSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = generateSecret();
    const otpAuthUrl = generateURI({
      issuer: 'JobAgent AI',
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Save secret provisionally (unconfirmed until code verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      secret,
      otpAuthUrl,
      qrCodeDataUrl,
    };
  }

  async enable2Fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const res = verifySync({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!res.valid) {
      throw new BadRequestException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.RECORD_UPDATE,
        entity: 'User',
        entityId: userId,
        meta: { event: '2FA_ENABLED' },
      },
    });

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully.',
    };
  }

  async disable2Fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not active');
    }

    const res = verifySync({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!res.valid) {
      throw new BadRequestException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.RECORD_UPDATE,
        entity: 'User',
        entityId: userId,
        meta: { event: '2FA_DISABLED' },
      },
    });

    return {
      success: true,
      message: 'Two-factor authentication disabled.',
    };
  }

  private async generateTokens(user: UserResponse): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as any,
    });

    const refreshToken = uuidv4();

    return { accessToken, refreshToken };
  }
}
