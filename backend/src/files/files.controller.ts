import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Get,
  Delete,
  Param,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

type PdfTextItem = {
  str?: string;
};

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @GetUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const content = await this.extractPdfText(file.buffer);

    return this.filesService.createDocument({
      title: file.originalname,
      fileName: file.originalname,
      content,
      userId: user.id,
    });
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') =
      await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    });

    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => (item as PdfTextItem).str ?? '')
        .join(' ');

      fullText += pageText + '\n';
    }

    return fullText;
  }

  @Get('my')
  getMyDocuments(@GetUser() user: AuthUser) {
    return this.filesService.getMyDocuments(user.id);
  }

  @Delete(':id')
  deleteDocument(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.filesService.deleteDocument(id, user.id);
  }
}
