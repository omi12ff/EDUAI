export const fpunaCareers = [
  {
    orientation: 'A',
    name: 'Ingenieria en Informatica',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Sistemas de Produccion',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Marketing',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Electronica',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Electricidad',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria Aeronautica',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Ciencias de los Materiales',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'A',
    name: 'Ingenieria en Energia',
    durationSemesters: 10,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'B',
    name: 'Licenciatura en Ciencias Informaticas',
    durationSemesters: 8,
    campuses: ['Sede Central', 'Filiales'],
  },
  {
    orientation: 'B',
    name: 'Licenciatura en Electricidad',
    durationSemesters: 8,
    campuses: ['Sede Central', 'Villarrica'],
  },
  {
    orientation: 'B',
    name: 'Licenciatura en Ciencias Atmosfericas',
    durationSemesters: 8,
    campuses: ['Sede Central'],
  },
  {
    orientation: 'C',
    name: 'Licenciatura en Gestion de la Hospitalidad',
    durationSemesters: 8,
    campuses: ['Sede Central', 'Villarrica'],
  },
  {
    orientation: 'C',
    name: 'Licenciatura en Ciencias de la Informacion',
    durationSemesters: 9,
    campuses: ['Sede Central'],
  },
] as const;

export type FpunaCareer = (typeof fpunaCareers)[number];
