import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

function resolveApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const { hostname, protocol } = window.location;

  if (hostname.endsWith('.devtunnels.ms')) {
    return `${protocol}//${hostname.replace(/-\d+(\.[^.]+\.devtunnels\.ms)$/, '-3001$1')}`;
  }

  return `${protocol}//${hostname}:3001`;
}

export const apiBaseUrl =
  resolveApiBaseUrl();

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
});

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    return `No puedo conectar con el backend en ${apiBaseUrl}. Verifica que el backend este iniciado en el puerto 3001.`;
  }

  const message = error.response.data?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  if (typeof message === 'string') {
    return message;
  }

  return fallback;
}

export function isUnauthorizedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      isUnauthorizedError(error) &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      useAuthStore.getState().logout();
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);
