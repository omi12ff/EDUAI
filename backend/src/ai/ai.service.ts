import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Groq from 'groq-sdk';

import { PrismaService } from '../prisma/prisma.service';

const APP_TIME_ZONE = 'America/Asuncion';

interface AcademicDate {
  weekday: string;
  fullDate: string;
  isoDate: string;
}

interface ScheduleWithSubject {
  day: string;
  startTime: string;
  endTime: string;
  subject: {
    name: string;
  };
}

interface SubjectRecord {
  id: string;
  name: string;
  teacher?: string;
}

interface ExamRecord {
  id: string;
  title: string;
  date: Date;
  subjectId: string;
}

interface GradeWithSubject {
  title: string;
  type: string;
  score: number;
  maxScore: number;
  weight?: number | null;
  date?: Date | null;
  notes?: string | null;
  subject: {
    name: string;
  };
  exam?: {
    title: string;
    date: Date;
  } | null;
}

export interface GradeActionPayload {
  title: string;
  type: 'PARCIAL' | 'RECUPERATORIO' | 'FINAL';
  score: number;
  maxScore: number;
  notes?: string;
  subjectId: string;
  examId?: string | null;
}

type GradeSlot = 'P1' | 'P2' | 'REC' | 'F1' | 'F2';

const gradeSlotMeta: Record<
  GradeSlot,
  { label: string; type: 'PARCIAL' | 'RECUPERATORIO' | 'FINAL' }
