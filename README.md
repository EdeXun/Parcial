# Parcial2 · Metabase

Aplicación local con backend Laravel y frontend React + Vite. Todo el código del servidor está en `backend/`; la interfaz está en `frontend/`.

## Iniciar

Abre dos terminales en VS Code.

Terminal 1 — Laravel:

```powershell
cd backend
php artisan serve
```

Terminal 2 — React:

```powershell
cd frontend
npm run dev
```

Abre **http://127.0.0.1:5173**. Laravel escucha en http://127.0.0.1:8000 y Metabase en http://localhost:3000. Vite redirige `/api` a Laravel para que el navegador use el mismo origen.

## Configuración MySQL

El único archivo con credenciales es `backend/.env`. La conexión fue verificada con una consulta de lectura:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=Parcial
DB_USERNAME=root
DB_PASSWORD=tu_clave_local
```

La contraseña existente se conservó. `3307` es el puerto publicado por Docker; `3306` es el puerto dentro del contenedor. Comprueba nuevamente desde `backend/`:

```powershell
php artisan config:clear
php artisan db:check
```

La aplicación usa sesiones y caché en archivos; no requiere migrar ni modificar tus tablas existentes para mostrar el dashboard.

## Configurar Metabase

La conexión MySQL de Laravel y la conexión de Metabase se configuran por separado. La API key permite crear las preguntas; la clave de incrustación firma los JWT. Son claves diferentes y permanecen en el backend.

1. En Administración de Metabase → Configuración → Claves API, crea una clave con permisos para importar datos y crear elementos en Parcial2.
2. Guarda la clave en `backend/.env`, variable `METABASE_API_KEY`.
3. Habilita las cargas CSV en Metabase si aún no están habilitadas y selecciona tu base de datos de destino.
4. Desde `backend/`, ejecuta `npm run setup:metabase`. Importa `data/student_grade_ses_dataset.csv` como modelo y crea cinco preguntas y el dashboard en la colección **Parcial2, ID 8**. Guarda los IDs en `data/metabase-state.json` para reanudar sin repetir los elementos ya registrados.
5. En Metabase, habilita la incrustación firmada y publica el dashboard para incrustación. Copia la clave de incrustación en `METABASE_SECRET_KEY`. El script guarda `METABASE_DASHBOARD_ID` automáticamente.
6. Ejecuta `php artisan config:clear` y actualiza el frontend.

El JWT usa HS256, dura diez minutos y referencia únicamente el dashboard configurado. React renueva la vista antes de su vencimiento. El servidor está pensado para esta práctica local; no incorpora inicio de sesión de usuarios para despliegue público.

## Gráficas

1. Distribución por categoría de calificación.
2. Promedio por educación del padre y la madre, separado por género.
3. Dispersión de horas de estudio y nota final.
4. Dona de aprobados/reprobados, con filtro de internet `1=Sí`, `0=No` y sin filtro para ambas poblaciones. Aprobación definida explícitamente como nota ≥ 60/100.
5. Promedio por intervalos de asistencia de diez puntos porcentuales.

Los valores ausentes se excluyen del análisis que los necesita. Las gráficas muestran asociaciones, no causalidad. Los SQL quedan en `backend/metabase/` después de ejecutar el configurador. El configurador está preparado para la conexión MySQL existente y requiere acceso SQL en Metabase.

## PDF y validación

Desde `backend/`, ejecuta `npm run export:pdf` para guardar `output/dashboard-parcial2.pdf`, o usa el menú del dashboard → Exportar como PDF. El PDF requiere haber creado el dashboard y una API key válida.

```powershell
# backend/
php artisan test

# frontend/
npm run build
```

En una instalación nueva, ejecuta `composer install` dentro de `backend/` y `npm install` dentro de `frontend/`. Si falta `.env`, copia `backend/.env.example` a `backend/.env`, completa tus credenciales y ejecuta `php artisan key:generate`.

Referencias: [integración JWT de Metabase](https://www.metabase.com/docs/latest/embedding/static-embedding) y [documentación Laravel](https://laravel.com/docs/13.x).
