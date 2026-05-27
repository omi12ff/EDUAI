import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicEventKind,
  GradeKind,
  ImportReviewStatus,
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
  SyncRunStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ImportAcademicTextDto } from './dto/import-academic-text.dto';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';

const connectorCatalog: Array<{
  provider: IntegrationProvider;
  label: string;
  baseUrl: string | null;
  status: string;
  automation: string;
  data: string[];
}> = [
  {
    provider: IntegrationProvider.EDUCA,
    label: 'EDUCA / Moodle',
    baseUrl: 'https://grado.pol.una.py/my/',
    status: 'PREPARADO',
    automation:
      'API Moodle si la institucion habilita token; si no, importacion por texto o archivo.',
    data: ['materias', 'tareas', 'fechas', 'calificaciones', 'avisos'],
  },
  {
    provider: IntegrationProvider.EALU,
    label: 'EALU CNC UNA',
    baseUrl: 'https://www.cnc.una.py/ealu',
    status: 'PREPARADO',
    automation: 'Conector web pendiente de credenciales y permisos del portal.',
    data: ['materias', 'inscripciones', 'notas', 'promedio'],
  },
  {
    provider: IntegrationProvider.POLIPLANNER,
    label: 'PoliPlanner',
    baseUrl: 'https://main--clever-longma-c888e2.netlify.app/inicio',
    status: 'PREPARADO',
    automation:
      'Sincronizacion planificada para horarios y organizacion academica.',
    data: ['horarios', 'materias', 'calendario'],
  },
  {
    provider: IntegrationProvider.MANUAL,
    label: 'Importacion manual inteligente',
    baseUrl: null,
    status: 'ACTIVO',
    automation:
      'Pega texto copiado de cualquier sistema y EduAI detecta eventos.',
    data: ['tareas', 'examenes', 'notas', 'materias', 'horarios'],
  },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseNumber(value: string) {
  return Number(value.replace(',', '.'));
}

function parseDateFromLine(line: string) {
  const iso = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const local = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);

  if (local) {
    return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  }

  return null;
}

function extractSubjectName(line: string) {
  const explicit = line.match(
    /(?:materia|asignatura|curso)\s*[:|-]\s*([^,.;]+)/i,
  );

  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const relational = line.match(
    /(?: de | en )([a-zA-Z0-9\s]+?)(?:\.|,| - | vence| fecha| nota|$)/i,
  );

  return relational?.[1]?.trim();
}

function detectGrade(line: string) {
  const normalized = normalizeText(line);

  const looksLikeGrade =
    normalized.includes('nota') ||
    normalized.includes('calificacion') ||
    normalized.includes('puntaje') ||
    normalized.includes('promedio') ||
    normalized.includes('parcial') ||
    normalized.includes('final') ||
    normalized.includes('recuperatorio') ||
    normalized.includes('practica') ||
    normalized.includes('laboratorio');

  if (!looksLikeGrade) {
    return null;
  }

  const scoreMatch = line.match(
    /\b(\d{1,3}(?:[.,]\d+)?)\s*(?:\/| de )\s*(\d{1,3}(?:[.,]\d+)?)\b/i,
  );

  if (!scoreMatch) {
    return null;
  }

  const score = parseNumber(scoreMatch[1]);
  const maxScore = parseNumber(scoreMatch[2]);

  if (score < 0 || maxScore <= 0 || score > maxScore) {
    return null;
  }

  let type: GradeKind = GradeKind.OTRO;

  if (normalized.includes('recuperatorio')) type = GradeKind.RECUPERATORIO;
  else if (normalized.includes('parcial')) type = GradeKind.PARCIAL;
  else if (normalized.includes('final')) type = GradeKind.FINAL;
  else if (normalized.includes('tarea')) type = GradeKind.TAREA;
  else if (normalized.includes('practica')) type = GradeKind.PRACTICA;
  else if (normalized.includes('laboratorio')) type = GradeKind.LABORATORIO;
  else if (normalized.includes('proyecto')) type = GradeKind.PROYECTO;

  return {
    score,
    maxScore,
    type,
  };
}

function detectSchedule(line: string) {
  const normalized = normalizeText(line);

  const day = [
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'domingo',
  ].find((dayName) => normalized.includes(dayName));

  const timeMatch = line.match(
    /\b(\d{1,2}:\d{2})\s*(?:-|a|hasta)\s*(\d{1,2}:\d{2})\b/i,
  );

  if (!day || !timeMatch) {
    return null;
  }

  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    startTime: timeMatch[1],
    endTime: timeMatch[2],
  };
}

