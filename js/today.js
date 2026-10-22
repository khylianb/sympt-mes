// Écran « Aujourd'hui » : symptômes et note.

import * as store from './store.js';
import { CATEGORIES, BODY_PARTS, SIDES } from './catalogue.js';
import { usualSymptoms } from './analysis.js';
import { esc, $, $$, debounce, uuid, intensityColor, toast, toDay } from './util.js';

export function greeting() {
  const h = new Date().getHours();
  if (h < 5 || h >= 18) return 'Bonsoir';
  if (h >= 12) return 'Bon après-midi';
  return 'Bonjour';
}

import { openSheet, closeSheet } from './ui.js';

// Catégories ouvertes / fermées à la main ; par défaut, celles qui ont
// un symptôme coché sont ouvertes.
const openCats = new Set();
const closedCats = new Set();
let day;
let root;

export function renderToday(container, currentDay) {
  day = currentDay;
  root = container;
  const note = store.noteForDay(day);
  const logs = new Map(store.logsForDay(day).map((l) => [l.symptom_key, l]));
  const defs = store.symptomDefs();
  const usual = usualSymptoms(day);

  const nothingOn = note.nothing && ![...logs.values()].some((l) => !store.symptomDef(l.symptom_key).normal);
  const isToday = day === toDay();
  let html = `
    <div class="hero compact">
      <p class="hero-q">${isToday ? 'Comment te sens-tu aujourd’hui ?' : 'Comment s’est passée cette journée ?'}</p>
      <button class="nothing ${nothingOn ? 'on' : ''}" data-act="nothing">
        ${nothingOn ? '✓ Journée sans symptôme enregistrée' : '🌿 Rien à signaler'}
      </button>
    </div>
    <h2 class="section-title"><span class="st-ico">🩺</span>Symptômes</h2>`;

  if (usual.length) {
    html += `<div class="card"><div class="cat-title static"><span class="cat-ico">⭐</span>Habituels</div>
      ${usual.map((k) => symptomHtml(defs.find((d) => d.key === k), logs.get(k))).join('')}</div>`;
  }

  html += '<div class="card cats">';
  for (const cat of CATEGORIES) {
    const items = defs.filter((d) => d.cat === cat.id);
    const n = items.filter((d) => logs.has(d.key)).length;
    const open = openCats.has(cat.id) || (n > 0 && !closedCats.has(cat.id));
    html += `<div class="cat ${open ? 'open' : ''}" data-cat="${cat.id}">
      <button class="cat-title" data-act="cat">
        <span class="cat-ico">${cat.icon}</span>
        <span>${esc(cat.label)}</span>
        ${n ? `<span class="count">${n}</span>` : ''}
        <span class="chev">›</span>
      </button>
      <div class="cat-body">${open ? items.map((d) => symptomHtml(d, logs.get(d.key))).join('') : ''}</div>
    </div>`;
  }
  html += `</div>
    <button class="add-btn" data-act="add-symptom">+ Ajouter un symptôme</button>
    <label class="note-label" for="day-note"><span class="st-ico">📝</span>Note libre</label>
    <textarea id="day-note" rows="3" placeholder="Ex. : stress au travail, règles, médicament pris…">${esc(note.note)}</textarea>`;

  container.innerHTML = html;
}

