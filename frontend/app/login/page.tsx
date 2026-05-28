'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { api, getApiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

type AuthMode = 'login' | 'signup' | 'reset' | 'verify';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const modeIndex: Record<AuthMode, number> = {
  login: 0,
  signup: 1,
  reset: 2,
  verify: 3,
};

const authModes: Array<{
  mode: AuthMode;
  label: string;
}> = [
  {
    mode: 'login',
    label: 'Iniciar sesion',
  },
  {
    mode: 'signup',
    label: 'Crear cuenta',
  },
  {
    mode: 'reset',
    label: 'Recuperar',
  },
  {
    mode: 'verify',
    label: 'Verificar',
  },
];

const authModeCount = authModes.length;

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (mode === 'signup') return 'Crear cuenta';
    if (mode === 'reset') return 'Recuperar contrasena';
    if (mode === 'verify') return 'Verificar correo';
    return 'Iniciar sesion';
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === 'signup') {
      return 'Registrate con correo y contrasena, o entra directo con Google.';
    }

    if (mode === 'reset') {
      return 'Genera un token temporal y define una nueva contrasena.';
    }

    if (mode === 'verify') {
      return 'Pega el token recibido para activar tu cuenta.';
    }

    return 'Usa tu correo o continua con tu cuenta de Google.';
  }, [mode]);

  function clearFeedback() {
    setMessage('');
    setError('');
  }

  function switchMode(nextMode: AuthMode) {
    clearFeedback();
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setResetToken('');
    setNewPassword('');
    if (nextMode !== 'verify') {
      setVerificationToken('');
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setError('Completa email y contrasena.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      const response = await api.post('/auth/login', {
        email,
        password,
      });

      setToken(response.data.access_token);
      router.push('/dashboard');
    } catch (loginError) {
      setError(
        getApiErrorMessage(
          loginError,
          'No pude iniciar sesion. Revisa tus datos.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!name || !email || !password) {
      setError('Completa nombre, email y contrasena.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });

      setPassword('');
      setConfirmPassword('');
      setVerificationToken(response.data.verificationToken ?? '');
      setMode('verify');
      setMessage(
        response.data.verificationToken
          ? `Cuenta creada. Token de desarrollo: ${response.data.verificationToken}`
          : response.data.message,
      );
    } catch (signupError) {
      setError(
        getApiErrorMessage(
          signupError,
          'No pude crear la cuenta. Tal vez ese email ya existe.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset() {
    if (!email) {
      setError('Escribe tu email para generar el reinicio.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      const response = await api.post('/auth/password-reset/request', {
        email,
      });

      setResetToken(response.data.resetToken ?? '');
      setMessage(
        response.data.resetToken
          ? 'Token generado para desarrollo. Pegalo abajo y define una nueva contrasena.'
          : response.data.message,
      );
    } catch (resetError) {
      setError(
        getApiErrorMessage(
          resetError,
          'No pude generar el reinicio de contrasena.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestEmailVerification() {
    if (!email) {
      setError('Escribe tu email para reenviar la verificacion.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      const response = await api.post('/auth/email-verification/request', {
        email,
      });

      setVerificationToken(response.data.verificationToken ?? '');
      setMode('verify');
      setMessage(
        response.data.verificationToken
          ? `Token de desarrollo: ${response.data.verificationToken}`
          : response.data.message,
      );
    } catch (verificationError) {
      setError(
        getApiErrorMessage(
          verificationError,
          'No pude generar la verificacion de correo.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verificationToken) {
      setError('Pega el token de verificacion.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      const response = await api.post('/auth/email-verification/confirm', {
        token: verificationToken,
      });

      setVerificationToken('');
      setMode('login');
      setMessage(response.data.message ?? 'Correo verificado. Ya podes iniciar sesion.');
    } catch (verificationError) {
      setError(
        getApiErrorMessage(
          verificationError,
          'El token de verificacion no es valido o ya expiro.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetToken || !newPassword) {
      setError('Pega el token y escribe una nueva contrasena.');
      return;
    }

    try {
      setLoading(true);
      clearFeedback();

      await api.post('/auth/password-reset/confirm', {
        token: resetToken,
        password: newPassword,
      });

      setMessage('Contrasena actualizada. Ya podes iniciar sesion.');
      setPassword('');
      setNewPassword('');
      setResetToken('');
      setMode('login');
    } catch (resetError) {
      setError(
        getApiErrorMessage(resetError, 'El token no es valido o ya expiro.'),
      );
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) {
        setError('Google no devolvio credenciales.');
        return;
      }

      try {
        setLoading(true);
        clearFeedback();

        const loginResponse = await api.post('/auth/google', {
          credential: response.credential,
        });

        setToken(loginResponse.data.access_token);
        router.push('/dashboard');
      } catch (googleError) {
        setError(
          getApiErrorMessage(googleError, 'No pude iniciar con Google.'),
        );
      } finally {
        setLoading(false);
      }
    },
    [router, setToken],
  );

  useEffect(() => {
    if (!googleClientId) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    if (existingScript) {
      setGoogleReady(Boolean(window.google));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(Boolean(window.google));
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('verifyToken');

    if (!token) {
      return;
    }

    setVerificationToken(token);
    setMode('verify');
    setMessage('Detecte un token de verificacion en el enlace. Confirmalo para activar la cuenta.');
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleReady || !window.google || !googleButtonRef.current) {
      return;
    }

    googleButtonRef.current.innerHTML = '';

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'continue_with',
      shape: 'pill',
      width: Math.min(390, Math.max(280, googleButtonRef.current.clientWidth)),
    });
  }, [googleReady, handleGoogleCredential, mode]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#061632] px-3 py-5 text-[var(--edu-text)] sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(59,130,246,0.38),transparent_28rem),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.28),transparent_26rem),linear-gradient(135deg,#07142f_0%,#123985_48%,#0e7c75_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute left-6 top-20 h-24 w-24 rounded-3xl border border-white/20 bg-white/5 blur-[1px] sm:left-16" />
      <div className="absolute bottom-16 right-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <section className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-md sm:p-7 lg:min-h-[620px] lg:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
                <GraduationCap size={29} />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">EDUAI</h1>
                <p className="text-sm text-cyan-50/90">
                  Tu centro academico en un solo lugar
                </p>
              </div>
            </div>

            <div className="mt-8 lg:mt-20">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50">
                FPUNA + IA
              </span>
              <h2 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Organiza tu semestre con una cuenta academica inteligente.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-cyan-50/90 sm:text-base">
                Carga tu horario, consulta tus examenes, registra puntajes y usa
                EduAI como apoyo para PDFs y contexto academico.
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3 lg:mt-20 lg:grid-cols-1">
              {[
                'Horario desde Excel FPUNA',
                'Notas y examenes conectados',
                'Chat con PDFs y contexto propio',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-cyan-50"
                >
                  <CheckCircle2 size={18} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[520px] rounded-[1.75rem] border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-7 lg:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--edu-primary)]">
                  Acceso seguro
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {subtitle}
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 sm:grid">
                {mode === 'signup' ? <UserPlus size={24} /> : <ShieldCheck size={24} />}
              </div>
            </div>

            <div className="relative grid grid-cols-4 gap-1 overflow-hidden rounded-2xl bg-slate-100 p-1">
              <span
                className="absolute bottom-1 top-1 z-0 rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out"
                style={{
                  width: `calc((100% - ${(authModeCount - 1) * 0.25}rem) / ${authModeCount})`,
                  transform: `translateX(calc(${modeIndex[mode]} * (100% + 0.25rem)))`,
                }}
              />

              {authModes.map((authMode) => (
                <button
                  key={authMode.mode}
                  onClick={() => switchMode(authMode.mode)}
                  className={`relative z-10 rounded-xl px-2 py-2.5 text-[0.68rem] font-bold transition-colors duration-300 sm:text-sm ${
                    mode === authMode.mode
                      ? 'text-[var(--edu-primary)]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {authMode.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {googleClientId ? (
                <div
                  ref={googleButtonRef}
                  className="flex min-h-12 w-full justify-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
                />
              ) : (
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-400 shadow-sm"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-sm font-bold text-blue-600">
                    G
                  </span>
                  Continuar con Google
                </button>
              )}

              {!googleClientId && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Google esta listo en la interfaz. Solo falta configurar el
                  Client ID en las variables de entorno.
                </p>
              )}
            </div>

            <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <span>o usa tu correo</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-4">
              {mode === 'signup' && (
                <Field
                  label="Nombre"
                  value={name}
                  onChange={setName}
                  placeholder="Tu nombre"
                />
              )}

              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="tu@email.com"
                icon={<Mail size={18} />}
              />

              {mode !== 'reset' && mode !== 'verify' && (
                <Field
                  label="Contrasena"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  icon={<LockKeyhole size={18} />}
                />
              )}

              {mode === 'signup' && (
                <Field
                  label="Confirmar contrasena"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  type="password"
                  placeholder="Repite tu contrasena"
                />
              )}

              {mode === 'reset' && (
                <div className="grid gap-4">
                  <button
                    onClick={handleRequestReset}
                    disabled={loading}
                    className="edu-button w-full px-5 py-3 disabled:opacity-60"
                  >
                    Generar token de recuperacion
                  </button>

                  <Field
                    label="Token de recuperacion"
                    value={resetToken}
                    onChange={setResetToken}
                    placeholder="Pega el token generado"
                  />

                  <Field
                    label="Nueva contrasena"
                    value={newPassword}
                    onChange={setNewPassword}
                    type="password"
                    placeholder="Minimo 6 caracteres"
                  />
                </div>
              )}

              {mode === 'verify' && (
                <div className="grid gap-4">
                  <Field
                    label="Token de verificacion"
                    value={verificationToken}
                    onChange={setVerificationToken}
                    placeholder="Pega el token recibido por correo"
                  />

                  <button
                    onClick={handleRequestEmailVerification}
                    disabled={loading}
                    className="edu-button-secondary w-full px-5 py-3 disabled:opacity-60"
                  >
                    Reenviar verificacion
                  </button>
                </div>
              )}
            </div>

            {message && (
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6">
              {mode === 'login' && (
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="edu-button flex w-full items-center justify-center gap-2 px-5 py-3.5 text-base disabled:opacity-60"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  <ShieldCheck size={18} />
                  Iniciar sesion
                </button>
              )}

              {mode === 'signup' && (
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="edu-button flex w-full items-center justify-center gap-2 px-5 py-3.5 text-base disabled:opacity-60"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  <UserPlus size={18} />
                  Crear cuenta
                </button>
              )}

              {mode === 'reset' && (
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="edu-button flex w-full items-center justify-center gap-2 px-5 py-3.5 text-base disabled:opacity-60"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  Guardar nueva contrasena
                </button>
              )}

              {mode === 'verify' && (
                <button
                  onClick={handleVerifyEmail}
                  disabled={loading}
                  className="edu-button flex w-full items-center justify-center gap-2 px-5 py-3.5 text-base disabled:opacity-60"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  <MailCheck size={18} />
                  Verificar correo
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`edu-input ${icon ? 'pl-10' : ''}`}
        />
      </span>
    </label>
  );
}
