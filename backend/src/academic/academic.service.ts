import { Injectable, NotFoundException } from '@nestjs/common';
import { GradeKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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

const dayMap: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
};

function normalizeGrade(score: number, maxScore: number) {
  if (!maxScore || maxScore <= 0) {
    return 0;
  }

  return (score / maxScore) * 5;
}

function roundScore(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function calculateAverage(
  grades: Array<{
    score: number;
    maxScore: number;
    weight: number | null;
  }>,
) {
  if (grades.length === 0) {
    return null;
  }

  const weightedGrades = grades.filter((grade) => (grade.weight ?? 0) > 0);

  if (weightedGrades.length > 0) {
    const totalWeight = weightedGrades.reduce(
      (sum, grade) => sum + (grade.weight ?? 0),
      0,
    );

    if (totalWeight > 0) {
      const weightedAverage =
        weightedGrades.reduce(
          (sum, grade) =>
            sum +
            normalizeGrade(grade.score, grade.maxScore) * (grade.weight ?? 0),
          0,
        ) / totalWeight;

      return roundScore(weightedAverage);
    }
  }

  const average =
    grades.reduce(
      (sum, grade) => sum + normalizeGrade(grade.score, grade.maxScore),
      0,
    ) / grades.length;

  return roundScore(average);
}

function getGradeStatus(average: number | null) {
  if (average === null) {
    return 'SIN_DATOS';
  }

  if (average >= 4) {
    return 'EXCELENTE';
  }

  if (average >= 3) {
    return 'ESTABLE';
  }

  if (average >= 2) {
    return 'ATENCION';
  }

  return 'RIESGO';
}

@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  // SUBJECTS

  async createSubject(dto: CreateSubjectDto, userId: string) {
    return this.prisma.subject.create({
      data: {
        name: dto.name,
        teacher: dto.teacher,
        credits: dto.credits ?? 0,
        userId,
      },
    });
  }

  async getSubjects(userId: string) {
    return this.prisma.subject.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto, userId: string) {
    await this.ensureSubjectAccess(id, userId);

    return this.prisma.subject.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSubject(id: string, userId: string) {
    await this.ensureSubjectAccess(id, userId);

    return this.prisma.subject.delete({
      where: {
        id,
      },
    });
  }

  // ASSIGNMENTS

  async createAssignment(dto: CreateAssignmentDto, userId: string) {
    await this.ensureSubjectAccess(dto.subjectId, userId);

    return this.prisma.assignment.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: new Date(dto.dueDate),

        userId,
        subjectId: dto.subjectId,
      },
    });
  }

  async getMyAssignments(userId: string) {
    return this.prisma.assignment.findMany({
      where: {
        userId,
      },

      include: {
        subject: true,
      },

      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  async updateAssignment(id: string, dto: UpdateAssignmentDto, userId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (dto.subjectId) {
      await this.ensureSubjectAccess(dto.subjectId, userId);
    }

    return this.prisma.assignment.update({
      where: { id },

      data: {
        ...dto,

        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async deleteAssignment(id: string, userId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.assignment.delete({
      where: {
        id,
      },
    });
  }

  // SCHEDULES

  async createSchedule(dto: CreateScheduleDto, userId: string) {
    await this.ensureSubjectAccess(dto.subjectId, userId);

    return this.prisma.schedule.create({
      data: dto,

      include: {
        subject: true,
      },
    });
  }

  async getSchedules(userId: string) {
    return this.prisma.schedule.findMany({
      where: {
        subject: {
          userId,
        },
      },
      include: {
        subject: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto, userId: string) {
    await this.ensureScheduleAccess(id, userId);

    if (dto.subjectId) {
      await this.ensureSubjectAccess(dto.subjectId, userId);
    }

    return this.prisma.schedule.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSchedule(id: string, userId: string) {
    await this.ensureScheduleAccess(id, userId);

    return this.prisma.schedule.delete({
      where: {
        id,
      },
    });
  }

  // EXAMS

  async createExam(dto: CreateExamDto, userId: string) {
    await this.ensureSubjectAccess(dto.subjectId, userId);
    const examDate = new Date(dto.date);

    const existingExam = await this.prisma.exam.findFirst({
      where: {
        title: dto.title,
        date: examDate,
        subjectId: dto.subjectId,
        subject: {
          userId,
        },
      },
      include: {
        subject: true,
      },
    });

    if (existingExam) {
      return existingExam;
    }

    return this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description,
        date: examDate,

        subjectId: dto.subjectId,
      },

      include: {
        subject: true,
      },
    });
  }

  async getExams(userId: string) {
    return this.prisma.exam.findMany({
      where: {
        subject: {
          userId,
        },
      },
      include: {
        subject: true,
      },

      orderBy: {
        date: 'asc',
      },
    });
  }

  async updateExam(id: string, dto: UpdateExamDto, userId: string) {
    await this.ensureExamAccess(id, userId);

    if (dto.subjectId) {
      await this.ensureSubjectAccess(dto.subjectId, userId);
    }

    return this.prisma.exam.update({
      where: { id },

      data: {
        ...dto,

        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async deleteExam(id: string, userId: string) {
    await this.ensureExamAccess(id, userId);

    return this.prisma.exam.delete({
      where: {
        id,
      },
    });
  }

  // GRADES

  async createGrade(dto: CreateGradeDto, userId: string) {
    await this.ensureSubjectAccess(dto.subjectId, userId);

    if (dto.examId) {
      await this.ensureExamAccess(dto.examId, userId);
    }

    return this.prisma.grade.create({
      data: {
        title: dto.title,
        type: dto.type ?? GradeKind.OTRO,
        score: dto.score,
        maxScore: dto.maxScore ?? 100,
        weight: dto.weight,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
        userId,
        subjectId: dto.subjectId,
        examId: dto.examId,
      },

      include: {
        subject: true,
        exam: true,
      },
    });
  }

  async getMyGrades(userId: string) {
    return this.prisma.grade.findMany({
      where: {
        userId,
      },

      include: {
        subject: true,
        exam: true,
      },

      orderBy: [
        {
          date: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async updateGrade(id: string, dto: UpdateGradeDto, userId: string) {
    const grade = await this.prisma.grade.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    if (dto.subjectId) {
      await this.ensureSubjectAccess(dto.subjectId, userId);
    }

    if (dto.examId) {
      await this.ensureExamAccess(dto.examId, userId);
    }

    return this.prisma.grade.update({
      where: { id },

      data: {
        title: dto.title,
        type: dto.type,
        score: dto.score,
        maxScore: dto.maxScore,
        weight: dto.weight,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
        subjectId: dto.subjectId,
        examId: dto.examId,
      },

      include: {
        subject: true,
        exam: true,
      },
    });
  }

  async deleteGrade(id: string, userId: string) {
    const grade = await this.prisma.grade.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    return this.prisma.grade.delete({
      where: {
        id,
      },
    });
  }

  async getOverview(userId: string) {
    const now = new Date();
    const todayName = dayMap[now.getDay()];

    const [subjects, assignments, exams, schedules, grades] = await Promise.all(
      [
        this.prisma.subject.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),

        this.prisma.assignment.findMany({
          where: {
            userId,
          },
          include: {
            subject: true,
          },
          orderBy: {
            dueDate: 'asc',
          },
        }),

        this.prisma.exam.findMany({
          where: {
            subject: {
              userId,
            },
          },
          include: {
            subject: true,
          },
          orderBy: {
            date: 'asc',
          },
        }),

        this.prisma.schedule.findMany({
          where: {
            subject: {
              userId,
            },
          },
          include: {
            subject: true,
          },
        }),

        this.prisma.grade.findMany({
          where: {
            userId,
          },
          include: {
            subject: true,
          },
          orderBy: [
            {
              date: 'desc',
            },
            {
              createdAt: 'desc',
            },
          ],
        }),
      ],
    );

    const upcomingAssignments = assignments
      .filter((assignment) => assignment.dueDate >= now)
      .slice(0, 5);

    const upcomingExams = exams.filter((exam) => exam.date >= now).slice(0, 5);

    const todaySchedules = schedules
      .filter(
        (schedule) =>
          schedule.day.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
          todayName,
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const subjectSummaries = subjects.map((subject) => {
      const subjectGrades = grades.filter(
        (grade) => grade.subjectId === subject.id,
      );

      const average = calculateAverage(subjectGrades);

      return {
        id: subject.id,
        name: subject.name,
        teacher: subject.teacher,
        credits: subject.credits,
        average,
        status: getGradeStatus(average),
        gradesCount: subjectGrades.length,
        latestGrade: subjectGrades[0] ?? null,
      };
    });

    const gradedSubjects = subjectSummaries.filter(
      (subject) => subject.average !== null,
    );

    const overallAverage =
      gradedSubjects.length > 0
        ? roundScore(
            gradedSubjects.reduce(
              (sum, subject) => sum + (subject.average ?? 0),
              0,
            ) / gradedSubjects.length,
          )
        : null;

    const riskSubjects = subjectSummaries.filter(
      (subject) => subject.status === 'RIESGO' || subject.status === 'ATENCION',
    );

    const urgentAssignments = upcomingAssignments.filter((assignment) => {
      const diffMs = assignment.dueDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      return diffDays <= 3;
    });

    const recommendations = [
      ...(urgentAssignments.length > 0
        ? [
            `Tenes ${urgentAssignments.length} tarea(s) con vencimiento cercano.`,
          ]
        : []),
      ...(riskSubjects.length > 0
        ? [
            `Revisa ${riskSubjects.length} materia(s) con promedio bajo o incompleto.`,
          ]
        : []),
      ...(todaySchedules.length > 0
        ? [
            `Hoy tenes ${todaySchedules.length} clase(s) cargada(s) en tu horario.`,
          ]
        : ['Hoy no hay clases cargadas en tu horario.']),
    ];

    return {
      generatedAt: now,

      stats: {
        subjects: subjects.length,
        assignments: assignments.length,
        pendingAssignments: upcomingAssignments.length,
        exams: exams.length,
        upcomingExams: upcomingExams.length,
        grades: grades.length,
        overallAverage,
        riskSubjects: riskSubjects.length,
      },

      today: {
        name: todayName,
        schedules: todaySchedules,
      },

      upcoming: {
        assignments: upcomingAssignments,
        exams: upcomingExams,
      },

      grades: {
        overallAverage,
        subjects: subjectSummaries,
        latest: grades.slice(0, 5),
      },

      recommendations,
    };
  }

  private async ensureSubjectAccess(subjectId: string, userId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        userId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  private async ensureScheduleAccess(id: string, userId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id,
        subject: {
          userId,
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  private async ensureExamAccess(id: string, userId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        id,
        subject: {
          userId,
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }
}