function symptomHtml(def, log) {
  if (!def) return '';
  const on = !!log;
  const v = log && log.intensity != null ? log.intensity : 5;
  let body = '';
  if (on) {
    if (!def.noScale) {
      body += `<div class="scale">
        <input type="range" min="0" max="10" step="1" value="${v}" data-act="intensity" style="--c:${intensityColor(v)}">
        <span class="scale-val" style="background:${intensityColor(v)}">${v}</span>
      </div>`;
    }
    for (const f of def.fields || []) {
      const val = (log.details || {})[f.id];
      if (f.type === 'multi') {
        const sel = new Set(val || []);
        body += `<div class="field"><span class="field-label">${esc(f.label)}</span><div class="chips">
          ${f.options.map((o) => `<button class="chip ${sel.has(o) ? 'on' : ''}" data-act="multi" data-field="${f.id}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
        </div></div>`;
      } else if (f.type === 'choice') {
        body += `<div class="field"><span class="field-label">${esc(f.label)}</span><div class="chips">
          ${f.options.map((o) => `<button class="chip ${val === o ? 'on' : ''}" data-act="choice" data-field="${f.id}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
        </div></div>`;
      } else if (f.type === 'zones') {
        body += zonesHtml(f, val || {});
      } else if (f.type === 'number') {
        body += `<label class="field inline"><span class="field-label">${esc(f.label)}</span>
          <input type="number" inputmode="decimal" step="${f.step || 1}" min="0" value="${val ?? ''}" data-act="number" data-field="${f.id}">
          ${f.unit ? `<span>${esc(f.unit)}</span>` : ''}</label>`;
      }
    }
  }
  return `<div class="sym ${on ? 'on' : ''} ${def.urgent ? 'urgent' : ''}" data-key="${esc(def.key)}">
    <label class="sym-row">
      <input type="checkbox" ${on ? 'checked' : ''} data-act="toggle">
      <span class="sym-label">${esc(def.label)}${def.urgent ? ' <span class="dot" title="À signaler vite"></span>' : ''}</span>
    </label>
    ${on ? `<div class="sym-body">${body}</div>` : ''}
  </div>`;
}

// Zones du corps : on choisit la partie, puis le côté
function zonesHtml(f, zones) {
  const picked = BODY_PARTS.filter((p) => p.id in zones);
  return `<div class="field"><span class="field-label">${esc(f.label)}</span>
    <div class="chips">${BODY_PARTS.map((p) => `<button class="chip ${p.id in zones ? 'on' : ''}" data-act="zone-part" data-field="${f.id}" data-opt="${esc(p.id)}">${esc(p.id)}</button>`).join('')}</div>
    ${picked.filter((p) => p.side !== false).map((p) => `<div class="zone-side">
      <span class="zone-name">${esc(p.id)}</span>
      <div class="chips">${SIDES.map((s) => `<button class="chip small ${zones[p.id] === s.id ? 'on' : ''}" data-act="zone-side" data-field="${f.id}" data-part="${esc(p.id)}" data-opt="${s.id}">${esc(s.label)}</button>`).join('')}</div>
    </div>`).join('')}
  </div>`;
}

// ---------- actions ----------

// « Rien à signaler » : efface les symptômes du jour (sauf les états normaux), ou annule
export function toggleNothing(d) {
  const n = store.noteForDay(d);
  const logs = store.logsForDay(d).filter((l) => !store.symptomDef(l.symptom_key).normal);
  if (!n.nothing || logs.length) {
    for (const l of logs) store.save('symptom_logs', { ...l, deleted: true });
    store.save('day_notes', { ...n, day: d, nothing: true });
    toast('Journée enregistrée ✓');
  } else {
    store.save('day_notes', { ...n, day: d, nothing: false });
  }
}

function currentLog(key) {
  return store.get('symptom_logs', `${day}|${key}`);
}

function saveLog(key, patch) {
  const prev = currentLog(key) || { day, symptom_key: key, intensity: null, details: {}, deleted: false };
  store.save('symptom_logs', { ...prev, ...patch, day, symptom_key: key });
}

function rerender() {
  const y = window.scrollY;
  renderToday(root, day);
  window.scrollTo(0, y);
}

const saveNote = debounce((text) => {
  const n = store.noteForDay(day);
  store.save('day_notes', { ...n, day, note: text });
}, 600);

const saveIntensity = debounce((key, v) => saveLog(key, { intensity: v }), 250);
// Enregistré à chaque frappe : un choix touché juste après ne doit pas effacer la valeur
function saveNumber(key, field, val) {
  const log = currentLog(key);
  const details = { ...(log && log.details) };
  if (val === '') delete details[field]; else details[field] = Number(val);
  saveLog(key, { details });
}

export function bindToday(container) {
  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !container.contains(el)) return;
    const act = el.dataset.act;
    const sym = el.closest('.sym');
    const key = sym && sym.dataset.key;

    if (act === 'nothing') {
      toggleNothing(day);
      rerender();
    } else if (act === 'cat') {
      const cat = el.closest('.cat').dataset.cat;
      if (el.closest('.cat').classList.contains('open')) { openCats.delete(cat); closedCats.add(cat); }
      else { closedCats.delete(cat); openCats.add(cat); }
      rerender();
    } else if (act === 'multi') {
      e.preventDefault();
      const log = currentLog(key);
      const details = { ...(log && log.details) };
      const set = new Set(details[el.dataset.field] || []);
      if (set.has(el.dataset.opt)) set.delete(el.dataset.opt); else set.add(el.dataset.opt);
      details[el.dataset.field] = [...set];
      saveLog(key, { details });
      for (const c of $$(`.sym[data-key="${CSS.escape(key)}"] [data-act="multi"][data-field="${el.dataset.field}"][data-opt="${CSS.escape(el.dataset.opt)}"]`, container)) {
        c.classList.toggle('on', set.has(el.dataset.opt));
      }
    } else if (act === 'choice' || act === 'zone-part' || act === 'zone-side') {
      e.preventDefault();
      const log = currentLog(key);
      const details = { ...(log && log.details) };
      const f = el.dataset.field;
      if (act === 'choice') {
        details[f] = details[f] === el.dataset.opt ? undefined : el.dataset.opt;
      } else {
        const zones = { ...(details[f] || {}) };
        if (act === 'zone-part') {
          if (el.dataset.opt in zones) delete zones[el.dataset.opt]; else zones[el.dataset.opt] = '';
        } else {
          zones[el.dataset.part] = zones[el.dataset.part] === el.dataset.opt ? '' : el.dataset.opt;
        }
        details[f] = zones;
      }
      if (details[f] === undefined) delete details[f];
      saveLog(key, { details });
      rerender();
    } else if (act === 'add-symptom') {
      openAddSymptom();
    }
  });

  container.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act !== 'toggle') return;
    const key = el.closest('.sym').dataset.key;
    const def = store.symptomDef(key);
    if (el.checked) {
      const prev = currentLog(key);
      saveLog(key, {
        deleted: false,
        intensity: def.noScale ? null : (prev && prev.intensity != null ? prev.intensity : 5),
      });
      const n = store.noteForDay(day);
      if (n.nothing && !def.normal) store.save('day_notes', { ...n, day, nothing: false });
    } else {
      saveLog(key, { deleted: true });
    }
    rerender();
  });

  container.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'day-note') { saveNote(el.value); return; }
    const sym = el.closest('.sym');
    if (!sym) return;
    const key = sym.dataset.key;
    if (el.dataset.act === 'intensity') {
      const v = Number(el.value);
      const color = intensityColor(v);
      for (const s of $$(`.sym[data-key="${CSS.escape(key)}"]`, container)) {
        const r = $('input[type=range]', s);
        if (r && r !== el) r.value = v;
        if (r) r.style.setProperty('--c', color);
        for (const b of $$('.scale-val', s)) { b.textContent = v; b.style.background = color; }
      }
      saveIntensity(key, v);
    } else if (el.dataset.act === 'number') {
      saveNumber(key, el.dataset.field, el.value);
    }
  });
}

