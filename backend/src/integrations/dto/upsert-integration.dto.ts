import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IntegrationProvider } from '@prisma/client';

export const integrationProviders = Object.values(IntegrationProvider);

export class UpsertIntegrationDto {
  @IsEnum(IntegrationProvider)
  provider!: IntegrationProvider;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
