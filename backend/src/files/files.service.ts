import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async createDocument(data: {
    title: string;
    fileName: string;
    content: string;
    userId: string;
  }) {
    return this.prisma.document.create({
      data,
    });
  }

  async getMyDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteDocument(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.document.delete({
      where: {
        id,
      },
    });
  }
}
