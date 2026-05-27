'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, RefreshCw, ShieldCheck, Unlock, UsersRound } from 'lucide-react';

import { api } from '@/services/api';

type Role = 'ADMIN' | 'STUDENT';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  country: string;
  city: string;
  campus: string;
  career: string | null;
  lastLoginAt: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count: {
    subjects: number;
    assignments: number;
    grades: number;
    chatHistory: number;
  };
}

const roles: Role[] = ['STUDENT', 'ADMIN'];

function formatDate(value: string | null) {
  if (!value) return 'Sin acceso';
  return new Date(value).toLocaleString('es-PY');
}

function roleLabel(role: Role) {
  if (role === 'ADMIN') return 'Admin';
  return 'Estudiante';
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (loadError) {
      console.error(loadError);
      setError('No pude abrir el panel admin. Tu cuenta necesita rol ADMIN.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      return [user.name, user.email, user.career ?? '', user.role]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, users]);

  async function updateRole(user: AdminUser, role: Role) {
    if (user.role === role) return;

    try {
      setBusyId(user.id);
      setMessage('');
      setError('');

      const response = await api.patch(`/admin/users/${user.id}/role`, {
        role,
      });

      replaceUser(response.data);
      setMessage(`${user.name} ahora tiene rol ${roleLabel(role)}.`);
    } catch (roleError) {
      console.error(roleError);
      setError('No pude cambiar ese rol.');
    } finally {
      setBusyId(null);
    }
  }

  async function banUser(user: AdminUser) {
    const reason = window.prompt(
      `Motivo para bloquear a ${user.name}:`,
      user.bannedReason ?? '',
    );

    if (reason === null) return;

    try {
      setBusyId(user.id);
      setMessage('');
      setError('');

      const response = await api.patch(`/admin/users/${user.id}/ban`, {
        reason,
      });

      replaceUser(response.data);
      setMessage(`${user.name} fue bloqueado.`);
    } catch (banError) {
      console.error(banError);
      setError('No pude bloquear esa cuenta.');
    } finally {
      setBusyId(null);
    }
  }

  async function unbanUser(user: AdminUser) {
    try {
      setBusyId(user.id);
      setMessage('');
      setError('');

      const response = await api.patch(`/admin/users/${user.id}/unban`);

      replaceUser(response.data);
      setMessage(`${user.name} fue reactivado.`);
    } catch (unbanError) {
      console.error(unbanError);
      setError('No pude reactivar esa cuenta.');
    } finally {
      setBusyId(null);
    }
  }

  function replaceUser(nextUser: AdminUser) {
    setUsers((current) =>
      current.map((user) => (user.id === nextUser.id ? nextUser : user)),
    );
  }

  if (loading) {
    return <div className="edu-page">Cargando administracion...</div>;
  }

  return (
    <div className="edu-page">
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--edu-text)] sm:text-4xl">
            Control de usuarios
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--edu-muted)]">
            Administra accesos, roles y bloqueos. Los cambios de rol se aplican
            desde el backend en la siguiente peticion del usuario.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="edu-button-secondary inline-flex items-center justify-center gap-2 px-5 py-3"
        >
          <RefreshCw size={18} />
          Actualizar
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

      <section className="edu-card mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-teal-600 text-white">
              <UsersRound size={25} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {users.length} cuentas registradas
              </h2>
              <p className="text-sm text-slate-500">
                {users.filter((user) => user.bannedAt).length} bloqueadas
              </p>
            </div>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, email, carrera o rol"
            className="edu-input w-full lg:max-w-xl"
          />
        </div>
      </section>

      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <article key={user.id} className="edu-card p-5">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.8fr] xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      user.bannedAt
                        ? 'bg-red-50 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {user.bannedAt ? 'Bloqueado' : 'Activo'}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                    {roleLabel(user.role)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      user.emailVerifiedAt
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {user.emailVerifiedAt ? 'Email verificado' : 'Sin verificar'}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.career || 'Carrera sin definir'} - {user.campus}
                </p>
                {user.bannedReason && (
                  <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                    {user.bannedReason}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-2">
                <MiniStat label="Materias" value={user._count.subjects} />
                <MiniStat label="Tareas" value={user._count.assignments} />
                <MiniStat label="Notas" value={user._count.grades} />
                <MiniStat label="Chat" value={user._count.chatHistory} />
              </div>

              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                    Rol
                  </span>
                  <select
                    value={user.role}
                    onChange={(event) => updateRole(user, event.target.value as Role)}
                    disabled={busyId === user.id}
                    className="edu-input"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  {user.bannedAt ? (
                    <button
                      onClick={() => unbanUser(user)}
                      disabled={busyId === user.id}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <Unlock size={17} />
                      Reactivar
                    </button>
                  ) : (
                    <button
                      onClick={() => banUser(user)}
                      disabled={busyId === user.id}
                      className="inline-flex items-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <Ban size={17} />
                      Banear
                    </button>
                  )}

                  <span className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-4 py-2 text-sm text-slate-600">
                    <ShieldCheck size={17} />
                    Ultimo acceso: {formatDate(user.lastLoginAt)}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredUsers.length === 0 && !error && (
        <p className="edu-card p-5 text-sm text-[var(--edu-muted)]">
          No hay usuarios que coincidan con la busqueda.
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}
