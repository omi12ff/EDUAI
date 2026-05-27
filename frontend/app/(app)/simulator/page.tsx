'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Target } from 'lucide-react';

import { api } from '@/services/api';

interface Subject {
  id: string;
  name: string;
  teacher?: string;
}

interface Exam {
  id: string;
  title: string;
  date: string;
  subjectId: string;
}

interface Grade {
  id: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  subjectId?: string;
  subject: Subject;
  exam?: Exam | null;
  createdAt?: string;
}

type GradeSlot = 'P1' | 'P2' | 'REC' | 'F1' | 'F2';

const targetThresholds: Record<number, number> = {
  2: 60,
  3: 71,
  4: 81,
  5: 91,
};

function normalizeText(value: string) {
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

function valueLabel(value: number | null) {
  return value === null ? '-' : `${round2(value)}`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function slotFromTitleAndType(titleValue: string, type: string): GradeSlot | null {
  const title = normalizeText(titleValue);

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

  return null;
}

function slotFromGrade(grade: Grade) {
  return slotFromTitleAndType(grade.exam?.title ?? grade.title, grade.type);
}

function sortGrades(grades: Grade[]) {
  return [...grades].sort((a, b) => {
    const aDate = new Date(a.exam?.date ?? a.createdAt ?? 0).getTime();
    const bDate = new Date(b.exam?.date ?? b.createdAt ?? 0).getTime();

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

function parseScore(value: string) {
  if (!value.trim()) {
    return null;
  }

  const score = Number(value);

  if (Number.isNaN(score)) {
    return null;
  }

  return Math.min(100, Math.max(0, score));
}

function finalScale(partialAverage: number, finalScore: number) {
  const weightedScore = Math.round(partialAverage * 0.4 + finalScore * 0.6);

  if (finalScore < 50 || weightedScore < 60) {
    return {
      weightedScore,
      grade: 1,
    };
  }

  if (weightedScore >= 91) return { weightedScore, grade: 5 };
  if (weightedScore >= 81) return { weightedScore, grade: 4 };
  if (weightedScore >= 71) return { weightedScore, grade: 3 };
  return { weightedScore, grade: 2 };
}

function requiredFinalScore(partialAverage: number | null, targetGrade: number) {
  if (partialAverage === null) {
    return null;
  }

  const threshold = targetThresholds[targetGrade];
  const rawRequired = Math.ceil((threshold - partialAverage * 0.4) / 0.6);
  const required = Math.max(50, rawRequired);

  return required > 100 ? null : required;
}

export default function SimulatorPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [targetGrade, setTargetGrade] = useState(3);

  const [p1Input, setP1Input] = useState('');
  const [p2Input, setP2Input] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');

  useEffect(() => {
    Promise.all([api.get('/academic/subjects'), api.get('/academic/grades/my')])
      .then(([subjectsResponse, gradesResponse]) => {
        setSubjects(subjectsResponse.data);
        setGrades(gradesResponse.data);

        if (subjectsResponse.data[0]) {
          setSubjectId(subjectsResponse.data[0].id);
        }
      })
      .catch((error) => console.error(error));
  }, []);

  const subjectGrades = useMemo(
    () =>
      grades.filter(
        (grade) => (grade.subjectId ?? grade.subject.id) === subjectId,
      ),
    [grades, subjectId],
  );

  const realScores = useMemo(() => {
    return {
      p1: scoreOn100(latestSlotGrade(subjectGrades, 'P1')),
      p2: scoreOn100(latestSlotGrade(subjectGrades, 'P2')),
      recovery: scoreOn100(latestSlotGrade(subjectGrades, 'REC')),
      firstFinal: scoreOn100(latestSlotGrade(subjectGrades, 'F1')),
      secondFinal: scoreOn100(latestSlotGrade(subjectGrades, 'F2')),
    };
  }, [subjectGrades]);

  useEffect(() => {
    setP1Input(realScores.p1?.toString() ?? '');
    setP2Input(realScores.p2?.toString() ?? '');
    setRecoveryInput(realScores.recovery?.toString() ?? '');
  }, [realScores]);

  const scenario = useMemo(() => {
    const p1 = parseScore(p1Input);
    const p2 = parseScore(p2Input);
    const recovery = parseScore(recoveryInput);
    const firstFinal = realScores.firstFinal;
    const secondFinal = realScores.secondFinal;
    const initialAverage = p1 !== null && p2 !== null ? average([p1, p2]) : null;
    let effectiveAverage = initialAverage;
    let canFirstFinal = false;
    let canSecondFinal = false;
    let status = 'Carga P1 y P2 para simular habilitacion.';
    let tone: 'success' | 'warning' | 'danger' | 'muted' = 'muted';

    if (initialAverage !== null) {
      if (initialAverage >= 59.5) {
        canFirstFinal = true;
        canSecondFinal = true;
        status = 'Habilita primer y segundo final.';
        tone = 'success';
      } else if (initialAverage >= 49.5) {
        canSecondFinal = true;
        status = 'Habilita solo segundo final.';
        tone = 'warning';
      } else if (recovery === null) {
        status = 'Debe rendir recuperatorio.';
        tone = 'danger';
      } else {
        const bestPartial = Math.max(p1 ?? 0, p2 ?? 0);
        effectiveAverage = average([bestPartial, recovery]);

        if ((effectiveAverage ?? 0) >= 49.5) {
          canSecondFinal = true;
          status = 'Con recuperatorio habilita solo segundo final.';
          tone = 'warning';
        } else {
          status = 'No habilita finales con este escenario.';
          tone = 'danger';
        }
      }
    }

    const firstFinalResult =
      canFirstFinal && firstFinal !== null && initialAverage !== null
        ? finalScale(initialAverage, firstFinal)
        : null;
    const secondFinalResult =
      canSecondFinal && secondFinal !== null && effectiveAverage !== null
        ? finalScale(effectiveAverage, secondFinal)
        : null;
    const requiredFirstFinal = canFirstFinal
      ? requiredFinalScore(initialAverage, targetGrade)
      : null;
    const requiredSecondFinal = canSecondFinal
      ? requiredFinalScore(effectiveAverage, targetGrade)
      : null;

    return {
      p1,
      p2,
      recovery,
      initialAverage,
      effectiveAverage,
      canFirstFinal,
      canSecondFinal,
      status,
      tone,
      firstFinalResult,
      secondFinalResult,
      requiredFirstFinal,
      requiredSecondFinal,
    };
  }, [
    p1Input,
    p2Input,
    realScores.firstFinal,
    realScores.secondFinal,
    recoveryInput,
    targetGrade,
  ]);

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);

  return (
    <div className="edu-page">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--edu-primary)]">
            Simulador FPUNA
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Probar escenarios</h1>
          <p className="edu-muted mt-2">
            Cambia puntajes sin guardar nada y mira habilitacion, recuperatorio y
            nota final estimada.
          </p>
        </div>

        <div className="edu-card px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Materia
          </p>
          <p className="mt-1 text-xl font-bold">
            {selectedSubject?.name ?? 'Sin materia'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="edu-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Calculator size={20} />
            Datos del escenario
          </h2>

          <div className="grid gap-3">
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="edu-input"
            >
              {subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </select>

            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreInput
                label="Primer parcial"
                value={p1Input}
                onChange={setP1Input}
              />
              <ScoreInput
                label="Segundo parcial"
                value={p2Input}
                onChange={setP2Input}
              />
              <ScoreInput
                label="Recuperatorio"
                value={recoveryInput}
                onChange={setRecoveryInput}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Nota objetivo
                </span>
                <select
                  value={targetGrade}
                  onChange={(event) => setTargetGrade(Number(event.target.value))}
                  className="edu-input"
                >
                  {[2, 3, 4, 5].map((grade) => (
                    <option
                      key={grade}
                      value={grade}
                    >
                      Nota {grade}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className={`rounded-xl border p-5 ${toneClass(scenario.tone)}`}>
            <div className="flex items-start gap-3">
              {scenario.tone === 'success' ? (
                <CheckCircle2 size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
              <div>
                <h2 className="text-xl font-semibold">{scenario.status}</h2>
                <p className="mt-1 text-sm">
                  Promedio inicial: {valueLabel(scenario.initialAverage)}.
                  Promedio vigente: {valueLabel(scenario.effectiveAverage)}.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ResultCard
              label="Promedio inicial"
              value={valueLabel(scenario.initialAverage)}
              detail="P1 y P2"
            />
            <ResultCard
              label="Promedio vigente"
              value={valueLabel(scenario.effectiveAverage)}
              detail={
                scenario.recovery !== null
                  ? 'Mejor parcial + recuperatorio'
                  : 'Sin recuperatorio'
              }
            />
            <ResultCard
              label="Finales"
              value={
                scenario.canFirstFinal
                  ? '1er y 2do'
                  : scenario.canSecondFinal
                    ? '2do'
                    : '-'
              }
              detail="Segun regla FPUNA"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FinalCard
              title="Primer final"
              enabled={scenario.canFirstFinal}
              required={scenario.requiredFirstFinal}
              targetGrade={targetGrade}
              result={scenario.firstFinalResult}
            />
            <FinalCard
              title="Segundo final"
              enabled={scenario.canSecondFinal}
              required={scenario.requiredSecondFinal}
              targetGrade={targetGrade}
              result={scenario.secondFinalResult}
            />
          </div>

          <section className="edu-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Target size={20} />
              Lectura rapida
            </h2>
            <p className="edu-muted leading-7">
              Este simulador no guarda puntajes. Sirve para preguntar cosas tipo:
              cuanto necesito en el final, si me conviene recuperar, o que pasa si
              cargo un segundo parcial con cierto puntaje.
            </p>
          </section>
        </section>
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">
        {label}
      </span>
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="edu-input"
        placeholder="0 a 100"
      />
    </label>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="edu-card p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="edu-muted mt-1 text-sm">{detail}</p>
    </div>
  );
}

function FinalCard({
  title,
  enabled,
  required,
  targetGrade,
  result,
}: {
  title: string;
  enabled: boolean;
  required: number | null;
  targetGrade: number;
  result: { weightedScore: number; grade: number } | null;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        enabled
          ? 'border-cyan-200 bg-cyan-50'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[var(--edu-text)]">
            {title}
          </h3>
          <p className="mt-1 text-sm">
            {enabled ? 'Habilitado en este escenario' : 'No habilitado'}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold">
          Nota {targetGrade}
        </span>
      </div>

      <div className="mt-4 rounded-lg bg-white p-4 text-sm text-[var(--edu-text)]">
        {enabled ? (
          <p>
            Necesitas{' '}
            <strong>{required === null ? 'mas de 100' : `${required}/100`}</strong>{' '}
            para apuntar a nota {targetGrade}.
          </p>
        ) : (
          <p>Primero hay que habilitar este final.</p>
        )}

        {result && (
          <p className="mt-2">
            Con el puntaje simulado: final ponderado{' '}
            <strong>{result.weightedScore}/100</strong>, nota{' '}
            <strong>{result.grade}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

function toneClass(tone: 'success' | 'warning' | 'danger' | 'muted') {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    muted: 'border-slate-200 bg-white text-slate-600',
  };

  return classes[tone];
}
