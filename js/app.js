import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const VERSION = '2026-10-08.6';
import { SUPABASE_URL, SUPABASE_KEY, LOGIN_DOMAIN } from '../config.js?v=2026-10-08.6';
import { dispatch, startExtras, exportIncidents } from './extra.js?v=2026-10-08.6';
import { viewDetail, viewResolve, viewPause } from './flow.js?v=2026-10-08.6';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $app = document.getElementById('app');
export const S = { me: null, ref: null, channel: null, poll: null, notifs: [], seenTop: null };

// ---------------------------------------------------------------- utilidades
export const URG = { CRITICA: ['🔴', 'CRÍTICA', 'Afecta a producción, seguridad o puede provocar daños importantes.'],
  ALTA: ['🟠', 'ALTA', 'Afecta considerablemente al funcionamiento y necesita atención rápida.'],
  MEDIA: ['🟡', 'MEDIA', 'Afecta al funcionamiento pero se puede continuar trabajando.'],
  BAJA: ['🟢', 'BAJA', 'Problema menor que puede solucionarse cuando haya disponibilidad.'] };
export const STATUS = { PENDIENTE: 'Pendiente', ASIGNADA: 'Asignada', EN_PROCESO: 'En proceso', PENDIENTE_ACTUACION: 'Pendiente de actuación',
  RESUELTA: 'Resuelta', CERRADA: 'Cerrada', CANCELADA: 'Cancelada' };
export const PAUSE_LABEL = { FALTA_MATERIAL: 'Falta material', MATERIAL_COMPRA: 'Material pendiente de compra', MATERIAL_RECIBIR: 'Material pendiente de recibir',
  TECNICO_EXTERNO: 'Necesario técnico externo', AUTORIZACION: 'Pendiente de autorización', NO_PARAR_MAQUINA: 'No se puede parar la máquina',
  DIAGNOSTICO: 'Necesita diagnóstico adicional', PROGRAMAR: 'Pendiente de programar', OTRO: 'Otro' };
export const RES_LABEL = { REPARACION: 'Reparación', SUSTITUCION_PIEZA: 'Sustitución de pieza', AJUSTE: 'Ajuste / regulación', LIMPIEZA: 'Limpieza / mantenimiento',
  SUSTITUCION_MATERIAL: 'Sustitución de material', OTRO: 'Otro' };
