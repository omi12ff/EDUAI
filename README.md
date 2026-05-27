EduAI
=====

EduAI es una app web academica pensada para estudiantes de la FPUNA. Centraliza horario, examenes, notas, perfil, administracion de usuarios y un chat con IA que puede trabajar con contexto academico.

## Stack

- Frontend: Next.js, React, Tailwind CSS y Zustand.
- Backend: NestJS, Prisma y PostgreSQL.
- Base de datos local: PostgreSQL via Docker Compose.
- Autenticacion: email/password, Google OAuth y verificacion de correo por token.

## Requisitos

- Node.js 20 o superior.
- npm.
- Docker Desktop, para levantar PostgreSQL local.

## Configuracion inicial

1. Levantar la base de datos:

```powershell
docker compose up -d
```

2. Configurar variables del backend:

```powershell
cd backend
copy .env.example .env
```

Edita `backend/.env` y completa como minimo:

```env
DATABASE_URL=postgresql://eduai:eduai123@127.0.0.1:5433/eduai_db?schema=public
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=change_this_to_a_long_random_secret
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Para enviar correos reales de verificacion, agrega tambien:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM="EduAI <your_email@gmail.com>"
```

3. Configurar variables del frontend:

```powershell
cd ..\frontend
copy .env.example .env
```

Edita `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

## Instalacion y ejecucion

Desde la raiz podes usar estos atajos:

```powershell
npm run db:up
npm run db:generate
npm run db:migrate
npm run dev:backend
npm run dev:frontend
```

Backend:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

La app queda disponible en:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Flujo de autenticacion

- El registro con email y contrasena crea una cuenta pendiente.
- El usuario debe verificar su correo antes de iniciar sesion.
- En desarrollo, si SMTP no esta configurado, el backend muestra el enlace/token en logs o en la respuesta del flujo.
- Google OAuth marca el correo como verificado si Google confirma `email_verified`.
- El primer usuario creado queda como `ADMIN`; los siguientes quedan como `STUDENT`.

## Importacion academica

El horario, secciones, profesores y fechas de examenes se importan desde el Excel academico de FPUNA en la seccion Horario. A partir de esa carga, la app alimenta:

- Horario semanal.
- Examenes.
- Materias vinculadas al usuario.
- Calculo de notas y habilitaciones.

## Comandos utiles

Backend:

```powershell
npm run build
npm test -- --runInBand
npm run lint
```

Frontend:

```powershell
npm run build
npm run lint
```

## Antes de subir al repositorio

- No subir archivos `.env`.
- No subir `node_modules`, `.next`, `dist`, `.logs` ni archivos personales.
- Revisar que `JWT_SECRET`, `GROQ_API_KEY`, `SMTP_PASS` y credenciales de Google no esten hardcodeadas.
- Ejecutar build y tests.
- Si una clave real fue expuesta por accidente, rotarla.
