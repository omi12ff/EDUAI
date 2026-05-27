export const plannerDays = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
] as const;

export type PlannerDay = (typeof plannerDays)[number];

export const defaultPlannerDay: PlannerDay = 'Lunes';

function normalizeDay(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getCurrentPlannerDay(date = new Date()): PlannerDay {
  const weekday = new Intl.DateTimeFormat('es-PY', {
    weekday: 'long',
    timeZone: 'America/Asuncion',
  }).format(date);

  return (
    plannerDays.find((day) => normalizeDay(day) === normalizeDay(weekday)) ??
    defaultPlannerDay
  );
}
