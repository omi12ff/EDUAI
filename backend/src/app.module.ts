import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AcademicModule } from './academic/academic.module';
import { AiModule } from './ai/ai.module';
import { FilesModule } from './files/files.module';
import { ImportsModule } from './imports/imports.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AcademicModule,
    AiModule,
    FilesModule,
    ImportsModule,
    IntegrationsModule,
    AdminModule,
  ],
})
export class AppModule {}
