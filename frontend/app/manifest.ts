import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduAI',
    short_name: 'EduAI',
    description: 'Panel academico integrado para estudiantes FPUNA.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#eef4fb',
    theme_color: '#2563eb',
    orientation: 'portrait',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
