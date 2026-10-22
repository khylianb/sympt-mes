// Mode démo : utilisé tant que Supabase n'est pas configuré.
// Données fictives, stockées dans une base locale séparée, jamais envoyées.

import * as store from './store.js';
import { toDay, addDays, uuid } from './util.js';

const BREAKFASTS = [['Café', 'Pain', 'Beurre'], ['Thé', 'Biscottes', 'Confiture'], ['Café au lait', 'Céréales']];
const LUNCHES = [['Riz', 'Poulet', 'Courgettes'], ['Pâtes', 'Fromage râpé'], ['Salade composée', 'Thon'], ['Pizza'], ['Quiche', 'Salade']];
const DINNERS = [['Soupe de légumes', 'Pain'], ['Poisson', 'Pommes de terre'], ['Burger', 'Frites'], ['Omelette', 'Haricots verts'], ['Curry de lentilles', 'Riz']];

const TAGS = {
  'Café': ['cafe'], 'Café au lait': ['cafe', 'laitier'], 'Beurre': ['gras', 'laitier'], 'Fromage râpé': ['laitier'],
  'Pizza': ['gras', 'laitier'], 'Quiche': ['gras', 'laitier'], 'Burger': ['gras'], 'Frites': ['gras'],
  'Curry de lentilles': ['epice', 'fibres'], 'Salade composée': ['fibres'], 'Haricots verts': ['fibres'], 'Céréales': ['fibres'],
};

// Générateur pseudo-aléatoire fixe : la démo est identique à chaque ouverture
function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export function seedDemo() {
  if (store.all('meals').length || store.all('symptom_logs').length) return;
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const now = new Date().toISOString();
  const today = toDay();
  const put = (table, row) => store.mergeRemote(table, { ...row, updated_at: now });

  for (let i = 35; i >= 1; i--) {
    const day = addDays(today, -i);
    let fat = false;
    let dairy = false;
    for (const [slot, list, time] of [['breakfast', BREAKFASTS, '08:00'], ['lunch', LUNCHES, '12:30'], ['dinner', DINNERS, '19:45']]) {
      const items = pick(list);
      const tags = [...new Set(items.flatMap((x) => TAGS[x] || []))];
      fat ||= tags.includes('gras');
      dairy ||= tags.includes('laitier');
      put('meals', { id: uuid(), day, slot, time, items, tags, deleted: false });
    }
    if (r() < 0.3) put('meals', { id: uuid(), day, slot: 'drinks', time: '17:00', items: ['Coca'], tags: [], deleted: false });

    const bad = (fat && dairy) ? 0.75 : fat || dairy ? 0.45 : 0.15;
    if (r() < bad) {
      const v = 4 + Math.floor(r() * 5);
      put('symptom_logs', { day, symptom_key: 'abdo_pain', intensity: v, details: { zone: [pick(['Bas droit', 'Autour du nombril', 'Diffuse'])] }, deleted: false });
      if (r() < 0.6) put('symptom_logs', { day, symptom_key: 'diarrhea', intensity: v - 1, details: { count: 3 + Math.floor(r() * 4) }, deleted: false });
      if (r() < 0.5) put('symptom_logs', { day, symptom_key: 'bloating', intensity: 3 + Math.floor(r() * 4), details: {}, deleted: false });
    } else if (r() < 0.4) {
      put('day_notes', { day, note: '', nothing: true });
    }
    if (r() < 0.35) put('symptom_logs', { day, symptom_key: 'fatigue', intensity: 3 + Math.floor(r() * 5), details: {}, deleted: false });
    if (r() < 0.12) put('symptom_logs', { day, symptom_key: 'joint_pain', intensity: 4 + Math.floor(r() * 3), details: { where: ['Genoux'] }, deleted: false });
    if (i === 9) put('symptom_logs', { day, symptom_key: 'blood_stool', intensity: 5, details: {}, deleted: false });
    if (i === 17) put('day_notes', { day, note: 'Repas au restaurant le soir', nothing: false });
  }
  put('app_meta', { key: 'profile', value: { name: 'Exemple (démo)', birth: '' } });
}
