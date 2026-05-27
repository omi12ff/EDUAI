'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  History,
  Info,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

import { api } from '@/services/api';

interface Subject {
  id: string;
  name: string;
  teacher?: string;
}

interface Grade {
  id: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  weight?: number | null;
  date?: string | null;
  notes?: string | null;
  subjectId?: string;
  examId?: string | null;
  createdAt?: string;
  subject: Subject;
  exam?: Exam | null;
}

interface Exam {
  id: string;
  title: string;
  date: string;
  subjectId: string;
  subject?: Subject;
}

type GradeSlot = 'P1' | 'P2' | 'REC' | 'F1' | 'F2' | 'OTRO';
type StatusTone = 'success' | 'warning' | 'danger' | 'muted';

interface GradeOption {
  value: GradeSlot;
  label: string;
  type: string;
}

interface FinalResult {
  label: string;
  finalScore: number;
  weightedScore: number;
  grade: number;
  canUse: boolean;
}

interface SubjectPlan {
  subject: Subject;
  grades: Grade[];
  p1: number | null;
  p2: number | null;
  recovery: number | null;
  firstFinal: number | null;
  secondFinal: number | null;
  p1Absent: boolean;
  p2Absent: boolean;
  recoveryAbsent: boolean;
  firstFinalAbsent: boolean;
  secondFinalAbsent: boolean;
  initialAverage: number | null;
  effectiveAverage: number | null;
  canFirstFinal: boolean;
  canSecondFinal: boolean;
  needsRecovery: boolean;
  recoveryUsed: boolean;
  statusLabel: string;
  statusDetail: string;
  statusTone: StatusTone;
  finalResults: FinalResult[];
  bestFinal: FinalResult | null;
}

const gradeOptions: GradeOption[] = [
  { value: 'P1', label: '1er. parcial', type: 'PARCIAL' },
  { value: 'P2', label: '2do. parcial', type: 'PARCIAL' },
  { value: 'REC', label: 'Recuperatorio', type: 'RECUPERATORIO' },
  { value: 'F1', label: '1er. final', type: 'FINAL' },
  { value: 'F2', label: '2do. final', type: 'FINAL' },
  { value: 'OTRO', label: 'Otro registro', type: 'OTRO' },
];

const ABSENT_NOTE = 'Ausente';
const examSlotOrder: GradeSlot[] = ['P1', 'P2', 'REC', 'F1', 'F2', 'OTRO'];

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
  if (!grade || !grade.maxScore) {
    return null;
  }

  return round2((grade.score / grade.maxScore) * 100);
}

function scoreLabel(value: number | null) {
  return value === null ? '-' : `${round2(value)}`;
}

function scoreWithScaleLabel(value: number | null) {
  return value === null ? '-' : `${round2(value)}/100`;
}

function gradeScoreLabel(grade: Grade) {
  return isAbsentGrade(grade)
    ? 'Ausente'
    : scoreWithScaleLabel(scoreOn100(grade));
}

function formatGradeDate(grade: Grade) {
  const value = grade.exam?.date ?? grade.date ?? grade.createdAt;

  if (!value) {
    return 'Sin fecha';
  }

  return new Date(value).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isAbsentGrade(grade: Grade | null) {
  return Boolean(grade?.notes && normalizeText(grade.notes).includes('ausente'));
}

function absentNotes(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return ABSENT_NOTE;
  }

  if (normalizeText(trimmed).includes('ausente')) {
    return trimmed;
  }

  return `${trimmed} - ${ABSENT_NOTE}`;
}

function shouldSaveAbsent(value: string) {
  const trimmed = value.trim();

  return trimmed === '' || Number.isNaN(Number(trimmed));
}