function detectEventKind(line: string) {
  const normalized = normalizeText(line);
  const grade = detectGrade(line);

  if (grade) return AcademicEventKind.GRADE;
  if (normalized.includes('tarea') || normalized.includes('entrega'))
    return AcademicEventKind.ASSIGNMENT;
  if (
    normalized.includes('examen') ||
    normalized.includes('parcial') ||
    normalized.includes('final')
  )
    return AcademicEventKind.EXAM;
  if (normalized.includes('horario') || normalized.includes('clase'))
    return AcademicEventKind.SCHEDULE;
  if (normalized.includes('materia') || normalized.includes('asignatura'))
    return AcademicEventKind.SUBJECT;

  return AcademicEventKind.ANNOUNCEMENT;
}

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  getCatalog() {
    return connectorCatalog;
  }

  async getConnections(userId: string) {
    const connections = await this.prisma.integrationConnection.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return connectorCatalog.map((connector) => ({
      ...connector,
      connection:
        connections.find(
          (connection) => connection.provider === connector.provider,
        ) ?? null,
    }));
  }

  async upsertConnection(dto: UpsertIntegrationDto, userId: string) {
    const catalogItem = connectorCatalog.find(
      (connector) => connector.provider === dto.provider,
    );

    if (!catalogItem) {
      throw new BadRequestException('Unsupported provider');
    }

    return this.prisma.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: dto.provider,
        },
      },
      update: {
        label: dto.label ?? catalogItem.label,
        baseUrl: dto.baseUrl ?? catalogItem.baseUrl,
        username: dto.username,
        status:
          dto.provider === IntegrationProvider.MANUAL
            ? IntegrationStatus.CONNECTED
            : IntegrationStatus.NEEDS_ACTION,
        lastError:
          dto.provider === IntegrationProvider.MANUAL
            ? null
            : 'Conector listo. Falta token/API o flujo autorizado de acceso.',
      },
      create: {
        provider: dto.provider,
        label: dto.label ?? catalogItem.label,
        baseUrl: dto.baseUrl ?? catalogItem.baseUrl,
        username: dto.username,
        status:
          dto.provider === IntegrationProvider.MANUAL
            ? IntegrationStatus.CONNECTED
            : IntegrationStatus.NEEDS_ACTION,
        lastError:
          dto.provider === IntegrationProvider.MANUAL
            ? null
            : 'Conector listo. Falta token/API o flujo autorizado de acceso.',
        userId,
      },
    });
  }

  async syncProvider(provider: string, userId: string) {
    const integrationProvider = this.parseProvider(provider);
    let connection = await this.prisma.integrationConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: integrationProvider,
        },
      },
    });

    if (!connection) {
      connection = await this.upsertConnection(
        {
          provider: integrationProvider,
        },
        userId,
      );
    }

    const run = await this.prisma.syncRun.create({
      data: {
        provider: integrationProvider,
        status:
          integrationProvider === IntegrationProvider.MANUAL
            ? SyncRunStatus.SUCCESS
            : SyncRunStatus.NEEDS_REVIEW,
        finishedAt: new Date(),
        message:
          integrationProvider === IntegrationProvider.MANUAL
            ? 'La importacion manual esta lista para usar.'
            : 'El conector esta preparado. Para sincronizacion real se necesita API/token o acceso autorizado.',
        connectionId: connection.id,
      },
    });

    await this.prisma.integrationConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        lastSyncAt: new Date(),
        status:
          integrationProvider === IntegrationProvider.MANUAL
            ? IntegrationStatus.CONNECTED
            : IntegrationStatus.NEEDS_ACTION,
      },
    });

    return {
      run,
      nextSteps:
        integrationProvider === IntegrationProvider.MANUAL
          ? ['Pega texto academico en el importador inteligente.']
          : [
              'Conseguir token/API oficial si existe.',
              'O pegar/exportar datos para que EduAI los detecte y confirme.',
            ],
    };
  }

  async importAcademicText(dto: ImportAcademicTextDto, userId: string) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: {
        userId,
        provider: dto.provider,
      },
    });

    const lines = dto.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const candidates = lines
      .map((line) => this.detectEvent(line))
      .filter((event) => event !== null);

    const events =
      candidates.length > 0
        ? candidates
        : [
            {
              kind: AcademicEventKind.OTHER,
              title: 'Texto academico importado',
              description: dto.text.slice(0, 1000),
              eventDate: null,
              raw: {
                text: dto.text,
              },
            },
          ];

    const created: unknown[] = [];

    for (const event of events) {
      const createdEvent = await this.prisma.importedAcademicEvent.create({
        data: {
          provider: dto.provider,
          kind: event.kind,
          title: event.title,
          description: event.description,
          eventDate: event.eventDate ?? undefined,
          raw: event.raw,
          userId,
          connectionId: connection?.id,
        },
      });

      created.push(createdEvent);
    }

    return {
      detected: created.length,
      events: created,
    };
  }

  async getImportedEvents(userId: string) {
    return this.prisma.importedAcademicEvent.findMany({
      where: {
        userId,
      },
      include: {
        subject: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async applyImportedEvent(id: string, userId: string) {
    const event = await this.prisma.importedAcademicEvent.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!event) {
      throw new NotFoundException('Imported event not found');
    }

    const raw = this.asRecord(event.raw);
    const subjectName = this.rawString(raw, 'subjectName') ?? event.title;
    const subject = await this.findOrCreateSubject(userId, subjectName);

    let result: unknown;

    if (event.kind === AcademicEventKind.SUBJECT) {
      result = subject;
    } else if (event.kind === AcademicEventKind.GRADE) {
      const score = this.rawNumber(raw, 'score');

      if (score === null) {
        throw new BadRequestException('The imported grade has no score');
      }

      result = await this.prisma.grade.create({
        data: {
          title: event.title,
          type: this.gradeKindFromUnknown(raw.type),
          score,
          maxScore: this.rawNumber(raw, 'maxScore') ?? 5,
          date: event.eventDate ?? undefined,
          notes: event.description,
          source: event.provider,
          externalId: event.id,
          userId,
          subjectId: subject.id,
        },
        include: {
          subject: true,
        },
      });
    } else if (event.kind === AcademicEventKind.ASSIGNMENT) {
      if (!event.eventDate) {
        throw new BadRequestException(
          'The imported assignment has no due date',
        );
      }

      result = await this.prisma.assignment.create({
        data: {
          title: event.title,
          description: event.description,
          dueDate: event.eventDate,
          userId,
          subjectId: subject.id,
        },
        include: {
          subject: true,
        },
      });
    } else if (event.kind === AcademicEventKind.EXAM) {
      if (!event.eventDate) {
        throw new BadRequestException('The imported exam has no date');
      }

      result = await this.prisma.exam.create({
        data: {
          title: event.title,
          description: event.description,
          date: event.eventDate,
          subjectId: subject.id,
        },
        include: {
          subject: true,
        },
      });
    } else if (event.kind === AcademicEventKind.SCHEDULE) {
      const day = this.rawString(raw, 'day');
      const startTime = this.rawString(raw, 'startTime');
      const endTime = this.rawString(raw, 'endTime');

      if (!day || !startTime || !endTime) {
        throw new BadRequestException(
          'The imported schedule has no complete time data',
        );
      }

      result = await this.prisma.schedule.create({
        data: {
          day,
          startTime,
          endTime,
          subjectId: subject.id,
        },
        include: {
          subject: true,
        },
      });
    } else {
      throw new BadRequestException('This event needs manual review');
    }

    await this.prisma.importedAcademicEvent.update({
      where: {
        id,
      },
      data: {
        status: ImportReviewStatus.APPLIED,
        subjectId: subject.id,
      },
    });

    return {
      applied: true,
      result,
    };
  }

  async dismissImportedEvent(id: string, userId: string) {
    const event = await this.prisma.importedAcademicEvent.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!event) {
      throw new NotFoundException('Imported event not found');
    }

    return this.prisma.importedAcademicEvent.update({
      where: {
        id,
      },
      data: {
        status: ImportReviewStatus.DISMISSED,
      },
    });
  }

  private detectEvent(line: string) {
    const kind = detectEventKind(line);
    const grade = detectGrade(line);
    const schedule = detectSchedule(line);
    const eventDate = parseDateFromLine(line);
    const subjectName = extractSubjectName(line);

    if (kind === AcademicEventKind.ANNOUNCEMENT && !eventDate && !subjectName) {
      return null;
    }

    const raw: Prisma.JsonObject = {
      text: line,
    };

    if (subjectName) raw.subjectName = subjectName;
    if (grade) {
      raw.score = grade.score;
      raw.maxScore = grade.maxScore;
      raw.type = grade.type;
    }
    if (schedule) {
      raw.day = schedule.day;
      raw.startTime = schedule.startTime;
      raw.endTime = schedule.endTime;
    }

    return {
      kind,
      title: line.slice(0, 120),
      description: line,
      eventDate,
      raw,
    };
  }

  private parseProvider(provider: string) {
    const normalized = provider.toUpperCase();

    if (
      Object.values(IntegrationProvider).includes(
        normalized as IntegrationProvider,
      )
    ) {
      return normalized as IntegrationProvider;
    }

    throw new BadRequestException('Unsupported provider');
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private rawString(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === 'string' ? value : null;
  }

  private rawNumber(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === 'number' ? value : null;
  }

  private gradeKindFromUnknown(value: unknown) {
    return typeof value === 'string' &&
      Object.values(GradeKind).includes(value as GradeKind)
      ? (value as GradeKind)
      : GradeKind.OTRO;
  }

  private async findOrCreateSubject(userId: string, subjectName?: string) {
    const name = subjectName?.trim() || 'Materia importada';

    const existing = await this.prisma.subject.findFirst({
      where: {
        userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.subject.create({
      data: {
        name,
        teacher: 'Sin profesor',
        credits: 0,
        userId,
      },
    });
  }
}
