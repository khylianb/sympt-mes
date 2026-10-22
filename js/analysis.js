// Calculs des synthèses (utilisés à l'écran et dans le PDF).

import * as store from './store.js';
import { MEAL_TAGS, DIGESTIVE_CAT } from './catalogue.js';
import { dayRange, addDays } from './util.js';

// Un symptôme digestif « notable » : intensité ≥ ce seuil
export const DIGESTIVE_THRESHOLD = 4;

export function describeDetails(log) {
  const def = store.symptomDef(log.symptom_key);
  const parts = [];
  for (const f of def.fields || []) {
    const v = log.details && log.details[f.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) parts.push(v.join(', '));
    else parts.push(`${f.label} : ${String(v).replace('.', ',')}${f.unit ? ' ' + f.unit : ''}`);
  }
  return parts.join(' · ');
}

function indexByDay(rows) {
  const m = new Map();
  for (const r of rows) {
    if (r.deleted) continue;
    if (!m.has(r.day)) m.set(r.day, []);
    m.get(r.day).push(r);
  }
  return m;
}

export function firstDay() {
  let min = null;
  for (const t of ['symptom_logs', 'meals', 'day_notes']) {
    for (const r of store.all(t)) if (!r.deleted && (!min || r.day < min)) min = r.day;
  }
  return min;
}

