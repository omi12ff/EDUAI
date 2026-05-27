import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService, PrismaService],
})
export class AcademicModule {}
