import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  teacher?: string;

  @IsOptional()
  @IsInt()
  credits?: number;
}
