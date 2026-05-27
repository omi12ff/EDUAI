import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
