import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  identityNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  campus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  career?: string;
}
