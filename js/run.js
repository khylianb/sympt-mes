// Axolo Run : course sous-marine en 3D avec l'axolotl (moteur dans run-3d.js, chargé à la demande).
// Record et gouttes gagnées par jour enregistrés par téléphone dans app_meta « run:<téléphone> ».

import * as store from './store.js';
import { getPet } from './pet.js';
import { COLORS } from './pet-art.js';
import { DROPS, runDropsOn as dropsOn } from './wallet.js';
import { uuid, toDay, esc } from './util.js';

let engine = null;
let host = null;
let loading = false;

// ---------- données ----------
function deviceId() {
  let id = store.kvGet('deviceId');
  if (!id) { id = uuid(); store.kvSet('deviceId', id); }
  return id;
}
const myKey = () => `run:${deviceId()}`;
const myRun = () => store.meta(myKey()) || {};

// Meilleur score, tous téléphones confondus
export function runBest() {
  let best = 0;
  for (const r of store.all('app_meta')) if (r.key.startsWith('run:') && r.value) best = Math.max(best, r.value.best || 0);
  return best;
}
// Fin de partie : 1 goutte pour 5 crevettes, dans la limite du plafond du jour
function record({ score, shrimps }) {
  const day = toDay();
  const before = dropsOn(day);
  const r = myRun();
  const days = { ...(r.days || {}) };
  days[day] = (days[day] || 0) + Math.floor(shrimps / DROPS.runShrimps);
  const oldBest = runBest();
  store.setMeta(myKey(), { ...r, best: Math.max(r.best || 0, score), days, games: (r.games || 0) + 1 });
  return { drops: dropsOn(day) - before, capped: dropsOn(day) >= DROPS.runDay, newBest: score > oldBest, best: Math.max(oldBest, score) };
}

// ---------- couverture dans la liste des jeux ----------
export function runCover() {
  const best = runBest();
  return `<div class="run-cover" aria-hidden="true">
    <span class="cover-sticker">Nouveau · 3D ✨</span>
    <div class="rc-scene"><i class="rc-ray"></i><i class="rc-ray r2"></i><span class="rc-axo">${axoBadge()}</span><span class="rc-shrimp">🍤</span><span class="rc-jelly">🪼</span><span class="rc-fish">🐠</span></div>
    <div class="cover-title">Axolo Run</div>
    <div class="cover-sub">Nage, esquive, attrape les crevettes${best ? ` · record ${best}` : ''}</div>
  </div>`;
}
function axoBadge() {
  const pet = getPet();
  const c = COLORS[(pet && pet.color) || 'rose'] || COLORS.rose;
  return `<svg viewBox="0 0 120 80" width="120" height="80"><g transform="translate(60 44)">
    ${[-1, 1].map((s) => [[-22, -30], [-10, -8], [2, 14]].map(([y, a]) => `<ellipse cx="${s * 38}" cy="${y}" rx="14" ry="5" transform="rotate(${s * a} ${s * 38} ${y})" fill="${c.gills}"/>`).join('')).join('')}
    <ellipse cx="0" cy="-4" rx="36" ry="28" fill="${c.main}"/><ellipse cx="0" cy="8" rx="26" ry="14" fill="${c.belly}"/>
    <circle cx="-14" cy="-8" r="5" fill="#2a1f2a"/><circle cx="14" cy="-8" r="5" fill="#2a1f2a"/><circle cx="-12.5" cy="-10" r="1.6" fill="#fff"/><circle cx="15.5" cy="-10" r="1.6" fill="#fff"/>
    <path d="M-7,4 Q0,10 7,4" fill="none" stroke="#4a1a2e" stroke-width="2.4" stroke-linecap="round"/></g></svg>`;
}

// ---------- écran de jeu ----------
const hearts = (n) => '🩷'.repeat(Math.max(0, n)) + '🤍'.repeat(3 - Math.max(0, n));

