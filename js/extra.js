// Pantallas de Mantenimiento y Administración: equipos, preventivo, estadísticas, informes, exportación y administración.
import { S, rpc, esc, num, fmtDT, fmtMin, urgPill, stPill, shell, flash, guard, staff, route, URG, STATUS, sb } from './app.js';

const bars = (items, color = 'var(--primary)') => {
  const mx = Math.max(0, ...items.map(i => Number(i[1])));
  return items.length ? items.map(i => `<div class="bar-row"><span class="bar-label">${esc(i[0])}</span><span class="bar-track"><span class="bar-fill" style="width:${mx ? Number(i[1]) / mx * 100 : 0}%;background:${color}"></span></span><span class="bar-val">${esc(i[1])}</span></div>`).join('') : '<p class="muted">Sin datos.</p>';
};
const isAdmin = () => S.me.role === 'ADMIN';
const back = (href, txt) => `<a class="back" href="${href}">← ${txt}</a>`;
const need = (cond) => { if (!cond) throw new Error('No tienes permiso para ver esto.'); };
const done = (msg, kind = 'ok') => sessionStorage.setItem('flash', JSON.stringify([msg, kind]));
const act = (fn, btn, then) => guard(async () => { await fn(); if (then) location.hash = then; else await route(); }, btn);
const fmtD = v => v ? new Date(v + (String(v).length <= 10 ? 'T12:00:00' : '')).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) : '—';
const form2obj = f => Object.fromEntries(new FormData(f).entries());

export function startExtras() {
  if (staff()) { rpc('check_preventive_due').catch(() => {}); setInterval(() => rpc('check_preventive_due').catch(() => {}), 30 * 60000); }
  rpc('get_settings').then(s => { if (s.company_name) { S.ref.company = s.company_name; document.querySelectorAll('.brand span').forEach(e => e.textContent = s.company_name); } }).catch(() => {});
}

