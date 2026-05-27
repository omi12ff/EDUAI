'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Clock,
} from 'lucide-react';

import { api } from '@/services/api';

interface Exam {
  id: string;
  title: string;
  description?: string;
  date: string;
  subjectId: string;
  subject: {
    id?: string;
    name: string;
  };
}

function formatExamDate(date: string) {
  return new Date(date).toLocaleDateString('es-PY', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatExamTime(date: string) {
  return new Date(date).toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isUpcoming(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Date(date) >= today;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);

  const fetchData = useCallback(async () => {
    const examsResponse = await api.get('/academic/exams');
    setExams(examsResponse.data);
  }, []);

  useEffect(() => {
    fetchData().catch((error) => console.error(error));
  }, [fetchData]);

  const upcomingExams = useMemo(
    () => exams.filter((exam) => isUpcoming(exam.date)),
    [exams],
  );

  const groupedExams = useMemo(() => {
    return exams.reduce<Record<string, Exam[]>>((acc, exam) => {
      const key = exam.subject.name;
      acc[key] = acc[key] ? [...acc[key], exam] : [exam];
      return acc;
    }, {});
  }, [exams]);

  return (
    <div className="edu-page">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--edu-primary)]">
            Calendario academico
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--edu-text)] sm:text-4xl">
            Examenes
          </h1>
          <p className="edu-muted mt-2">
            Aca aparecen los parciales y finales importados desde tu horario.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-56">
          <Metric
            label="Proximos"
            value={upcomingExams.length}
          />
          <Metric
            label="Total"
            value={exams.length}
          />
        </div>
      </div>

      <section className="space-y-5">
        <div className="edu-card p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--edu-surface-soft)] text-[var(--edu-primary)]">
              <CalendarClock size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--edu-text)]">
                Examenes sincronizados
              </h2>
              <p className="edu-muted mt-1 text-sm">
                Esta seccion es solo lectura. Para cambiar fechas, actualiza el
                Excel en Horario y vuelve a guardar tus secciones.
              </p>
            </div>
          </div>
        </div>

          {exams.length === 0 ? (
            <div className="edu-card p-8 text-center text-[var(--edu-muted)]">
              Todavia no hay examenes cargados. Al guardar tu horario desde el
              Excel, EduAI tambien trae las fechas de parciales y finales.
            </div>
          ) : (
            Object.entries(groupedExams).map(([subjectName, subjectExams]) => (
              <div
                key={subjectName}
                className="edu-card overflow-hidden"
              >
                <div className="border-b border-[var(--edu-border)] bg-white p-5">
                  <h2 className="text-xl font-semibold">{subjectName}</h2>
                  <p className="edu-muted mt-1 text-sm">
                    {subjectExams.length} examen(es) registrado(s)
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {subjectExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--edu-surface-soft)] text-[var(--edu-primary)]">
                          <CalendarClock size={24} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{exam.title}</h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isUpcoming(exam.date)
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isUpcoming(exam.date) ? 'Proximo' : 'Pasado'}
                            </span>
                          </div>
                          <p className="edu-muted mt-1 flex items-center gap-2 text-sm">
                            <Clock size={15} />
                            {formatExamDate(exam.date)} - {formatExamTime(exam.date)}
                          </p>
                          {exam.description && (
                            <p className="mt-2 text-sm text-slate-600">
                              {exam.description}
                            </p>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="edu-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--edu-text)]">{value}</p>
    </div>
  );
}
