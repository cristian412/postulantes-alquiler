# Postulantes para alquiler de departamento

- `/` → formulario para postulantes
- `/admin` → panel con contraseña: lista, puntaje, filtros, estados, notas, ponderación y descarga CSV

## Netlify (recomendado)
1. Importar este repositorio en Netlify (Add new project → Import from GitHub).
2. Variable de entorno `ADMIN_PASSWORD` = la contraseña del panel.
3. Deploy. Los datos se guardan en Netlify Blobs (incluido, sin configurar nada).

## Vercel (alternativa)
Variable `ADMIN_PASSWORD` y Storage → Upstash for Redis.