// ============================================================ EQUIPOS
async function viewEquipos() {
  need(staff()); const rows = await rpc('list_equipment');
  return shell(`<div class="row between wrap"><h1>Equipos y máquinas</h1>${isAdmin() ? '<a class="btn btn-primary" href="#/equipo/nuevo">＋ Nuevo equipo</a>' : ''}</div>
  <div class="tablewrap"><table class="table"><thead><tr><th>Código</th><th>Nombre</th><th>Área</th><th>Ubicación</th><th>Marca / modelo</th><th>Estado</th><th>Averías</th><th></th></tr></thead><tbody>
  ${rows.map(e => `<tr class="${e.active ? '' : 'inactive'}"><td>${esc(e.code)}</td><td><a href="#/equipo/${e.id}">${esc(e.name)}</a></td><td>${esc(e.area_name || '—')}</td><td>${esc(e.location || '—')}</td>
  <td>${esc(e.brand || '')} ${esc(e.model || '')}</td><td>${esc(e.status.replace(/_/g, ' ').toLowerCase())}</td><td><strong>${e.n_inc}</strong></td>
  <td>${isAdmin() ? `<a class="btn btn-sm" href="#/equipo/${e.id}/editar">Editar</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`);
}
async function viewEquipo(id) {
  need(staff()); const d = await rpc('equipment_detail', { p_id: Number(id) }), e = d.equipment;
  return shell(`${back('#/equipos', 'Equipos')}<h1>⚙️ ${esc(e.name)} <small class="muted">${esc(e.code)}</small></h1>
  <div class="card"><dl class="info"><dt>Área</dt><dd>${esc(e.area_name || '—')}</dd><dt>Ubicación</dt><dd>${esc(e.location || '—')}</dd><dt>Marca / modelo</dt><dd>${esc(e.brand || '—')} ${esc(e.model || '')}</dd>
  <dt>Nº serie</dt><dd>${esc(e.serial_number || '—')}</dd><dt>Fecha de compra</dt><dd>${fmtD(e.purchase_date)}</dd><dt>Estado</dt><dd>${esc(e.status.replace(/_/g, ' ').toLowerCase())}</dd>
  <dt>Averías registradas</dt><dd><strong>${d.incidents.length}</strong></dd><dt>Tiempo total de reparación</dt><dd>${fmtMin(d.total_minutes)}</dd></dl>${e.notes ? `<p class="descbox">${esc(e.notes)}</p>` : ''}</div>
  <h2>Historial de mantenimiento</h2><div class="tablewrap"><table class="table"><thead><tr><th>Incidencia</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Urgencia</th><th>Estado</th><th>Tiempo</th></tr></thead><tbody>
  ${d.incidents.map(i => `<tr><td><a href="#/incidencia/${i.id}">${esc(i.number)}</a></td><td>${fmtDT(i.created_at)}</td><td>${esc(i.category_name || '—')}</td><td>${esc(i.description.slice(0, 80))}</td><td>${urgPill(i.urgency)}</td><td>${stPill(i.status)}</td><td>${fmtMin(i.minutes_spent)}</td></tr>`).join('') || '<tr><td colspan="7" class="center muted">Sin incidencias.</td></tr>'}</tbody></table></div>`);
}
async function viewEquipoForm(id) {
  need(isAdmin()); const e = id ? (await rpc('equipment_detail', { p_id: Number(id) })).equipment : {}; const areas = S.ref.areas;
  const st = [['OPERATIVO', 'Operativo'], ['EN_REVISION', 'En revisión'], ['FUERA_DE_SERVICIO', 'Fuera de servicio'], ['BAJA', 'Baja']];
  return { html: shell(`${back('#/equipos', 'Equipos')}<h1>${id ? 'Editar equipo' : 'Nuevo equipo'}</h1><form id="feq" class="card stack"><div class="grid-form">
  <label>Código<input name="code" value="${esc(e.code || '')}" required></label><label>Nombre<input name="name" value="${esc(e.name || '')}" required></label>
  <label>Área<select name="area_id"><option value="">—</option>${areas.map(a => `<option value="${a.id}" ${e.area_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
  <label>Ubicación<input name="location" value="${esc(e.location || '')}"></label><label>Marca<input name="brand" value="${esc(e.brand || '')}"></label><label>Modelo<input name="model" value="${esc(e.model || '')}"></label>
  <label>Número de serie<input name="serial_number" value="${esc(e.serial_number || '')}"></label><label>Fecha de compra<input type="date" name="purchase_date" value="${esc(e.purchase_date || '')}"></label>
  <label>Estado<select name="status">${st.map(([k, v]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label class="check"><input type="checkbox" name="active" ${e.active === false ? '' : 'checked'}> Activo</label></div>
  <label>Observaciones<textarea name="notes" rows="3">${esc(e.notes || '')}</textarea></label><button class="btn btn-primary">Guardar</button></form>`),
    after: () => { const f = document.getElementById('feq'); f.onsubmit = ev => { ev.preventDefault(); const o = form2obj(f); o.active = f.active.checked; if (id) o.id = Number(id);
      act(async () => { await rpc('save_equipment', { p: o }); done('Equipo guardado.'); }, f.querySelector('button.btn-primary'), '#/equipos'); }; } };
}

// ============================================================ PREVENTIVO
const PSTAT = [['ACTIVO', 'Activo'], ['PAUSADO', 'Pausado'], ['FINALIZADO', 'Finalizado']];
async function viewPreventivo(q) {
  need(staff()); const flt = q.estado || 'ACTIVO';
  const [rows, sum] = await Promise.all([rpc('list_plans', { p_status: flt }), rpc('preventive_summary')]);
  return shell(`<div class="row between wrap"><h1>Mantenimiento preventivo</h1><a class="btn btn-primary" href="#/preventivo/nuevo">＋ Nuevo plan</a></div>
  <div class="tiles tiles-sm"><div class="tile t-CRITICA"><b>${sum.overdue}</b><span>Revisiones vencidas</span></div><div class="tile t-ALTA"><b>${sum.soon}</b><span>Próximas (3 días)</span></div></div>
  <div class="tabs">${PSTAT.map(([k, n]) => `<a class="${flt === k ? 'on' : ''}" href="#/preventivo?estado=${k}">${n.toUpperCase()}</a>`).join('')}<a class="${flt === 'TODOS' ? 'on' : ''}" href="#/preventivo?estado=TODOS">TODOS</a></div>
  ${rows.map(p => { const act = p.status === 'ACTIVO', cls = act && p.days_left < 0 ? 'urgb-CRITICA' : act && p.days_left <= 3 ? 'urgb-ALTA' : 'urgb-BAJA';
    const badge = !act ? `<span class="pill">${esc(p.status.toLowerCase())}</span>` : p.days_left < 0 ? `<span class="pill urg-CRITICA">Vencida hace ${-p.days_left} d</span>` : p.days_left === 0 ? '<span class="pill urg-ALTA">Vence hoy</span>' : `<span class="pill ${p.days_left <= 3 ? 'urg-ALTA' : 'urg-BAJA'}">En ${p.days_left} d</span>`;
    return `<a class="card inc ${cls}" href="#/preventivo/${p.id}"><div class="row between"><strong>${esc(p.title)}</strong>${badge}</div><div class="meta"><span>⚙️ ${esc(p.equip_name)}</span><span>🏭 ${esc(p.area_name || '—')}</span>
    <span>🔁 cada ${p.frequency_days} días</span><span>📅 próxima: ${fmtD(p.next_due)}</span><span>👷 ${esc(p.tech_name || 'Cualquier técnico')}</span><span>✔ última: ${p.last_done ? fmtD(p.last_done) : 'nunca'}</span></div></a>`; }).join('') || '<div class="card center muted">No hay planes en esta lista.</div>'}`);
}
async function viewPlan(id) {
  need(staff()); const d = await rpc('plan_detail', { p_id: Number(id) }), p = d.plan;
  return shell(`${back('#/preventivo', 'Preventivo')}<div class="row between wrap"><h1>🗓️ ${esc(p.title)}</h1><span class="row gap"><a class="btn" href="#/preventivo/${p.id}/editar">✏️ Editar</a>
  ${p.status === 'ACTIVO' ? `<a class="btn btn-ok" href="#/preventivo/${p.id}/ejecutar">✔ Realizar revisión</a>` : ''}</span></div>
  <section class="card"><dl class="info"><dt>Equipo</dt><dd><a href="#/equipo/${p.equipment_id}">${esc(p.equip_name)}</a> (${esc(p.equip_code)})</dd><dt>Área</dt><dd>${esc(p.area_name || '—')}</dd><dt>Frecuencia</dt><dd>cada ${p.frequency_days} días</dd>
  <dt>Próxima revisión</dt><dd><strong>${fmtD(p.next_due)}</strong> ${p.status === 'ACTIVO' ? (p.days_left < 0 ? `<span class="pill urg-CRITICA">vencida hace ${-p.days_left} d</span>` : p.days_left <= 3 ? `<span class="pill urg-ALTA">en ${p.days_left} d</span>` : '') : ''}</dd>
  <dt>Técnico</dt><dd>${esc(p.tech_name || 'Cualquiera')}</dd><dt>Estado</dt><dd>${esc(p.status.toLowerCase())}</dd></dl>
  <div class="row gap" style="margin-top:.7rem">${PSTAT.filter(([k]) => k !== p.status).map(([k, n]) => `<button class="btn btn-sm" data-pst="${k}">${{ ACTIVO: 'Activar', PAUSADO: 'Pausar', FINALIZADO: 'Finalizar' }[k]}</button>`).join('')}</div></section>
  <section class="card"><h2>Checklist</h2><ul class="checklist">${d.items.map(i => `<li>☐ ${esc(i.text)}</li>`).join('') || '<li class="muted">Sin tareas definidas.</li>'}</ul></section>
  <section class="card"><h2>Historial de revisiones</h2>${d.runs.map(r => `<div class="run"><div class="row between wrap"><strong>${fmtDT(r.performed_at)}</strong><span class="pill ${r.status === 'COMPLETADA' ? 'st-RESUELTA' : r.status === 'PARCIAL' ? 'st-PENDIENTE_MATERIAL' : 'st-PENDIENTE'}">${esc(r.status.replace('_', ' ').toLowerCase())}</span></div>
  <small class="muted">${esc(r.tech_name || '—')}${r.minutes_spent != null ? ' · ' + fmtMin(r.minutes_spent) : ''}</small>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}
  <ul class="checklist">${r.items.map(i => `<li>${i.done ? '☑' : '☐'} ${esc(i.text)}${i.notes ? ` <small class="muted">— ${esc(i.notes)}</small>` : ''}</li>`).join('')}</ul></div>`).join('') || '<p class="muted">Todavía no se ha realizado ninguna revisión.</p>'}</section>`);
}
function wirePlan(id) { document.querySelectorAll('[data-pst]').forEach(b => b.onclick = () => act(() => rpc('set_plan_status', { p_id: Number(id), p_status: b.dataset.pst }), b)); }
async function viewPlanForm(id) {
  need(staff()); const d = id ? await rpc('plan_detail', { p_id: Number(id) }) : null, p = d ? d.plan : {}; const R = S.ref; const eq = await rpc('list_equipment');
  const today = new Date().toISOString().slice(0, 10);
  return { html: shell(`${back('#/preventivo', 'Preventivo')}<h1>${id ? 'Editar plan' : 'Nuevo plan preventivo'}</h1><form id="fplan" class="card stack"><div class="grid-form">
  <label>Título de la revisión<input name="title" value="${esc(p.title || '')}" placeholder="Engrasado y revisión de correas" required></label>
  <label>Equipo<select name="equipment_id" required><option value="">—</option>${eq.filter(e => e.active).map(e => `<option value="${e.id}" ${p.equipment_id === e.id ? 'selected' : ''}>${esc(e.code)} · ${esc(e.name)}</option>`).join('')}</select></label>
  <label>Frecuencia (días)<input type="number" name="frequency_days" min="1" max="3650" list="freqs" value="${p.frequency_days || 30}" required></label>
  <datalist id="freqs"><option value="7"><option value="15"><option value="30"><option value="90"><option value="180"><option value="365"></datalist>
  <label>Próxima revisión<input type="date" name="next_due" value="${esc(p.next_due || today)}" required></label>
  <label>Técnico responsable<select name="technician_id"><option value="">Cualquiera</option>${R.techs.map(t => `<option value="${t.id}" ${p.technician_id === t.id ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select></label>
  <label>Estado<select name="status">${PSTAT.map(([k, n]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
  <label>Checklist (una tarea por línea)<textarea name="checklist" rows="7" placeholder="Comprobar tensión de la correa&#10;Engrasar rodamientos&#10;Limpiar sensores">${esc(d ? d.items.map(i => i.text).join('\n') : '')}</textarea></label><button class="btn btn-primary">Guardar plan</button></form>`),
    after: () => { const f = document.getElementById('fplan'); f.onsubmit = ev => { ev.preventDefault(); const o = form2obj(f); o.checklist = o.checklist.split('\n').map(x => x.trim()).filter(Boolean); if (id) o.id = Number(id);
      guard(async () => { const nid = await rpc('save_plan', { p: o }); done('Plan guardado.'); location.hash = '#/preventivo/' + nid; }, f.querySelector('button')); }; } };
}
async function viewPlanRun(id) {
  need(staff()); const d = await rpc('plan_detail', { p_id: Number(id) }), p = d.plan;
  if (p.status !== 'ACTIVO') throw new Error('Solo se pueden ejecutar planes activos.');
  const now = new Date(), pad = n => String(n).padStart(2, '0'), loc = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { html: shell(`${back('#/preventivo/' + id, esc(p.title))}<h1>Revisión: ${esc(p.title)}</h1><p class="muted">⚙️ ${esc(p.equip_name)}</p><form id="frun" class="stack">
  <div class="card stack">${d.items.map(i => `<div class="chk"><label class="check big-check"><input type="checkbox" name="done_${i.id}"> ${esc(i.text)}</label><input name="note_${i.id}" placeholder="Observación (opcional)"></div>`).join('') || '<p class="muted">Este plan no tiene checklist; registra la revisión con las observaciones.</p>'}</div>
  <div class="card stack"><div class="grid-form"><label>Fecha y hora<input type="datetime-local" name="performed_at" value="${loc}"></label><label>Tiempo empleado (min)<input type="number" name="minutes" min="0"></label></div>
  <label>Observaciones<textarea name="notes" rows="3"></textarea></label><label class="check"><input type="checkbox" name="not_done"> No se ha podido realizar (el plan seguirá pendiente)</label></div>
  <button class="btn btn-ok" style="min-height:56px">Guardar revisión</button></form>`),
    after: () => { const f = document.getElementById('frun'); f.onsubmit = ev => { ev.preventDefault(); const dn = {}, nt = {};
      d.items.forEach(i => { dn[i.id] = f['done_' + i.id].checked; nt[i.id] = f['note_' + i.id].value; });
      guard(async () => { const st = await rpc('run_plan', { p_id: Number(id), p_performed: f.performed_at.value ? new Date(f.performed_at.value).toISOString() : null, p_minutes: num(f.minutes.value), p_notes: f.notes.value, p_done: dn, p_item_notes: nt, p_not_done: f.not_done.checked });
        done({ COMPLETADA: 'Revisión completada. Próxima revisión programada.', PARCIAL: 'Revisión registrada como parcial.', NO_REALIZADA: 'Registrada como no realizada; sigue pendiente.' }[st]); location.hash = '#/preventivo/' + id; }, f.querySelector('button')); }; } };
}

// ============================================================ ESTADÍSTICAS
async function viewStats(q) {
  need(isAdmin()); const s = await rpc('stats', { p_from: q.date_from || null, p_to: q.date_to || null }), st = s.by_status;
  const urg = Object.keys(URG).map(k => [URG[k][1], s.by_urgency[k] || 0, k]);
  return { html: shell(`<div class="row between wrap"><h1>Estadísticas</h1><form id="fst" class="row gap wrap"><input type="date" name="date_from" value="${esc(q.date_from || '')}"><input type="date" name="date_to" value="${esc(q.date_to || '')}"><button class="btn">Filtrar</button></form></div>
  <div class="tiles tiles-sm"><div class="tile"><b>${s.total}</b><span>Total incidencias</span></div><div class="tile"><b>${fmtMin(s.avg_response_min)}</b><span>Tiempo medio de respuesta</span></div><div class="tile"><b>${fmtMin(s.avg_resolution_min)}</b><span>Tiempo medio de resolución</span></div>
  <div class="tile"><b>${st.PENDIENTE_MATERIAL || 0}</b><span>Pend. de material</span></div><div class="tile"><b>${(st.PENDIENTE || 0) + (st.ASIGNADA || 0) + (st.EN_PROCESO || 0)}</b><span>Pendientes / en curso</span></div><div class="tile"><b>${(st.RESUELTA || 0) + (st.CERRADA || 0)}</b><span>Resueltas</span></div></div>
  <div class="stats-grid"><section class="card"><h2>Por área</h2>${bars(s.by_area)}</section><section class="card"><h2>Por urgencia</h2>${urg.map(u => bars([[u[0], u[1]]], `var(--u-${u[2]})`)).join('')}</section>
  <section class="card"><h2>Por mes</h2>${bars(s.by_month)}</section><section class="card"><h2>Por categoría</h2>${bars(s.by_category)}</section>
  <section class="card"><h2>Máquinas con más averías</h2>${bars(s.by_equipment, 'var(--u-ALTA)')}</section><section class="card"><h2>Incidencias por técnico</h2>${bars(s.by_tech)}</section></div>
  <section class="card"><h2>Comparativa de áreas</h2><div class="tablewrap"><table class="table"><thead><tr><th>Área</th><th>Total</th><th>Abiertas</th><th>Resueltas</th><th>Críticas</th></tr></thead><tbody>
  ${s.area_compare.map(a => `<tr><td><strong>${esc(a.name)}</strong></td><td>${a.total}</td><td>${a.abiertas}</td><td>${a.resueltas}</td><td>${a.criticas}</td></tr>`).join('') || '<tr><td colspan="5" class="muted center">Sin datos.</td></tr>'}</tbody></table></div></section>`),
    after: () => { document.getElementById('fst').onsubmit = ev => { ev.preventDefault(); const p = new URLSearchParams(); new FormData(ev.target).forEach((v, k) => { if (v) p.set(k, v); }); location.hash = '#/estadisticas' + (p.toString() ? '?' + p : ''); }; } };
}

// ============================================================ INFORMES + EXPORTACIÓN
let xlsxP;
const loadXLSX = () => xlsxP || (xlsxP = new Promise((ok, ko) => { if (window.XLSX) return ok(window.XLSX); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = () => ko(new Error('No se pudo cargar el generador de Excel.')); document.head.append(s); }));
const safe = v => (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;   // evita fórmulas al abrir en Excel
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function saveTable(fmt, name, sheets) {      // sheets: {hoja: [cabeceras, ...filas]}
  if (fmt === 'csv') { const [first] = Object.values(sheets); const csv = first.map(r => r.map(c => `"${String(safe(c) ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    return saveBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), name + '.csv'); }
  const X = await loadXLSX(), wb = X.utils.book_new();
  for (const [n, rows] of Object.entries(sheets)) { const ws = X.utils.aoa_to_sheet(rows.map(r => r.map(safe))); ws['!cols'] = rows[0].map((_, i) => ({ wch: i < 2 ? 30 : 16 })); X.utils.book_append_sheet(wb, ws, n); }
  X.writeFile(wb, name + '.xlsx');
}
export async function exportIncidents(fmt, rows) {
  const ex = Object.fromEntries((await rpc('export_extra', { p_ids: rows.map(r => r.id) })).map(e => [e.id, e]));
  const H = ['Número', 'Fecha creación', 'Área', 'Usuario', 'Zona', 'Línea', 'Instalación', 'Equipo', 'Categoría', 'Urgencia', 'Estado', 'Técnico', 'Descripción', 'Inicio', 'Fin', 'Tiempo (min)', 'Trabajo realizado', 'Materiales', 'Fecha resolución', 'Fecha cierre'];
  const data = rows.map(r => { const e = ex[r.id] || {}; return [r.number, fmtDT(r.created_at), r.area_name, r.creator_name, r.zone_name || '', r.line_name || '', r.inst_name || '', r.equip_name || '', r.category_name || '', URG[r.urgency][1], STATUS[r.status], r.tech_name || '',
    r.description, e.started_at ? fmtDT(e.started_at) : '', e.finished_at ? fmtDT(e.finished_at) : '', e.minutes_spent ?? '', e.work_done || '', e.materials || '', r.resolved_at ? fmtDT(r.resolved_at) : '', r.closed_at ? fmtDT(r.closed_at) : '']; });
  await saveTable(fmt, 'incidencias', { Incidencias: [H, ...data] });
}
const REP = { tecnico: ['Por técnico', ['Técnico', 'Incidencias', 'Horas', 'Coste material (€)']], equipo: ['Por equipo', ['Equipo', 'Incidencias', 'Horas', 'Coste material (€)']], area: ['Por área', ['Área', 'Incidencias', 'Horas', 'Coste material (€)']],
  categoria: ['Por categoría', ['Categoría', 'Incidencias', 'Horas', 'Coste material (€)']], materiales: ['Materiales', ['Material', 'Unidad', 'Cantidad', 'Coste (€)', 'Incidencias']],
  preventivo: ['Preventivo', ['Equipo', 'Plan', 'Revisiones', 'Completadas', 'Parciales', 'No realizadas', 'Horas', 'Cumplimiento %']] };
async function viewReport(q) {
  need(isAdmin()); const r = await rpc('report', { p_from: q.date_from || null, p_to: q.date_to || null }); window.__report = r;
  return { html: shell(`<div class="row between wrap"><h1>Informes</h1><form id="frp" class="row gap wrap"><input type="date" name="date_from" value="${esc(q.date_from || '')}"><input type="date" name="date_to" value="${esc(q.date_to || '')}">
  <button class="btn">Filtrar</button><button class="btn" type="button" id="rp-xlsx">⬇ Excel</button><button class="btn" type="button" onclick="print()">🖨 Imprimir</button></form></div>
  <p class="muted">Rango según fecha de creación de la incidencia (preventivo: fecha de la revisión). El coste suma el material con coste unitario; si no lo hay, el coste manual de la actuación.</p>
  ${Object.entries(REP).map(([k, [t, h]]) => `<section class="card"><h2>${t}</h2><div class="tablewrap"><table class="table"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>
  ${r[k].map(row => `<tr>${row.map(c => `<td>${esc(c ?? 0)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${h.length}" class="muted center">Sin datos.</td></tr>`}</tbody></table></div></section>`).join('')}`),
    after: () => { document.getElementById('frp').onsubmit = ev => { ev.preventDefault(); const p = new URLSearchParams(); new FormData(ev.target).forEach((v, k) => { if (v) p.set(k, v); }); location.hash = '#/informes' + (p.toString() ? '?' + p : ''); };
      document.getElementById('rp-xlsx').onclick = e => guard(() => saveTable('xlsx', 'informe_mantenimiento', Object.fromEntries(Object.entries(REP).map(([k, [t, h]]) => [t, [h, ...r[k]]]))), e.target); } };
}

// ============================================================ ADMINISTRACIÓN
const ADM = [['usuarios', '👥', 'Usuarios', 'Crear, editar y desactivar'], ['areas', '🏭', 'Áreas', 'IV GAMA, 1ª GAMA, Oficinas…'], ['categorias', '🏷️', 'Categorías', 'Tipos de incidencia'], ['ubicaciones', '📍', 'Ubicaciones', 'Zonas, líneas, instalaciones'],
  ['equipos', '⚙️', 'Equipos', 'Maestro de máquinas'], ['materiales', '🔩', 'Materiales', 'Catálogo y costes'], ['preventivo', '🗓️', 'Preventivo', 'Revisiones periódicas'], ['informes', '📑', 'Informes', 'Tiempos y costes'], ['estadisticas', '📊', 'Estadísticas', 'Dashboard'], ['ajustes', '🛠️', 'Ajustes', 'Configuración general']];
const viewAdminHome = () => shell(`<h1>Administración</h1><div class="admin-grid">${ADM.map(([k, ic, t, d]) => `<a class="card tilelink" href="${['equipos', 'preventivo', 'informes', 'estadisticas'].includes(k) ? '#/' + k : '#/admin/' + k}">${ic}<b>${t}</b><small>${d}</small></a>`).join('')}</div>`);

async function viewUsers() {
  const u = await rpc('list_users');
  return shell(`${back('#/admin', 'Administración')}<div class="row between wrap"><h1>Usuarios</h1><a class="btn btn-primary" href="#/admin/usuario/nuevo">＋ Nuevo usuario</a></div>
  <div class="tablewrap"><table class="table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Área</th><th>Estado</th><th></th></tr></thead><tbody>
  ${u.map(x => `<tr class="${x.active ? '' : 'inactive'}"><td>${esc(x.username)}</td><td>${esc(x.full_name)}</td><td>${esc({ ADMIN: 'Administrador', MANTENIMIENTO: 'Mantenimiento', ENCARGADO: 'Encargado' }[x.role])}</td><td>${esc(x.area_name || '—')}</td><td>${x.active ? 'Activo' : 'Desactivado'}</td>
  <td><a class="btn btn-sm" href="#/admin/usuario/${x.id}">Editar</a></td></tr>`).join('')}</tbody></table></div>`);
}
async function viewUserForm(id) {
  const all = await rpc('list_users'), u = id === 'nuevo' ? null : all.find(x => x.id === id); if (id !== 'nuevo' && !u) throw new Error('Usuario no encontrado');
  const x = u || { role: 'ENCARGADO', active: true };
  return { html: shell(`${back('#/admin/usuarios', 'Usuarios')}<h1>${u ? 'Editar usuario' : 'Nuevo usuario'}</h1><form id="fus" class="card stack"><div class="grid-form">
  <label>Usuario<input name="username" value="${esc(x.username || '')}" required autocapitalize="none"></label><label>Nombre completo<input name="full_name" value="${esc(x.full_name || '')}" required></label>
  <label>Email (para avisos, opcional)<input type="email" name="email_contact" value="${esc(x.email_contact || '')}"></label>
  <label>Rol<select name="role" id="role">${[['ENCARGADO', 'Encargado'], ['MANTENIMIENTO', 'Mantenimiento'], ['ADMIN', 'Administrador']].map(([k, v]) => `<option value="${k}" ${x.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label id="area-wrap">Área (solo encargados)<select name="area_id"><option value="">—</option>${S.ref.areas.map(a => `<option value="${a.id}" ${x.area_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
  <label>${u ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña (mín. 8)'}<input type="password" name="password" autocomplete="new-password" minlength="8" ${u ? '' : 'required'}></label>
  <label class="check"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}> Activo</label></div><button class="btn btn-primary">Guardar</button></form>`),
    after: () => { const f = document.getElementById('fus'), r = f.role, w = document.getElementById('area-wrap'); const t = () => { w.style.display = r.value === 'ENCARGADO' ? '' : 'none'; }; r.onchange = t; t();
      f.onsubmit = ev => { ev.preventDefault(); const o = form2obj(f); o.active = f.active.checked; if (u) o.id = u.id; if (!o.password) delete o.password;
        act(async () => { await rpc('save_user', { p: o }); done('Usuario guardado.'); }, f.querySelector('button.btn-primary'), '#/admin/usuarios'); }; } };
}
async function viewSimple(kind) {
  const d = await rpc('admin_data'); const cfg = { areas: ['Áreas', 'areas', d.areas], categorias: ['Categorías de incidencia', 'categories', d.categories] }[kind]; const [title, table, rows] = cfg;
  return { html: shell(`${back('#/admin', 'Administración')}<h1>${title}</h1><form class="card row gap wrap" data-new><input name="name" placeholder="Nuevo nombre" required><button class="btn btn-primary">＋ Añadir</button></form>
  ${rows.map(r => `<form class="card row gap wrap ${r.active ? '' : 'inactive'}" data-id="${r.id}"><input name="name" value="${esc(r.name)}" required><label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Activa</label><button class="btn btn-sm">Guardar</button></form>`).join('')}`),
    after: () => document.querySelectorAll('form[data-id], form[data-new]').forEach(f => f.onsubmit = ev => { ev.preventDefault(); const id = f.dataset.id ? Number(f.dataset.id) : null;
      act(async () => { await rpc('admin_save_simple', { p_table: table, p_id: id, p_name: f.name.value, p_active: id ? f.active.checked : true }); done('Guardado.'); }, f.querySelector('button')); }) };
}
async function viewLocations() {
  const d = await rpc('admin_data'), areas = S.ref.areas; const sel = v => `<select name="area_id"><option value="">Todas las áreas</option>${areas.map(a => `<option value="${a.id}" ${v === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
  return { html: shell(`${back('#/admin', 'Administración')}<h1>Listas de ubicación</h1><form class="card row gap wrap" data-new><select name="kind"><option value="ZONA">Zona</option><option value="LINEA">Línea</option><option value="INSTALACION">Instalación</option></select>
  <input name="name" placeholder="Nombre" required>${sel(null)}<button class="btn btn-primary">＋ Añadir</button></form>
  ${d.locations.map(r => `<form class="card row gap wrap ${r.active ? '' : 'inactive'}" data-id="${r.id}"><span class="pill">${esc(r.kind[0] + r.kind.slice(1).toLowerCase())}</span><input name="name" value="${esc(r.name)}" required>${sel(r.area_id)}
  <label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Activa</label><button class="btn btn-sm">Guardar</button></form>`).join('')}`),
    after: () => document.querySelectorAll('form[data-id], form[data-new]').forEach(f => f.onsubmit = ev => { ev.preventDefault(); const id = f.dataset.id ? Number(f.dataset.id) : null;
      act(async () => { await rpc('admin_save_simple', { p_table: 'location_options', p_id: id, p_name: f.name.value, p_active: id ? f.active.checked : true, p_extra: { kind: f.kind ? f.kind.value : null, area_id: f.area_id.value || null } }); done('Guardado.'); }, f.querySelector('button')); }) };
}
async function viewMaterials() {
  const d = await rpc('admin_data');
  return { html: shell(`${back('#/admin', 'Administración')}<h1>Catálogo de materiales</h1><p class="muted">Al registrar material en una incidencia se sugieren estos nombres y se rellenan unidad y coste.</p>
  <form class="card row gap wrap" data-new><input name="name" placeholder="Material" required><input name="unit" placeholder="Unidad" value="Ud" style="max-width:90px"><input name="unit_cost" placeholder="€/ud" inputmode="decimal" style="max-width:110px"><button class="btn btn-primary">＋ Añadir</button></form>
  ${d.materials.map(r => `<form class="card row gap wrap ${r.active ? '' : 'inactive'}" data-id="${r.id}"><input name="name" value="${esc(r.name)}" required><input name="unit" value="${esc(r.unit)}" style="max-width:90px"><input name="unit_cost" value="${r.unit_cost ?? ''}" inputmode="decimal" style="max-width:110px">
  <label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Activo</label><button class="btn btn-sm">Guardar</button></form>`).join('')}`),
    after: () => document.querySelectorAll('form[data-id], form[data-new]').forEach(f => f.onsubmit = ev => { ev.preventDefault(); const id = f.dataset.id ? Number(f.dataset.id) : null;
      act(async () => { await rpc('admin_save_simple', { p_table: 'materials_catalog', p_id: id, p_name: f.name.value, p_active: id ? f.active.checked : true, p_extra: { unit: f.unit.value, unit_cost: f.unit_cost.value } }); done('Guardado.'); }, f.querySelector('button')); }) };
}
async function viewSettings() {
  const s = await rpc('get_settings');
  return { html: shell(`${back('#/admin', 'Administración')}<h1>Ajustes</h1><form id="fset" class="card stack"><label>Nombre de la empresa<input name="company" value="${esc(s.company_name || '')}"></label><button class="btn btn-primary">Guardar</button></form>
  <div class="card stack"><h2>Avisos externos</h2><p>📧 Email y 📲 notificaciones push: <strong>no disponibles todavía en la versión web</strong> (siguen funcionando en la app del servidor). Las alertas dentro de la aplicación funcionan en tiempo real.</p></div>`),
    after: () => { const f = document.getElementById('fset'); f.onsubmit = ev => { ev.preventDefault(); act(async () => { await rpc('save_setting', { p_key: 'company_name', p_value: f.company.value }); done('Ajustes guardados.'); }, f.querySelector('button')); }; } };
}

// ============================================================ enrutado de las pantallas extra
export async function dispatch(parts, q) {
  const [a, b, c] = parts; const wrap = h => ({ html: h });
  try {
    if (a === 'equipos') return wrap(await viewEquipos());
    if (a === 'equipo') { if (b === 'nuevo') return await viewEquipoForm(null); if (c === 'editar') return await viewEquipoForm(b); return wrap(await viewEquipo(b)); }
    if (a === 'preventivo') { if (!b) return wrap(await viewPreventivo(q)); if (b === 'nuevo') return await viewPlanForm(null); if (c === 'editar') return await viewPlanForm(b); if (c === 'ejecutar') return await viewPlanRun(b); return { html: await viewPlan(b), after: () => wirePlan(b) }; }
    if (a === 'estadisticas') return await viewStats(q);
    if (a === 'informes') return await viewReport(q);
    if (a === 'admin') { need(isAdmin());
      if (!b) return wrap(viewAdminHome()); if (b === 'usuarios') return wrap(await viewUsers()); if (b === 'usuario') return await viewUserForm(c);
      if (b === 'areas' || b === 'categorias') return await viewSimple(b); if (b === 'ubicaciones') return await viewLocations(); if (b === 'materiales') return await viewMaterials(); if (b === 'ajustes') return await viewSettings(); }
  } catch (e) { return wrap(shell(`<div class="card center"><h1>Error</h1><p>${esc(e.message)}</p><a class="btn btn-primary" href="#/">Volver al inicio</a></div>`)); }
  return null;
}
