import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { ImportAcademicTextDto } from './dto/import-academic-text.dto';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('catalog')
  getCatalog() {
    return this.integrationsService.getCatalog();
  }

  @Get()
  getConnections(@GetUser() user: AuthUser) {
    return this.integrationsService.getConnections(user.id);
  }

  @Post()
  upsertConnection(
    @Body() dto: UpsertIntegrationDto,
    @GetUser() user: AuthUser,
  ) {
    return this.integrationsService.upsertConnection(dto, user.id);
  }

  @Post(':provider/sync')
  syncProvider(@Param('provider') provider: string, @GetUser() user: AuthUser) {
    return this.integrationsService.syncProvider(
      provider.toUpperCase(),
      user.id,
    );
  }

  @Post('import-text')
  importAcademicText(
    @Body() dto: ImportAcademicTextDto,
    @GetUser() user: AuthUser,
  ) {
    return this.integrationsService.importAcademicText(dto, user.id);
  }

  @Get('imported-events')
  getImportedEvents(@GetUser() user: AuthUser) {
    return this.integrationsService.getImportedEvents(user.id);
  }

  @Patch('imported-events/:id/apply')
  applyImportedEvent(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.integrationsService.applyImportedEvent(id, user.id);
  }

  @Patch('imported-events/:id/dismiss')
  dismissImportedEvent(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.integrationsService.dismissImportedEvent(id, user.id);
  }
}
