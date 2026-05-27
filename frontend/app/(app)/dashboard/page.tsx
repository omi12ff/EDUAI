'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  GraduationCap,
  MessageCircle,
} from 'lucide-react';

import { getCurrentPlannerDay, plannerDays } from '@/lib/planner-days';
import { api } from '@/services/api';

interface Schedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject?: {
    name: string;
  };
}

interface Exam {
  id: string;
  title: string;
  date: string;
  subjectId?: string;
  subject?: {
    id?: string;
    name: string;
  };
}

interface Grade {
  id: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  date?: string | null;
  notes?: string | null;
  createdAt?: string;
  subjectId?: string;
  subject: {
    id?: string;
    name: string;
  };
  exam?: Exam | null;
}

interface SubjectSummary {
  id: string;
  name: string;
  average: number | null;
  status: string;
}

interface Overview {
  stats: {
    subjects: number;
    upcomingExams: number;
    grades: number;
    riskSubjects: number;
  };
  upcoming: {
    exams: Exam[];
  };
  grades: {
    subjects: SubjectSummary[];
  };
  recommendations: string[];
}

type GradeSlot = 'P1' | 'P2' | 'REC' | 'F1' | 'F2' | 'OTRO';
type AttentionTone = 'warning' | 'danger';

interface FpunaAttention {
  key: string;
  name: string;
  title: string;
  detail: string;
  tone: AttentionTone;
}

