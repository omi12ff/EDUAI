'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { api } from '@/services/api';

interface Subject {
  id: string;
  name: string;
  teacher?: string;
}

interface Schedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: {
    name: string;
    teacher?: string;
  };
}

interface CatalogBlock {
  day: string;
  time: string;
  startTime: string;
  endTime: string;
  room: string;
  notes: string;
}

interface CatalogExam {
  title: string;
  dateText: string;
  time: string;
  room: string;
  date: string;
}

interface CatalogSection {
  id: string;
  name: string;
  teacher: string;
  email: string;
  turn: string;
  emphasis: string;
  platform: string;
  schedule: CatalogBlock[];
  exams: CatalogExam[];
}

interface CatalogSubject {
  name: string;
  semester: number;
  sections: CatalogSection[];
}

interface CatalogSemester {
  number: number;
  subjects: CatalogSubject[];
}

interface CatalogCareer {
  code: string;
  name: string;
  semesters: CatalogSemester[];
}

interface ScheduleCatalog {
  sourceFile: string;
  rowCount: number;
  careerCount: number;
  careers: CatalogCareer[];
}

interface SubjectItem {
  key: string;
  semester: number;
  subject: CatalogSubject;
}

const days = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

const stepLabels = [
  'Carrera',
  'Materias',
  'Secciones',
  'Vista final',
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function sameText(a: string, b: string) {
  return normalize(a).trim() === normalize(b).trim();
}

function subjectKey(careerCode: string, semester: number, subjectName: string) {
  return `${careerCode}::${semester}::${subjectName}`;
}

function formatTurn(turn: string) {
  const turns: Record<string, string> = {
    M: 'Manana',
    T: 'Tarde',
    N: 'Noche',
  };

  return turns[turn] ?? turn;
}

export default function SchedulePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDay, setSelectedDay] = useState('Lunes');

  const [catalog, setCatalog] = useState<ScheduleCatalog | null>(null);
  const [selectedCareerCode, setSelectedCareerCode] = useState('');
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<string[]>([]);
  const [sectionBySubject, setSectionBySubject] = useState<Record<string, string>>(
    {},
  );
  const [expandedSemesters, setExpandedSemesters] = useState<number[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const fetchData = useCallback(async () => {
    const [schedulesResponse, subjectsResponse] = await Promise.all([
      api.get('/academic/schedules'),
      api.get('/academic/subjects'),
    ]);

    setSchedules(schedulesResponse.data);
    setSubjects(subjectsResponse.data);
  }, []);

  useEffect(() => {
    fetchData().catch((error) => console.error(error));
  }, [fetchData]);

  const selectedCareer = useMemo(() => {
    return (
      catalog?.careers.find((career) => career.code === selectedCareerCode) ??
      null
    );
  }, [catalog, selectedCareerCode]);

  const allSubjectItems = useMemo<SubjectItem[]>(() => {
    if (!selectedCareer) return [];

    return selectedCareer.semesters.flatMap((semester) =>
      semester.subjects.map((subject) => ({
        key: subjectKey(selectedCareer.code, semester.number, subject.name),
        semester: semester.number,
        subject,
      })),
    );
  }, [selectedCareer]);

  const selectedSubjectItems = useMemo(() => {
    return allSubjectItems.filter((item) => selectedSubjectKeys.includes(item.key));
  }, [allSubjectItems, selectedSubjectKeys]);

  const selectedSections = useMemo(() => {
    return selectedSubjectItems.flatMap((item) => {
      const section = item.subject.sections.find(
        (sectionOption) => sectionOption.id === sectionBySubject[item.key],
      );

      return section
        ? [
            {
              ...item,
              section,
            },
          ]
        : [];
    });
  }, [selectedSubjectItems, sectionBySubject]);

  const previewBlocks = useMemo(() => {
    return selectedSections.flatMap((item) =>
      item.section.schedule.map((block) => ({
        ...block,
        subjectName: item.subject.name,
        sectionName: item.section.name,
        teacher: item.section.teacher,
      })),
    );
  }, [selectedSections]);

  const filteredSchedules = useMemo(() => {
    return schedules
      .filter((schedule) => sameText(schedule.day, selectedDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules, selectedDay]);

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  async function handleExcelChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;

    await importScheduleCatalog(file);
  }

  async function importScheduleCatalog(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      alert('Selecciona un archivo Excel valido');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setImporting(true);
      setStatus('Leyendo el Excel...');

      const response = await api.post<ScheduleCatalog>(
        '/imports/schedule-catalog',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      const newCatalog = response.data;
      const firstCareer = newCatalog.careers[0];

      setCatalog(newCatalog);
      setSelectedCareerCode(firstCareer?.code ?? '');
      setSelectedSubjectKeys([]);
      setSectionBySubject({});
      setExpandedSemesters(firstCareer?.semesters.slice(0, 2).map((item) => item.number) ?? []);
      setWizardOpen(true);
      setStep(1);
      setStatus(
        `Excel actualizado: ${newCatalog.careerCount} carreras y ${newCatalog.rowCount} secciones detectadas.`,
      );
    } catch (error) {
      console.error('Error importing schedule catalog:', error);
      setStatus('');
      alert('No pude leer el Excel de horario');
    } finally {
      setImporting(false);
    }
  }

  function startWizard() {
    setWizardOpen(true);

    if (!catalog) {
      setStep(1);
      return;
    }

    if (!selectedCareerCode && catalog.careers[0]) {
      setSelectedCareerCode(catalog.careers[0].code);
    }
  }

  function selectCareer(career: CatalogCareer) {
    setSelectedCareerCode(career.code);
    setSelectedSubjectKeys([]);
    setSectionBySubject({});
    setExpandedSemesters(career.semesters.slice(0, 2).map((item) => item.number));
    setStep(2);
  }

  function toggleSemester(number: number) {
    setExpandedSemesters((current) =>
      current.includes(number)
        ? current.filter((item) => item !== number)
        : [...current, number],
    );
  }

  function toggleSubject(item: SubjectItem) {
    setSelectedSubjectKeys((current) => {
      if (current.includes(item.key)) {
        setSectionBySubject((sections) => {
          const next = { ...sections };
          delete next[item.key];
          return next;
        });

        return current.filter((key) => key !== item.key);
      }

      return [...current, item.key];
    });
  }

  function continueToSections() {
    if (selectedSubjectItems.length === 0) {
      alert('Selecciona al menos una materia');
      return;
    }

    setSectionBySubject((current) => {
      const next = { ...current };

      selectedSubjectItems.forEach((item) => {
        if (!next[item.key] && item.subject.sections[0]) {
          next[item.key] = item.subject.sections[0].id;
        }
      });

      return next;
    });

    setStep(3);
  }

  function continueToPreview() {
    const missingSection = selectedSubjectItems.find(
      (item) => !sectionBySubject[item.key],
    );

    if (missingSection) {
      alert(`Falta elegir seccion para ${missingSection.subject.name}`);
      return;
    }

    setStep(4);
  }

  async function saveWizardSchedule() {
    if (selectedSections.length === 0) {
      alert('No hay secciones seleccionadas');
      return;
    }

    try {
      setSaving(true);

      let currentSubjects = [...subjects];
      let currentSchedules = [...schedules];
      let savedBlocks = 0;
      let syncedExams = 0;

      for (const item of selectedSections) {
        let subject = currentSubjects.find((candidate) =>
          sameText(candidate.name, item.subject.name),
        );

        if (!subject) {
          const createdSubject = await api.post<Subject>('/academic/subjects', {
            name: item.subject.name,
            teacher: item.section.teacher,
          });

          subject = createdSubject.data;
          currentSubjects = [createdSubject.data, ...currentSubjects];
        }

        for (const block of item.section.schedule) {
          if (!block.startTime || !block.endTime) continue;

          const exists = currentSchedules.some(
            (schedule) =>
              sameText(schedule.subject?.name ?? '', subject.name) &&
              sameText(schedule.day, block.day) &&
              schedule.startTime === block.startTime &&
              schedule.endTime === block.endTime,
          );

          if (exists) continue;

          const createdSchedule = await api.post<Schedule>('/academic/schedules', {
            day: block.day,
            startTime: block.startTime,
            endTime: block.endTime,
            subjectId: subject.id,
          });

          currentSchedules = [createdSchedule.data, ...currentSchedules];
          savedBlocks++;
        }

        for (const exam of item.section.exams ?? []) {
          await api.post('/academic/exams', {
            title: exam.title,
            description: [
              `Seccion ${item.section.name}`,
              item.section.teacher,
              exam.room ? `Aula ${exam.room}` : '',
            ]
              .filter(Boolean)
              .join(' - '),
            date: exam.date,
            subjectId: subject.id,
          });

          syncedExams++;
        }
      }

      await fetchData();
      setWizardOpen(false);
      setStatus(
        savedBlocks > 0 || syncedExams > 0
          ? `Horario guardado: ${savedBlocks} bloque(s) y ${syncedExams} fecha(s) de examen sincronizada(s).`
          : 'Esta seleccion ya estaba guardada.',
      );
    } catch (error) {
      console.error('Error saving generated schedule:', error);
      alert('No pude guardar el horario');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(id: string) {
    try {
      await api.delete(`/academic/schedules/${id}`);
      await fetchData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Error al eliminar horario');
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[var(--edu-bg)] text-slate-700 lg:min-h-[calc(100vh-80px)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelChange}
        className="hidden"
      />

      <div className="edu-topbar shadow-sm">
        <div className="flex min-h-20 flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/15 text-white">
              <CalendarDays size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-cyan-50">
                Panel semanal
              </p>
              <h1 className="text-2xl font-semibold">Horario</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            {catalog && (
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm text-white">
                {catalog.careerCount} carreras cargadas
              </span>
            )}

            <button
              onClick={openFileDialog}
              disabled={importing}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--edu-primary)] shadow-sm disabled:opacity-60"
            >
              {importing ? 'Leyendo Excel...' : 'Actualizar Excel'}
            </button>
          </div>
        </div>

        <div className="edu-mobile-scroll flex gap-2 overflow-x-auto px-4 pb-4 sm:flex-wrap">
          {days.map((dayOption) => (
            <button
              key={dayOption}
              onClick={() => setSelectedDay(dayOption)}
              className={`shrink-0 rounded-lg px-5 py-2 transition ${
                selectedDay === dayOption
                  ? 'bg-white text-[var(--edu-primary)]'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {dayOption}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="edu-card p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
                  {selectedDay}
                </p>
                <h2 className="text-2xl font-semibold text-slate-800">
                  Clases guardadas
                </h2>
              </div>

              <button
                onClick={startWizard}
                className="edu-button inline-flex items-center justify-center gap-2 px-5 py-3"
              >
                <Upload size={18} />
                Cargar horario
              </button>
            </div>

            <div key={selectedDay} className="edu-day-panel">
              {filteredSchedules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-6 text-sm text-slate-600">
                  No hay clases para {selectedDay.toLowerCase()}. Carga el Excel y
                  EduAI te ayuda a construir tu horario.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-[var(--edu-border)] bg-white">
                  {filteredSchedules.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className="edu-schedule-item flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"
                      style={{
                        animationDelay: `${index * 45}ms`,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-bold text-white">
                          {schedule.subject.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--edu-primary)]">
                            {schedule.subject.name}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {schedule.startTime} a {schedule.endTime}
                          </p>
                          {schedule.subject.teacher && (
                            <p className="mt-1 text-xs text-slate-500">
                              {schedule.subject.teacher}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="edu-card p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <FileSpreadsheet size={23} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Excel del periodo
                </h2>
                <p className="text-sm text-slate-500">
                  Importa el archivo oficial y arma tu horario desde sus
                  carreras, semestres y secciones.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={openFileDialog}
                disabled={importing}
                className="edu-button flex w-full items-center justify-center gap-2 px-5 py-3 disabled:opacity-60"
              >
                <RefreshCw size={18} />
                Actualizar Excel horario
              </button>

              <button
                onClick={startWizard}
                className="edu-button-secondary flex w-full items-center justify-center gap-2 px-5 py-3"
              >
                <CalendarDays size={18} />
                Cargar horario
              </button>
            </div>

            {status && (
              <p className="mt-4 rounded-lg bg-[var(--edu-surface-soft)] p-3 text-sm text-slate-600">
                {status}
              </p>
            )}

            {catalog && (
              <div className="mt-5 rounded-lg border border-[var(--edu-border)] p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">
                  {catalog.sourceFile}
                </p>
                <p className="mt-1">
                  {catalog.rowCount} secciones listas para elegir.
                </p>
              </div>
            )}
          </aside>
        </div>

        {wizardOpen && (
          <section className="edu-card mt-6 overflow-hidden">
            <div className="border-b border-[var(--edu-border)] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
                    Asistente de horario
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-800">
                    Cargar horario desde Excel
                  </h2>
                </div>

                <button
                  onClick={() => setWizardOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-4">
                {stepLabels.map((label, index) => (
                  <StepPill
                    key={label}
                    label={label}
                    number={index + 1}
                    active={step === index + 1}
                    done={step > index + 1}
                  />
                ))}
              </div>
            </div>

            <div className="p-5">
              {step === 1 && (
                <CareerStep
                  catalog={catalog}
                  importing={importing}
                  selectedCareerCode={selectedCareerCode}
                  onImport={openFileDialog}
                  onSelectCareer={selectCareer}
                />
              )}

              {step === 2 && selectedCareer && (
                <SubjectsStep
                  career={selectedCareer}
                  expandedSemesters={expandedSemesters}
                  selectedSubjectKeys={selectedSubjectKeys}
                  onBack={() => setStep(1)}
                  onContinue={continueToSections}
                  onToggleSemester={toggleSemester}
                  onToggleSubject={toggleSubject}
                />
              )}

              {step === 3 && (
                <SectionsStep
                  subjects={selectedSubjectItems}
                  sectionBySubject={sectionBySubject}
                  onBack={() => setStep(2)}
                  onContinue={continueToPreview}
                  onSelectSection={(key, sectionId) =>
                    setSectionBySubject((current) => ({
                      ...current,
                      [key]: sectionId,
                    }))
                  }
                />
              )}

              {step === 4 && (
                <PreviewStep
                  blocks={previewBlocks}
                  saving={saving}
                  onBack={() => setStep(3)}
                  onSave={saveWizardSchedule}
                />
              )}
            </div>
          </section>
        )}
      </main>

    </div>
  );
}

function CareerStep({
  catalog,
  importing,
  selectedCareerCode,
  onImport,
  onSelectCareer,
}: {
  catalog: ScheduleCatalog | null;
  importing: boolean;
  selectedCareerCode: string;
  onImport: () => void;
  onSelectCareer: (career: CatalogCareer) => void;
}) {
  if (!catalog) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-dashed border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-6">
          <h3 className="text-xl font-semibold text-slate-800">
            Primero carga el Excel de horarios
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            EduAI va a leer las carreras, semestres, materias, docentes y
            bloques de clases para que no tengas que cargar todo a mano.
          </p>
        </div>

        <button
          onClick={onImport}
          disabled={importing}
          className="edu-button flex items-center justify-center gap-2 px-5 py-4 disabled:opacity-60"
        >
          <FileSpreadsheet size={20} />
          {importing ? 'Leyendo Excel...' : 'Seleccionar Excel'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">
            Selecciona tu carrera
          </h3>
          <p className="text-sm text-slate-500">
            Las carreras vienen del Excel cargado.
          </p>
        </div>

        <button
          onClick={onImport}
          className="edu-button-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <RefreshCw size={17} />
          Cambiar Excel
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {catalog.careers.map((career) => {
          const active = selectedCareerCode === career.code;
          const subjectCount = career.semesters.reduce(
            (total, semester) => total + semester.subjects.length,
            0,
          );

          return (
            <button
              key={career.code}
              onClick={() => onSelectCareer(career)}
              className={`rounded-lg border p-4 text-left transition ${
                active
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-[var(--edu-border)] bg-white hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-600 text-sm font-bold text-white">
                  {career.code.slice(0, 3)}
                </div>
                {active && <Check className="text-blue-700" size={20} />}
              </div>
              <h4 className="mt-4 font-semibold text-slate-800">
                {career.name}
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                {career.semesters.length} semestres - {subjectCount} materias
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubjectsStep({
  career,
  expandedSemesters,
  selectedSubjectKeys,
  onBack,
  onContinue,
  onToggleSemester,
  onToggleSubject,
}: {
  career: CatalogCareer;
  expandedSemesters: number[];
  selectedSubjectKeys: string[];
  onBack: () => void;
  onContinue: () => void;
  onToggleSemester: (number: number) => void;
  onToggleSubject: (item: SubjectItem) => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-slate-800">
          {career.name}
        </h3>
        <p className="text-sm text-slate-500">
          Abre un semestre y marca las materias que estas cursando.
        </p>
      </div>

      <div className="space-y-3">
        {career.semesters.map((semester) => {
          const open = expandedSemesters.includes(semester.number);
          const selectedCount = semester.subjects.filter((subject) =>
            selectedSubjectKeys.includes(
              subjectKey(career.code, semester.number, subject.name),
            ),
          ).length;

          return (
            <div
              key={semester.number}
              className="overflow-hidden rounded-lg border border-[var(--edu-border)] bg-white"
            >
              <button
                onClick={() => onToggleSemester(semester.number)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              >
                <div>
                  <h4 className="font-semibold text-slate-800">
                    Semestre {semester.number}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {selectedCount} de {semester.subjects.length} materias
                    seleccionadas
                  </p>
                </div>
                <ChevronDown
                  size={20}
                  className={`transition ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3 md:grid-cols-2">
                  {semester.subjects.map((subject) => {
                    const key = subjectKey(career.code, semester.number, subject.name);
                    const active = selectedSubjectKeys.includes(key);

                    return (
                      <button
                        key={key}
                        onClick={() =>
                          onToggleSubject({
                            key,
                            semester: semester.number,
                            subject,
                          })
                        }
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          active
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${
                            active
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {active && <Check size={14} />}
                        </span>
                        <span>
                          <span className="block font-medium">{subject.name}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {subject.sections.length} seccion(es)
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <WizardActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Elegir secciones"
      />
    </div>
  );
}

function SectionsStep({
  subjects,
  sectionBySubject,
  onBack,
  onContinue,
  onSelectSection,
}: {
  subjects: SubjectItem[];
  sectionBySubject: Record<string, string>;
  onBack: () => void;
  onContinue: () => void;
  onSelectSection: (key: string, sectionId: string) => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-slate-800">
          Elige una seccion por materia
        </h3>
        <p className="text-sm text-slate-500">
          Aca ves docente, turno, plataforma y horarios disponibles.
        </p>
      </div>

      <div className="space-y-5">
        {subjects.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border border-[var(--edu-border)] bg-white p-4"
          >
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">
                  {item.subject.name}
                </h4>
                <p className="text-sm text-slate-500">
                  Semestre {item.semester}
                </p>
              </div>
              <span className="edu-chip">
                {item.subject.sections.length} opciones
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {item.subject.sections.map((section) => {
                const active = sectionBySubject[item.key] === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => onSelectSection(item.key, section.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      active
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="font-semibold text-slate-800">
                          Seccion {section.name}
                        </h5>
                        <p className="mt-1 text-sm text-slate-600">
                          {section.teacher}
                        </p>
                      </div>
                      {active && <Check className="text-blue-700" size={20} />}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {section.turn && (
                        <span className="rounded-full bg-white px-2 py-1 text-slate-600">
                          {formatTurn(section.turn)}
                        </span>
                      )}
                      {section.platform && (
                        <span className="rounded-full bg-white px-2 py-1 text-slate-600">
                          {section.platform}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      {section.schedule.length === 0 ? (
                        <p>Sin horario cargado en el Excel.</p>
                      ) : (
                        section.schedule.map((block) => (
                          <p key={`${section.id}-${block.day}-${block.time}`}>
                            {block.day}: {block.time}
                            {block.room ? ` - Aula ${block.room}` : ''}
                          </p>
                        ))
                      )}
                    </div>

                    {(section.exams ?? []).length > 0 && (
                      <div className="mt-4 rounded-lg bg-white p-3 text-xs text-slate-600">
                        <p className="mb-2 font-semibold text-slate-800">
                          Fechas de examenes
                        </p>
                        <div className="space-y-1">
                          {(section.exams ?? []).map((exam) => (
                            <p key={`${section.id}-${exam.title}`}>
                              {exam.title}: {exam.dateText}
                              {exam.time ? ` ${exam.time}` : ''}
                              {exam.room ? ` - Aula ${exam.room}` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <WizardActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Ver horario"
      />
    </div>
  );
}

function PreviewStep({
  blocks,
  saving,
  onBack,
  onSave,
}: {
  blocks: Array<
    CatalogBlock & {
      subjectName: string;
      sectionName: string;
      teacher: string;
    }
  >;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-slate-800">
          Vista final del horario
        </h3>
        <p className="text-sm text-slate-500">
          Si se ve bien, guardalo y aparecera en tu semana.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const dayBlocks = blocks
            .filter((block) => sameText(block.day, day))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={day}
              className="min-h-48 rounded-lg border border-[var(--edu-border)] bg-white p-4"
            >
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <Clock size={17} />
                {day}
              </h4>

              {dayBlocks.length === 0 ? (
                <p className="text-sm text-slate-500">Sin clases.</p>
              ) : (
                <div className="space-y-3">
                  {dayBlocks.map((block) => (
                    <div
                      key={`${day}-${block.subjectName}-${block.time}-${block.sectionName}`}
                      className="rounded-lg bg-[var(--edu-surface-soft)] p-3"
                    >
                      <p className="font-semibold text-[var(--edu-primary)]">
                        {block.subjectName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {block.time} - Seccion {block.sectionName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {block.teacher}
                        {block.room ? ` - Aula ${block.room}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-between">
        <button
          onClick={onBack}
          className="edu-button-secondary px-5 py-3"
        >
          Volver
        </button>

        <button
          onClick={onSave}
          disabled={saving}
          className="edu-button inline-flex items-center justify-center gap-2 px-5 py-3 disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar horario'}
        </button>
      </div>
    </div>
  );
}

function StepPill({
  label,
  number,
  active,
  done,
}: {
  label: string;
  number: number;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
        active
          ? 'border-blue-600 bg-blue-50 text-blue-800'
          : done
            ? 'border-teal-200 bg-teal-50 text-teal-800'
            : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
          done ? 'bg-teal-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-white'
        }`}
      >
        {done ? <Check size={15} /> : number}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function WizardActions({
  onBack,
  onContinue,
  continueLabel,
}: {
  onBack: () => void;
  onContinue: () => void;
  continueLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-between">
      <button
        onClick={onBack}
        className="edu-button-secondary px-5 py-3"
      >
        Volver
      </button>
      <button
        onClick={onContinue}
        className="edu-button px-5 py-3"
      >
        {continueLabel}
      </button>
    </div>
  );
}
