// Gouttes 💧 : une seule cagnotte pour la boutique de l'axolotl et celle du jeu des tubes.
// Elles se gagnent en nourrissant l'axolotl chaque jour et avec les jeux ; le solde est recalculé depuis les jours de soins
// (rien à tricher ni à perdre), seules les dépenses sont enregistrées.

import * as store from './store.js';
import { toDay, addDays, startOfWeek } from './util.js';
import { caredDays } from './care.js';

export const DROPS = { welcome: 50, day: 10, week: 30, star: 2, boss: 10 };

// Étoiles du jeu des tubes : la meilleure note de chaque niveau, sur tous les téléphones du compte.
// Chaque étoile ne rapporte qu'une fois (rejouer un niveau déjà à 3 ⭐ ne rapporte rien).
export function gameStars() {
  let n = 0;
  for (const r of store.all('app_meta')) {
    if (!r.key.startsWith('game:') || !r.value || !r.value.stars) continue;
    for (const v of Object.values(r.value.stars)) n += v || 0;
  }
  return n;
}
// Boss vaincus (chacun compte une fois, même s'il est battu sur les deux téléphones)
export function bossesBeaten() {
  const set = new Set();
  for (const r of store.all('app_meta')) {
    if (r.key.startsWith('game:') && r.value && r.value.bosses) for (const n of Object.keys(r.value.bosses)) set.add(n);
  }
  return set.size;
}

// Début de la cagnotte : éclosion de l'axolotl ou première visite d'une boutique
function since() {
  const pet = store.meta('pet');
  const shop = store.meta('gameShop');
  return [pet && pet.hatched, shop && shop.since].filter(Boolean).sort()[0] || null;
}

export function startWallet() {
  if (since()) return;
  store.setMeta('gameShop', { ...(store.meta('gameShop') || {}), since: toDay() });
}

export function wallet() {
  const from = since();
  const today = toDay();
  const days = from ? [...caredDays()].filter((d) => d >= from && d <= today) : [];
  const perWeek = new Map();
  for (const d of days) { const k = startOfWeek(d); perWeek.set(k, (perWeek.get(k) || 0) + 1); }
  const fullWeeks = [...perWeek.values()].filter((n) => n >= 5).length;
  const pet = store.meta('pet');
  const shop = store.meta('gameShop');
  const spent = ((pet && pet.spent) || 0) + ((shop && shop.spent) || 0);
  const stars = gameStars();
  return { balance: DROPS.welcome + DROPS.day * days.length + DROPS.week * fullWeeks + DROPS.star * stars + DROPS.boss * bossesBeaten() - spent, caredCount: days.length, fullWeeks, stars };
}

// Série en cours : jours de soins d'affilée jusqu'à aujourd'hui (ou hier si l'axolotl n'a pas encore mangé)
export function streak() {
  const set = caredDays();
  let d = toDay();
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
