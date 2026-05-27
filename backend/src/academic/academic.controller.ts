import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';

import { AcademicService } from './academic.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateGradeDto } from './dto/create-grade.dto';

import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Controller('academic')
@UseGuards(JwtAuthGuard)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('overview')
  getOverview(@GetUser() user: AuthUser) {
    return this.academicService.getOverview(user.id);
  }

  // SUBJECTS

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto, @GetUser() user: AuthUser) {
    return this.academicService.createSubject(dto, user.id);
  }

  @Get('subjects')
  getSubjects(@GetUser() user: AuthUser) {
    return this.academicService.getSubjects(user.id);
  }

  @Patch('subjects/:id')
  updateSubject(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.updateSubject(id, dto, user.id);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.academicService.deleteSubject(id, user.id);
  }

  // ASSIGNMENTS

  @Post('assignments')
  createAssignment(
    @Body() dto: CreateAssignmentDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.createAssignment(dto, user.id);
  }

  @Get('assignments/my')
  getMyAssignments(@GetUser() user: AuthUser) {
    return this.academicService.getMyAssignments(user.id);
  }

  @Patch('assignments/:id')
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.updateAssignment(id, dto, user.id);
  }

  @Delete('assignments/:id')
  deleteAssignment(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.academicService.deleteAssignment(id, user.id);
  }

  // SCHEDULES

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto, @GetUser() user: AuthUser) {
    return this.academicService.createSchedule(dto, user.id);
  }

  @Get('schedules')
  getSchedules(@GetUser() user: AuthUser) {
    return this.academicService.getSchedules(user.id);
  }

  @Patch('schedules/:id')
  updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.updateSchedule(id, dto, user.id);
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.academicService.deleteSchedule(id, user.id);
  }

  // EXAMS

  @Post('exams')
  createExam(@Body() dto: CreateExamDto, @GetUser() user: AuthUser) {
    return this.academicService.createExam(dto, user.id);
  }

  @Get('exams')
  getExams(@GetUser() user: AuthUser) {
    return this.academicService.getExams(user.id);
  }

  @Patch('exams/:id')
  updateExam(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.updateExam(id, dto, user.id);
  }

  @Delete('exams/:id')
  deleteExam(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.academicService.deleteExam(id, user.id);
  }

  // GRADES

  @Post('grades')
  createGrade(@Body() dto: CreateGradeDto, @GetUser() user: AuthUser) {
    return this.academicService.createGrade(dto, user.id);
  }

  @Get('grades/my')
  getMyGrades(@GetUser() user: AuthUser) {
    return this.academicService.getMyGrades(user.id);
  }

  @Patch('grades/:id')
  updateGrade(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
    @GetUser() user: AuthUser,
  ) {
    return this.academicService.updateGrade(id, dto, user.id);
  }

  @Delete('grades/:id')
  deleteGrade(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.academicService.deleteGrade(id, user.id);
  }
}