function stageHtml() {
  const best = runBest();
  return `<div class="run-stage">
    <div class="run-hud">
      <button class="icon-btn run-back" data-d="hub" aria-label="Retour aux jeux">‹</button>
      <span class="run-pill run-hearts" id="run-hearts">${hearts(3)}</span>
      <span class="run-pill run-score"><b id="run-score">0</b><small>🍤 <span id="run-shrimps">0</span></small></span>
    </div>
    <div class="run-flash" id="run-flash"></div>
    <div class="run-panel" id="run-loading"><p class="run-tag">Axolo Run</p><p>Chargement des fonds marins… 🫧</p></div>
    <div class="run-panel" id="run-start" hidden>
      <p class="run-tag">Axolo Run</p>
      <h2>Prêt${getPet() ? ` ${esc(getPet().name)}` : ''} ?</h2>
      <p>Glisse à gauche ou à droite pour changer de couloir, vers le haut pour sauter. Attrape les crevettes, évite les rochers et les méduses.</p>
      <p class="run-small">🍤 ${DROPS.runShrimps} crevettes = 1 💧 (jusqu’à ${DROPS.runDay} 💧 par jour)${best ? ` · record : ${best}` : ''}</p>
      <button class="run-go" data-run="play">Nager !</button>
    </div>
    <div class="run-panel" id="run-over" hidden></div>
  </div>`;
}

function overHtml(res, out) {
  return `<p class="run-tag">${out.newBest ? '🏆 Nouveau record !' : 'Aïe, la méduse !'}</p>
    <div class="run-big">${res.score}</div>
    <p>${res.shrimps} crevette${res.shrimps > 1 ? 's' : ''} · ${res.dist} m · record ${out.best}</p>
    ${out.drops ? `<span class="run-drops">+${out.drops} 💧 pour ton axolotl</span>`
      : out.capped ? `<span class="run-drops muted">Plafond du jour atteint (${DROPS.runDay} 💧) : reviens demain !</span>`
      : `<span class="run-drops muted">Attrape ${DROPS.runShrimps} crevettes pour gagner une goutte 💧</span>`}
    <div class="run-row"><button class="run-go ghost" data-d="hub">Retour</button><button class="run-go" data-run="play">Rejouer</button></div>`;
}

export function renderRun(container) {
  // Une partie en cours n'est jamais redessinée (synchronisation, retour sur l'onglet…)
  if (host && host.isConnected && container.contains(host)) return;
  container.innerHTML = stageHtml();
  host = container.querySelector('.run-stage');
  mountEngine();
}

async function mountEngine() {
  if (loading) return;
  loading = true;
  const el = host;
  try {
    const { mount } = await import('./run-3d.js');
    if (el !== host || !el.isConnected) return;
    const pet = getPet();
    const look = { colors: COLORS[(pet && pet.color) || 'rose'] || COLORS.rose, equipped: (pet && pet.equipped) || {} };
    const $ = (id) => el.querySelector('#' + id);
    engine = await mount(el, look, {
      onReady: () => { $('run-loading').hidden = true; $('run-start').hidden = false; },
      onScore: (s) => { $('run-score').textContent = s.score; $('run-shrimps').textContent = s.shrimps; $('run-hearts').textContent = hearts(s.hearts); },
      onHit: () => { const f = $('run-flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 80); },
      onEnd: (res) => { const out = record(res); const o = $('run-over'); o.innerHTML = overHtml(res, out); o.hidden = false; },
    });
    if (el !== host || !el.isConnected) { engine.destroy(); engine = null; }
  } catch (e) {
    console.error(e);
    const l = el.querySelector('#run-loading');
    if (l) l.innerHTML = `<p class="run-tag">Oups</p><p>${navigator.onLine ? 'Le jeu n’a pas pu démarrer sur ce téléphone.' : 'Connecte-toi une première fois à internet pour télécharger le jeu.'}</p><button class="run-go ghost" data-d="hub">Retour</button>`;
  } finally {
    loading = false;
  }
}

export function leaveRun() {
  if (engine) { engine.destroy(); engine = null; }
  host = null;
}

export const runBusy = () => false;

export function bindRun(container) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-run]');
    if (!b || !engine || !host) return;
    if (b.dataset.run === 'play') {
      host.querySelector('#run-start').hidden = true;
      host.querySelector('#run-over').hidden = true;
      engine.start();
    }
  });
}

// Pour les tests automatiques
window.__run = { sim: (s) => engine && engine.sim(s) };
