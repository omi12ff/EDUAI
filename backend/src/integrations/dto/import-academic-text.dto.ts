import { IsEnum, IsString, MinLength } from 'class-validator';
import { IntegrationProvider } from '@prisma/client';

export class ImportAcademicTextDto {
  @IsEnum(IntegrationProvider)
  provider!: IntegrationProvider;

  @IsString()
  @MinLength(10)
  text!: string;
}
