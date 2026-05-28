import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly adminUserSelect = {
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
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        subjects: true,
        assignments: true,
        grades: true,
        chatHistory: true,
      },
    },
  } as const;

  constructor(private prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: this.adminUserSelect,
    });
  }

  async updateRole(adminId: string, userId: string, role: Role) {
    if (adminId === userId) {
      throw new BadRequestException(
        'No podes cambiar tu propio rol desde aqui',
      );
    }

    await this.ensureUserExists(userId);

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role,
      },
      select: this.adminUserSelect,
    });
  }

  async banUser(adminId: string, userId: string, reason?: string) {
    if (adminId === userId) {
      throw new BadRequestException('No podes bloquear tu propia cuenta');
    }

    await this.ensureUserExists(userId);

    const data: Prisma.UserUpdateInput = {
      bannedAt: new Date(),
      bannedReason: reason?.trim() || 'Bloqueado por administracion',
    };

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data,
      select: this.adminUserSelect,
    });
  }

  async unbanUser(userId: string) {
    await this.ensureUserExists(userId);

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        bannedAt: null,
        bannedReason: null,
      },
      select: this.adminUserSelect,
    });
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }
}
