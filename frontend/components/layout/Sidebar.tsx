'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

import {
  LayoutDashboard,
  Bot,
  CalendarDays,
  GraduationCap,
  BarChart3,
  Calculator,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

const baseLinks = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },

  {
    href: '/schedule',
    label: 'Horario',
    icon: CalendarDays,
  },

  {
    href: '/exams',
    label: 'Examenes',
    icon: GraduationCap,
  },

  {
    href: '/grades',
    label: 'Notas',
    icon: BarChart3,
  },

  {
    href: '/simulator',
    label: 'Simulador',
    icon: Calculator,
  },

  {
    href: '/profile',
    label: 'Perfil',
    icon: UserRound,
  },

  {
    href: '/ai-chat',
    label: 'EduAI Chat',
    icon: Bot,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setRole(null);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => setRole(response.data.role))
      .catch(() => setRole(null));
  }, [token]);

  const links = useMemo(() => {
    if (role !== 'ADMIN') return baseLinks;

    return [
      ...baseLinks,
      {
        href: '/admin',
        label: 'Admin',
        icon: ShieldCheck,
      },
    ];
  }, [role]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <>
      <aside className="sticky top-0 hidden min-h-screen w-64 shrink-0 flex-col self-stretch overflow-y-auto bg-[linear-gradient(180deg,#020617_0%,#071426_54%,#06141f_100%)] px-4 py-5 text-white shadow-2xl lg:flex">
        <div className="mb-5 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-950/30">
              <GraduationCap size={27} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-wide">
                EDUAI
              </h1>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {links.map((link) => {
            const Icon = link.icon;

            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative flex items-center gap-3 rounded-lg p-3 transition ${
                  active
                    ? 'bg-white text-slate-950 shadow-lg shadow-black/15'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                )}
                <Icon
                  size={22}
                  className={active ? 'text-blue-700' : 'text-slate-300 group-hover:text-white'}
                />

                <span className="font-medium">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-slate-300 transition hover:bg-white/8 hover:text-white"
          >
            <LogOut size={22} />
            <span className="font-medium">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:hidden">
        <div className="edu-mobile-scroll mx-auto flex max-w-screen-sm items-center gap-1 overflow-x-auto px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                className={`flex min-w-[4.8rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[0.7rem] font-semibold transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon size={21} />
                <span className="max-w-[4.2rem] truncate">{link.label}</span>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            aria-label="Cerrar sesion"
            className="flex min-w-[4.8rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[0.7rem] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={21} />
            <span className="max-w-[4.2rem] truncate">Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