> = {
  P1: { label: '1er. parcial', type: 'PARCIAL' },
  P2: { label: '2do. parcial', type: 'PARCIAL' },
  REC: { label: 'Recuperatorio', type: 'RECUPERATORIO' },
  F1: { label: '1er. final', type: 'FINAL' },
  F2: { label: '2do. final', type: 'FINAL' },
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeForSearch(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class AiService {
  private groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  constructor(private prisma: PrismaService) {}

  async getHistory(userId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 120,
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
      },
    });
  }

  async clearHistory(userId: string) {
    await this.prisma.chatHistory.deleteMany({
      where: { userId },
    });

    return {
      message: 'Chat history cleared',
    };
  }

  async chat(userId: string, message: string) {
    const academicDate = this.getAcademicDate();

    const assignments = await this.prisma.assignment.findMany({
      where: { userId },
      include: { subject: true },
      orderBy: { dueDate: 'asc' },
    });

    const subjects = await this.prisma.subject.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const schedules = await this.prisma.schedule.findMany({
      where: {
        subject: {
          userId,
        },
      },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
    });

    const exams = await this.prisma.exam.findMany({
      where: {
        subject: {
          userId,
        },
      },
      include: { subject: true },
      orderBy: { date: 'asc' },
    });

    const grades = await this.prisma.grade.findMany({
      where: { userId },
      include: { subject: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const importedEvents = await this.prisma.importedAcademicEvent.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const documents = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const chatHistory = await this.prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const todaySchedules = schedules
      .filter((schedule) =>
        this.isSameDayName(schedule.day, academicDate.weekday),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (this.isTodayScheduleQuestion(message)) {
      const response = this.buildTodayScheduleResponse(
        academicDate,
        todaySchedules,
      );

      await this.saveChatExchange(userId, message, response);

      return { response };
    }

    if (this.isGradeDeleteIntent(message)) {
      const response = [
        'No elimine ningun puntaje desde el chat.',
        'Para evitar borrar datos por una orden ambigua, las eliminaciones se hacen manualmente desde el historial de cargas en Notas.',
        '',
        'NOTAS ACTUALES:',
        '',
        this.formatGradesList(grades),
      ].join('\n');

      await this.saveChatExchange(userId, message, response);

      return { response };
    }

    const gradeSaveResponse = this.tryPrepareGradeFromMessage(
      userId,
      message,
      subjects,
      exams,
    );

    if (gradeSaveResponse) {
      await this.saveChatExchange(userId, message, gradeSaveResponse.response);

      return gradeSaveResponse;
    }

    const documentsContext = documents
      .map(
        (doc) => `
DOCUMENTO: ${doc.title}

CONTENIDO:
${doc.content.slice(0, 12000)}
`,
      )
      .join('\n\n');

    const context = `
FECHA ACTUAL:
Hoy es ${academicDate.weekday}, ${academicDate.fullDate}.
Fecha ISO local: ${academicDate.isoDate}
Zona horaria: ${APP_TIME_ZONE}
Regla critica: si el usuario pregunta por "hoy", usa solamente el dia ${academicDate.weekday}. No mezcles clases de otros dias.

MATERIAS:
${
  subjects.length > 0
    ? subjects
        .map((subject) => `- ${subject.name}, profesor: ${subject.teacher}`)
        .join('\n')
    : 'No hay materias registradas.'
}

TAREAS:
${
  assignments.length > 0
    ? assignments
        .map(
          (assignment) =>
            `- ${assignment.title} de ${assignment.subject.name}. Vence: ${this.formatDate(
              assignment.dueDate,
            )}. Descripcion: ${assignment.description ?? 'Sin descripcion'}`,
        )
        .join('\n')
    : 'No hay tareas registradas.'
}

HORARIOS:
${
  schedules.length > 0
    ? schedules
        .map(
          (schedule) =>
            `- ${schedule.day}: ${schedule.subject.name} de ${schedule.startTime} a ${schedule.endTime}`,
        )
        .join('\n')
    : 'No hay horarios registrados.'
}

HORARIOS DE HOY (${academicDate.weekday}):
${
  todaySchedules.length > 0
    ? todaySchedules
        .map(
          (schedule) =>
            `- ${schedule.subject.name} de ${schedule.startTime} a ${schedule.endTime}`,
        )
        .join('\n')
    : `No hay clases registradas para hoy (${academicDate.weekday}).`
}

EXAMENES:
${
  exams.length > 0
    ? exams
        .map(
          (exam) =>
            `- ${exam.title} de ${exam.subject.name}. Fecha: ${this.formatDate(
              exam.date,
            )}. Descripcion: ${exam.description ?? 'Sin descripcion'}`,
        )
        .join('\n')
    : 'No hay examenes registrados.'
}

NOTAS:
${
  grades.length > 0
    ? grades
        .map(
          (grade) =>
            `- ${grade.title} de ${grade.subject.name}: ${grade.score}/${grade.maxScore}. Tipo: ${grade.type}. Peso: ${
              grade.weight ?? 'sin peso'
            }. Fecha: ${
              grade.date ? this.formatDate(grade.date) : 'sin fecha'
            }. Notas: ${grade.notes ?? 'sin notas'}`,
        )
        .join('\n')
    : 'No hay notas registradas.'
}

DATOS IMPORTADOS PENDIENTES:
${
  importedEvents.length > 0
    ? importedEvents
        .map(
          (event) =>
            `- ${event.kind} desde ${event.provider}: ${event.title}. Estado: ${event.status}`,
        )
        .join('\n')
    : 'No hay datos importados pendientes.'
}

PDFS:
${documentsContext || 'No hay documentos subidos.'}

HISTORIAL RECIENTE:
${
  chatHistory.length > 0
    ? chatHistory
        .reverse()
        .map((chat) => `${chat.role}: ${chat.message}`)
        .join('\n')
    : 'No hay historial previo.'
}
`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `
Eres EduAI, un asistente academico inteligente.

Usa el contexto academico y los PDFs del usuario para responder.

Puedes:
- resumir PDFs
- explicar temas
- responder sobre horarios
- responder sobre tareas
- responder sobre examenes
- responder sobre notas y promedios
- detectar materias en riesgo
- sugerir que datos importados conviene aplicar
- crear planes de estudio
- generar preguntas de practica

Reglas:
- Responde siempre en espanol.
- Se claro y util.
- Si no hay informacion suficiente, dilo.
- Si el usuario pide calcular promedio, usa las notas registradas y explica cualquier supuesto.
- Si falta una nota, peso o escala, dilo antes de concluir.
- Si el usuario pregunta por PDFs, usa el contenido de documentos.
- Si pregunta por hoy, manana o esta semana, usa la fecha actual en zona horaria America/Asuncion.
- Si pregunta por clases de hoy, responde solo con "HORARIOS DE HOY" y no incluyas clases de otros dias.
- No digas que creaste, guardaste, actualizaste o eliminaste datos si esa accion no fue ejecutada por el sistema.

CONTEXTO:
${context}
`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const response = completion.choices[0].message.content ?? '';

    await this.saveChatExchange(userId, message, response);

    return { response };
  }

  async confirmGradeAction(userId: string, payload: GradeActionPayload) {
    if (
      !payload.subjectId ||
      !Number.isFinite(payload.score) ||
      !Number.isFinite(payload.maxScore) ||
      payload.score < 0 ||
      payload.score > 100 ||
      payload.maxScore <= 0
    ) {
      throw new BadRequestException('Invalid grade action');
    }

    const subject = await this.prisma.subject.findFirst({
      where: {
        id: payload.subjectId,
        userId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    if (payload.examId) {
      const exam = await this.prisma.exam.findFirst({
        where: {
          id: payload.examId,
          subject: {
            userId,
          },
        },
      });

      if (!exam) {
        throw new NotFoundException('Exam not found');
      }
    }

    const grade = await this.prisma.grade.create({
      data: {
        title: payload.title,
        type: payload.type,
        score: payload.score,
        maxScore: payload.maxScore,
        notes: payload.notes,
        userId,
        subjectId: payload.subjectId,
        examId: payload.examId ?? null,
      },
      include: {
        subject: true,
        exam: true,
      },
    });

    const response = `Listo, guarde ${payload.title} de ${subject.name} como ${this.formatScore(
      payload.score,
    )}/${this.formatScore(payload.maxScore)}.`;

    await this.prisma.chatHistory.create({
      data: {
        userId,
        role: 'assistant',
        message: response,
      },
    });

    return {
      response,
      grade,
    };
  }

  private tryPrepareGradeFromMessage(
    userId: string,
    message: string,
    subjects: SubjectRecord[],
    exams: ExamRecord[],
  ) {
    if (!this.isGradeSaveIntent(message)) {
      return null;
    }

    const subject = this.findSubjectInMessage(message, subjects);
    const slot = this.findGradeSlotInMessage(message);

    if (!subject || !slot) {
      return {
        response: [
          'Puedo preparar puntajes desde el chat, pero necesito materia y tipo de examen.',
          'Ejemplo: "guarda mi puntaje del segundo parcial de Base de Datos con 79".',
        ].join('\n'),
      };
    }

    const score = this.extractScore(message);
    const exam = this.findExamForSlot(subject.id, slot, exams);
    const meta = gradeSlotMeta[slot];
    const notes = score === null ? 'Ausente' : undefined;
    const savedScore = score ?? 0;
    const payload: GradeActionPayload = {
      title: exam?.title ?? meta.label,
      type: meta.type,
      score: savedScore,
      maxScore: 100,
      notes,
      subjectId: subject.id,
      examId: exam?.id ?? null,
    };

    const savedLabel =
      score === null ? 'Ausente (0/100)' : `${this.formatScore(score)}/100`;

    return {
      response: `Detecte una carga de puntaje: ${meta.label} de ${subject.name} como ${savedLabel}. Confirmala para guardarla en Notas.`,
      action: {
        id: randomUUID(),
        type: 'CREATE_GRADE' as const,
        label: `Guardar ${meta.label} de ${subject.name} (${savedLabel})`,
        payload,
      },
    };
  }

  private isGradeSaveIntent(message: string) {
    const text = normalizeForSearch(message);
    const hasAction =
      /\b(guarda|guardar|guarde|registra|registrar|registre|carga|cargar|cargue|agrega|agregar|anota|anotar|pon)\b/.test(
        text,
      );
    const hasGradeTarget =
      /\b(puntaje|nota|notas|parcial|final|recuperatorio)\b/.test(text);

    return hasAction && hasGradeTarget;
  }

  private isGradeDeleteIntent(message: string) {
    const text = normalizeForSearch(message);
    const hasDeleteAction =
      /\b(elimina|eliminar|elimine|borra|borrar|borre|quita|quitar|quite|saca|sacar|saque)\b/.test(
        text,
      );
    const hasGradeTarget =
      /\b(puntaje|nota|notas|parcial|final|recuperatorio)\b/.test(text);

    return hasDeleteAction && hasGradeTarget;
  }

  private findGradeSlotInMessage(message: string): GradeSlot | null {
    const text = normalizeForSearch(message);

    if (
      /\b(primer|1er|1ro|1)\s+final\b/.test(text) ||
      /\bfinal\s+(uno|1)\b/.test(text)
    ) {
      return 'F1';
    }

    if (
      /\b(segundo|2do|2)\s+final\b/.test(text) ||
      /\bfinal\s+(dos|2)\b/.test(text)
    ) {
      return 'F2';
    }

    if (/\brecuperatorio\b/.test(text)) {
      return 'REC';
    }

    if (
      /\b(primer|1er|1ro|1)\s+parcial\b/.test(text) ||
      /\bparcial\s+(uno|1)\b/.test(text)
    ) {
      return 'P1';
    }

    if (
      /\b(segundo|2do|2)\s+parcial\b/.test(text) ||
      /\bparcial\s+(dos|2)\b/.test(text)
    ) {
      return 'P2';
    }

    return null;
  }

  private extractScore(message: string) {
    const normalized = normalizeText(message).replace(/,/g, '.');
    const patterns = [
      /(?:con|como|saque|obtuve|puntaje|nota)(?:\s+de)?\s+(\d{1,3}(?:\.\d+)?)(?:\s*\/\s*100)?/,
      /(\d{1,3}(?:\.\d+)?)\s*\/\s*100/,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);

      if (!match) {
        continue;
      }

      const value = Number(match[1]);

      if (!Number.isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }

    return null;
  }

  private findSubjectInMessage(message: string, subjects: SubjectRecord[]) {
    const text = normalizeForSearch(message);
    let bestSubject: SubjectRecord | null = null;
    let bestScore = 0;

    for (const subject of subjects) {
      const candidates = this.buildSubjectCandidates(subject.name);
      let score = 0;

      for (const candidate of candidates) {
        if (!candidate.value) {
          continue;
        }

        if (
          candidate.exact
            ? text.includes(candidate.value)
            : this.hasWordVariant(text, candidate.value)
        ) {
          score = Math.max(score, candidate.score);
        }
      }

      const meaningfulWords = this.meaningfulSubjectWords(subject.name);
      const presentWords = meaningfulWords.filter((word) =>
        this.hasWordVariant(text, word),
      ).length;

      if (meaningfulWords.length > 0) {
        score += presentWords * 8;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSubject = subject;
      }
    }

    return bestScore >= 20 ? bestSubject : null;
  }

  private buildSubjectCandidates(subjectName: string) {
    const name = normalizeForSearch(subjectName);
    const words = name.split(' ').filter(Boolean);
    const withoutRoman = words
      .filter((word) => !this.isRomanNumber(word))
      .join(' ');
    const meaningfulWords = this.meaningfulSubjectWords(subjectName);
    const acronym = meaningfulWords.map((word) => word[0]).join('');
    const firstWord = meaningfulWords[0] ?? '';

    return [
      { value: name, score: 100, exact: true },
      { value: withoutRoman, score: 90, exact: true },
      { value: acronym, score: 80, exact: false },
      { value: firstWord, score: 24, exact: false },
      { value: this.singularizeWord(firstWord), score: 24, exact: false },
    ];
  }

  private meaningfulSubjectWords(subjectName: string) {
    const stopWords = new Set([
      'de',
      'del',
      'la',
      'las',
      'el',
      'los',
      'y',
      'en',
    ]);

    return normalizeForSearch(subjectName)
      .split(' ')
      .filter(
        (word) =>
          word &&
          !stopWords.has(word) &&
          !this.isRomanNumber(word) &&
          word.length > 1,
      );
  }

  private isRomanNumber(value: string) {
    return /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(value);
  }

  private hasWord(text: string, word: string) {
    return new RegExp(`(^|\\s)${this.escapeRegex(word)}(\\s|$)`).test(text);
  }

  private hasWordVariant(text: string, word: string) {
    return this.wordVariants(word).some((variant) =>
      this.hasWord(text, variant),
    );
  }

  private wordVariants(word: string) {
    return Array.from(new Set([word, this.singularizeWord(word)])).filter(
      Boolean,
    );
  }

  private singularizeWord(word: string) {
    return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private findExamForSlot(
    subjectId: string,
    slot: GradeSlot,
    exams: ExamRecord[],
  ) {
    return (
      exams.find(
        (exam) =>
          exam.subjectId === subjectId &&
          this.findGradeSlotInMessage(exam.title) === slot,
      ) ?? null
    );
  }

  private formatGradesList(grades: GradeWithSubject[]) {
    if (grades.length === 0) {
      return 'No hay notas registradas.';
    }

    return grades
      .map((grade) => {
        const score = normalizeText(grade.notes ?? '').includes('ausente')
          ? 'Ausente (0/100)'
          : `${this.formatScore(grade.score)}/${this.formatScore(
              grade.maxScore,
            )}`;
        const examDate = grade.exam?.date ?? grade.date;

        return `- ${grade.title} de ${grade.subject.name}: ${score}. Tipo: ${
          grade.type
        }. Fecha: ${examDate ? this.formatDate(examDate) : 'sin fecha'}.`;
      })
      .join('\n');
  }

  private formatScore(value: number) {
    return Number.isInteger(value)
      ? `${value}`
      : `${Math.round(value * 100) / 100}`;
  }

  private getAcademicDate(date = new Date()): AcademicDate {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? '';

    const weekday = titleCase(
      new Intl.DateTimeFormat('es-PY', {
        weekday: 'long',
        timeZone: APP_TIME_ZONE,
      }).format(date),
    );

    const fullDate = new Intl.DateTimeFormat('es-PY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: APP_TIME_ZONE,
    }).format(date);

    return {
      weekday,
      fullDate,
      isoDate: `${part('year')}-${part('month')}-${part('day')}`,
    };
  }

  private formatDate(date: Date) {
    return date.toLocaleDateString('es-PY', {
      timeZone: APP_TIME_ZONE,
    });
  }

  private isTodayScheduleQuestion(message: string) {
    const normalized = normalizeText(message);

    return (
      normalized.includes('hoy') &&
      ['clase', 'clases', 'horario', 'horarios'].some((word) =>
        normalized.includes(word),
      )
    );
  }

  private isSameDayName(dayA: string, dayB: string) {
    return normalizeText(dayA) === normalizeText(dayB);
  }

  private buildTodayScheduleResponse(
    academicDate: AcademicDate,
    schedules: ScheduleWithSubject[],
  ) {
    if (schedules.length === 0) {
      return `Hoy es ${academicDate.weekday}, ${academicDate.fullDate}. No tenes clases registradas para hoy.`;
    }

    const scheduleList = schedules
      .map(
        (schedule) =>
          `- ${schedule.subject.name}: ${schedule.startTime} a ${schedule.endTime}`,
      )
      .join('\n');

    return `Hoy es ${academicDate.weekday}, ${academicDate.fullDate}. Tus clases para hoy son:\n\n${scheduleList}`;
  }

  private async saveChatExchange(
    userId: string,
    userMessage: string,
    assistantMessage: string,
  ) {
    await this.prisma.chatHistory.create({
      data: {
        userId,
        role: 'user',
        message: userMessage,
      },
    });

    await this.prisma.chatHistory.create({
      data: {
        userId,
        role: 'assistant',
        message: assistantMessage,
      },
    });
  }
}
