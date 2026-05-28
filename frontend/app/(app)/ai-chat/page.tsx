'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Upload, XCircle } from 'lucide-react';

import { api, getApiErrorMessage, isUnauthorizedError } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: AiAction;
  actionState?: 'pending' | 'confirmed' | 'cancelled';
}

interface GradeActionPayload {
  title: string;
  type: 'PARCIAL' | 'RECUPERATORIO' | 'FINAL';
  score: number;
  maxScore: number;
  notes?: string;
  subjectId: string;
  examId?: string | null;
}

interface AiAction {
  id: string;
  type: 'CREATE_GRADE';
  label: string;
  payload: GradeActionPayload;
}

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    'Hola, soy EduAI. Puedo ayudarte con materias, examenes, notas y responder preguntas sobre los PDFs que subas aca.',
};

export default function AiChatPage() {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const handleUnauthorized = useCallback((error: unknown) => {
    if (!isUnauthorizedError(error)) {
      return false;
    }

    logout();
    setMessages([
      {
        role: 'assistant',
        content:
          'Tu sesion expiro. Volve a iniciar sesion para cargar el historial y seguir usando EduAI.',
      },
    ]);

    return true;
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setHistoryLoading(false);
      return;
    }

    api
      .get('/ai/history')
      .then((response) => {
        const history = response.data as Array<{
          role: 'user' | 'assistant';
          message: string;
        }>;

        setMessages(
          history.length > 0
            ? history.map((item) => ({
                role: item.role,
                content: item.message,
              }))
            : [welcomeMessage],
        );
      })
      .catch((error) => {
        if (!handleUnauthorized(error)) {
          setMessages([welcomeMessage]);
        }
      })
      .finally(() => setHistoryLoading(false));
  }, [handleUnauthorized, token]);

  async function sendMessage() {
    if (!message.trim() || loading) return;

    const currentMessage = message;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: currentMessage,
      },
    ]);
    setMessage('');

    try {
      setLoading(true);

      const response = await api.post('/ai/chat', {
        message: currentMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.response,
          action: response.data.action,
          actionState: response.data.action ? 'pending' : undefined,
        },
      ]);
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: getApiErrorMessage(
            error,
            'Ocurrio un error al procesar tu mensaje.',
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPdf(file: File | undefined) {
    if (!file || uploading) return;

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);

      await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: `Subi el PDF: ${file.name}`,
        },
        {
          role: 'assistant',
          content:
            'PDF cargado. Ya puedo usarlo como contexto cuando me preguntes sobre ese material.',
        },
      ]);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        alert(getApiErrorMessage(error, 'Error al subir PDF'));
      }
    } finally {
      setUploading(false);
    }
  }

  async function clearChat() {
    try {
      await api.delete('/ai/history');
      setMessages([
        {
          role: 'assistant',
          content: 'Chat reiniciado. Que queres estudiar ahora?',
        },
      ]);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        alert(getApiErrorMessage(error, 'No pude limpiar el historial del chat'));
      }
    }
  }

  async function confirmAction(action: AiAction) {
    try {
      setLoading(true);

      const response = await api.post('/ai/actions/grade', action.payload);

      setMessages((prev) =>
        prev.map((item) =>
          item.action?.id === action.id
            ? {
                ...item,
                actionState: 'confirmed',
              }
            : item,
        ),
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.response,
        },
      ]);
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: getApiErrorMessage(
            error,
            'No pude confirmar esa accion. Revisemos los datos e intentemos otra vez.',
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function cancelAction(action: AiAction) {
    setMessages((prev) =>
      prev.map((item) =>
        item.action?.id === action.id
          ? {
              ...item,
              actionState: 'cancelled',
            }
          : item,
      ),
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, loading]);

  return (
    <div className="flex min-h-[calc(100vh-64px-5.5rem)] flex-col bg-[var(--edu-bg)] p-4 text-[var(--edu-text)] sm:p-6 lg:h-[calc(100vh-80px)] lg:p-8">
      <div className="mb-4 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
            Asistente academico
          </p>
          <h1 className="text-3xl font-bold text-[var(--edu-text)] sm:text-4xl">
            EduAI Chat
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <label className="edu-button-secondary inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-3 sm:px-5">
            <Upload size={18} />
            {uploading ? 'Subiendo...' : 'Subir PDF'}
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(event) => uploadPdf(event.target.files?.[0])}
              className="hidden"
            />
          </label>

          <button
            onClick={clearChat}
            className="rounded-xl bg-red-50 px-4 py-3 font-medium text-[var(--edu-danger)] transition hover:bg-red-100 sm:px-5"
          >
            Limpiar chat
          </button>
        </div>
      </div>

      <div className="edu-card mb-4 flex-1 overflow-y-auto p-4 sm:mb-6 sm:p-6">
        <div className="flex flex-col gap-5">
          {historyLoading ? (
            <div className="max-w-[92%] rounded-2xl border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4 text-[var(--edu-text)] shadow-lg sm:max-w-[80%] sm:p-5">
              Cargando historial...
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-[92%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg sm:max-w-[80%] sm:p-5 ${
                  msg.role === 'user'
                    ? 'ml-auto bg-gradient-to-br from-blue-600 to-teal-600 text-white'
                    : 'border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] text-[var(--edu-text)]'
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                  {msg.role === 'assistant' && <FileText size={14} />}
                  {msg.role === 'assistant' ? 'EduAI' : 'Vos'}
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.action && (
                  <ActionCard
                    action={msg.action}
                    state={msg.actionState ?? 'pending'}
                    loading={loading}
                    onConfirm={() => confirmAction(msg.action!)}
                    onCancel={() => cancelAction(msg.action!)}
                  />
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="max-w-[92%] rounded-2xl border border-[var(--edu-border)] bg-[var(--edu-surface-soft)] p-4 text-[var(--edu-text)] shadow-lg sm:max-w-[80%] sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-[var(--edu-primary)]" />
                <p>EduAI esta pensando...</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          placeholder="Preguntame sobre tus materias, examenes o PDFs..."
          className="edu-input flex-1 p-4 sm:p-5"
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="edu-button px-8 py-3 disabled:opacity-50 sm:py-0"
        >
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  state,
  loading,
  onConfirm,
  onCancel,
}: {
  action: AiAction;
  state: 'pending' | 'confirmed' | 'cancelled';
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const scoreLabel =
    action.payload.notes?.toLowerCase().includes('ausente')
      ? 'Ausente'
      : `${action.payload.score}/${action.payload.maxScore}`;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-[var(--edu-text)] shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--edu-primary)]">
            Accion pendiente
          </p>
          <h3 className="mt-1 font-semibold">{action.label}</h3>
          <p className="edu-muted mt-1 text-xs">
            Se guardara como {scoreLabel}. Confirmar evita que EduAI cambie datos
            por una frase ambigua.
          </p>
        </div>

        {state === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              <XCircle size={16} />
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              Confirmar
            </button>
          </div>
        )}
      </div>

      {state !== 'pending' && (
        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            state === 'confirmed'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {state === 'confirmed' ? 'Confirmado' : 'Cancelado'}
        </div>
      )}
    </div>
  );
}
