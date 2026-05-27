import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  subjectId!: string;
}
