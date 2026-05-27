import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { GradeKind } from '@prisma/client';

export const gradeKinds = Object.values(GradeKind);

export class CreateGradeDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsEnum(GradeKind)
  type?: GradeKind;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  examId?: string | null;
}
