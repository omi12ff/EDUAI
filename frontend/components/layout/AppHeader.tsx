'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

interface Profile {
  name: string;
  email: string;
  role: string;
}

export function AppHeader() {
  const token = useAuthStore((state) => state.token);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationState, setNotificationState] =
    useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => setProfile(response.data))
      .catch(() => setProfile(null));
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }

    setNotificationState(Notification.permission);
  }, []);

  const initials = useMemo(() => {
    if (!profile?.name) return 'ED';

    return profile.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile]);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationState(permission);

    if (permission !== 'granted') {
      return;
    }

    const registration = await navigator.serviceWorker?.getRegistration();

    if (registration?.showNotification) {
      registration.showNotification('EduAI listo', {
        body: 'Los recordatorios quedan habilitados en este dispositivo.',
        icon: '/icon.svg',
      });
    } else {
      new Notification('EduAI listo', {
        body: 'Los recordatorios quedan habilitados en este dispositivo.',
        icon: '/icon.svg',
      });
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/88 px-4 shadow-sm backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
      <div>
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">
          Panel academico integrado
        </p>
        <h2 className="text-base font-bold tracking-wide text-slate-800 sm:text-lg">
          EDUAI
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {notificationState !== 'unsupported' && notificationState !== 'granted' && (
          <button
            onClick={enableNotifications}
            className="hidden items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 lg:inline-flex"
          >
            <Bell size={17} />
            Activar recordatorios
          </button>
        )}

        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-full border border-transparent px-2 py-1 transition hover:border-slate-200 hover:bg-slate-50"
        >
          <div className="hidden text-right text-sm sm:block">
            <p className="font-semibold text-slate-700">
              {profile?.name ?? 'Estudiante'}
            </p>
            <p className="text-xs uppercase text-slate-500">
              {profile?.role ?? 'STUDENT'}
            </p>
          </div>

          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-teal-600 text-sm font-bold text-white shadow-sm">
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}