const slotLabels: Record<GradeSlot, string> = {
  P1: '1er. parcial',
  P2: '2do. parcial',
  REC: 'Recuperatorio',
  F1: '1er. final',
  F2: '2do. final',
  OTRO: 'Otro',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-PY');
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreOn100(grade: Grade | null) {
  if (!grade?.maxScore) {
    return null;
  }

  return round2((grade.score / grade.maxScore) * 100);
}

function scoreLabel(value: number | null) {
  return value === null ? '-' : `${round2(value)}/100`;
}

function isAbsentGrade(grade: Grade | null) {
  return Boolean(grade?.notes && normalize(grade.notes).includes('ausente'));
}

function gradeScoreLabel(grade: Grade) {
  return isAbsentGrade(grade) ? 'Ausente' : scoreLabel(scoreOn100(grade));
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function slotFromTitleAndType(titleValue: string, type: string): GradeSlot {
  const title = normalize(titleValue);

  if (
    title.includes('primer parcial') ||
    title.includes('parcial 1') ||
    (title.includes('1er') && title.includes('parcial'))
  ) {
    return 'P1';
  }

  if (
    title.includes('segundo parcial') ||
    title.includes('parcial 2') ||
    (title.includes('2do') && title.includes('parcial'))
  ) {
    return 'P2';
  }

  if (title.includes('recuperatorio') || type === 'RECUPERATORIO') {
    return 'REC';
  }

  if (
    title.includes('primer final') ||
    title.includes('final 1') ||
    (title.includes('1er') && title.includes('final'))
  ) {
    return 'F1';
  }

  if (
    title.includes('segundo final') ||
    title.includes('final 2') ||
    (title.includes('2do') && title.includes('final'))
  ) {
    return 'F2';
  }

  return 'OTRO';
}

function slotFromGrade(grade: Grade) {
  return slotFromTitleAndType(grade.exam?.title ?? grade.title, grade.type);
}

function sortGrades(grades: Grade[]) {
  return [...grades].sort((a, b) => {
    const aDate = new Date(
      a.exam?.date ?? a.date ?? a.createdAt ?? 0,
    ).getTime();
    const bDate = new Date(
      b.exam?.date ?? b.date ?? b.createdAt ?? 0,
    ).getTime();

    if (aDate !== bDate) {
      return bDate - aDate;
    }

    const aCreated = new Date(a.createdAt ?? 0).getTime();
    const bCreated = new Date(b.createdAt ?? 0).getTime();

    return bCreated - aCreated;
  });
}

function latestSlotGrade(grades: Grade[], slot: GradeSlot) {
  return sortGrades(grades).find((grade) => slotFromGrade(grade) === slot) ?? null;
}

function finalScale(partialAverage: number, finalScore: number): number {
  const weightedScore = Math.round(partialAverage * 0.4 + finalScore * 0.6);

  if (finalScore < 50 || weightedScore < 60) {
    return 1;
  }

  if (weightedScore >= 91) return 5;
  if (weightedScore >= 81) return 4;
  if (weightedScore >= 71) return 3;
  return 2;
}

function subjectKey(grade: Grade) {
  return grade.subjectId ?? grade.subject.id ?? grade.subject.name;
}

function finalGradeFor(grade: Grade, allGrades: Grade[]) {
  const slot = slotFromGrade(grade);

  if (slot !== 'F1' && slot !== 'F2') {
    return null;
  }

  const relatedGrades = allGrades.filter(
    (item) => subjectKey(item) === subjectKey(grade),
  );
  const p1 = scoreOn100(latestSlotGrade(relatedGrades, 'P1'));
  const p2 = scoreOn100(latestSlotGrade(relatedGrades, 'P2'));
  const recovery = scoreOn100(latestSlotGrade(relatedGrades, 'REC'));
  const finalScore = scoreOn100(grade);

  if (p1 === null || p2 === null || finalScore === null) {
    return null;
  }

  const initialAverage = average([p1, p2]);

  if (initialAverage === null) {
    return null;
  }

  if (slot === 'F1') {
    return initialAverage >= 59.5
      ? finalScale(initialAverage, finalScore)
      : null;
  }

  if (initialAverage >= 49.5) {
    return finalScale(initialAverage, finalScore);
  }

  if (recovery === null) {
    return null;
  }

  const recoveryAverage = average([Math.max(p1, p2), recovery]);

  return recoveryAverage !== null && recoveryAverage >= 49.5
    ? finalScale(recoveryAverage, finalScore)
    : null;
}

function buildFpunaAttention(grades: Grade[]) {
  const grouped = grades.reduce<
    Record<string, { name: string; grades: Grade[] }>
  >((acc, grade) => {
    const key = subjectKey(grade);

    acc[key] = acc[key] ?? {
      name: grade.subject.name,
      grades: [],
    };

    acc[key].grades.push(grade);

    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([key, item]): FpunaAttention | null => {
      const p1Grade = latestSlotGrade(item.grades, 'P1');
      const p2Grade = latestSlotGrade(item.grades, 'P2');
      const recoveryGrade = latestSlotGrade(item.grades, 'REC');
      const p1 = scoreOn100(p1Grade);
      const p2 = scoreOn100(p2Grade);
      const recovery = scoreOn100(recoveryGrade);

      if (p1 === null || p2 === null) {
        const loaded = [
          p1Grade ? `1er. parcial ${gradeScoreLabel(p1Grade)}` : null,
          p2Grade ? `2do. parcial ${gradeScoreLabel(p2Grade)}` : null,
        ]
          .filter(Boolean)
          .join(' - ');
        const missing = [
          p1 === null ? '1er. parcial' : null,
          p2 === null ? '2do. parcial' : null,
        ]
          .filter(Boolean)
          .join(' y ');

        return {
          key,
          name: item.name,
          title: 'Faltan parciales',
          detail: `${loaded || 'Sin parciales cargados'}. Falta ${missing} para calcular habilitacion.`,
          tone: 'warning',
        };
      }

      const initialAverage = average([p1, p2]) ?? 0;

      if (initialAverage >= 59.5) {
        return null;
      }

      if (initialAverage >= 49.5) {
        return {
          key,
          name: item.name,
          title: 'Habilita solo segundo final',
          detail: `Promedio parcial ${scoreLabel(initialAverage)}. Con este promedio no habilita el primer final.`,
          tone: 'warning',
        };
      }

      if (recovery === null) {
        return {
          key,
          name: item.name,
          title: 'Debe ir a recuperatorio',
          detail: `Promedio parcial ${scoreLabel(initialAverage)}. Falta cargar recuperatorio para recalcular habilitacion.`,
          tone: 'danger',
        };
      }

      const recoveryAverage = average([Math.max(p1, p2), recovery]) ?? 0;

      if (recoveryAverage >= 49.5) {
        return {
          key,
          name: item.name,
          title: 'Habilita segundo final',
          detail: `Promedio entre recuperatorio y mejor parcial ${scoreLabel(recoveryAverage)}. Solo queda disponible el segundo final.`,
          tone: 'warning',
        };
      }

      return {
        key,
        name: item.name,
        title: 'No habilita finales',
        detail: `Promedio entre recuperatorio y mejor parcial ${scoreLabel(recoveryAverage)}. Sigue por debajo de 49.5.`,
        tone: 'danger',
      };
    })
    .filter((item): item is FpunaAttention => item !== null);
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('Lunes');

  const fetchOverview = useCallback(async () => {
    const [overviewResponse, schedulesResponse, gradesResponse] =
      await Promise.all([
        api.get('/academic/overview'),
        api.get('/academic/schedules'),
        api.get('/academic/grades/my'),
      ]);

    setOverview(overviewResponse.data);
    setAllSchedules(schedulesResponse.data);
    setGrades(gradesResponse.data);
  }, []);

  useEffect(() => {
    fetchOverview()
      .catch((error) => {
        console.error('Error fetching dashboard data:', error);
      })
      .finally(() => setLoading(false));
  }, [fetchOverview]);

  useEffect(() => {
    setSelectedDay(getCurrentPlannerDay());
  }, []);

  const scheduleForDay = useMemo(() => {
    return allSchedules
      .filter((schedule) => normalize(schedule.day) === normalize(selectedDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allSchedules, selectedDay]);

  const recentGrades = useMemo(() => sortGrades(grades).slice(0, 6), [grades]);

  const finalGrades = useMemo(() => {
    return grades
      .map((grade) => finalGradeFor(grade, grades))
      .filter((value): value is number => value !== null);
  }, [grades]);

  const finalAverage =
    finalGrades.length > 0 ? round2(average(finalGrades) ?? 0) : null;

  const fpunaAttention = useMemo(
    () => buildFpunaAttention(grades),
    [grades],
  );

  const recommendations =
    overview?.recommendations.filter(
      (recommendation) =>
        !normalize(recommendation).includes('tarea') &&
        !normalize(recommendation).includes('promedio'),
    ) ?? [];

  if (loading) {
    return <div className="edu-page">Cargando dashboard...</div>;
  }

  return (
    <div className="edu-page">
      <div className="mb-7 flex items-center gap-4">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-500 shadow">
          ...
        </button>

        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Inicio
          </p>
          <h1 className="text-2xl font-semibold text-slate-700 sm:text-3xl">
            Tu centro academico
          </h1>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <EaluPanel title="Notas / puntajes de examen" icon={<Check size={30} />}>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[var(--edu-surface-soft)] text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-4">Asignatura</th>
                  <th className="px-4 py-4">Tipo examen</th>
                  <th className="px-4 py-4">Puntaje</th>
                  <th className="px-4 py-4">Nota</th>
                </tr>
              </thead>
              <tbody>
                {recentGrades.map((grade) => {
                  const slot = slotFromGrade(grade);
                  const finalGrade = finalGradeFor(grade, grades);

                  return (
                    <tr
                      key={grade.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-4 font-medium">
                        {grade.subject.name}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {slotLabels[slot]}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {gradeScoreLabel(grade)}
                      </td>
                      <td className="px-4 py-4 font-bold text-emerald-600">
                        {slot === 'F1' || slot === 'F2' ? finalGrade ?? '' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {recentGrades.length === 0 && (
              <p className="px-4 py-5 text-sm text-[var(--edu-warning)]">
                No existen notas parciales o finales recientes.
              </p>
            )}
          </div>

          <p className="mt-5 text-xs text-slate-400">
            Ultimos puntajes cargados desde Notas
          </p>
        </EaluPanel>

        <EaluPanel
          title="Resumen academico"
          icon={<GraduationCap size={30} />}
        >
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Materias en horario: {overview?.stats.subjects ?? 0}</li>
            <li>2. Bloques de clase: {allSchedules.length}</li>
            <li>3. Examenes proximos: {overview?.stats.upcomingExams ?? 0}</li>
            <li>4. Puntajes cargados: {grades.length}</li>
            <li>5. Promedio final: {finalAverage ?? '-'}</li>
          </ol>
        </EaluPanel>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="edu-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Examenes proximos
              </h2>
              <p className="text-sm text-slate-500">
                Fechas importadas desde tu horario.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {overview?.upcoming.exams.slice(0, 5).map((exam) => (
              <EducaRow
                key={exam.id}
                title={exam.title}
                meta={`${exam.subject?.name ?? 'Sin materia'} - ${formatDate(
                  exam.date,
                )}`}
              />
            ))}

            {(overview?.upcoming.exams.length ?? 0) === 0 && (
              <p className="rounded-sm border border-[var(--edu-border)] p-4 text-sm text-[var(--edu-muted)]">
                Todavia no hay examenes proximos.
              </p>
            )}
          </div>
        </section>

        <section className="edu-card overflow-hidden">
          <div className="edu-topbar px-5 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays size={22} />
                <h2 className="text-xl font-semibold">Horario</h2>
              </div>
              <span className="text-sm text-cyan-50">Horario semanal</span>
            </div>

            <div className="edu-mobile-scroll -mx-1 flex gap-2 overflow-x-auto px-1 sm:flex-wrap">
              {plannerDays.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-lg px-4 py-2 text-sm transition ${
                    selectedDay === day
                      ? 'bg-white text-[var(--edu-primary)]'
                      : 'text-white hover:bg-white/15'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-48 p-5">
            <div
              key={selectedDay}
              className="edu-day-panel"
            >
              {scheduleForDay.length > 0 ? (
                <div className="space-y-3">
                  {scheduleForDay.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className="edu-schedule-item rounded-md border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4"
                      style={{
                        animationDelay: `${index * 45}ms`,
                      }}
                    >
                      <h3 className="font-semibold text-slate-800">
                        {schedule.subject?.name ?? 'Sin materia'}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay clases para {selectedDay.toLowerCase()}.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <QuickLink
                href="/schedule"
                icon={<CalendarDays size={17} />}
              >
                Cargar horario
              </QuickLink>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-4">
        <Metric
          icon={<CalendarDays size={24} />}
          label="Bloques de clase"
          value={allSchedules.length}
        />
        <Metric
          icon={<GraduationCap size={24} />}
          label="Examenes proximos"
          value={overview?.stats.upcomingExams ?? 0}
        />
        <Metric
          icon={<Check size={24} />}
          label="Puntajes"
          value={grades.length}
        />
        <Metric
          icon={<BarChart3 size={24} />}
          label="Promedio final"
          value={finalAverage ?? '-'}
          danger={fpunaAttention.some((item) => item.tone === 'danger')}
        />
      </div>

      <section className="edu-card mt-6 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Recomendaciones de EduAI
          </h2>
          <QuickLink
            href="/ai-chat"
            icon={<MessageCircle size={17} />}
          >
            Preguntar
          </QuickLink>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation}
              className="flex items-start gap-3 rounded-md border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4"
            >
              <AlertTriangle
                className="mt-0.5 text-[var(--edu-warning)]"
                size={18}
              />
              <p className="text-sm text-slate-600">{recommendation}</p>
            </div>
          ))}

          {fpunaAttention.map((subject) => (
            <div
              key={subject.key}
              className={`rounded-md border p-4 ${
                subject.tone === 'danger'
                  ? 'border-red-100 bg-red-50'
                  : 'border-amber-100 bg-amber-50'
              }`}
            >
              <h3
                className={`font-semibold ${
                  subject.tone === 'danger' ? 'text-red-700' : 'text-amber-700'
                }`}
              >
                {subject.name}
              </h3>
              <p
                className={`mt-1 text-sm ${
                  subject.tone === 'danger' ? 'text-red-600' : 'text-amber-700'
                }`}
              >
                {subject.title} - {subject.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EaluPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="edu-card relative p-6">
      <div className="absolute -top-5 left-9 grid h-16 w-16 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-xl">
        {icon}
      </div>

      <h2 className="mb-6 ml-20 text-sm font-bold uppercase text-slate-600">
        {title}
      </h2>

      {children}
    </section>
  );
}

function QuickLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
    >
      {icon}
      {children}
    </Link>
  );
}

function EducaRow({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-[var(--edu-border)] bg-white px-3 py-3">
      <GraduationCap
        className="text-[var(--edu-accent)]"
        size={18}
      />
      <div>
        <h3 className="text-sm font-semibold text-[var(--edu-primary)]">
          {title}
        </h3>
        <p className="text-xs text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="edu-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <h3 className="mt-1 text-3xl font-bold text-slate-800">{value}</h3>
        </div>

        <div
          className={`rounded-md p-3 ${
            danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
