// Boutique du jeu des tubes : fioles, liquides, fonds et effets de victoire.
// Payée avec la cagnotte de gouttes commune (js/wallet.js) ; achats et équipement dans app_meta « gameShop ».

import * as store from './store.js';
import { wallet, streak, startWallet, DROPS } from './wallet.js';
import { liquidHtml } from './game.js';
import { esc, toast } from './util.js';
import { openSheet, closeSheet } from './ui.js';

const KEY = 'gameShop';
export const SHOP_ITEMS = [
  { id: 'classic', cat: 'shape', label: 'Tube classique', price: 0 },
  { id: 'syringe', cat: 'shape', label: 'Grosse seringue', price: 150, badge: '💉 Clin d’œil' },
  { id: 'potion', cat: 'shape', label: 'Flacon de potion', price: 200 },
  { id: 'normal', cat: 'liquid', label: 'Liquide normal', price: 0 },
  { id: 'glitter', cat: 'liquid', label: 'Paillettes', price: 80 },
  { id: 'neon', cat: 'liquid', label: 'Néon', price: 100 },
  { id: 'lava', cat: 'liquid', label: 'Lave', price: 120 },
  { id: 'rainbow', cat: 'liquid', label: 'Reflets irisés', price: 150 },
  { id: 'night', cat: 'bg', label: 'Nuit violette', price: 0 },
  { id: 'aurora', cat: 'bg', label: 'Aurore boréale', price: 90 },
  { id: 'sunset', cat: 'bg', label: 'Coucher de soleil', price: 90 },
  { id: 'ocean', cat: 'bg', label: 'Océan', price: 90 },
  { id: 'galaxy', cat: 'bg', label: 'Galaxie', price: 150, streak: 7 },
  { id: 'poop', cat: 'effect', label: 'Pluie de 💩', price: 0 },
  { id: 'hearts', cat: 'effect', label: 'Pluie de cœurs', price: 60 },
  { id: 'stars', cat: 'effect', label: 'Pluie d’étoiles', price: 60 },
  { id: 'bubbles', cat: 'effect', label: 'Bulles', price: 60 },
  { id: 'fireworks', cat: 'effect', label: 'Feux d’artifice', price: 120, streak: 7 },
];
const CATS = [['shape', '🧪 Fioles'], ['liquid', '🌈 Liquides'], ['bg', '🌌 Fonds'], ['effect', '🎉 Effets']];
const DEFAULTS = { shape: 'classic', liquid: 'normal', bg: 'night', effect: 'poop' };
const EMOJIS = { poop: ['💩'], hearts: ['💖', '💗', '💕'], stars: ['⭐', '🌟', '✨'], bubbles: ['🫧'], fireworks: ['🎆', '🎇', '✨'] };

let cat = 'shape';
let tryOn = null;

const data = () => store.meta(KEY) || {};
const save = (d) => store.setMeta(KEY, { ...d, updated: new Date().toISOString() });
const owns = (id) => SHOP_ITEMS.find((i) => i.id === id).price === 0 || (data().owned || []).includes(id);

// Habillage équipé (ou essayé dans la boutique)
export function skin(withTry = false) {
  const s = { ...DEFAULTS, ...(data().equipped || {}) };
  if (withTry && tryOn) s[SHOP_ITEMS.find((i) => i.id === tryOn).cat] = tryOn;
  return s;
}
export const tubesClass = (s = skin()) => `shape-${s.shape} liq-${s.liquid}`;
export const arcadeClass = (s = skin()) => `bg-${s.bg}`;
export const effectEmojis = () => EMOJIS[skin().effect] || EMOJIS.poop;
export const tubeDeco = '<i class="tube-deco" aria-hidden="true"><b></b><u></u></i>';

const miniTubes = (s, tubes = [[0, 6, 0, 2], [6, 6, 2], [4, 4, 4, 4], [7, 8, 7]]) => `<div class="mini-tubes ${tubesClass(s)}">${tubes
  .map((t) => `<span class="tube mini ${t.length === 4 && new Set(t).size === 1 ? 'done' : ''}">${liquidHtml(t)}${tubeDeco}</span>`).join('')}</div>`;

function itemPreview(it) {
  if (it.cat === 'shape') return miniTubes({ ...DEFAULTS, shape: it.id }, [[0, 2, 0], [6, 6]]);
  if (it.cat === 'liquid') return miniTubes({ ...DEFAULTS, liquid: it.id }, [[0, 2, 6], [4, 7]]);
  if (it.cat === 'bg') return `<span class="bg-swatch bg-${it.id}"></span>`;
  return `<span class="fx-preview">${EMOJIS[it.id].join('')}</span>`;
}

