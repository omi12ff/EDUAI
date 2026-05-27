import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name!: string;

  @IsString()
  teacher!: string;

  @IsOptional()
  @IsInt()
  credits?: number;
}
