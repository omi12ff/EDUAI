'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Save, UserRound } from 'lucide-react';

import { api } from '@/services/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  country: string;
  city: string;
  timeZone: string;
  campus: string;
  career: string | null;
  lastLoginAt: string | null;
  bannedAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count: {
    subjects: number;
    assignments: number;
    grades: number;
  };
}

interface Subject {
  id: string;
  name: string;
  teacher: string;
}

interface Career {
  id: string;
  code: string | null;
  name: string;
}

interface ProfileForm {
  name: string;
  country: string;
  city: string;
  timeZone: string;
  campus: string;
  career: string;
}

const fieldGroups = [
  {
    title: 'Datos personales',
    fields: [
      { key: 'name', label: 'Nombre completo' },
      { key: 'country', label: 'Pais' },
      { key: 'city', label: 'Ciudad' },
    ],
  },
  {
    title: 'Datos academicos',
    fields: [
      { key: 'campus', label: 'Sede' },
      { key: 'career', label: 'Carrera' },
      { key: 'timeZone', label: 'Zona horaria' },
    ],
  },
] as const;

function formatDate(value: string | null) {
  if (!value) return 'Sin registro';
  return new Date(value).toLocaleString('es-PY');
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    country: '',
    city: '',
    timeZone: '',
    campus: '',
    career: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    const [profileResponse, subjectsResponse, careersResponse] = await Promise.all([
      api.get('/auth/me'),
      api.get('/academic/subjects'),
      api.get('/imports/careers'),
    ]);

    const nextProfile = profileResponse.data as Profile;
    setProfile(nextProfile);
    setSubjects(subjectsResponse.data);
    setCareers(careersResponse.data);
    setForm({
      name: nextProfile.name ?? '',
      country: nextProfile.country ?? '',
      city: nextProfile.city ?? '',
      timeZone: nextProfile.timeZone ?? '',
      campus: nextProfile.campus ?? '',
      career: nextProfile.career ?? '',
    });
  }, []);

  useEffect(() => {
    loadProfile()
      .catch((profileError) => {
        console.error(profileError);
        setError('No pude cargar tu perfil.');
      })
      .finally(() => setLoading(false));
  }, [loadProfile]);

  const roleLabel = useMemo(() => {
    if (profile?.role === 'ADMIN') return 'Administrador';
    return 'Estudiante';
  }, [profile?.role]);

  const careerOptions = useMemo(() => {
    if (!form.career || careers.some((career) => career.name === form.career)) {
      return careers;
    }

    return [
      {
        id: 'selected-career',
        code: null,
        name: form.career,
      },
      ...careers,
    ];
  }, [careers, form.career]);

  async function saveProfile() {
    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await api.patch('/auth/profile', form);
      setProfile(response.data);
      setMessage('Perfil actualizado.');
    } catch (saveError) {
      console.error(saveError);
      setError('No pude guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof ProfileForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  if (loading) {
    return <div className="edu-page">Cargando perfil...</div>;
  }

  return (
    <div className="edu-page">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
            Perfil
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--edu-text)] sm:text-4xl">
            Tu informacion academica
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--edu-muted)]">
            Estos datos ayudan a EduAI a personalizar horarios, materias y
            respuestas sin mezclar tu informacion con la de otros usuarios.
          </p>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="edu-button inline-flex items-center justify-center gap-2 px-5 py-3 disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>

      {message && (
        <p className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}

      {error && (
        <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="edu-card p-6">
          <div className="mb-6 flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-teal-600 text-white">
              <UserRound size={28} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {profile?.name ?? 'Estudiante'}
              </h2>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            <InfoRow label="Estado" value={profile?.bannedAt ? 'Bloqueado' : 'Activo'} />
            <InfoRow
              label="Correo"
              value={profile?.emailVerifiedAt ? 'Verificado' : 'Pendiente'}
            />
            <InfoRow label="Ultimo acceso" value={formatDate(profile?.lastLoginAt ?? null)} />
            <InfoRow label="Cuenta creada" value={formatDate(profile?.createdAt ?? null)} />
          </div>
        </section>

        <section className="edu-card p-6">
          <h2 className="mb-5 text-xl font-bold text-slate-800">
            Editar datos
          </h2>

          <div className="grid gap-6 lg:grid-cols-2">
            {fieldGroups.map((group) => (
              <div key={group.title} className="space-y-4">
                <h3 className="text-sm font-bold uppercase text-slate-500">
                  {group.title}
                </h3>

                {group.fields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      {field.label}
                    </span>

                    {field.key === 'career' ? (
                      <select
                        value={form.career}
                        onChange={(event) => updateField('career', event.target.value)}
                        className="edu-input"
                      >
                        <option value="">Selecciona tu carrera</option>
                        {careerOptions.map((career) => (
                          <option key={career.id} value={career.name}>
                            {career.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form[field.key]}
                        onChange={(event) =>
                          updateField(field.key, event.target.value)
                        }
                        className="edu-input"
                      />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>

          {careers.length === 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              Todavia no hay carreras cargadas en la base. Importa el Excel de
              horarios para llenar esta lista.
            </p>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ProfileMetric
          icon={<BookOpen size={24} />}
          label="Materias propias"
          value={profile?._count.subjects ?? 0}
        />
        <ProfileMetric
          icon={<Clock size={24} />}
          label="Pendientes"
          value={profile?._count.assignments ?? 0}
        />
        <ProfileMetric
          icon={<CheckCircle2 size={24} />}
          label="Notas cargadas"
          value={profile?._count.grades ?? 0}
        />
      </div>

      <section className="edu-card mt-5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <BookOpen className="text-blue-700" size={22} />
          <h2 className="text-xl font-bold text-slate-800">
            Materias vinculadas
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="rounded-md border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4"
            >
              <h3 className="font-semibold text-slate-800">{subject.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {subject.teacher || 'Profesor por definir'}
              </p>
            </div>
          ))}
        </div>

        {subjects.length === 0 && (
          <p className="rounded-md border border-[var(--edu-border)] p-4 text-sm text-[var(--edu-muted)]">
            Todavia no cargaste materias para esta cuenta.
          </p>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="edu-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-blue-700">{icon}</div>
      </div>
    </div>
  );
}