export function renderGameShop(container) {
  startWallet();
  const w = wallet();
  const st = streak();
  const s = skin(true);
  const eq = skin();
  const items = SHOP_ITEMS.filter((i) => i.cat === cat);
  const trying = tryOn && SHOP_ITEMS.find((i) => i.id === tryOn);
  container.innerHTML = `<div class="arcade ${arcadeClass(s)}">
    <div class="arcade-bokeh" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="game-top">
      <div class="game-top-left">
        <button class="icon-btn" data-g="shop-close" aria-label="Retour au jeu">‹</button>
        <div class="game-level"><small>Le jeu des tubes</small><b>Boutique</b></div>
      </div>
      <button class="drops-pill" data-gs="drops">💧 ${w.balance}</button>
    </div>
    <div class="gs-preview">${miniTubes(s)}${trying ? '<span class="try-tag">Essayage 👀</span>' : ''}</div>
    <div class="shop-tabs">${CATS.map(([id, label]) => `<button class="${id === cat ? 'on' : ''}" data-gs-cat="${id}">${label}</button>`).join('')}</div>
    <div class="shop-grid">
      ${items.map((it) => {
        const has = owns(it.id);
        const worn = eq[it.cat] === it.id;
        const locked = !has && it.streak && st < it.streak;
        const btn = worn ? '<span class="price eq">✓ Équipé</span>'
          : has ? '<span class="price owned">Équiper</span>'
          : locked ? `<span class="price lock">🔒 Série de ${it.streak} jours</span>`
          : `<span class="price ${w.balance >= it.price ? '' : 'poor'}">💧 ${it.price}</span>`;
        return `<button class="shop-item ${worn ? 'worn' : ''} ${tryOn === it.id ? 'trying' : ''}" data-gs-item="${it.id}">
          ${it.badge ? `<span class="badge">${it.badge}</span>` : ''}
          <span class="gs-art">${itemPreview(it)}</span>
          <b>${esc(it.label)}</b>${btn}</button>`;
      }).join('')}
    </div>
    ${trying && !owns(trying.id) ? (trying.streak && st < trying.streak
      ? `<p class="gs-note">🔒 Se débloque après ${trying.streak} jours remplis d’affilée (série actuelle : ${st} jour${st > 1 ? 's' : ''}).</p>`
      : w.balance >= trying.price
        ? `<button class="btn primary big arcade-go" data-gs="buy">Acheter « ${esc(trying.label)} » · 💧 ${trying.price}</button>`
        : `<button class="glass-btn wide shop-poor" data-gs="drops">Il te manque ${trying.price - w.balance} 💧 · comment en gagner ?</button>`) : ''}
  </div>`;
}

function dropsSheet() {
  const w = wallet();
  const body = openSheet(`
    <h3>💧 Gagner des gouttes</h3>
    <p>Tu as <b>${w.balance} 💧</b>, à dépenser ici ou dans la boutique de ton axolotl.</p>
    <div class="drops-list">
      <div><span>✏️ Chaque journée remplie</span><b>+${DROPS.day} 💧</b></div>
      <div><span>📅 Chaque semaine complète (5 jours sur 7)</span><b>+${DROPS.week} 💧</b></div>
      <div><span>⭐ Chaque nouvelle étoile dans le jeu des tubes</span><b>+${DROPS.star} 💧</b></div>
      <div><span>🎁 Cadeau de bienvenue</span><b>+${DROPS.welcome} 💧</b></div>
    </div>
    <p class="muted small">Certains articles se débloquent aussi avec une série de jours remplis d’affilée (série actuelle : ${streak()} jour${streak() > 1 ? 's' : ''}).</p>
    <div class="sheet-actions"><button class="btn primary" data-close>Compris</button></div>`);
  body.querySelector('[data-close]').onclick = closeSheet;
}

function itemTap(id) {
  const it = SHOP_ITEMS.find((i) => i.id === id);
  if (owns(id)) {
    const d = data();
    save({ ...d, equipped: { ...(d.equipped || {}), [it.cat]: id } });
    tryOn = null;
  } else tryOn = tryOn === id ? null : id;
}

function buy() {
  const it = SHOP_ITEMS.find((i) => i.id === tryOn);
  if (!it) return;
  const w = wallet();
  if (it.streak && streak() < it.streak) return;
  if (w.balance < it.price) { toast(`Il te manque ${it.price - w.balance} 💧 : remplis tes journées pour en gagner`); return; }
  const d = data();
  save({ ...d, owned: [...(d.owned || []), it.id], spent: (d.spent || 0) + it.price, equipped: { ...(d.equipped || {}), [it.cat]: it.id } });
  tryOn = null;
  toast(`${it.label} : équipé ! 🎉`);
}

export function resetGameShop() { tryOn = null; }

// Gère les touches dans la boutique ; renvoie true si l'écran doit être redessiné
export function gameShopClick(e) {
  const c = e.target.closest('[data-gs-cat]');
  if (c) { cat = c.dataset.gsCat; tryOn = null; return true; }
  const it = e.target.closest('[data-gs-item]');
  if (it) { itemTap(it.dataset.gsItem); return true; }
  const b = e.target.closest('[data-gs]');
  if (!b) return false;
  if (b.dataset.gs === 'drops') { dropsSheet(); return false; }
  if (b.dataset.gs === 'buy') { buy(); return true; }
  return false;
}
