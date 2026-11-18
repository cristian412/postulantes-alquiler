# Postulantes para alquiler de departamento

- `/` → formulario para postulantes
- `/admin` → panel con contraseña: lista, puntaje, filtros, estados, notas, ponderación y descarga CSV

## Configuración en Vercel
1. Importar este repositorio en Vercel.
2. Variable de entorno `ADMIN_PASSWORD` = la contraseña del panel.
3. Storage → agregar **Upstash for Redis** (plan gratuito) y conectarlo al proyecto.
4. Redeploy.
