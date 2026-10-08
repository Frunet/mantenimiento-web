# Mantenimiento · FRUNET (web)

Aplicación web interna para comunicar y gestionar incidencias de mantenimiento.
Sitio estático (HTML + JavaScript) que usa Supabase como backend (login, base de datos con reglas de acceso por rol y área, y almacenamiento privado de fotos).

- El acceso es solo con usuario y contraseña facilitados por el administrador.
- La clave incluida en `config.js` es la clave pública (publishable) de Supabase; la seguridad la imponen las reglas de la base de datos.
- No se guardan datos ni credenciales en este repositorio.

Probar en local: `python -m http.server 8080` y abrir http://127.0.0.1:8080
