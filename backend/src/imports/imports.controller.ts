import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Get,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportsService } from './imports.service';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('academic-excel')
  @UseInterceptors(FileInterceptor('file'))
  importAcademicExcel(@UploadedFile() file: UploadedFile) {
    return this.importsService.importAcademicExcel(file);
  }

  @Post('schedule-catalog')
  @UseInterceptors(FileInterceptor('file'))
  parseScheduleCatalog(@UploadedFile() file: UploadedFile): Promise<any> {
    return this.importsService.parseScheduleCatalog(file);
  }

  @Get('academic')
  getAcademicImports() {
    return this.importsService.getAcademicImports();
  }

  @Get('careers')
  getCareers() {
    return this.importsService.getCareers();
  }
}