// ---------- ajout d'un symptôme personnalisé ----------

function openAddSymptom() {
  const body = openSheet(`
    <h3>Nouveau symptôme</h3>
    <label class="field-block">Nom<input id="ns-label" type="text" placeholder="Ex. : douleur à la mâchoire" autocomplete="off"></label>
    <label class="field-block">Catégorie
      <select id="ns-cat">${CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select>
    </label>
    <label class="check-line"><input id="ns-urgent" type="checkbox"> À signaler vite (affiché en rouge)</label>
    <div class="sheet-actions">
      <button class="btn ghost" data-close>Annuler</button>
      <button class="btn primary" id="ns-save">Ajouter et cocher</button>
    </div>`);
  $('#ns-label', body).focus();
  $('[data-close]', body).onclick = closeSheet;
  $('#ns-save', body).onclick = () => {
    const label = $('#ns-label', body).value.trim();
    if (!label) { $('#ns-label', body).focus(); return; }
    const key = 'c_' + uuid().slice(0, 8);
    const category = $('#ns-cat', body).value;
    store.save('custom_symptoms', { key, label, category, urgent: $('#ns-urgent', body).checked, archived: false });
    saveLog(key, { deleted: false, intensity: 5 });
    openCats.add(category);
    closedCats.delete(category);
    closeSheet();
    rerender();
  };
}
