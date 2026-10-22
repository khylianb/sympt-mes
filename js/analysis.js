// Calculs des synthèses (utilisés à l'écran et dans le PDF).

import * as store from './store.js';
import { dayRange, addDays } from './util.js';
import { SIDES } from './catalogue.js';

export function describeDetails(log) {
  const def = store.symptomDef(log.symptom_key);
  const parts = [];
  for (const f of def.fields || []) {
    const v = log.details && log.details[f.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (f.type === 'zones') {
      const z = Object.entries(v).map(([part, side]) => {
        const s = SIDES.find((x) => x.id === side);
        return s ? `${part} ${s.text}` : part;
      });
      if (z.length) parts.push(z.join(', '));
    } else if (Array.isArray(v)) parts.push(v.join(', '));
    else if (f.type === 'choice') parts.push(`${f.label} : ${v.toLowerCase()}`);
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
  for (const t of ['symptom_logs', 'day_notes']) {
    for (const r of store.all(t)) if (!r.deleted && (!min || r.day < min)) min = r.day;
  }
  return min;
}

export function analyse(from, to) {
  const logsByDay = indexByDay(store.all('symptom_logs'));

  const days = dayRange(from, to).map((day) => {
    const logs = (logsByDay.get(day) || []).map((l) => ({ ...l, def: store.symptomDef(l.symptom_key) }));
    const scaled = logs.filter((l) => !l.def.noScale && l.intensity != null);
    const note = store.get('day_notes', day);
    // sick : les vrais symptômes (sans les états normaux comme « selles moulées »)
    const sick = logs.filter((l) => !l.def.normal);
    const nothing = !!(note && note.nothing) && !sick.length;
    const calm = !sick.length && (nothing || logs.length > 0);
    const max = scaled.length ? Math.max(...scaled.map((l) => l.intensity)) : (calm ? 0 : null);
    const avg = scaled.length ? scaled.reduce((s, l) => s + l.intensity, 0) / scaled.length : (calm ? 0 : null);
    const sum = scaled.reduce((s, l) => s + l.intensity, 0);
    return {
      day, logs, sick, nothing, max, avg, sum,
      note: note && note.note ? note.note : '',
      urgent: logs.filter((l) => l.def.urgent),
      hasData: logs.length > 0 || nothing || !!(note && note.note),
    };
  });

  // Symptômes les plus fréquents
  const agg = new Map();
  for (const d of days) {
    for (const l of d.sick) {
      const a = agg.get(l.symptom_key) || { key: l.symptom_key, label: l.def.label, urgent: !!l.def.urgent, days: 0, total: 0, scaled: 0, max: 0 };
      a.days++;
      if (!l.def.noScale && l.intensity != null) { a.total += l.intensity; a.scaled++; a.max = Math.max(a.max, l.intensity); }
      agg.set(l.symptom_key, a);
    }
  }
  const top = [...agg.values()]
    .map((a) => ({ ...a, avg: a.scaled ? a.total / a.scaled : null }))
    .sort((a, b) => b.days - a.days || (b.avg || 0) - (a.avg || 0));

  const hardest = days.filter((d) => d.sick.length)
    .sort((a, b) => (b.max - a.max) || (b.sum - a.sum))
    .slice(0, 3);

  const alerts = [];
  for (const d of days) for (const l of d.urgent) alerts.push({ day: d.day, log: l });

  const withData = days.filter((d) => d.max != null);
  const avgMax = withData.length ? withData.reduce((s, d) => s + d.max, 0) / withData.length : null;

  return {
    from, to, days, top, hardest, alerts, avgMax,
    filledDays: days.filter((d) => d.hasData).length,
    symptomDays: days.filter((d) => d.sick.length).length,
  };
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
