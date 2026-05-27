import { IsNotEmpty, IsString } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  day!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;
}
