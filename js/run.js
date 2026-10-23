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
let engineBest = () => {};
let shopFrom = 'run-start';

// ---------- données ----------
function deviceId() {
  let id = store.kvGet('deviceId');
  if (!id) { id = uuid(); store.kvSet('deviceId', id); }
  return id;
}
const myKey = () => `run:${deviceId()}`;
const myRun = () => store.meta(myKey()) || {};

// Record de distance (en mètres), tous téléphones confondus
export function runBest() {
  let best = 0;
  for (const r of store.all('app_meta')) if (r.key.startsWith('run:') && r.value) best = Math.max(best, r.value.bestDist || 0);
  return best;
}
const fmtM = (m) => `${m.toLocaleString('fr-FR')} m`;

// ---------- améliorations des bonus, payées avec les crevettes attrapées ----------
// Réserve = crevettes attrapées sur tous les téléphones − crevettes dépensées (app_meta « runUp », partagé)
const UP_KEY = 'runUp';
export const UP_COSTS = [40, 90, 180, 350, 600];
export const START_SHIELD_COST = 500;
// Mêmes bonus que dans le moteur (run-3d.js), recopiés ici pour ne pas charger la 3D
const PW = {
  turbo: { icon: '🚀', name: 'Turbo-bulle', dur: 6, step: 1, txt: 'vole au-dessus de tout, vitesse max' },
  magnet: { icon: '🧲', name: 'Aimant', dur: 10, step: 2, txt: 'attire les crevettes des 3 couloirs' },
  fins: { icon: '🦶', name: 'Palmes', dur: 10, step: 2, txt: 'sauts deux fois plus hauts' },
  x2: { icon: '⭐', name: 'Crevettes ×2', dur: 15, step: 3, txt: 'chaque crevette compte double' },
};
const upData = () => store.meta(UP_KEY) || {};
export function shrimpBank() {
  let caught = 0;
  for (const r of store.all('app_meta')) if (r.key.startsWith('run:') && r.value) caught += r.value.caught || 0;
  return caught - (upData().spent || 0);
}
const levelsOf = () => ({ ...(upData().levels || {}) });
function buyUp(k) {
  const d = upData(); const lv = levelsOf();
  const cost = k === 'startShield' ? START_SHIELD_COST : UP_COSTS[lv[k] || 0];
  if (cost === undefined || shrimpBank() < cost || (k === 'startShield' && d.startShield)) return false;
  if (k === 'startShield') store.setMeta(UP_KEY, { ...d, startShield: true, spent: (d.spent || 0) + cost });
  else store.setMeta(UP_KEY, { ...d, levels: { ...lv, [k]: (lv[k] || 0) + 1 }, spent: (d.spent || 0) + cost });
  return true;
}
function shopHtml() {
  const bank = shrimpBank(); const lv = levelsOf(); const d = upData();
  const row = (k) => {
    const P = PW[k]; const n = lv[k] || 0; const cost = UP_COSTS[n];
    return `<div class="up-row">
      <span class="up-ico">${P.icon}</span>
      <span class="up-txt"><b>${P.name}</b><small>${P.txt}</small>
        <span class="up-lv">${UP_COSTS.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<em>${P.dur + n * P.step} s${cost !== undefined ? ` → ${P.dur + (n + 1) * P.step} s` : ' · max'}</em></span></span>
      ${cost === undefined ? '<span class="up-max">MAX</span>' : `<button class="up-buy" data-up="${k}" ${bank < cost ? 'disabled' : ''}>🍤 ${cost}</button>`}
    </div>`;
  };
  return `<p class="run-tag">Atelier des bonus</p>
    <div class="up-bank">🍤 <b>${bank.toLocaleString('fr-FR')}</b> crevettes en réserve</div>
    <div class="up-list">
      ${Object.keys(PW).map(row).join('')}
      <div class="up-row"><span class="up-ico">🫧</span><span class="up-txt"><b>Départ protégé</b><small>commence chaque course avec une bulle-bouclier</small></span>
        ${d.startShield ? '<span class="up-max">✓</span>' : `<button class="up-buy" data-up="startShield" ${bank < START_SHIELD_COST ? 'disabled' : ''}>🍤 ${START_SHIELD_COST}</button>`}</div>
    </div>
    <p class="run-small">Les crevettes de chaque course remplissent la réserve (en plus des gouttes 💧).</p>
    <button class="run-go" data-run="shop-close">C’est bon</button>`;
}
// Fin de partie : 1 goutte pour 5 crevettes, dans la limite du plafond du jour
function record({ dist, shrimps }) {
  const day = toDay();
  const before = dropsOn(day);
  const r = myRun();
  const days = { ...(r.days || {}) };
  days[day] = (days[day] || 0) + Math.floor(shrimps / DROPS.runShrimps);
  const oldBest = runBest();
  store.setMeta(myKey(), { ...r, bestDist: Math.max(r.bestDist || 0, dist), days, games: (r.games || 0) + 1, caught: (r.caught || 0) + shrimps });
  return { drops: dropsOn(day) - before, capped: dropsOn(day) >= DROPS.runDay, newBest: dist > oldBest && oldBest > 0, first: !oldBest, best: Math.max(oldBest, dist) };
}

