// Écran « Aujourd'hui » : symptômes, note, repas.

import * as store from './store.js';
import { CATEGORIES, MEAL_SLOTS, MEAL_TAGS } from './catalogue.js';
import { recentFoods, usualSymptoms } from './analysis.js';
import { esc, $, $$, debounce, nowTime, uuid, intensityColor, toast } from './util.js';
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

  const nothingOn = note.nothing && logs.size === 0;
  let html = `
    <button class="nothing ${nothingOn ? 'on' : ''}" data-act="nothing">
      ${nothingOn ? '✓ Rien à signaler aujourd’hui' : '🙂 Rien à signaler aujourd’hui'}
    </button>
    <h2 class="section-title">Symptômes</h2>`;

  if (usual.length) {
    html += `<div class="card"><div class="cat-title static">★ Habituels</div>
      ${usual.map((k) => symptomHtml(defs.find((d) => d.key === k), logs.get(k))).join('')}</div>`;
  }

  html += '<div class="card cats">';
  for (const cat of CATEGORIES) {
    const items = defs.filter((d) => d.cat === cat.id);
    const n = items.filter((d) => logs.has(d.key)).length;
    const open = openCats.has(cat.id) || (n > 0 && !closedCats.has(cat.id));
    html += `<div class="cat ${open ? 'open' : ''}" data-cat="${cat.id}">
      <button class="cat-title" data-act="cat">
        <span>${esc(cat.label)}</span>
        ${n ? `<span class="count">${n}</span>` : ''}
        <span class="chev">›</span>
      </button>
      <div class="cat-body">${open ? items.map((d) => symptomHtml(d, logs.get(d.key))).join('') : ''}</div>
    </div>`;
  }
  html += `</div>
    <button class="add-btn" data-act="add-symptom">+ Ajouter un symptôme</button>
    <label class="note-label" for="day-note">Note libre</label>
    <textarea id="day-note" rows="3" placeholder="Ex. : stress au travail, règles, médicament pris…">${esc(note.note)}</textarea>

    <h2 class="section-title">Repas</h2>
    <div class="card meals">${MEAL_SLOTS.map(slotHtml).join('')}</div>`;

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

function slotHtml(slot) {
  const meals = store.mealsForDay(day).filter((m) => m.slot === slot.id);
  return `<div class="slot" data-slot="${slot.id}">
    <div class="slot-head">
      <span class="slot-name">${slot.icon} ${esc(slot.label)}</span>
      <button class="slot-add" data-act="meal-add">+ ajouter</button>
    </div>
    ${meals.map((m) => `<button class="meal" data-act="meal-edit" data-id="${m.id}">
      <span class="meal-time">${esc(m.time || '')}</span>
      <span class="meal-items">${esc((m.items || []).join(', ') || '—')}</span>
      ${(m.tags || []).length ? `<span class="meal-tags">${m.tags.map((t) => `<span class="tag">${esc(MEAL_TAGS.find((x) => x.id === t)?.label || t)}</span>`).join('')}</span>` : ''}
    </button>`).join('')}
  </div>`;
}

// ---------- actions ----------

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
const saveNumber = debounce((key, field, val) => {
  const log = currentLog(key);
  const details = { ...(log && log.details) };
  if (val === '') delete details[field]; else details[field] = Number(val);
  saveLog(key, { details });
}, 500);

