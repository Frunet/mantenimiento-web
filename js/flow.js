// Flujo de estados: ficha de la incidencia, formulario de resolución y de «pendiente de actuación».
import { S, rpc, esc, num, fmtDT, fmtMin, since, urgPill, stPill, shell, flash, guard, staff, route, STATUS, OPEN, loc,
  PAUSE_LABEL, RES_LABEL, EQ_LABEL, compressImage, uploadPhotos, signedUrls, toLocalInput, fromLocalInput } from './app.js?v=2026-10-08.4';

const act = (fn, btn) => guard(async () => { await fn(); await route(); }, btn);
const done = (msg, kind = 'ok') => sessionStorage.setItem('flash', JSON.stringify([msg, kind]));
const back = (href, txt) => `<a class="back" href="${href}">← ${txt}</a>`;
const fmtD = v => v ? new Date(v + (String(v).length <= 10 ? 'T12:00:00' : '')).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) : '—';
let tickTimer;

// ============================================================ FICHA
export async function viewDetail(id) {
  const d = await rpc('incident_detail', { p_id: Number(id) }); const i = d.incident, a = d.action, A = new Set(d.actions);
  const isStaff = staff(), edit = d.can_edit, urls = await signedUrls(d.photos), R = S.ref, admin = S.me.role === 'ADMIN';
  const gal = kind => d.photos.filter(p => p.kind === kind).map(p => urls[p.path] ? `<a href="${esc(urls[p.path])}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(urls[p.path])}" alt="Foto"></a>` : '').join('');
  const costed = d.materials.filter(m => m.unit_cost != null), total = costed.reduce((s, m) => s + m.quantity * m.unit_cost, 0);
  const pause = [...d.pauses].reverse().find(p => !p.resumed_at);
  const assignOther = A.has('ASSIGN_OTHER') ? `<div class="row gap" style="margin-top:.7rem"><select id="sel-tech">${R.techs.map(t => `<option value="${t.id}" ${i.assigned_to === t.id ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select>
    <button class="btn" data-act="ASSIGN_OTHER">👷 ASIGNAR A TÉCNICO</button></div>` : '';
  const cancel = A.has('CANCEL') ? '<div style="margin-top:.8rem"><button class="linkbtn" data-act="CANCEL">Cancelar la incidencia</button></div>' : '';

  let panel = '';
  if (i.status === 'PENDIENTE') {
    panel = `<section class="card panel p-PENDIENTE"><h2>🔴 Pendiente de asignar</h2><p class="muted">Nadie se ha hecho responsable todavía.</p>
      ${A.has('ASSIGN_ME') ? '<button class="btn btn-xl btn-start" data-act="ASSIGN_ME">🙋 ASIGNARME</button>' : ''}${assignOther}${cancel}</section>`;
  } else if (i.status === 'ASIGNADA') {
    panel = `<section class="card panel p-ASIGNADA"><h2>🔵 Asignada a ${esc(i.tech_name || '—')}</h2><p class="muted">Desde el ${fmtDT(i.assigned_at)}</p>
      <div class="actions-big">${A.has('START') ? '<button class="btn btn-xl btn-start" data-act="START">▶ COMENZAR ACTUACIÓN</button>' : '<p class="muted">Solo el técnico asignado o un responsable puede comenzar la actuación.</p>'}
      ${A.has('ASSIGN_ME') ? '<button class="btn" data-act="ASSIGN_ME">🙋 Asignármela yo</button>' : ''}</div>${assignOther}${cancel}</section>`;
  } else if (i.status === 'EN_PROCESO') {
    panel = `<section class="card panel p-EN_PROCESO"><h2>🟡 En proceso — ${esc(i.tech_name || '')}</h2>
      <p class="muted">Tiempo trabajado: <span class="timer" id="timer" data-base="${d.worked_minutes}" data-at="${Date.now()}" data-live="${d.session_started ? 1 : 0}">${fmtMin(d.worked_minutes)}</span>
      ${d.session_started ? `<br><small>Comenzó la actuación: ${fmtDT(d.session_started)}</small>` : ''}</p>
      ${A.has('RESOLVE') ? `<div class="actions-big two"><a class="btn btn-xl btn-resolve" href="#/incidencia/${i.id}/resolver">🟢 RESOLVER INCIDENCIA</a>
      <a class="btn btn-xl btn-hold" href="#/incidencia/${i.id}/pendiente">🟠 DEJAR PENDIENTE DE ACTUACIÓN</a></div>` : '<p class="muted">Solo el técnico asignado o un responsable puede resolverla o dejarla pendiente.</p>'}${cancel}</section>`;
  } else if (i.status === 'PENDIENTE_ACTUACION') {
    panel = `<section class="card panel p-PENDIENTE_ACTUACION"><h2>🟠 Pendiente de actuación</h2>${pause ? `<dl class="info"><dt>Motivo</dt><dd><strong>${esc(PAUSE_LABEL[pause.reason])}</strong></dd>
      <dt>Detalle / próxima actuación</dt><dd>${esc(pause.detail)}</dd><dt>Fecha prevista</dt><dd>${pause.expected_date ? fmtD(pause.expected_date) : '—'}</dd>
      ${pause.observations ? `<dt>Observaciones</dt><dd>${esc(pause.observations)}</dd>` : ''}<dt>Desde</dt><dd>${fmtDT(pause.created_at)} · hace ${since(pause.created_at)} (${esc(pause.by || '')})</dd></dl>` : ''}
      ${A.has('RESUME') ? '<div class="actions-big"><button class="btn btn-xl btn-start" data-act="RESUME">▶ RETOMAR INCIDENCIA</button></div>' : ''}${assignOther}${cancel}</section>`;
  } else if (i.status === 'RESUELTA') {
    panel = `<section class="card panel p-RESUELTA"><h2>🟢 Resuelta</h2><p class="muted">Mantenimiento ha terminado el trabajo. Falta la confirmación para cerrarla definitivamente.</p>
      ${A.has('CLOSE') ? `<button class="btn btn-xl btn-resolve" data-act="CLOSE">${isStaff ? '✔ CERRAR INCIDENCIA' : '✅ CONFIRMAR Y CERRAR'}</button>` : ''}
      ${A.has('REOPEN') ? '<button class="btn" data-act="REOPEN" style="margin-top:.6rem">↩ Reabrir</button>' : ''}</section>`;
  } else if (A.has('REOPEN')) {
    panel = '<section class="card"><button class="btn" data-act="REOPEN">↩ Reabrir la incidencia</button></section>';
  }

  const showRes = ['RESUELTA', 'CERRADA'].includes(i.status) && a && a.work_done;
  const resumen = showRes ? `<section class="card"><h2>Solución aplicada</h2><dl class="info"><dt>Cómo se resolvió</dt><dd>${esc(RES_LABEL[a.resolution_type] || '—')}</dd><dt>Técnico</dt><dd>${esc(a.resolved_by_name || a.tech_name || '—')}</dd>
    <dt>Fecha de resolución</dt><dd>${fmtDT(i.resolved_at)}</dd><dt>Tiempo empleado</dt><dd>${fmtMin(a.minutes_spent)}</dd><dt>Equipo operativo</dt><dd>${esc(EQ_LABEL[a.equipment_state] || '—')}</dd>
    ${i.closed_at ? `<dt>Cerrada</dt><dd>${fmtDT(i.closed_at)}</dd>` : ''}</dl><h3>Trabajo realizado</h3><p class="descbox">${esc(a.work_done)}</p>
    ${a.observations ? `<h3>Observaciones</h3><p class="descbox">${esc(a.observations)}</p>` : ''}</section>` : '';

  const matCard = d.materials.length || (isStaff && edit) ? `<section class="card" id="materiales"><h2>Materiales utilizados</h2>
    ${d.materials.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Observaciones</th>${isStaff ? '<th>€/ud</th><th>Importe</th>' : ''}${isStaff && edit ? '<th></th>' : ''}</tr></thead><tbody>
    ${d.materials.map(m => `<tr><td>${esc(m.name)}</td><td>${+m.quantity}</td><td>${esc(m.unit)}</td><td>${esc(m.notes || '')}</td>${isStaff ? `<td>${m.unit_cost != null ? (+m.unit_cost).toFixed(2) : '—'}</td><td>${m.unit_cost != null ? (m.quantity * m.unit_cost).toFixed(2) + ' €' : '—'}</td>` : ''}
    ${isStaff && edit ? `<td><button class="linkbtn" data-delmat="${m.id}">✕</button></td>` : ''}</tr>`).join('')}</tbody></table></div>${isStaff && costed.length ? `<p><strong>Coste total del material: ${total.toFixed(2)} €</strong></p>` : ''}` : '<p class="muted">Sin materiales registrados.</p>'}
    ${isStaff && edit && i.status !== 'RESUELTA' ? matForm() : ''}</section>` : '';
  const seguimiento = isStaff && edit && ['ASIGNADA', 'EN_PROCESO', 'PENDIENTE_ACTUACION'].includes(i.status) ? `<section class="card"><h2>Seguimiento</h2><form id="fobs" class="stack">
    <label>Añadir observación<textarea name="text" rows="2" placeholder="Ej.: Se ha desmontado la tapa, pendiente de revisar el rodamiento." required></textarea></label><button class="btn">💬 Guardar observación</button></form>
    ${a && a.observations ? `<h3>Observaciones registradas</h3><p class="descbox">${esc(a.observations)}</p>` : ''}</section>` : '';
  const fotos = gal('REPARACION') || (isStaff && edit) ? `<section class="card"><h2>Fotografías de la reparación</h2><div class="gallery">${gal('REPARACION')}</div>
    ${isStaff && edit ? '<form id="frep" class="row gap wrap"><input type="file" name="photos" accept="image/*" multiple required><button class="btn">📷 Subir fotos</button></form>' : ''}</section>` : '';
  const corregir = d.can_correct ? `<details class="card"><summary>🛠 Corregir datos de la actuación (responsable)</summary><form id="faction" class="stack" style="margin-top:.8rem"><div class="grid-form">
    <label>Técnico responsable<select name="tech"><option value="">—</option>${R.techs.map(t => `<option value="${t.id}" ${i.assigned_to === t.id ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select></label>
    <label>Inicio<input type="datetime-local" name="started" value="${toLocalInput(a?.started_at)}"></label><label>Fin<input type="datetime-local" name="finished" value="${toLocalInput(a?.finished_at)}"></label>
    <div class="timebox"><span>Tiempo empleado</span><div class="row gap"><label class="inline">Horas<input type="number" min="0" name="hours" value="${a?.minutes_spent != null ? Math.floor(a.minutes_spent / 60) : ''}"></label>
    <label class="inline">Min<input type="number" min="0" max="59" name="minutes" value="${a?.minutes_spent != null ? a.minutes_spent % 60 : ''}"></label></div></div>
    <label>Categoría<select name="category"><option value="">—</option>${R.categories.map(c => `<option value="${c.id}" ${i.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Coste del material (€)<input name="cost" inputmode="decimal" value="${a?.material_cost ?? ''}"></label></div>
    <label>Trabajo realizado<textarea name="work" rows="3">${esc(a?.work_done || '')}</textarea></label><label>Observaciones<textarea name="obs" rows="2">${esc(a?.observations || '')}</textarea></label>
    <button class="btn btn-primary">💾 Guardar corrección</button></form></details>` : '';

  const html = shell(`<a class="back" href="#/">← Volver</a><div class="row between wrap"><h1>${esc(i.number)}</h1><span>${urgPill(i.urgency)} ${stPill(i.status)}</span></div>
  <section class="card"><h2>Información de la incidencia</h2><dl class="info"><dt>Fecha y hora</dt><dd>${fmtDT(i.created_at)}</dd><dt>Comunicada por</dt><dd>${esc(i.creator_name)}</dd><dt>Área</dt><dd>${esc(i.area_name)}</dd>
    <dt>Ubicación</dt><dd>${esc(loc(i))}</dd><dt>Máquina / equipo</dt><dd>${esc(i.equip_name || '—')}</dd><dt>Categoría</dt><dd>${esc(i.category_name || '—')}</dd>
    <dt>Responsable</dt><dd>${esc(i.tech_name || 'Sin asignar')}</dd>${i.assigned_at ? `<dt>Asignada</dt><dd>${fmtDT(i.assigned_at)}</dd>` : ''}${OPEN.includes(i.status) ? `<dt>Abierta desde</dt><dd>hace ${since(i.created_at)}</dd>` : ''}
    ${i.resolved_at ? `<dt>Resuelta</dt><dd>${fmtDT(i.resolved_at)}</dd>` : ''}${i.closed_at ? `<dt>Cerrada</dt><dd>${fmtDT(i.closed_at)}</dd>` : ''}</dl>
    <p class="descbox">${esc(i.description)}</p><div class="gallery">${gal('INCIDENCIA')}</div></section>
  ${panel}${resumen}${seguimiento}${matCard}${fotos}${corregir}
  <section class="card"><h2>Historial</h2><ul class="timeline">${d.history.map(h => `<li><time>${fmtDT(h.created_at)}</time> — ${esc(h.detail || h.action)}${h.user && h.action !== 'CREADA' && !(h.detail || '').includes(h.user) ? ` <small class="muted">· ${esc(h.user)}</small>` : ''}</li>`).join('')}</ul></section>`);
  return { html, after: () => wireDetail(id, d) };
}

function matForm() {
  const cat = S.ref.catalog || [];
  return `<form id="fmat" class="grid-form mat-form"><label>Material<input name="name" id="mat-name" list="catalog" autocomplete="off" required placeholder="Rodamiento 6204"></label>
    <label>Cantidad<input name="qty" inputmode="decimal" value="1" required></label><label>Unidad<input name="unit" id="mat-unit" value="Ud" list="units"></label>
    <label>Coste unitario € (opcional)<input name="cost" id="mat-cost" inputmode="decimal"></label><label>Observaciones<input name="notes" placeholder="Sustitución"></label>
    <datalist id="catalog">${cat.map(c => `<option value="${esc(c.name)}" data-unit="${esc(c.unit)}" data-cost="${c.unit_cost ?? ''}">`).join('')}</datalist>
    <datalist id="units"><option>Ud</option><option>m</option><option>kg</option><option>l</option><option>Caja</option></datalist><button class="btn">＋ Añadir material</button></form>`;
}

function wireDetail(id, d) {
  const pid = Number(id);
  clearInterval(tickTimer);
  const t = document.getElementById('timer');
  if (t && t.dataset.live === '1') tickTimer = setInterval(() => { const el = document.getElementById('timer'); if (!el) return clearInterval(tickTimer);
    el.textContent = fmtMin(Number(el.dataset.base) + Math.floor((Date.now() - Number(el.dataset.at)) / 60000)); }, 20000);
  const run = {
    ASSIGN_ME: () => rpc('assign_incident', { p_id: pid, p_tech: null }).then(r => done(r.changed ? 'Incidencia asignada.' : 'Ya estaba asignada a ti.', r.changed ? 'ok' : 'info')),
    ASSIGN_OTHER: () => rpc('assign_incident', { p_id: pid, p_tech: document.getElementById('sel-tech').value }).then(r => done(r.changed ? 'Incidencia asignada al técnico.' : 'Ya estaba asignada a esa persona.', r.changed ? 'ok' : 'info')),
    START: () => rpc('start_work', { p_id: pid }).then(() => done('Actuación comenzada. El cronómetro está en marcha.')),
    RESUME: () => rpc('resume_incident', { p_id: pid }).then(() => done('Incidencia retomada: vuelve a estar en proceso.')),
    CLOSE: () => rpc('close_incident', { p_id: pid }).then(() => done('Incidencia cerrada.')),
    CANCEL: () => rpc('change_status', { p_id: pid, p_status: 'CANCELADA' }).then(() => done('Incidencia cancelada.')),
    REOPEN: () => rpc('change_status', { p_id: pid, p_status: 'REABRIR' }).then(() => done('Incidencia reabierta.')),
  };
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const k = b.dataset.act;
    if (k === 'CANCEL' && !confirm('¿Cancelar la incidencia?')) return;
    if (k === 'CLOSE' && !staff() && !confirm('¿Confirmas que la solución es correcta y quieres cerrar la incidencia?')) return;
    act(run[k], b);
  });
  const fo = document.getElementById('fobs');
  if (fo) fo.onsubmit = e => { e.preventDefault(); act(async () => { await rpc('add_observation', { p_id: pid, p_text: fo.text.value }); done('Observación guardada.'); }, fo.querySelector('button')); };
  const mn = document.getElementById('mat-name');
  if (mn) mn.onchange = () => { const o = [...document.querySelectorAll('#catalog option')].find(x => x.value.toLowerCase() === mn.value.trim().toLowerCase()); if (o) { document.getElementById('mat-unit').value = o.dataset.unit || 'Ud'; document.getElementById('mat-cost').value = o.dataset.cost || ''; } };
  const fm = document.getElementById('fmat');
  if (fm) fm.onsubmit = e => { e.preventDefault(); const f = new FormData(fm);
    act(async () => { await rpc('add_material', { p_id: pid, p_name: f.get('name'), p_qty: num((f.get('qty') || '').replace(',', '.')), p_unit: f.get('unit'), p_notes: f.get('notes'), p_unit_cost: num((f.get('cost') || '').replace(',', '.')) }); done('Material añadido.'); }, fm.querySelector('button')); };
  document.querySelectorAll('[data-delmat]').forEach(b => b.onclick = () => { if (confirm('¿Quitar este material?')) act(() => rpc('delete_material', { p_id: pid, p_mid: Number(b.dataset.delmat) }), b); });
  const fr = document.getElementById('frep');
  if (fr) fr.onsubmit = e => { e.preventDefault(); const inp = fr.querySelector('input[type=file]');
    act(async () => { const fs = []; for (const f of inp.files) fs.push(await compressImage(f)); await rpc('register_photos', { p_id: pid, p_kind: 'REPARACION', p_paths: await uploadPhotos(pid, fs) }); done(fs.length + ' foto(s) añadida(s).'); }, fr.querySelector('button')); };
  const fa = document.getElementById('faction');
  if (fa) fa.onsubmit = e => { e.preventDefault(); const f = new FormData(fa);
    act(async () => { await rpc('save_action', { p_id: pid, p_tech: f.get('tech') || null, p_started: fromLocalInput(f.get('started')), p_finished: fromLocalInput(f.get('finished')), p_hours: num(f.get('hours')), p_minutes: num(f.get('minutes')),
      p_work: f.get('work'), p_obs: f.get('obs'), p_cost: num((f.get('cost') || '').replace(',', '.')), p_category: num(f.get('category')) }); done('Actuación corregida.'); }, fa.querySelector('button.btn-primary')); };
}

// ============================================================ RESOLVER INCIDENCIA
export async function viewResolve(id) {
  const d = await rpc('incident_detail', { p_id: Number(id) }), i = d.incident;
  if (!d.actions.includes('RESOLVE')) throw new Error('Esta incidencia no se puede resolver ahora mismo (debe estar en proceso y ser tuya o de un responsable).');
  const canFix = d.can_correct, w = d.worked_minutes, cat = S.ref.catalog || [];
  const opt = (name, k, v, extra = '') => `<label class="opt"><input type="radio" name="${name}" value="${k}" required ${extra}><span>${v}</span></label>`;
  const html = shell(`${back('#/incidencia/' + id, esc(i.number))}<h1>🟢 Resolver incidencia</h1><p class="muted">${esc(i.number)} · ${esc(i.description.slice(0, 90))}</p>
  <form id="fres" class="stack" novalidate>
  <section class="card stack"><h2>¿Cómo se ha resuelto?</h2><div class="optgrid">${Object.entries(RES_LABEL).map(([k, v]) => opt('type', k, v)).join('')}</div>
    <label>Trabajo realizado (obligatorio)<textarea name="work" rows="4" required placeholder="Ej.: Se desmontó el motor, se detectó desgaste del rodamiento y se sustituyeron los dos rodamientos."></textarea></label></section>

  <section class="card stack"><h2>Materiales utilizados</h2>
    ${d.materials.length ? `<p class="muted">Ya registrados: ${d.materials.map(m => esc(m.name) + ' ×' + +m.quantity).join(', ')}</p>` : ''}
    <div id="mats" class="stack"></div><button type="button" class="btn" id="addmat">＋ Añadir material</button>
    <datalist id="catalog">${cat.map(c => `<option value="${esc(c.name)}" data-unit="${esc(c.unit)}" data-cost="${c.unit_cost ?? ''}">`).join('')}</datalist>
    <datalist id="units"><option>Ud</option><option>m</option><option>kg</option><option>l</option><option>Caja</option></datalist></section>

  <section class="card stack"><h2>Tiempo empleado</h2>
    <dl class="info"><dt>Comienzo</dt><dd>${fmtDT(d.action?.started_at)}</dd><dt>Finalización</dt><dd>Ahora (${fmtDT(new Date().toISOString())})</dd><dt>Tiempo trabajado</dt><dd><strong>${fmtMin(w)}</strong> <small class="muted">(no cuenta las pausas)</small></dd></dl>
    ${canFix ? `<div class="timebox"><span>Corregir tiempo total (responsable)</span><div class="row gap"><label class="inline">Horas<input type="number" min="0" name="hours" value="${Math.floor(w / 60)}"></label><label class="inline">Min<input type="number" min="0" max="59" name="minutes" value="${w % 60}"></label></div></div>`
      : '<p class="muted">El tiempo se calcula automáticamente. Solo un responsable puede corregirlo.</p>'}</section>

  <section class="card stack"><h2>¿El equipo queda operativo?</h2><div class="optgrid">${opt('eq', 'SI', 'Sí')}${opt('eq', 'SI_OBSERVACIONES', 'Sí, pero con observaciones')}${opt('eq', 'NO', 'No')}</div>
    <label id="obs-wrap" hidden>Observaciones<textarea name="notes" rows="3" placeholder="Qué hay que vigilar o tener en cuenta"></textarea></label>
    <div id="no-wrap" class="warnbox" hidden><strong>⚠ Así no se puede resolver.</strong> Si el equipo no queda operativo, déjala pendiente de actuación e indica qué queda pendiente.
      <label style="margin-top:.6rem">¿Qué queda pendiente? (obligatorio)<textarea name="pending" rows="3"></textarea></label>
      <button type="button" class="btn btn-hold" id="go-pend" style="margin-top:.6rem">🟠 DEJAR PENDIENTE DE ACTUACIÓN</button></div></section>

  <section class="card stack"><h2>Fotografías de la reparación</h2><div class="row gap wrap"><button type="button" class="btn btn-photo" id="btn-camera">📷 AÑADIR FOTO</button><button type="button" class="btn" id="btn-gallery">🖼 Elegir de la galería</button></div>
    <input type="file" id="in-camera" accept="image/*" capture="environment" hidden><input type="file" id="in-gallery" accept="image/*" multiple hidden><div class="previews" id="previews"></div></section>

  <button class="btn btn-xl btn-resolve" id="send">MARCAR COMO RESUELTA</button></form>`);
  return { html, after: () => wireResolve(id) };
}
function wireResolve(id) {
  const f = document.getElementById('fres'), pid = Number(id), files = []; let busy = false;
  const mats = document.getElementById('mats');
  const addRow = () => { const r = document.createElement('div'); r.className = 'matrow';
    r.innerHTML = `<input name="m_name" list="catalog" placeholder="Material (ej. Rodamiento 6204)" autocomplete="off"><input name="m_qty" inputmode="decimal" placeholder="Cant." value="1"><input name="m_unit" list="units" value="Ud" placeholder="Unidad"><input name="m_notes" placeholder="Observaciones"><button type="button" class="btn btn-sm" aria-label="Quitar">✕</button>`;
    r.querySelector('button').onclick = () => r.remove();
    r.querySelector('[name=m_name]').onchange = e => { const o = [...document.querySelectorAll('#catalog option')].find(x => x.value.toLowerCase() === e.target.value.trim().toLowerCase()); if (o) { r.querySelector('[name=m_unit]').value = o.dataset.unit || 'Ud'; r.dataset.cost = o.dataset.cost || ''; } };
    mats.append(r); };
  document.getElementById('addmat').onclick = addRow; addRow();
  const eqs = f.querySelectorAll('input[name=eq]'), obs = document.getElementById('obs-wrap'), no = document.getElementById('no-wrap'), send = document.getElementById('send');
  const sync = () => { const v = f.querySelector('input[name=eq]:checked')?.value; obs.hidden = v !== 'SI_OBSERVACIONES'; no.hidden = v !== 'NO'; send.hidden = v === 'NO'; };
  eqs.forEach(e => e.onchange = sync);
  document.getElementById('go-pend').onclick = () => { const t = f.pending.value.trim(); if (t.length < 5) { f.pending.focus(); return alert('Indica qué queda pendiente.'); }
    sessionStorage.setItem('pause_prefill', t); location.hash = `#/incidencia/${id}/pendiente`; };
  const prev = document.getElementById('previews');
  const paint = () => { prev.innerHTML = ''; files.forEach((fl, k) => { const dv = document.createElement('div'); dv.className = 'pv'; const im = document.createElement('img'); im.src = URL.createObjectURL(fl); im.alt = 'Vista previa';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Quitar foto'); b.onclick = () => { files.splice(k, 1); paint(); }; dv.append(im, b); prev.append(dv); }); };
  const add = async list => { busy = true; for (const fl of list) if (files.length < 10 && fl.type.startsWith('image/')) files.push(await compressImage(fl)); paint(); busy = false; };
  const cam = document.getElementById('in-camera'), gal = document.getElementById('in-gallery');
  document.getElementById('btn-camera').onclick = () => cam.click(); document.getElementById('btn-gallery').onclick = () => gal.click();
  cam.onchange = () => { const l = [...cam.files]; cam.value = ''; add(l); }; gal.onchange = () => { const l = [...gal.files]; gal.value = ''; add(l); };

  f.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const type = f.querySelector('input[name=type]:checked')?.value, eq = f.querySelector('input[name=eq]:checked')?.value, work = f.work.value.trim(), notes = f.notes.value.trim();
    if (!type) return alert('Indica cómo se ha resuelto.');
    if (work.length < 5) { f.work.focus(); return alert('Describe el trabajo realizado.'); }
    if (!eq) return alert('Indica si el equipo queda operativo.');
    if (eq === 'SI_OBSERVACIONES' && notes.length < 3) { f.notes.focus(); return alert('Indica las observaciones del equipo.'); }
    const materials = [...mats.querySelectorAll('.matrow')].map(r => ({ name: r.querySelector('[name=m_name]').value.trim(), quantity: num(r.querySelector('[name=m_qty]').value.replace(',', '.')),
      unit: r.querySelector('[name=m_unit]').value, notes: r.querySelector('[name=m_notes]').value, unit_cost: num(r.dataset.cost) })).filter(m => m.name);
    if (materials.some(m => !(m.quantity > 0))) return alert('Revisa la cantidad de los materiales.');
    const minutes = f.hours ? (num(f.hours.value) || 0) * 60 + (num(f.minutes.value) || 0) : null;
    send.disabled = true; send.textContent = 'Guardando…';
    try {
      if (files.length) await rpc('register_photos', { p_id: pid, p_kind: 'REPARACION', p_paths: await uploadPhotos(pid, files) });
      const r = await rpc('resolve_incident', { p_id: pid, p_type: type, p_work: work, p_materials: materials, p_minutes: minutes, p_equipment_state: eq, p_notes: notes });
      done(`Incidencia resuelta. Tiempo empleado: ${fmtMin(r.minutes)}.`); location.hash = '#/incidencia/' + id;
    } catch (err) { flash(err.message, 'error'); send.disabled = false; send.textContent = 'MARCAR COMO RESUELTA'; }
  };
}

// ============================================================ DEJAR PENDIENTE DE ACTUACIÓN
export async function viewPause(id) {
  const d = await rpc('incident_detail', { p_id: Number(id) }), i = d.incident;
  if (!d.actions.includes('PAUSE')) throw new Error('Esta incidencia no se puede dejar pendiente ahora mismo (debe estar en proceso y ser tuya o de un responsable).');
  const pre = sessionStorage.getItem('pause_prefill') || ''; sessionStorage.removeItem('pause_prefill');
  const html = shell(`${back('#/incidencia/' + id, esc(i.number))}<h1>🟠 Dejar pendiente de actuación</h1><p class="muted">${esc(i.number)} · ${esc(i.description.slice(0, 90))}</p>
  <form id="fpause" class="stack" novalidate><section class="card stack"><h2>Motivo de la situación pendiente</h2><div class="optgrid">${Object.entries(PAUSE_LABEL).map(([k, v]) => `<label class="opt"><input type="radio" name="reason" value="${k}" required><span>${v}</span></label>`).join('')}</div></section>
  <section class="card stack"><label>Detalle / próxima actuación (obligatorio)<textarea name="detail" rows="4" required placeholder="Ej.: Necesitamos pedir rodamiento 6204. Se solicita compra y se retomará la reparación cuando llegue.">${esc(pre)}</textarea></label>
    <label>Fecha prevista de actuación (opcional)<input type="date" name="expected"></label><label>Observaciones<textarea name="obs" rows="2"></textarea></label></section>
  <button class="btn btn-xl btn-hold" id="send">DEJAR PENDIENTE DE ACTUACIÓN</button></form>`);
  return { html, after: () => { const f = document.getElementById('fpause'); f.onsubmit = e => { e.preventDefault();
    const reason = f.querySelector('input[name=reason]:checked')?.value; if (!reason) return alert('Selecciona el motivo.');
    if (f.detail.value.trim().length < 5) { f.detail.focus(); return alert('Indica el detalle / próxima actuación.'); }
    guard(async () => { await rpc('pause_incident', { p_id: Number(id), p_reason: reason, p_detail: f.detail.value, p_expected: f.expected.value || null, p_obs: f.obs.value });
      done('Incidencia pendiente de actuación. Podrás retomarla cuando quieras.'); location.hash = '#/incidencia/' + id; }, document.getElementById('send')); }; } };
}