// ---------- couverture dans la liste des jeux ----------
export function runCover() {
  const best = runBest();
  return `<div class="run-cover" aria-hidden="true">
    <span class="cover-sticker">Nouveau · 3D ✨</span>
    <div class="rc-scene"><i class="rc-ray"></i><i class="rc-ray r2"></i><span class="rc-axo">${axoBadge()}</span><span class="rc-shrimp">🍤</span><span class="rc-jelly">🪼</span><span class="rc-fish">🐠</span></div>
    <div class="cover-title">Axolo Run</div>
    <div class="cover-sub">Nage, esquive, attrape les crevettes${best ? ` · record ${fmtM(best)}` : ''}</div>
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
const HEART = '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21C5 15.5 1 12 1 7.2 1 3.8 3.6 1.5 6.6 1.5c2.2 0 4 1.2 5.4 3 1.4-1.8 3.2-3 5.4-3 3 0 5.6 2.3 5.6 5.7C23 12 19 15.5 12 21z"/></svg>';
const lifeHtml = (n) => Array.from({ length: 3 }, (_, i) => `<i class="hp ${i < n ? 'on' : ''}">${HEART}</i>`).join('');

const meterHtml = (best) => `<b id="run-dist">0</b><span>m</span>
  ${best ? `<div class="run-to-best"><i id="run-best-bar"></i></div><small id="run-best-txt">record ${fmtM(best)}</small>` : ''}`;

function stageHtml() {
  const best = runBest();
  return `<div class="run-stage">
    <div class="run-hud">
      <button class="icon-btn run-back" data-d="hub" aria-label="Retour aux jeux">‹</button>
      <span class="run-life" id="run-life" aria-label="Vies">${lifeHtml(3)}</span>
      <span class="run-pill run-shrimps">🍤 <b id="run-shrimps">0</b></span>
    </div>
    <div class="run-meter" id="run-meter" hidden>${meterHtml(best)}</div>
    <div class="run-powers" id="run-powers"></div>
    <div class="run-banner" id="run-banner"></div>
    <div class="run-flash" id="run-flash"></div>
    <div class="run-panel" id="run-loading"><p class="run-tag">Axolo Run</p><p>Chargement des fonds marins… 🫧</p></div>
    <div class="run-panel" id="run-start" hidden>
      <p class="run-tag">Axolo Run</p>
      <h2>Prêt${getPet() ? ` ${esc(getPet().name)}` : ''} ?</h2>
      <div class="run-moves"><span><b>← →</b>couloir</span><span><b>↑</b>sauter</span><span><b>↓</b>roulade</span></div>
      <p>Saute par-dessus les rochers, roule sous les filets, évite les méduses. Plus tu vas loin, plus ça va vite !</p>
      <p class="run-small">🍤 ${DROPS.runShrimps} crevettes = 1 💧 (jusqu’à ${DROPS.runDay} 💧 par jour)${best ? ` · record : ${fmtM(best)}` : ''}</p>
      <div class="run-row"><button class="run-go ghost" data-run="shop">🔧 Bonus</button><button class="run-go" data-run="play">Nager !</button></div>
    </div>
    <div class="run-panel" id="run-over" hidden></div>
    <div class="run-panel run-shop" id="run-shop" hidden></div>
  </div>`;
}

function overHtml(res, out) {
  return `<p class="run-tag">${out.newBest ? '🏆 Nouveau record !' : out.first ? 'Première course !' : 'Aïe, c’est fini !'}</p>
    <div class="run-big">${res.dist.toLocaleString('fr-FR')}<small> m</small></div>
    <p>${res.shrimps} crevette${res.shrimps > 1 ? 's' : ''} attrapée${res.shrimps > 1 ? 's' : ''} · record ${fmtM(out.best)}</p>
    ${out.drops ? `<span class="run-drops">+${out.drops} 💧 pour ton axolotl</span>`
      : out.capped ? `<span class="run-drops muted">Plafond du jour atteint (${DROPS.runDay} 💧) : reviens demain !</span>`
      : `<span class="run-drops muted">Attrape ${DROPS.runShrimps} crevettes pour gagner une goutte 💧</span>`}
    <p class="run-small">🍤 Réserve : ${shrimpBank().toLocaleString('fr-FR')} crevettes</p>
    <div class="run-row"><button class="run-go ghost" data-run="shop">🔧 Bonus</button><button class="run-go" data-run="play">Rejouer</button></div>
    <button class="run-link" data-d="hub">Retour aux jeux</button>`;
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
    const best = runBest();
    const look = { colors: COLORS[(pet && pet.color) || 'rose'] || COLORS.rose, equipped: (pet && pet.equipped) || {}, bestDist: best, levels: levelsOf(), startShield: !!upData().startShield };
    const $ = (id) => el.querySelector('#' + id);
    // Annonce au centre de l'écran (paliers, record)
    const banner = (html, cls = '') => {
      const b = $('run-banner');
      b.className = `run-banner ${cls}`; b.innerHTML = html;
      void b.offsetWidth; b.classList.add('show');
    };
    let lastDist = -1;
    let curBest = best;
    engine = await mount(el, look, {
      onReady: () => { $('run-loading').hidden = true; $('run-start').hidden = false; },
      onScore: (s) => {
        $('run-meter').hidden = false;
        if (s.dist !== lastDist) {
          lastDist = s.dist;
          $('run-dist').textContent = s.dist.toLocaleString('fr-FR');
          const bar = $('run-best-bar');
          if (bar) bar.style.width = `${Math.min(100, s.dist / curBest * 100)}%`;
        }
        $('run-shrimps').textContent = s.shrimps;
        const life = $('run-life');
        life.querySelectorAll('.hp').forEach((h, i) => {
          if (i >= s.hearts && h.classList.contains('on')) { h.classList.remove('on'); h.classList.add('break'); }
          if (i < s.hearts) { h.classList.add('on'); h.classList.remove('break'); }
        });
        life.classList.toggle('low', s.hearts === 1);
        life.classList.toggle('shielded', !!s.shield);
        $('run-powers').innerHTML = (s.powers || []).map((p) => `<span class="run-pw" style="--k:${(p.left / p.dur).toFixed(3)}"><b>${p.icon}</b><i></i></span>`).join('');
      },
      onPower: (type, P) => banner(`<small>Bonus !</small>${P.icon} ${P.name}`, 'power'),
      onShield: () => banner('<small>Ouf !</small>🫧 Bulle éclatée', 'power'),
      onHit: () => { const f = $('run-flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 80); },
      onMilestone: (m) => banner(`<small>Bravo !</small>${m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR')} km` : `${m} m`}`),
      onRecord: () => {
        banner('<small>Nouveau record</small>🏆 Record battu !', 'gold');
        $('run-meter').classList.add('beat');
        const t = $('run-best-txt'); if (t) t.textContent = 'record battu !';
      },
      onEnd: (res) => { const out = record(res); const o = $('run-over'); o.innerHTML = overHtml(res, out); o.hidden = false; $('run-meter').hidden = true; $('run-powers').innerHTML = ''; },
    });
    engineBest = (b) => { curBest = b; lastDist = -1; };
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
    const up = e.target.closest('[data-up]');
    if (up && host) { if (buyUp(up.dataset.up)) { host.querySelector('#run-shop').innerHTML = shopHtml(); } return; }
    const b = e.target.closest('[data-run]');
    if (!b || !engine || !host) return;
    if (b.dataset.run === 'shop') {
      shopFrom = host.querySelector('#run-over').hidden ? 'run-start' : 'run-over';
      host.querySelector('#' + shopFrom).hidden = true;
      const sh = host.querySelector('#run-shop'); sh.innerHTML = shopHtml(); sh.hidden = false;
      return;
    }
    if (b.dataset.run === 'shop-close') {
      host.querySelector('#run-shop').hidden = true;
      const back = host.querySelector('#' + shopFrom);
      if (shopFrom === 'run-over') back.querySelector('.run-small').textContent = `🍤 Réserve : ${shrimpBank().toLocaleString('fr-FR')} crevettes`;
      back.hidden = false;
      return;
    }
    if (b.dataset.run === 'play') {
      host.querySelector('#run-start').hidden = true;
      host.querySelector('#run-over').hidden = true;
      host.querySelector('#run-shop').hidden = true;
      // Chaque partie repart avec le record à jour (bouée et barre de progression)
      const best = runBest();
      const m = host.querySelector('#run-meter');
      m.classList.remove('beat');
      m.innerHTML = meterHtml(best);
      engine.start(best, { levels: levelsOf(), startShield: !!upData().startShield });
      engineBest(best);
    }
  });
}

// Pour les tests automatiques
window.__run = { sim: (s, g) => engine && engine.sim(s, g), act: (a) => engine && engine.act(a), state: () => engine && engine.state(), power: (t) => engine && engine.power(t) };