export const EQ_LABEL = { SI: 'Sí', SI_OBSERVACIONES: 'Sí, pero con observaciones', NO: 'No' };
export const OPEN = ['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'PENDIENTE_ACTUACION'];
const TZ = 'Europe/Madrid';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = v => (v === '' || v == null ? null : Number(v));
export const fmtDT = v => v ? new Date(v).toLocaleString('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—';
export const fmtMin = m => { if (m == null) return '—'; const h = Math.floor(m / 60), mm = m % 60; return h ? `${h} h ${String(mm).padStart(2, '0')} min` : `${mm} min`; };
export const since = (a, b) => { if (!a) return '—'; const m = Math.max(0, Math.floor(((b ? new Date(b) : new Date()) - new Date(a)) / 60000)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m % 60} min` : `${m} min`; };
export const toLocalInput = v => { if (!v) return ''; const d = new Date(v), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocalInput = v => v ? new Date(v).toISOString() : null;
export const urgPill = u => `<span class="pill urg-${u}">${URG[u][0]} ${URG[u][1]}</span>`;
export const stPill = s => `<span class="pill st-${s}">${STATUS[s]}</span>`;
export const slug = u => u.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const staff = () => S.me && ['MANTENIMIENTO', 'ADMIN'].includes(S.me.role);

export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export function flash(msg, kind = 'ok') {
  const el = document.createElement('div'); el.className = `flash flash-${kind}`; el.textContent = msg;
  const box = document.getElementById('flashbox'); if (box) { box.prepend(el); setTimeout(() => el.remove(), 6000); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
export async function guard(fn, btn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { flash(e.message || String(e), 'error'); } finally { if (btn) btn.disabled = false; }
}

// Reduce fotos (máx. 1600 px, JPEG) antes de subirlas
export function compressImage(file, max = 1600, quality = 0.82) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(file);
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      if (k === 1 && file.size < 600 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
export async function uploadPhotos(incidentId, files) {
  const paths = [];
  for (const f of files) {
    const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${incidentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('incident-photos').upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error('No se pudo subir una foto: ' + error.message);
    paths.push(path);
  }
  return paths;
}
export async function signedUrls(photos) {
  if (!photos.length) return {};
  const { data } = await sb.storage.from('incident-photos').createSignedUrls(photos.map(p => p.path), 3600);
  const m = {}; (data || []).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; }); return m;
}

// ---------------------------------------------------------------- estructura (barra superior)
export function shell(inner) {
  const me = S.me, isAdmin = me.role === 'ADMIN';
  return `
<header class="topbar">
  <a class="brand" href="#/">🔧 <span>${esc(S.ref.company || 'Mantenimiento')}</span></a>
  <nav class="nav" id="nav">
    <a href="#/">Inicio</a><a href="#/incidencias">Incidencias</a>
    ${staff() ? '<a href="#/preventivo">Preventivo</a>' : ''}
    ${isAdmin ? '<a href="#/equipos">Equipos</a><a href="#/estadisticas">Estadísticas</a><a href="#/informes">Informes</a><a href="#/admin">Administración</a>' : ''}
  </nav>
  <div class="topright">
    <button class="bell" id="bell" type="button" aria-label="Alertas">🔔<span class="badge" id="bell-count" hidden>0</span></button>
    <button class="burger" id="burger" type="button" aria-label="Menú">☰</button>
  </div>
  <div class="alertpanel" id="alertpanel" hidden></div>
</header>
<div class="alertbanner" id="alertbanner" hidden></div>
<main class="container"><div id="flashbox"></div>${inner}</main>
<footer class="foot">${esc(me.full_name)} · ${esc(me.area_name || me.role)} · <a href="#/cuenta">Mi cuenta</a> · <button class="linkbtn" id="logout">Salir</button> · <small>v${VERSION}</small></footer>`;
}
function wireShell() {
  document.getElementById('burger').onclick = () => document.getElementById('nav').classList.toggle('open');
  document.getElementById('logout').onclick = async () => { await sb.auth.signOut(); };
  const bell = document.getElementById('bell'), panel = document.getElementById('alertpanel');
  bell.onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; renderBell(); };
  document.addEventListener('click', e => { if (panel && !panel.contains(e.target) && e.target !== bell) panel.hidden = true; }, { once: false });
  panel.onclick = async e => {
    if (e.target.id === 'markall') { e.preventDefault(); await rpc('mark_notifications_read'); S.notifs = []; S.banner = null; renderBell(); paintBanner(); return; }
    const a = e.target.closest('a[data-id]');
    if (a) { e.preventDefault(); await rpc('mark_notifications_read', { p_id: Number(a.dataset.id) }); S.notifs = S.notifs.filter(n => n.id != a.dataset.id); S.banner = null; paintBanner(); panel.hidden = true; location.hash = a.getAttribute('href'); }
  };
  renderBell(); paintBanner();
}
export const nlink = n => n.incident_id ? `#/incidencia/${n.incident_id}` : n.plan_id || n.project_id ? '#/preventivo' : '#/';
function renderBell() {
  const c = document.getElementById('bell-count'), panel = document.getElementById('alertpanel'); if (!c) return;
  c.hidden = !S.notifs.length; c.textContent = S.notifs.length;
  if (!panel.hidden) {
    panel.innerHTML = `<div class="head"><span>Alertas</span><a href="#" id="markall" style="padding:0;border:0">Marcar leídas</a></div>` +
      (S.notifs.length ? S.notifs.map(n => `<a href="${nlink(n)}" data-id="${n.id}">${n.urgency ? `<b>${esc(URG[n.urgency][1])}</b> · ` : ''}${esc(n.message)}<br><small>${esc(fmtDT(n.created_at))}</small></a>`).join('')
        : '<div class="empty muted">No hay alertas nuevas.</div>');
  }
}
let audio;
function beep() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain();
  o.connect(g); g.connect(audio.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(audio.currentTime + 0.25); } catch { /* bloqueado hasta interacción */ } }
function paintBanner() {
  const b = document.getElementById('alertbanner'), n = S.banner;
  if (!b) return; if (!n || !staff() || !S.notifs.some(x => x.id === n.id)) { b.hidden = true; return; }
  b.className = 'alertbanner u-' + (n.urgency || 'CRITICA'); b.textContent = '🔔 ' + n.message + (S.notifs.length > 1 ? `  (+${S.notifs.length - 1} más)` : ''); b.hidden = false;
  b.onclick = () => { S.banner = null; b.hidden = true; location.hash = nlink(n); };
}
function showBanner(n) {
  if (!staff()) return; S.banner = n; paintBanner(); beep();
  const bell = document.getElementById('bell'); if (bell) { bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring'); }
}
async function loadNotifs(first = false) {
  const { data } = await sb.from('notifications').select('*').is('read_at', null).order('id', { ascending: false }).limit(20);
  if (!data) return; S.notifs = data;
  if (data.length && data[0].id !== S.seenTop && (!first || sessionStorage.getItem('seen') !== String(data[0].id))) { showBanner(data[0]); sessionStorage.setItem('seen', String(data[0].id)); }
  S.seenTop = data[0]?.id ?? null; renderBell();
}
function startRealtime() {
  stopRealtime();
  S.channel = sb.channel('notif-' + S.me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${S.me.id}` }, () => { loadNotifs(); if (/^#\/?$/.test(location.hash) || location.hash === '') route(); }).subscribe();
  S.poll = setInterval(() => loadNotifs(), 30000); loadNotifs(true);
}
function stopRealtime() { if (S.channel) { sb.removeChannel(S.channel); S.channel = null; } clearInterval(S.poll); }

let currentRows = [];

// ---------------------------------------------------------------- tarjetas
export function card(i, showTech = true) {
  return `<a class="card inc urgb-${i.urgency}" href="#/incidencia/${i.id}">
  <div class="row between"><strong class="num">${esc(i.number)}</strong><span>${urgPill(i.urgency)} ${stPill(i.status)}</span></div>
  <p class="desc">${esc(i.description.length > 140 ? i.description.slice(0, 137) + '…' : i.description)}</p>
  <div class="meta"><span>🏭 ${esc(i.area_name)}</span>${i.equip_name ? `<span>⚙️ ${esc(i.equip_name)}</span>` : ''}
  <span>🕒 ${fmtDT(i.created_at)}${OPEN.includes(i.status) ? ' · hace ' + since(i.created_at) : ''}</span>${i.status === 'PENDIENTE_ACTUACION' && i.pause_reason ? `<span>🟠 ${esc(PAUSE_LABEL[i.pause_reason] || '')}</span>` : ''}
  ${showTech ? `<span>👷 ${esc(i.tech_name || 'Sin asignar')}</span>` : ''}${i.n_photos > 0 ? `<span>📷 ${i.n_photos}</span>` : ''}</div></a>`;
}

// ---------------------------------------------------------------- vistas
async function viewHome(q) {
  if (S.me.role === 'ENCARGADO') {
    const rows = await rpc('list_incidents', { p_filters: { order: 'recientes' }, p_limit: 60 });
    const ab = rows.filter(r => OPEN.includes(r.status)).length, rs = rows.filter(r => r.status === 'RESUELTA').length;
    return shell(`<a class="btn-new" href="#/nueva">＋ NUEVA INCIDENCIA</a>
      <div class="row between wrap"><h2>MIS INCIDENCIAS <small class="muted">· ${esc(S.me.area_name)}</small></h2><span class="muted">${ab} abiertas · ${rs} resueltas</span></div>
      ${rows.map(r => card(r)).join('') || '<div class="card center muted">Todavía no hay incidencias en tu área.</div>'}`);
  }
  // Perfil Mantenimiento: panel simplificado (3 estados). El administrador conserva el panel completo.
  const lite = S.me.role === 'MANTENIMIENTO';
  const groups = lite ? ['pendientes', 'asignadas', 'proceso'] : ['pendientes', 'asignadas', 'proceso', 'actuacion', 'resueltas'];
  const group = groups.includes(q.group) ? q.group : 'pendientes';
  const [rows, d, pv, rowsAct] = await Promise.all([rpc('list_incidents', { p_filters: { group }, p_limit: 200 }), rpc('dashboard_staff'), rpc('preventive_summary'),
    lite ? rpc('list_incidents', { p_filters: { group: 'actuacion' }, p_limit: 200 }) : Promise.resolve([])]);
  const t = (k, ic, lb) => `<div class="tile t-${k}"><b>${d.by_urg[k] || 0}</b><span>${ic} ${lb}</span></div>`;
  const st = (cls, ic, lb, n, g) => `<a class="tile s-${cls}" href="#/?group=${g}"><b>${n}</b><span>${ic} ${lb}</span></a>`;
  const pst = await pushState(); const pushBanner = pst === 'off' || pst === 'ios-install' ? `<div class="card prev-alert" style="border-left-color:var(--primary)"><div class="row between wrap"><span>🔔 <strong>Activa los avisos en este móvil</strong> para recibir las incidencias nuevas aunque la app esté cerrada.</span>${pst === 'off' ? '<button class="btn btn-primary btn-sm" id="push-btn">Activar avisos</button>' : '<a class="btn btn-sm" href="#/cuenta">Cómo hacerlo</a>'}</div></div>` : '';
  return shell(`${pushBanner}<div class="row between wrap"><h1>Panel de mantenimiento</h1><a class="btn btn-primary" href="#/nueva">＋ Nueva incidencia</a></div>
    ${lite ? `<div class="tiles tiles3">${st('PENDIENTE', '🔴', 'PENDIENTES', d.pendientes, 'pendientes')}${st('ASIGNADA', '🔵', 'ASIGNADAS', d.asignadas, 'asignadas')}${st('EN_PROCESO', '🟡', 'EN PROCESO', d.proceso, 'proceso')}</div>
    <div class="tiles tiles-sm"><div class="tile ${d.mas_24h ? 'warn' : ''}"><b>${d.mas_24h}</b><span>⏰ Pendientes &gt; 24 h</span></div></div>`
    : `<div class="tiles tiles5">${st('PENDIENTE', '🔴', 'PENDIENTES', d.pendientes, 'pendientes')}${st('ASIGNADA', '🔵', 'ASIGNADAS', d.asignadas, 'asignadas')}${st('EN_PROCESO', '🟡', 'EN PROCESO', d.proceso, 'proceso')}
      ${st('PENDIENTE_ACTUACION', '🟠', 'PEND. DE ACTUACIÓN', d.pend_actuacion, 'actuacion')}${st('RESUELTA', '🟢', 'RESUELTAS', d.resueltas, 'resueltas')}</div>
    <div class="tiles tiles-sm"><div class="tile ${d.mas_24h ? 'warn' : ''}"><b>${d.mas_24h}</b><span>⏰ Pendientes &gt; 24 h</span></div><div class="tile"><b>${d.pend_material}</b><span>📦 Pend. de material</span></div>
      <div class="tile"><b>${d.pend_externo}</b><span>🧑‍🔧 Pend. técnico externo</span></div><div class="tile"><b>${d.hoy}</b><span>✅ Resueltas hoy</span></div><div class="tile"><b>${fmtMin(d.avg_res_min)}</b><span>⏱ Tiempo medio resolución</span></div></div>`}
    <details class="card"><summary>Por urgencia (sin resolver)</summary><div class="tiles" style="margin-top:.6rem">${t('CRITICA', '🔴', 'Críticas')}${t('ALTA', '🟠', 'Alta')}${t('MEDIA', '🟡', 'Medias')}${t('BAJA', '🟢', 'Bajas')}</div></details>
    ${pv.overdue || pv.soon ? `<a class="card prev-alert ${pv.overdue ? 'late' : ''}" href="#/preventivo">🗓️ Preventivo: ${pv.overdue ? `<strong>${pv.overdue} revisión(es) vencida(s)</strong> ` : ''}${pv.soon ? `${pv.soon} próxima(s) en 3 días` : ''}</a>` : ''}
    <div class="tabs">${(lite ? [['pendientes', 'PENDIENTES'], ['asignadas', 'ASIGNADAS'], ['proceso', 'EN PROCESO']] : [['pendientes', 'PENDIENTES'], ['asignadas', 'ASIGNADAS'], ['proceso', 'EN PROCESO'], ['actuacion', 'PEND. DE ACTUACIÓN'], ['resueltas', 'RESUELTAS']]).map(([k, l]) => `<a class="${group === k ? 'on' : ''}" href="#/?group=${k}">${l}</a>`).join('')}</div>
    ${rows.map(r => card(r)).join('') || '<div class="card center muted">No hay incidencias en esta lista. 🎉</div>'}
    ${lite && rowsAct.length ? `<h2 style="margin-top:1.4rem">🟠 Pendientes de actuación <small class="muted">(${rowsAct.length})</small></h2>${rowsAct.map(r => card(r)).join('')}` : ''}`);
}

async function viewList(q) {
  const R = S.ref, f = q;
  const rows = await rpc('list_incidents', { p_filters: f, p_limit: 500 }); currentRows = rows;
  const opt = (arr, val, label, all = 'Todos') => `<option value="">${all}</option>` + arr.map(x => `<option value="${esc(x[val])}" ${String(f[curKey]) === String(x[val]) ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
  let curKey = '';
  const sel = (key, name, arr, val, label, all) => { curKey = key; return `<label>${name}<select name="${key}">${opt(arr, val, label, all)}</select></label>`; };
  return shell(`<div class="row between wrap"><h1>Incidencias <small class="muted">(${rows.length})</small></h1>${staff() ? '<span class="row gap"><button class="btn" id="exp-xlsx">⬇ Excel</button><button class="btn" id="exp-csv">⬇ CSV</button></span>' : ''}</div>
  <details class="card filters" ${Object.keys(q).length ? 'open' : ''}><summary>🔎 Buscar y filtrar</summary>
  <form id="ffilter" class="grid-form">
    <label>Número / texto<input name="q" value="${esc(f.q || '')}" placeholder="INC-2026-…"></label>
    <label>Desde<input type="date" name="date_from" value="${esc(f.date_from || '')}"></label>
    <label>Hasta<input type="date" name="date_to" value="${esc(f.date_to || '')}"></label>
    ${S.me.role !== 'ENCARGADO' ? sel('area', 'Área', R.areas, 'id', x => x.name, 'Todas') : ''}
    ${sel('user', 'Usuario', R.users, 'id', x => x.full_name, 'Todos')}
    ${sel('status', 'Estado', Object.entries(STATUS).map(([k, v]) => ({ k, v })), 'k', x => x.v, 'Todos')}
    ${sel('urgency', 'Urgencia', Object.entries(URG).map(([k, v]) => ({ k, v })), 'k', x => x.v[0] + ' ' + x.v[1], 'Todas')}
    ${staff() ? sel('tech', 'Técnico', R.techs, 'id', x => x.full_name, 'Todos') : ''}
    ${sel('equipment', 'Máquina / equipo', R.equipment, 'id', x => x.name, 'Todos')}
    ${sel('category', 'Categoría', R.categories, 'id', x => x.name, 'Todas')}
    <div class="row gap actions"><button class="btn btn-primary" type="submit">Filtrar</button><a class="btn" href="#/incidencias">Limpiar</a></div>
  </form></details>
  <div class="tablewrap"><table class="table desktop-only"><thead><tr><th>Número</th><th>Fecha</th><th>Área</th><th>Equipo</th><th>Descripción</th><th>Urgencia</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>
  ${rows.map(i => `<tr class="clickable" onclick="location.hash='#/incidencia/${i.id}'"><td><a href="#/incidencia/${i.id}"><strong>${esc(i.number)}</strong></a></td><td>${fmtDT(i.created_at)}</td><td>${esc(i.area_name)}</td>
  <td>${esc(i.equip_name || '—')}</td><td>${esc(i.description.slice(0, 70))}</td><td>${urgPill(i.urgency)}</td><td>${stPill(i.status)}</td><td>${esc(i.tech_name || '—')}</td></tr>`).join('') || '<tr><td colspan="8" class="center muted">Sin resultados.</td></tr>'}</tbody></table></div>
  <div class="mobile-only">${rows.map(r => card(r)).join('') || '<div class="card center muted">Sin resultados.</div>'}</div>`);
}
function wireList() {
  ['xlsx', 'csv'].forEach(fmt => { const b = document.getElementById('exp-' + fmt); if (b) b.onclick = () => guard(() => exportIncidents(fmt, currentRows), b); });
  document.getElementById('ffilter').onsubmit = e => { e.preventDefault(); const p = new URLSearchParams();
    new FormData(e.target).forEach((v, k) => { if (v) p.set(k, v); }); location.hash = '#/incidencias' + (p.toString() ? '?' + p : ''); };
}

// ---- nueva incidencia
function viewNew() {
  const R = S.ref, enc = S.me.role === 'ENCARGADO';
  return shell(`<h1>Nueva incidencia</h1><form id="fnew" class="stack" novalidate>
  <div class="card stack">${enc ? `<div class="fixed-area">🏭 Área: <strong>${esc(S.me.area_name)}</strong></div><input type="hidden" name="area_id" value="${S.me.area_id}">`
    : `<label>Área<select name="area_id" id="area_id">${R.areas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>`}
    <div class="grid-form">
    <label>Máquina / equipo<select name="equipment_id"><option value="">—</option>${R.equipment.map(e => `<option value="${e.id}" data-area="${e.area_id ?? ''}">${esc(e.name)}</option>`).join('')}</select></label>
    <label>Categoría<select name="category_id"><option value="">—</option>${R.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div></div>
  <div class="card stack"><label for="description"><strong>¿Qué ocurre?</strong></label>
    <textarea name="description" id="description" rows="5" required minlength="5" placeholder="Ej.: El motor de la cinta transportadora de la línea 2 hace un ruido extraño y se ha parado."></textarea></div>
  <div class="card stack"><strong>Urgencia</strong><div class="urgency-pick">
    ${Object.entries(URG).map(([k, [ic, l, d]]) => `<label class="urg-opt urg-${k}"><input type="radio" name="urgency" value="${k}" required><span class="urg-box"><span class="urg-ic">${ic}</span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div></div>
  <div class="card stack"><strong>Fotografías</strong><div class="row gap wrap"><button type="button" class="btn btn-photo" id="btn-camera">📷 AÑADIR FOTO</button><button type="button" class="btn" id="btn-gallery">🖼 Elegir de la galería</button></div>
    <input type="file" id="in-camera" accept="image/*" capture="environment" hidden><input type="file" id="in-gallery" accept="image/*" multiple hidden><div class="previews" id="previews"></div></div>
  <button class="btn btn-send" type="submit" id="send">ENVIAR INCIDENCIA</button></form>`);
}
function wireNew() {
  const files = []; let busy = false; const prev = document.getElementById('previews'), form = document.getElementById('fnew');
  const sync = () => { prev.innerHTML = ''; files.forEach((f, i) => { const d = document.createElement('div'); d.className = 'pv'; const img = document.createElement('img'); img.src = URL.createObjectURL(f); img.alt = 'Vista previa';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Quitar foto'); b.onclick = () => { files.splice(i, 1); sync(); }; d.append(img, b); prev.append(d); }); };
  const add = async list => { busy = true; for (const f of list) if (files.length < 10 && f.type.startsWith('image/')) files.push(await compressImage(f)); sync(); busy = false; };
  const cam = document.getElementById('in-camera'), gal = document.getElementById('in-gallery');
  document.getElementById('btn-camera').onclick = () => cam.click(); document.getElementById('btn-gallery').onclick = () => gal.click();
  cam.onchange = () => { const l = [...cam.files]; cam.value = ''; add(l); }; gal.onchange = () => { const l = [...gal.files]; gal.value = ''; add(l); };
  const area = document.getElementById('area_id');
  const byArea = () => { if (!area) return; form.querySelectorAll('option[data-area]').forEach(o => { const ok = !o.dataset.area || o.dataset.area === area.value; o.hidden = !ok; o.disabled = !ok; if (!ok && o.selected) o.parentElement.value = ''; }); };
  if (area) { area.onchange = byArea; byArea(); }
  form.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const f = new FormData(form), btn = document.getElementById('send');
    if (!f.get('urgency')) return alert('Selecciona la urgencia.');
    if ((f.get('description') || '').trim().length < 5) { form.description.focus(); return alert('Describe qué ocurre.'); }
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const res = await rpc('create_incident', { p_area: num(f.get('area_id')), p_zone: null, p_line: null, p_inst: null,
        p_equip: num(f.get('equipment_id')), p_cat: num(f.get('category_id')), p_desc: f.get('description'), p_urgency: f.get('urgency') });
      let warn = '';
      if (files.length) { try { await rpc('register_photos', { p_id: res.id, p_kind: 'INCIDENCIA', p_paths: await uploadPhotos(res.id, files) }); }
        catch (err) { warn = ' Atención: ' + err.message; } }
      sessionStorage.setItem('flash', JSON.stringify(['Incidencia enviada correctamente. Número: ' + res.number + warn, warn ? 'info' : 'ok']));
      location.hash = '#/incidencia/' + res.id;
    } catch (err) { flash(err.message, 'error'); btn.disabled = false; btn.textContent = 'ENVIAR INCIDENCIA'; }
  };
}

// ---------------------------------------------------------------- notificaciones push (móvil)
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
export async function pushState() {
  if (!pushSupported()) return isIOS() && !standalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
export async function enablePush() {
  const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
  if (await Notification.requestPermission() !== 'granted') throw new Error('Has bloqueado las notificaciones. Actívalas en los ajustes del navegador para este sitio.');
  const key = await rpc('get_push_key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await rpc('save_push_subscription', { p: sub.toJSON() });
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { await rpc('delete_push_subscription', { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.goto) { const h = e.data.goto.split('#')[1]; if (h) location.hash = '#' + h; } });
}
const PUSH_TXT = { on: '✅ Los avisos están <strong>activados</strong> en este dispositivo.', off: 'Recibe un aviso en este móvil aunque la app esté cerrada.',
  denied: '🚫 Has bloqueado las notificaciones para este sitio. Actívalas en los ajustes del navegador.', unsupported: 'Este navegador no admite notificaciones push.',
  'ios-install': 'En iPhone/iPad: pulsa <strong>Compartir → Añadir a pantalla de inicio</strong>, abre la app desde el icono y vuelve aquí para activar los avisos.' };
export async function pushCard() {
  const st = await pushState(); const can = ['on', 'off'].includes(st);
  return `<div class="card stack" id="pushcard"><h2>Notificaciones en el móvil</h2><p class="muted">${PUSH_TXT[st]}</p>
    ${can ? `<button class="btn ${st === 'on' ? '' : 'btn-primary'}" id="push-btn">${st === 'on' ? '🔕 Desactivar avisos en este dispositivo' : '🔔 Activar avisos en este dispositivo'}</button>` : ''}</div>`;
}
export function wirePush() {
  const b = document.getElementById('push-btn'); if (!b) return;
  b.onclick = () => guard(async () => { const on = b.textContent.includes('Desactivar'); if (on) await disablePush(); else await enablePush();
    flash(on ? 'Avisos desactivados en este dispositivo.' : 'Avisos activados. Recibirás las incidencias nuevas en este móvil.', 'ok'); await route(); }, b);
}

// ---- cuenta
async function viewAccount() {
  return shell(`<h1>Mi cuenta</h1><div class="card"><p><strong>${esc(S.me.full_name)}</strong> · usuario <code>${esc(S.me.username)}</code> · ${esc(S.me.area_name || S.me.role)}</p>
  <h2>Cambiar contraseña</h2><form id="fpass" class="stack"><label>Contraseña actual<input type="password" name="cur" autocomplete="current-password" required></label>
  <label>Nueva contraseña (mín. 8 caracteres)<input type="password" name="new" autocomplete="new-password" minlength="8" required></label>
  <label>Repetir nueva contraseña<input type="password" name="rep" autocomplete="new-password" minlength="8" required></label><button class="btn btn-primary">Guardar</button></form></div>${await pushCard()}`);
}
function wireAccount() {
  const f = document.getElementById('fpass');
  f.onsubmit = e => { e.preventDefault(); const d = new FormData(f); guard(async () => {
    if (d.get('new').length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    if (d.get('new') !== d.get('rep')) throw new Error('Las contraseñas no coinciden.');
    const { error: e1 } = await sb.auth.signInWithPassword({ email: `${slug(S.me.username)}@${LOGIN_DOMAIN}`, password: d.get('cur') });
    if (e1) throw new Error('La contraseña actual no es correcta.');
    const { error } = await sb.auth.updateUser({ password: d.get('new') }); if (error) throw new Error(error.message);
    f.reset(); flash('Contraseña actualizada.'); }, f.querySelector('button')); };
}

// ---- login
function viewLogin() {
  return `<main class="container"><div id="flashbox"></div><div class="login card"><h1>🔧 Mantenimiento</h1><p class="muted">Gestión de incidencias y mantenimiento</p>
  <form id="flogin"><label>Usuario<input name="username" autocomplete="username" autocapitalize="none" required autofocus></label>
  <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary btn-block" type="submit">Entrar</button></form></div></main>`;
}
function wireLogin() {
  const f = document.getElementById('flogin');
  f.onsubmit = e => { e.preventDefault(); const d = new FormData(f); guard(async () => {
    const { error } = await sb.auth.signInWithPassword({ email: `${slug(d.get('username'))}@${LOGIN_DOMAIN}`, password: d.get('password') });
    if (error) throw new Error('Usuario o contraseña incorrectos.'); }, f.querySelector('button')); };
}

// ---------------------------------------------------------------- router
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/'; const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export async function route() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { stopRealtime(); S.me = null; $app.innerHTML = viewLogin(); wireLogin(); return; }
  try {
    if (!S.me) { const r = await rpc('ref_data'); S.ref = r; S.me = r.me; S.ref.company = 'FRUNET'; startRealtime(); startExtras(); }
  } catch (e) { await sb.auth.signOut(); $app.innerHTML = viewLogin(); wireLogin(); flash('Tu usuario no está activo.', 'error'); return; }
  const { parts, q } = parseHash(); let html, after = () => {};
  try {
    if (!parts.length) html = await viewHome(q);
    else if (parts[0] === 'incidencias') { html = await viewList(q); after = wireList; }
    else if (parts[0] === 'nueva') { html = viewNew(); after = wireNew; }
    else if (parts[0] === 'incidencia') { const v = parts[2] === 'resolver' ? await viewResolve(parts[1]) : parts[2] === 'pendiente' ? await viewPause(parts[1]) : await viewDetail(parts[1]); html = v.html; after = v.after || after; }
    else if (parts[0] === 'cuenta') { html = await viewAccount(); after = wireAccount; }
    else { const x = await dispatch(parts, q); if (x) { html = x.html; after = x.after || after; } else html = await viewHome({}); }
  } catch (e) { html = shell(`<div class="card center"><h1>Error</h1><p>${esc(e.message)}</p><a class="btn btn-primary" href="#/">Volver al inicio</a></div>`); }
  $app.innerHTML = html; wireShell(); after(); wirePush(); window.scrollTo(0, 0);
  const fl = sessionStorage.getItem('flash'); if (fl) { sessionStorage.removeItem('flash'); const [m, k] = JSON.parse(fl); flash(m, k); }
}
window.addEventListener('hashchange', route);
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.me = null; S.ref = null; route(); } else if (ev === 'SIGNED_IN' && !S.me) route(); });
route();