function formatExamOption(exam: Exam) {
  const date = new Date(exam.date).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = new Date(exam.date).toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${exam.title} - ${date} ${time}`;
}

function slotFromTitleAndType(titleValue: string, type: string): GradeSlot {
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

  return 'OTRO';
}

function slotFromExam(exam: Exam): GradeSlot {
  return slotFromTitleAndType(exam.title, 'OTRO');
}

function slotFromGrade(grade: Grade): GradeSlot {
  return slotFromTitleAndType(grade.exam?.title ?? grade.title, grade.type);
}

function compareExamsByFlow(a: Exam, b: Exam) {
  const slotDiff =
    examSlotOrder.indexOf(slotFromExam(a)) - examSlotOrder.indexOf(slotFromExam(b));

  if (slotDiff !== 0) {
    return slotDiff;
  }

  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function sortGrades(grades: Grade[]) {
  return [...grades].sort((a, b) => {
    const aDate = new Date(a.exam?.date ?? a.date ?? a.createdAt ?? 0).getTime();
    const bDate = new Date(b.exam?.date ?? b.date ?? b.createdAt ?? 0).getTime();

    if (aDate !== bDate) {
      return bDate - aDate;
    }

    const aCreated = new Date(a.createdAt ?? 0).getTime();
    const bCreated = new Date(b.createdAt ?? 0).getTime();

    return bCreated - aCreated;
  });
}

function latestGradeForSlot(grades: Grade[], slot: GradeSlot) {
  return sortGrades(grades).find((grade) => slotFromGrade(grade) === slot) ?? null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function finalScale(partialAverage: number, finalScore: number): FinalResult {
  const weightedScore = Math.round(partialAverage * 0.4 + finalScore * 0.6);
  let grade = 1;

  if (finalScore >= 50 && weightedScore >= 60) {
    if (weightedScore >= 91) {
      grade = 5;
    } else if (weightedScore >= 81) {
      grade = 4;
    } else if (weightedScore >= 71) {
      grade = 3;
    } else {
      grade = 2;
    }
  }

  return {
    label: '',
    finalScore,
    weightedScore,
    grade,
    canUse: true,
  };
}

function pickBestFinal(results: FinalResult[]) {
  const usableResults = results.filter((result) => result.canUse);

  if (usableResults.length === 0) {
    return null;
  }

  return usableResults.reduce((best, result) => {
    if (result.grade > best.grade) {
      return result;
    }

    if (result.grade === best.grade && result.weightedScore > best.weightedScore) {
      return result;
    }

    return best;
  }, usableResults[0]);
}

function buildSubjectPlan(subject: Subject, grades: Grade[]): SubjectPlan {
  const p1Grade = latestGradeForSlot(grades, 'P1');
  const p2Grade = latestGradeForSlot(grades, 'P2');
  const recoveryGrade = latestGradeForSlot(grades, 'REC');
  const firstFinalGrade = latestGradeForSlot(grades, 'F1');
  const secondFinalGrade = latestGradeForSlot(grades, 'F2');

  const p1 = scoreOn100(p1Grade);
  const p2 = scoreOn100(p2Grade);
  const recovery = scoreOn100(recoveryGrade);
  const firstFinal = scoreOn100(firstFinalGrade);
  const secondFinal = scoreOn100(secondFinalGrade);
  const p1Absent = isAbsentGrade(p1Grade);
  const p2Absent = isAbsentGrade(p2Grade);
  const recoveryAbsent = isAbsentGrade(recoveryGrade);
  const firstFinalAbsent = isAbsentGrade(firstFinalGrade);
  const secondFinalAbsent = isAbsentGrade(secondFinalGrade);

  const initialAverage = p1 !== null && p2 !== null ? average([p1, p2]) : null;
  let effectiveAverage = initialAverage;
  let canFirstFinal = false;
  let canSecondFinal = false;
  let needsRecovery = false;
  let recoveryUsed = false;
  let statusLabel = 'Faltan parciales';
  let statusDetail = 'Carga el primer y segundo parcial para calcular habilitacion.';
  let statusTone: StatusTone = 'muted';

  if (initialAverage !== null) {
    if (initialAverage >= 59.5) {
      canFirstFinal = true;
      canSecondFinal = true;
      statusLabel = 'Habilita ambos finales';
      statusDetail = 'Promedio de parciales mayor o igual a 59.5.';
      statusTone = 'success';
    } else if (initialAverage >= 49.5) {
      canSecondFinal = true;
      statusLabel = 'Habilita segundo final';
      statusDetail = 'Promedio de parciales entre 49.5 y 59.49.';
      statusTone = 'warning';
    } else if (recovery === null) {
      needsRecovery = true;
      statusLabel = 'Debe ir a recuperatorio';
      statusDetail = 'El promedio inicial queda por debajo de 49.5.';
      statusTone = 'danger';
    } else {
      recoveryUsed = true;
      const bestPartial = Math.max(p1 ?? 0, p2 ?? 0);
      effectiveAverage = average([bestPartial, recovery]);

      if ((effectiveAverage ?? 0) >= 49.5) {
        canSecondFinal = true;
        statusLabel = 'Habilita segundo final';
        statusDetail =
          'Se promedia el recuperatorio con el parcial mas alto. Solo queda disponible el segundo final.';
        statusTone = 'warning';
      } else {
        statusLabel = 'No habilita finales';
        statusDetail =
          'El promedio entre recuperatorio y mejor parcial queda por debajo de 49.5.';
        statusTone = 'danger';
      }
    }
  }

  const finalResults: FinalResult[] = [];

  if (firstFinal !== null && initialAverage !== null) {
    finalResults.push({
      ...finalScale(initialAverage, firstFinal),
      label: 'Primer final',
      canUse: canFirstFinal,
    });
  }

  if (secondFinal !== null && effectiveAverage !== null) {
    finalResults.push({
      ...finalScale(effectiveAverage, secondFinal),
      label: 'Segundo final',
      canUse: canSecondFinal,
    });
  }

  const bestFinal = pickBestFinal(finalResults);

  if (bestFinal) {
    statusLabel = `Nota final ${bestFinal.grade}`;
    statusDetail = `${bestFinal.label}: puntaje final ${bestFinal.weightedScore}/100.`;
    statusTone = bestFinal.grade > 1 ? 'success' : 'danger';
  }

  return {
    subject,
    grades,
    p1,
    p2,
    recovery,
    firstFinal,
    secondFinal,
    p1Absent,
    p2Absent,
    recoveryAbsent,
    firstFinalAbsent,
    secondFinalAbsent,
    initialAverage,
    effectiveAverage,
    canFirstFinal,
    canSecondFinal,
    needsRecovery,
    recoveryUsed,
    statusLabel,
    statusDetail,
    statusTone,
    finalResults,
    bestFinal,
  };
}

function statusClass(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    muted: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return classes[tone];
}

function statusIcon(tone: StatusTone) {
  if (tone === 'success') {
    return <CheckCircle2 size={18} />;
  }

  if (tone === 'danger') {
    return <XCircle size={18} />;
  }

  if (tone === 'warning') {
    return <AlertTriangle size={18} />;
  }

  return <Info size={18} />;
}

export default function GradesPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [slot, setSlot] = useState<GradeSlot>('P1');
  const [title, setTitle] = useState('');
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [subjectsResponse, gradesResponse, examsResponse] = await Promise.all([
      api.get('/academic/subjects'),
      api.get('/academic/grades/my'),
      api.get('/academic/exams'),
    ]);

    setSubjects(subjectsResponse.data);
    setGrades(gradesResponse.data);
    setExams(examsResponse.data);
  }, []);

  useEffect(() => {
    fetchData().catch((error) => {
      console.error(error);
    });
  }, [fetchData]);

  const gradesBySubject = useMemo(() => {
    return grades.reduce<Record<string, Grade[]>>((acc, grade) => {
      const key = grade.subjectId ?? grade.subject.id;
      acc[key] = acc[key] ? [...acc[key], grade] : [grade];
      return acc;
    }, {});
  }, [grades]);

  const plans = useMemo(() => {
    return subjects.map((subject) =>
      buildSubjectPlan(subject, gradesBySubject[subject.id] ?? []),
    );
  }, [subjects, gradesBySubject]);

  const sortedGrades = useMemo(() => sortGrades(grades), [grades]);

  const selectedOption =
    gradeOptions.find((option) => option.value === slot) ?? gradeOptions[0];

  const filteredExams = useMemo(() => {
    if (!subjectId) {
      return [];
    }

    return exams
      .filter((exam) => exam.subjectId === subjectId)
      .sort(compareExamsByFlow);
  }, [exams, subjectId]);

  const finalAverage = useMemo(() => {
    const finalGrades = plans
      .map((plan) => plan.bestFinal?.grade ?? null)
      .filter((value): value is number => value !== null);

    return finalGrades.length > 0 ? round2(average(finalGrades) ?? 0) : null;
  }, [plans]);

  const riskCount = plans.filter(
    (plan) => plan.statusTone === 'danger' || plan.needsRecovery,
  ).length;

  function resetForm() {
    setSlot('P1');
    setTitle('');
    setScore('');
    setNotes('');
    setSubjectId('');
    setExamId('');
    setEditingId(null);
  }

  function buildPayload() {
    const linkedExam = exams.find((exam) => exam.id === examId);
    const savingAbsent = shouldSaveAbsent(score);

    return {
      title:
        linkedExam?.title ??
        (slot === 'OTRO' ? title.trim() : selectedOption.label),
      type: selectedOption.type,
      score: savingAbsent ? 0 : Number(score),
      maxScore: 100,
      weight: undefined,
      notes: savingAbsent ? absentNotes(notes) : notes.trim() || undefined,
      subjectId,
      examId: examId || null,
    };
  }

  async function saveGrade() {
    const trimmedScore = score.trim();
    const savingAbsent = shouldSaveAbsent(score);
    const numericScore = Number(trimmedScore);

    if (!subjectId) {
      alert('Selecciona una materia');
      return;
    }

    if (!savingAbsent && (numericScore < 0 || numericScore > 100)) {
      alert('El puntaje debe estar entre 0 y 100');
      return;
    }

    if (slot === 'OTRO' && !title.trim()) {
      alert('Escribe un titulo para el registro');
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await api.patch(`/academic/grades/${editingId}`, buildPayload());
      } else {
        await api.post('/academic/grades', buildPayload());
      }

      resetForm();
      await fetchData();
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la nota');
    } finally {
      setLoading(false);
    }
  }

  async function deleteGrade(grade: Grade) {
    const confirmed = window.confirm(
      `Eliminar ${grade.title} de ${grade.subject.name}? Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/academic/grades/${grade.id}`);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert('No se pudo eliminar el puntaje');
    } finally {
      setLoading(false);
    }
  }

  function selectExam(nextExamId: string) {
    setExamId(nextExamId);

    const exam = exams.find((item) => item.id === nextExamId);

    if (exam) {
      setSlot(slotFromExam(exam));
    }
  }

  function selectSubject(nextSubjectId: string) {
    setSubjectId(nextSubjectId);

    const subjectExams = exams
      .filter((exam) => exam.subjectId === nextSubjectId)
      .sort(compareExamsByFlow);
    const firstPartial =
      subjectExams.find((exam) => slotFromExam(exam) === 'P1') ?? subjectExams[0];

    if (firstPartial) {
      setExamId(firstPartial.id);
      setSlot(slotFromExam(firstPartial));
    } else {
      setExamId('');
      setSlot('P1');
    }
  }

  return (
    <div className="edu-page">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--edu-primary)]">
            Sistema FPUNA
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Notas y promedio</h1>
          <p className="edu-muted mt-2">
            Calcula habilitacion, recuperatorio y nota final con escala de 100 puntos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="Promedio final"
            value={finalAverage ?? '-'}
          />
          <Metric
            label="Registros"
            value={grades.length}
          />
          <Metric
            label="En riesgo"
            value={riskCount}
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <RuleCard
          title="Parciales"
          detail="P1 y P2 se cargan sobre 100. Al elegir una materia se selecciona primero el 1er. parcial. Si dejas el puntaje vacio, se guarda como ausente."
        />
        <RuleCard
          title="Recuperatorio"
          detail="Si vas a recuperatorio, se conserva el parcial mas alto y se promedia con el recuperatorio. Aunque suba a 60, solo queda el segundo final."
        />
        <RuleCard
          title="Nota final"
          detail="La escala del final usa 40% del promedio parcial y 60% del examen final. Desde 60 puntos ya corresponde nota 2."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="edu-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Plus size={20} />
            {editingId ? 'Editar registro' : 'Cargar puntaje'}
          </h2>

          <div className="grid gap-3">
            <select
              value={subjectId}
              onChange={(event) => selectSubject(event.target.value)}
              className="edu-input"
            >
              <option value="">Materia</option>
              {subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </select>

            {slot === 'OTRO' && (
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="edu-input"
                placeholder="Ej: Trabajo practico"
              />
            )}

            <select
              value={examId}
              onChange={(event) => selectExam(event.target.value)}
              disabled={!subjectId || filteredExams.length === 0}
              className="edu-input disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">
                {subjectId
                  ? 'Vincular con examen cargado (opcional)'
                  : 'Primero selecciona una materia'}
              </option>
              {filteredExams.map((exam) => (
                <option
                  key={exam.id}
                  value={exam.id}
                >
                  {formatExamOption(exam)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              className="edu-input"
              placeholder="Puntaje / 100"
            />

            <div className="flex gap-3">
              <button
                onClick={saveGrade}
                disabled={loading}
                className="edu-button flex-1 px-4 py-3 disabled:opacity-50"
              >
                {loading
                  ? 'Guardando...'
                  : editingId
                    ? 'Guardar cambios'
                    : 'Guardar puntaje'}
              </button>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="edu-button-secondary px-4 py-3"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {plans.map((plan) => (
              <SubjectGradeCard
                key={plan.subject.id}
                plan={plan}
              />
            ))}
          </div>

          {grades.length === 0 && (
            <div className="edu-card p-8 text-center text-[var(--edu-muted)]">
              Todavia no hay notas cargadas.
            </div>
          )}
        </section>
      </div>

      {sortedGrades.length > 0 && (
        <section className="edu-card mt-6 p-5">
          <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <History size={20} />
                Historial de cargas de puntaje
              </h2>
              <p className="edu-muted mt-1 text-sm">
                Cada carga queda registrada. Las tarjetas de arriba usan el
                registro mas reciente de cada examen.
              </p>
            </div>
            <span className="rounded-full bg-[var(--edu-surface-soft)] px-3 py-1 text-sm font-semibold text-[var(--edu-muted)]">
              {sortedGrades.length} registro(s)
            </span>
          </div>

          <div className="space-y-3">
            {sortedGrades.map((grade) => (
              <div
                key={grade.id}
                className="flex flex-col gap-4 rounded-lg border border-[var(--edu-border)] bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--edu-text)]">
                      {grade.title}
                    </h3>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                      {grade.subject.name}
                    </span>
                  </div>
                  <p className="edu-muted mt-1 text-sm">
                    {formatGradeDate(grade)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className="text-2xl font-bold text-[var(--edu-text)]">
                    {gradeScoreLabel(grade)}
                  </span>
                  <button
                    onClick={() => deleteGrade(grade)}
                    disabled={loading}
                    className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    title="Eliminar registro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
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

function RuleCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="edu-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--edu-primary)]">
        <Info size={18} />
        <h2 className="font-semibold text-[var(--edu-text)]">{title}</h2>
      </div>
      <p className="edu-muted text-sm leading-6">{detail}</p>
    </div>
  );
}

function SubjectGradeCard({ plan }: { plan: SubjectPlan }) {
  return (
    <article className="edu-card p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h3 className="text-xl font-semibold">{plan.subject.name}</h3>
          <p className="edu-muted mt-1 text-sm">
            {plan.subject.teacher || 'Sin docente cargado'}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(plan.statusTone)}`}
        >
          {statusIcon(plan.statusTone)}
          {plan.statusLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ScoreTile
          label="Primer parcial"
          value={plan.p1}
          absent={plan.p1Absent}
        />
        <ScoreTile
          label="Segundo parcial"
          value={plan.p2}
          absent={plan.p2Absent}
        />
        <ScoreTile
          label="Recuperatorio"
          value={plan.recovery}
          absent={plan.recoveryAbsent}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Promedio inicial"
          value={scoreLabel(plan.initialAverage)}
        />
        <SummaryTile
          label={plan.recoveryUsed ? 'Promedio con rec.' : 'Promedio vigente'}
          value={scoreLabel(plan.effectiveAverage)}
        />
        <SummaryTile
          label="Finales"
          value={
            plan.canFirstFinal
              ? '1er y 2do'
              : plan.canSecondFinal
                ? '2do'
                : plan.needsRecovery
                  ? 'Rec.'
                  : '-'
          }
        />
      </div>

      <div className="mt-5 rounded-lg border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4">
        <p className="text-sm font-semibold text-[var(--edu-text)]">
          {plan.statusLabel}
        </p>
        <p className="edu-muted mt-1 text-sm">{plan.statusDetail}</p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <FinalTile
          label="Primer final"
          value={plan.firstFinal}
          absent={plan.firstFinalAbsent}
          enabled={plan.canFirstFinal}
          result={plan.finalResults.find((result) => result.label === 'Primer final')}
        />
        <FinalTile
          label="Segundo final"
          value={plan.secondFinal}
          absent={plan.secondFinalAbsent}
          enabled={plan.canSecondFinal}
          result={plan.finalResults.find((result) => result.label === 'Segundo final')}
        />
      </div>

      {plan.bestFinal && (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <BarChart3 size={20} />
          <div>
            <p className="font-semibold">
              Resultado vigente: nota {plan.bestFinal.grade}
            </p>
            <p className="text-sm">
              {plan.bestFinal.label} con puntaje final{' '}
              {plan.bestFinal.weightedScore}/100.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function ScoreTile({
  label,
  value,
  absent,
}: {
  label: string;
  value: number | null;
  absent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--edu-border)] bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--edu-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 font-bold ${
          absent ? 'text-lg text-amber-700' : 'text-2xl text-[var(--edu-text)]'
        }`}
      >
        {absent ? 'Ausente' : scoreLabel(value)}
      </p>
      <p className="edu-muted text-xs">
        {absent ? 'cuenta como 0/100' : 'sobre 100'}
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--edu-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[var(--edu-text)]">{value}</p>
    </div>
  );
}

function FinalTile({
  label,
  value,
  absent,
  enabled,
  result,
}: {
  label: string;
  value: number | null;
  absent?: boolean;
  enabled: boolean;
  result?: FinalResult;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        enabled
          ? 'border-cyan-200 bg-cyan-50'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--edu-text)]">{label}</p>
          <p className="mt-1 text-sm">
            {enabled ? 'Habilitado' : 'No habilitado por ahora'}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[var(--edu-text)]">
          {absent ? 'Ausente' : scoreLabel(value)}
        </span>
      </div>

      {result && (
        <div className="mt-4 rounded-md bg-white p-3 text-sm text-[var(--edu-text)]">
          <p>
            Puntaje final: <strong>{result.weightedScore}/100</strong>
          </p>
          <p>
            Nota: <strong>{result.grade}</strong>
          </p>
          {!result.canUse && (
            <p className="mt-1 text-xs text-[var(--edu-danger)]">
              Este registro queda guardado, pero no cuenta porque el final no
              esta habilitado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