export function analyse(from, to) {
  const logsByDay = indexByDay(store.all('symptom_logs'));
  const mealsByDay = indexByDay(store.all('meals'));

  const days = dayRange(from, to).map((day) => {
    const logs = (logsByDay.get(day) || []).map((l) => ({ ...l, def: store.symptomDef(l.symptom_key) }));
    const scaled = logs.filter((l) => !l.def.noScale && l.intensity != null);
    const note = store.get('day_notes', day);
    const meals = (mealsByDay.get(day) || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const nothing = !!(note && note.nothing) && !logs.length;
    const max = scaled.length ? Math.max(...scaled.map((l) => l.intensity)) : (nothing ? 0 : null);
    const avg = scaled.length ? scaled.reduce((s, l) => s + l.intensity, 0) / scaled.length : (nothing ? 0 : null);
    const sum = scaled.reduce((s, l) => s + l.intensity, 0);
    return {
      day, logs, meals, nothing, max, avg, sum,
      note: note && note.note ? note.note : '',
      urgent: logs.filter((l) => l.def.urgent),
      hasData: logs.length > 0 || nothing || meals.length > 0 || !!(note && note.note),
    };
  });

  // Symptômes les plus fréquents
  const agg = new Map();
  for (const d of days) {
    for (const l of d.logs) {
      const a = agg.get(l.symptom_key) || { key: l.symptom_key, label: l.def.label, urgent: !!l.def.urgent, days: 0, total: 0, scaled: 0, max: 0 };
      a.days++;
      if (!l.def.noScale && l.intensity != null) { a.total += l.intensity; a.scaled++; a.max = Math.max(a.max, l.intensity); }
      agg.set(l.symptom_key, a);
    }
  }
  const top = [...agg.values()]
    .map((a) => ({ ...a, avg: a.scaled ? a.total / a.scaled : null }))
    .sort((a, b) => b.days - a.days || (b.avg || 0) - (a.avg || 0));

  const hardest = days.filter((d) => d.logs.length)
    .sort((a, b) => (b.max - a.max) || (b.sum - a.sum))
    .slice(0, 3);

  const alerts = [];
  for (const d of days) for (const l of d.urgent) alerts.push({ day: d.day, log: l });

  const withData = days.filter((d) => d.max != null);
  const avgMax = withData.length ? withData.reduce((s, d) => s + d.max, 0) / withData.length : null;

  return {
    from, to, days, top, hardest, alerts, avgMax,
    filledDays: days.filter((d) => d.hasData).length,
    symptomDays: days.filter((d) => d.logs.length).length,
    crossings: crossings(days, logsByDay),
  };
}

// Repas × symptômes : part des repas suivis (le jour même ou le lendemain)
// d'un symptôme digestif d'intensité ≥ seuil, avec / sans l'étiquette ou l'aliment.
function crossings(days, logsByDay) {
  const hitCache = new Map();
  const digestiveHit = (day) => {
    if (hitCache.has(day)) return hitCache.get(day);
    const hit = [day, addDays(day, 1)].some((d) => (logsByDay.get(d) || []).some((l) => {
      const def = store.symptomDef(l.symptom_key);
      return def.cat === DIGESTIVE_CAT && !def.noScale && (l.intensity || 0) >= DIGESTIVE_THRESHOLD;
    }));
    hitCache.set(day, hit);
    return hit;
  };

  const meals = days.flatMap((d) => d.meals);
  if (meals.length < 3) return { meals: meals.length, tags: [], foods: [] };
  const rows = meals.map((m) => ({
    hit: digestiveHit(m.day),
    tags: new Set(m.tags || []),
    foods: new Set((m.items || []).map((i) => i.trim().toLowerCase()).filter(Boolean)),
  }));

  const compare = (has) => {
    let n = 0, h = 0, n2 = 0, h2 = 0;
    for (const r of rows) {
      if (has(r)) { n++; if (r.hit) h++; } else { n2++; if (r.hit) h2++; }
    }
    return { n, hits: h, pctWith: n ? h / n : null, nWithout: n2, pctWithout: n2 ? h2 / n2 : null };
  };

  const tags = MEAL_TAGS.map((t) => ({ id: t.id, label: t.label, ...compare((r) => r.tags.has(t.id)) }))
    .filter((t) => t.n >= 2)
    .sort((a, b) => (b.pctWith - (b.pctWithout || 0)) - (a.pctWith - (a.pctWithout || 0)));

  const foodCount = new Map();
  for (const r of rows) for (const f of r.foods) foodCount.set(f, (foodCount.get(f) || 0) + 1);
  const foods = [...foodCount.entries()].filter(([, n]) => n >= 3)
    .map(([f]) => ({ label: f, ...compare((r) => r.foods.has(f)) }))
    .sort((a, b) => (b.pctWith - (b.pctWithout || 0)) - (a.pctWith - (a.pctWithout || 0)))
    .slice(0, 6);

  return { meals: meals.length, tags, foods };
}

// Aliments récents pour la saisie rapide (ceux du même repas en premier)
export function recentFoods(slot, limit = 24) {
  const m = new Map();
  for (const meal of store.all('meals')) {
    if (meal.deleted) continue;
    for (const raw of meal.items || []) {
      const name = raw.trim();
      if (!name) continue;
      const k = name.toLowerCase();
      const e = m.get(k) || { name, last: '', count: 0, slotCount: 0 };
      e.count++;
      if (meal.slot === slot) e.slotCount++;
      const stamp = `${meal.day} ${meal.time || ''}`;
      if (stamp > e.last) { e.last = stamp; e.name = name; }
      m.set(k, e);
    }
  }
  return [...m.values()]
    .sort((a, b) => (b.slotCount > 0) - (a.slotCount > 0) || b.last.localeCompare(a.last) || b.count - a.count)
    .slice(0, limit)
    .map((e) => e.name);
}

// Symptômes « habituels » : les plus cochés sur les 60 jours précédents
// (le jour affiché est exclu pour que la liste ne bouge pas pendant la saisie)
export function usualSymptoms(today, limit = 6) {
  const from = addDays(today, -60);
  const count = new Map();
  for (const l of store.all('symptom_logs')) {
    if (l.deleted || l.day < from || l.day >= today) continue;
    count.set(l.symptom_key, (count.get(l.symptom_key) || 0) + 1);
  }
  const valid = new Set(store.symptomDefs().map((s) => s.key));
  return [...count.entries()].filter(([k]) => valid.has(k))
    .sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}
