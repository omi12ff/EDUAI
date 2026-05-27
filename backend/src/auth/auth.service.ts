import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly publicUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    country: true,
    city: true,
    timeZone: true,
    identityNumber: true,
    campus: true,
    career: true,
    lastLoginAt: true,
    bannedAt: true,
    bannedReason: true,
    emailVerifiedAt: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        subjects: true,
        assignments: true,
        grades: true,
      },
    },
  } as const;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (userExists) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const usersCount = await this.prisma.user.count();

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: usersCount === 0 ? Role.ADMIN : Role.STUDENT,
      },
      select: this.publicUserSelect,
    });
    const verification = await this.createEmailVerificationToken(
      user.id,
      user.email,
    );

    return {
      message:
        'Cuenta creada. Te enviamos un enlace para verificar tu correo antes de iniciar sesion.',
      user,
      ...verification,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureAccountIsActive(user);

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureEmailIsVerified(user);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      access_token: token,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const profile = await this.verifyGoogleCredential(dto.credential);

    let user = await this.prisma.user.findUnique({
      where: {
        email: profile.email,
      },
    });

    if (!user) {
      const temporaryPassword = await bcrypt.hash(
        randomBytes(32).toString('hex'),
        10,
      );
      const usersCount = await this.prisma.user.count();

      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          password: temporaryPassword,
          role: usersCount === 0 ? Role.ADMIN : Role.STUDENT,
          emailVerifiedAt: new Date(),
        },
      });
    }

    this.ensureAccountIsActive(user);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });

    return {
      access_token: this.signUserToken(user),
    };
  }

  async requestEmailVerification(dto: RequestEmailVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      return {
        message:
          'Si el correo existe y aun no esta verificado, se enviara un enlace de verificacion.',
      };
    }

    this.ensureAccountIsActive(user);

    if (user.emailVerifiedAt) {
      return {
        message: 'Este correo ya esta verificado. Ya podes iniciar sesion.',
      };
    }

    const verification = await this.createEmailVerificationToken(
      user.id,
      user.email,
    );

    return {
      message: 'Generamos un enlace de verificacion y lo enviamos a tu correo.',
      ...verification,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: {
          token: dto.token,
        },
        include: {
          user: true,
        },
      });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          emailVerifiedAt: verificationToken.user.emailVerifiedAt ?? new Date(),
        },
      }),
      this.prisma.emailVerificationToken.update({
        where: {
          id: verificationToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Correo verificado. Ya podes iniciar sesion.',
      email: verificationToken.user.email,
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      return {
        message:
          'Si el correo existe, se generara un enlace para restablecer la contrasena.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.passwordResetToken.create({
      data: {
        token,
        expiresAt,
        userId: user.id,
      },
    });

    return {
      message:
        'Token de recuperacion generado. En produccion esto se enviaria por correo.',
      resetToken: token,
      expiresAt,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        token: dto.token,
      },
      include: {
        user: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          password: hashedPassword,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password updated',
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data = this.buildProfileUpdate(dto);

    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data,
      select: this.publicUserSelect,
    });
  }

  private signUserToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private ensureAccountIsActive(user: { bannedAt: Date | null }) {
    if (user.bannedAt) {
      throw new ForbiddenException('Account disabled');
    }
  }

  private ensureEmailIsVerified(user: { emailVerifiedAt: Date | null }) {
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Tenes que verificar tu correo antes de iniciar sesion.',
      );
    }
  }

  private async createEmailVerificationToken(userId: string, email: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        expiresAt,
        userId,
      },
    });

    const verificationLink = this.buildVerificationLink(token);
    const emailSent = await this.mailService.sendEmailVerification(
      email,
      verificationLink,
    );

    if (process.env.NODE_ENV === 'production') {
      return {
        emailSent,
        expiresAt,
      };
    }

    return {
      verificationToken: token,
      verificationLink,
      emailSent,
      expiresAt,
    };
  }

  private buildVerificationLink(token: string) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    return `${frontendUrl.replace(/\/$/, '')}/login?verifyToken=${token}`;
  }

  private buildProfileUpdate(dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};

    this.assignTrimmed(data, 'name', dto.name);
    this.assignTrimmed(data, 'country', dto.country);
    this.assignTrimmed(data, 'city', dto.city);
    this.assignTrimmed(data, 'timeZone', dto.timeZone);
    this.assignTrimmed(data, 'campus', dto.campus);
    this.assignNullableTrimmed(data, 'identityNumber', dto.identityNumber);
    this.assignNullableTrimmed(data, 'career', dto.career);

    return data;
  }

  private assignTrimmed(
    data: Prisma.UserUpdateInput,
    key: 'name' | 'country' | 'city' | 'timeZone' | 'campus',
    value?: string,
  ) {
    if (value === undefined) return;

    const trimmed = value.trim();

    if (trimmed) {
      data[key] = trimmed;
    }
  }

  private assignNullableTrimmed(
    data: Prisma.UserUpdateInput,
    key: 'identityNumber' | 'career',
    value?: string,
  ) {
    if (value === undefined) return;

    const trimmed = value.trim();
    data[key] = trimmed || null;
  }

  private async verifyGoogleCredential(credential: string) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      throw new BadRequestException('Google login is not configured');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        credential,
      )}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    const payload = (await response.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      name?: string;
    };

    if (payload.aud !== googleClientId || payload.email_verified !== 'true') {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload.email) {
      throw new UnauthorizedException('Google account has no email');
    }

    return {
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
    };
  }
}