export function bindToday(container) {
  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !container.contains(el)) return;
    const act = el.dataset.act;
    const sym = el.closest('.sym');
    const key = sym && sym.dataset.key;

    if (act === 'nothing') {
      const n = store.noteForDay(day);
      const logs = store.logsForDay(day);
      if (!n.nothing || logs.length) {
        for (const l of logs) store.save('symptom_logs', { ...l, deleted: true });
        store.save('day_notes', { ...n, day, nothing: true });
        toast('Journée enregistrée ✓');
      } else {
        store.save('day_notes', { ...n, day, nothing: false });
      }
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
    } else if (act === 'add-symptom') {
      openAddSymptom();
    } else if (act === 'meal-add') {
      openMeal({ id: null, slot: el.closest('.slot').dataset.slot });
    } else if (act === 'meal-edit') {
      openMeal(store.get('meals', el.dataset.id));
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
      if (n.nothing) store.save('day_notes', { ...n, day, nothing: false });
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

// ---------- feuille repas ----------

function openMeal(existing) {
  const isNew = !existing.id;
  const meal = isNew ? { id: null, day, slot: existing.slot, time: nowTime(), items: [], tags: [] }
    : { ...existing, items: [...(existing.items || [])], tags: [...(existing.tags || [])] };
  const slot = MEAL_SLOTS.find((s) => s.id === meal.slot);

  const persist = () => {
    if (!meal.id) meal.id = uuid();
    store.save('meals', { id: meal.id, day: meal.day, slot: meal.slot, time: meal.time, items: meal.items, tags: meal.tags, deleted: false });
  };

  const body = openSheet(`
    <div class="sheet-head">
      <h3>${slot.icon} ${esc(slot.label)}</h3>
      <input type="time" id="m-time" value="${esc(meal.time || '')}">
    </div>
    <div class="chips" id="m-items"></div>
    <form id="m-form" class="add-food">
      <input id="m-input" type="text" placeholder="Ajouter un aliment…" autocomplete="off" enterkeyhint="done">
      <button class="btn primary small" type="submit">Ajouter</button>
    </form>
    <div class="sub">Récents</div>
    <div class="chips" id="m-recent"></div>
    <div class="sub">Étiquettes</div>
    <div class="chips" id="m-tags"></div>
    <div class="sheet-actions">
      ${!isNew ? '<button class="btn danger" id="m-del">Supprimer</button>' : '<span></span>'}
      <button class="btn primary" id="m-ok">OK</button>
    </div>`, { onClose: () => rerender() });

  const recent = recentFoods(meal.slot);
  const draw = () => {
    $('#m-items', body).innerHTML = meal.items.length
      ? meal.items.map((it, i) => `<button class="chip on" data-i="${i}">${esc(it)} ✕</button>`).join('')
      : '<span class="muted">Aucun aliment pour l’instant</span>';
    const lower = new Set(meal.items.map((x) => x.toLowerCase()));
    const rec = recent.filter((r) => !lower.has(r.toLowerCase()));
    $('#m-recent', body).innerHTML = rec.length
      ? rec.map((r) => `<button class="chip" data-food="${esc(r)}">+ ${esc(r)}</button>`).join('')
      : '<span class="muted">Les aliments saisis apparaîtront ici</span>';
    $('#m-tags', body).innerHTML = MEAL_TAGS.map((t) => `<button class="chip tagchip ${meal.tags.includes(t.id) ? 'on' : ''}" data-tag="${t.id}">${esc(t.label)}</button>`).join('');
  };
  draw();

  const addFood = (name) => {
    name = name.trim();
    if (!name || meal.items.some((x) => x.toLowerCase() === name.toLowerCase())) return;
    meal.items.push(name);
    persist();
    draw();
  };

  $('#m-items', body).onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    meal.items.splice(Number(b.dataset.i), 1);
    persist();
    draw();
  };
  $('#m-recent', body).onclick = (e) => {
    const b = e.target.closest('[data-food]');
    if (b) addFood(b.dataset.food);
  };
  $('#m-tags', body).onclick = (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const t = b.dataset.tag;
    meal.tags = meal.tags.includes(t) ? meal.tags.filter((x) => x !== t) : [...meal.tags, t];
    persist();
    draw();
  };
  $('#m-form', body).onsubmit = (e) => {
    e.preventDefault();
    const input = $('#m-input', body);
    for (const part of input.value.split(',')) addFood(part);
    input.value = '';
  };
  $('#m-time', body).onchange = (e) => { meal.time = e.target.value; if (meal.id) persist(); };
  $('#m-ok', body).onclick = () => {
    const input = $('#m-input', body);
    if (input.value.trim()) { for (const part of input.value.split(',')) addFood(part); }
    closeSheet();
  };
  const del = $('#m-del', body);
  if (del) del.onclick = () => {
    if (!confirm('Supprimer ce repas ?')) return;
    store.save('meals', { ...store.get('meals', meal.id), deleted: true });
    closeSheet();
  };
}
