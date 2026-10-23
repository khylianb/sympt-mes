// Soins quotidiens de l'axolotl : chaque jour où il est nourri fait grandir l'axolotl et rapporte des gouttes.
// Un jour = une ligne app_meta « care:AAAA-MM-JJ » : rien ne s'écrase entre les deux téléphones.

import * as store from './store.js';
import { toDay } from './util.js';

const PREFIX = 'care:';

export function caredDays() {
  const days = new Set();
  for (const r of store.all('app_meta')) if (r.key.startsWith(PREFIX) && r.value) days.add(r.key.slice(PREFIX.length));
  return days;
}

export const caredToday = () => !!store.meta(PREFIX + toDay());

export function feed() {
  if (caredToday()) return false;
  store.setMeta(PREFIX + toDay(), { fed: new Date().toISOString() });
  return true;
}

// Les journées remplies de l'ancien suivi santé deviennent des jours de soins, puis l'ancien stockage est vidé
export async function migrateLegacy() {
  const days = store.legacyDays();
  if (!days.length) return;
  for (const d of days) if (!store.meta(PREFIX + d)) store.setMeta(PREFIX + d, { fed: d, legacy: true });
  await store.dropLegacy();
}
