import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

interface ScheduleBlock {
  day: string;
  time: string;
  startTime: string;
  endTime: string;
  room: string;
  notes: string;
}

interface ExamBlock {
  title: string;
  dateText: string;
  time: string;
  room: string;
  date: string;
}

interface ScheduleSection {
  id: string;
  name: string;
  teacher: string;
  email: string;
  turn: string;
  emphasis: string;
  platform: string;
  schedule: ScheduleBlock[];
  exams: ExamBlock[];
}

interface SubjectAccumulator {
  name: string;
  semester: number;
  sections: ScheduleSection[];
}

interface SemesterAccumulator {
  number: number;
  subjects: Map<string, SubjectAccumulator>;
}

interface CareerAccumulator {
  code: string;
  name: string;
  semesters: Map<number, SemesterAccumulator>;
}

type WorkbookLoadInput = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  private readonly scheduleColumns = [
    { day: 'Lunes', time: 36, room: 35 },
    { day: 'Martes', time: 38, room: 37 },
    { day: 'Miercoles', time: 40, room: 39 },
    { day: 'Jueves', time: 42, room: 41 },
    { day: 'Viernes', time: 44, room: 43 },
    { day: 'Sabado', time: 46, room: 45, notes: 47 },
  ];

  private readonly examColumns = [
    { title: '1er. parcial', date: 16, time: 17, room: 18 },
    { title: '2do. parcial', date: 19, time: 20, room: 21 },
    { title: '1er. final', date: 22, time: 23, room: 24 },
    { title: '2do. final', date: 27, time: 28, room: 29 },
  ];

  async importAcademicExcel(file: UploadedFile) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as WorkbookLoadInput);

    const careerSheets = workbook.worksheets.filter(
      (sheet) =>
        ![
          'Códigos',
          '2026_1',
          'Asignaturas Homólogas-DCB',
          'Asignaturas Homólogas-DEE',
          'Asignaturas Homologadas-DEI',
          'Asignaturas Homólogas-DG',
        ].includes(sheet.name),
    );

    let imported = 0;

    for (const sheet of careerSheets) {
      const career = sheet.name;

      for (let rowNumber = 12; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);

        const subject = this.cellText(row, 3);

        if (!subject) continue;

        const semester = this.cellText(row, 5);
        const group = this.cellText(row, 10);

        const title = this.cellText(row, 12);
        const lastName = this.cellText(row, 13);
        const firstName = this.cellText(row, 14);
        const email = this.cellText(row, 15);

        const teacher = `${title} ${firstName} ${lastName}`.trim();

        await this.prisma.academicImport.create({
          data: {
            career,
            subject,
            semester,
            group,
            teacher,
            email,

            firstPartialDate: this.cellText(row, 16),
            secondPartialDate: this.cellText(row, 19),
            firstFinalDate: this.cellText(row, 22),
            secondFinalDate: this.cellText(row, 27),

            monday: this.cellText(row, 36),
            tuesday: this.cellText(row, 38),
            wednesday: this.cellText(row, 40),
            thursday: this.cellText(row, 42),
            friday: this.cellText(row, 44),

            sourceFile: file.originalname,
          },
        });

        imported++;
      }
    }

    return {
      message: 'Excel importado correctamente',
      imported,
    };
  }

  async getAcademicImports() {
    return this.prisma.academicImport.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCareers() {
    return this.prisma.career.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async parseScheduleCatalog(file: UploadedFile): Promise<any> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as WorkbookLoadInput);

    const careerNames = this.parseCareerCodes(workbook);
    const catalog = new Map<string, CareerAccumulator>();
    let rowCount = 0;

    for (const sheet of workbook.worksheets) {
      if (!this.isScheduleSheet(sheet)) continue;

      for (let rowNumber = 12; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const subjectName = this.cellText(row, 3);

        if (!subjectName) continue;

        const careerCode = this.cellText(row, 6) || sheet.name;
        const careerName = careerNames.get(careerCode) ?? careerCode;
        const semesterNumber = this.parseSemester(this.cellText(row, 5));

        if (!semesterNumber) continue;

        const sectionName = this.cellText(row, 10) || 'Sin seccion';
        const title = this.cellText(row, 12);
        const lastName = this.cellText(row, 13);
        const firstName = this.cellText(row, 14);
        const teacher = [title, firstName, lastName]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        const section: ScheduleSection = {
          id: this.makeSectionId([
            careerCode,
            String(semesterNumber),
            subjectName,
            sectionName,
            teacher,
            String(rowNumber),
          ]),
          name: sectionName,
          teacher: teacher || 'Docente por confirmar',
          email: this.cellText(row, 15),
          turn: this.cellText(row, 9),
          emphasis: this.cellText(row, 7),
          platform: this.cellText(row, 11),
          schedule: this.getRowSchedule(row),
          exams: this.getRowExams(row),
        };

        const career =
          catalog.get(careerCode) ??
          ({
            code: careerCode,
            name: careerName,
            semesters: new Map<number, SemesterAccumulator>(),
          } satisfies CareerAccumulator);

        const semester =
          career.semesters.get(semesterNumber) ??
          ({
            number: semesterNumber,
            subjects: new Map<string, SubjectAccumulator>(),
          } satisfies SemesterAccumulator);

        const subject =
          semester.subjects.get(subjectName) ??
          ({
            name: subjectName,
            semester: semesterNumber,
            sections: [],
          } satisfies SubjectAccumulator);

        subject.sections.push(section);
        semester.subjects.set(subjectName, subject);
        career.semesters.set(semesterNumber, semester);
        catalog.set(careerCode, career);
        rowCount++;
      }
    }

    const careers = Array.from(catalog.values())
      .map((career) => ({
        code: career.code,
        name: career.name,
        semesters: Array.from(career.semesters.values())
          .sort((a, b) => a.number - b.number)
          .map((semester) => ({
            number: semester.number,
            subjects: Array.from(semester.subjects.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((subject) => ({
                ...subject,
                sections: subject.sections.sort((a, b) =>
                  a.name.localeCompare(b.name),
                ),
              })),
          })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    await this.saveCareers(careers);

    return {
      sourceFile: file.originalname,
      rowCount,
      careerCount: careers.length,
      careers,
    };
  }

  private parseCareerCodes(workbook: ExcelJS.Workbook) {
    const codes = new Map<string, string>();
    const codesSheet = workbook.worksheets.find(
      (sheet) => this.normalize(sheet.name) === 'codigos',
    );

    if (!codesSheet) return codes;

    let readingCareers = false;

    for (let rowNumber = 1; rowNumber <= codesSheet.rowCount; rowNumber++) {
      const row = codesSheet.getRow(rowNumber);
      const code = this.cellText(row, 1);
      const name = this.cellText(row, 2);
      const normalizedCode = this.normalize(code);

      if (normalizedCode === 'carreras') {
        readingCareers = true;
        continue;
      }

      if (!readingCareers) continue;

      if (!code && !name) break;
      if (normalizedCode === 'codigo') continue;
      if (code && name) codes.set(code, name);
    }

    return codes;
  }

  private isScheduleSheet(sheet: ExcelJS.Worksheet) {
    const normalizedName = this.normalize(sheet.name);

    if (
      normalizedName === 'codigos' ||
      normalizedName === '2026_1' ||
      normalizedName.includes('homologa')
    ) {
      return false;
    }

    const header = this.normalize(this.cellText(sheet.getRow(11), 3));

    return header === 'asignatura';
  }

  private getRowSchedule(row: ExcelJS.Row) {
    return this.scheduleColumns
      .map((column) => {
        const time = this.cellText(row, column.time);

        if (!time) return null;

        const range = this.parseTimeRange(time);

        return {
          day: column.day,
          time,
          startTime: range.startTime,
          endTime: range.endTime,
          room: this.cellText(row, column.room),
          notes: column.notes ? this.cellText(row, column.notes) : '',
        };
      })
      .filter((item): item is ScheduleBlock => Boolean(item));
  }

  private getRowExams(row: ExcelJS.Row) {
    return this.examColumns
      .map((column) => {
        const dateText = this.cellText(row, column.date);
        const time = this.cellTimeText(row, column.time);

        if (!dateText) return null;

        const date = this.parseExamDateTime(dateText, time);

        if (!date) return null;

        return {
          title: column.title,
          dateText,
          time,
          room: this.cellText(row, column.room),
          date,
        };
      })
      .filter((item): item is ExamBlock => Boolean(item));
  }

  private parseExamDateTime(dateText: string, timeText: string) {
    const dateMatch = dateText.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);

    if (!dateMatch) {
      return '';
    }

    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const rawYear = Number(dateMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
    const hour = (timeMatch?.[1] ?? '00').padStart(2, '0');
    const minute = timeMatch?.[2] ?? '00';

    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  private parseTimeRange(time: string) {
    const cleanTime = time.replace(/\s+/g, ' ').trim();
    const [startTime, endTime] = cleanTime.split(/\s*[-–]\s*/);

    return {
      startTime: startTime || cleanTime,
      endTime: endTime || '',
    };
  }

  private parseSemester(value: string) {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  private cellText(row: ExcelJS.Row, column: number) {
    const cell = row.getCell(column);

    return this.normalizeCellText(cell.text || this.cellValueText(cell.value));
  }

  private cellValueText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('es-PY');

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text;
      }

      if ('result' in value) {
        return this.cellValueText(value.result);
      }

      const richText = (value as { richText?: unknown }).richText;

      if (Array.isArray(richText)) {
        return richText.map((item) => this.richTextItemText(item)).join('');
      }
    }

    return '';
  }

  private richTextItemText(item: unknown) {
    if (typeof item !== 'object' || item === null || !('text' in item)) {
      return '';
    }

    const text = (item as { text?: unknown }).text;

    return typeof text === 'string' ? text : '';
  }

  private normalizeCellText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private cellTimeText(row: ExcelJS.Row, column: number) {
    const cell = row.getCell(column);

    if (cell.value instanceof Date) {
      return `${String(cell.value.getUTCHours()).padStart(2, '0')}:${String(
        cell.value.getUTCMinutes(),
      ).padStart(2, '0')}`;
    }

    if (typeof cell.value === 'number') {
      const totalMinutes = Math.round(cell.value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0',
      )}`;
    }

    return this.cellText(row, column);
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async saveCareers(careers: Array<{ code: string; name: string }>) {
    await Promise.all(
      careers.map((career) =>
        this.prisma.career.upsert({
          where: {
            name: career.name,
          },
          update: {
            code: career.code,
          },
          create: {
            code: career.code,
            name: career.name,
          },
        }),
      ),
    );
  }

  private makeSectionId(parts: string[]) {
    return parts
      .join('-')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }
}
