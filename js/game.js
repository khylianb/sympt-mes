// Onglet « Détente » : jeu des tubes de liquides colorés (100 niveaux), une progression par
// téléphone et un classement commun synchronisé (via app_meta, clés « game:<téléphone> »).

import * as store from './store.js';
import { LEVELS } from './levels.js';
import { esc, uuid, toast } from './util.js';
import { openSheet, closeSheet } from './ui.js';

const CAP = 4;
const UNIT = 21; // hauteur d'une couche, en % de l'intérieur du tube (4 couches = 84 %)
const PALETTE = ['#e5484d', '#f08c2e', '#f5d33d', '#8bd346', '#2f9e57', '#2ec4c9', '#3b7ddd', '#8e5bd8', '#f27bbd', '#9a6a4f'];
const COLOR_NAMES = ['rouge', 'orange', 'jaune', 'vert clair', 'vert', 'turquoise', 'bleu', 'violet', 'rose', 'marron'];

let root;
let game = null; // partie en cours : { n, tubes, history, extraUsed, selected, won }
let busy = false; // une animation de versement est en cours

// ---------- joueur de ce téléphone ----------
function deviceId() {
  let id = store.kvGet('deviceId');
  if (!id) { id = uuid(); store.kvSet('deviceId', id); }
  return id;
}
const myKey = () => `game:${deviceId()}`;
const myProfile = () => store.meta(myKey());
function saveProfile(p) { store.setMeta(myKey(), { ...p, updated: new Date().toISOString() }); }

// moves : meilleur nombre de coups par niveau réussi
const records = (p) => (p && p.moves) || {};
const doneCount = (p) => Object.keys(records(p)).length;
const totalMoves = (p) => Object.values(records(p)).reduce((s, x) => s + x, 0);
function nextLevel(p) {
  for (let n = 1; n <= LEVELS.length; n++) if (!records(p)[n]) return n;
  return LEVELS.length;
}

// ---------- règles ----------
const parse = (n) => LEVELS[n - 1].split(':')[0].split('.').map((t) => [...t].map(Number));
const top = (t) => t[t.length - 1];
function runLen(t) {
  let k = 1;
  while (k < t.length && t[t.length - 1 - k] === top(t)) k++;
  return k;
}
const isDone = (t) => t.length === CAP && new Set(t).size === 1;
const isSolved = (tubes) => tubes.every((t) => t.length === 0 || isDone(t));

function canPour(a, b) {
  if (!a.length || a === b || b.length >= CAP || isDone(a)) return false;
  return b.length === 0 || top(b) === top(a);
}
const pourAmount = (a, b) => Math.min(runLen(a), CAP - b.length);
function pour(tubes, i, j) {
  const t = tubes.map((x) => x.slice());
  const k = pourAmount(t[i], t[j]);
  for (let m = 0; m < k; m++) t[j].push(t[i].pop());
  return t;
}

// ---------- son (synthétisé, aucun fichier à charger) ----------
let actx = null;
const soundOn = () => store.kvGet('gameSound') !== false;

// iOS n'autorise le son qu'après un toucher : on prépare le moteur audio à ce moment-là
function unlockAudio() {
  if (!soundOn()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
}

// Écoulement : bruit filtré dont la hauteur monte comme un récipient qui se remplit, plus quelques glouglous
function pourSound(duration) {
  if (!soundOn() || !actx) return;
  try {
    const t = actx.currentTime;
    const len = Math.floor(actx.sampleRate * duration);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    const noise = actx.createBufferSource();
    noise.buffer = buf;
    const band = actx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(450, t);
    band.frequency.linearRampToValueAtTime(1150, t + duration);
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + duration - 0.12);
    g.gain.linearRampToValueAtTime(0, t + duration);
    noise.connect(band).connect(g).connect(actx.destination);
    noise.start(t);
    noise.stop(t + duration);
    for (let b = 0; b < 6; b++) {
      const at = t + 0.04 + Math.random() * (duration - 0.14);
      const f = 280 + Math.random() * 420;
      const o = actx.createOscillator();
      const og = actx.createGain();
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * 1.9, at + 0.06);
      og.gain.setValueAtTime(0, at);
      og.gain.linearRampToValueAtTime(0.07, at + 0.01);
      og.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
      o.connect(og).connect(actx.destination);
      o.start(at);
      o.stop(at + 0.1);
    }
  } catch { /* son indisponible : on continue sans */ }
}

function winSound() {
  if (!soundOn() || !actx) return;
  try {
    const t = actx.currentTime;
    [523, 659, 784, 1047].forEach((f, k) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + k * 0.1);
      g.gain.linearRampToValueAtTime(0.12, t + k * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.1 + 0.35);
      o.connect(g).connect(actx.destination);
      o.start(t + k * 0.1);
      o.stop(t + k * 0.1 + 0.4);
    });
  } catch { /* ignore */ }
}

// ---------- partie ----------
function startLevel(n) {
  game = { n, tubes: parse(n), history: [], extraUsed: false, selected: null, won: false };
  persist();
}
function persist() {
  const { n, tubes, history, extraUsed } = game;
  store.kvSet('gameBoard', { n, tubes, history, extraUsed });
}
function ensureGame(p) {
  if (game) return;
  const saved = store.kvGet('gameBoard');
  if (saved && saved.n >= 1 && saved.n <= LEVELS.length) game = { ...saved, selected: null, won: false };
  else startLevel(nextLevel(p));
}

// ---------- affichage ----------
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// Couches consécutives de même couleur fondues en une seule masse de liquide
function blocks(t) {
  const out = [];
  for (const c of t) {
    const last = out[out.length - 1];
    if (last && last.c === c) last.n++;
    else out.push({ c, n: 1 });
  }
  return out;
}
const liquidHtml = (t) => `<span class="liquid">${blocks(t)
  .map((b) => `<i style="height:${b.n * UNIT}%;--c:${PALETTE[b.c]}"></i>`).join('')}</span>`;

export function renderGame(container) {
  root = container;
  if (busy) return;
  const p = myProfile();
  if (!p || !p.name) { container.innerHTML = welcomeHtml(); return; }
  ensureGame(p);
  const g = game;
  const cols = g.tubes.length <= 6 ? g.tubes.length : Math.ceil(g.tubes.length / 2);
  const rec = records(p)[g.n];
  const hint = [
    g.n <= 3 ? (g.selected === null ? 'Touche un tube, puis celui où verser.' : 'Où veux-tu verser ?') : '',
    rec ? `Ton record sur ce niveau : ${plural(rec, 'coup')}` : '',
  ].filter(Boolean).join('<br>');

  container.innerHTML = `
    <div class="game-top">
      <button class="game-level" data-g="levels"><b>Niveau ${g.n}</b><small> / ${LEVELS.length} ▾</small></button>
      <div class="game-top-right">
        <span class="game-moves">${plural(g.history.length, 'coup')}</span>
        <button class="icon-btn" data-g="sound" aria-label="${soundOn() ? 'Couper le son' : 'Activer le son'}">${soundOn() ? '🔊' : '🔇'}</button>
      </div>
    </div>
    <div class="card game-board">
      <div class="tubes ${g.tubes.length > 6 ? 'two-rows' : ''}" style="--cols:${cols}">
        ${g.tubes.map((t, i) => `<button class="tube ${g.selected === i ? 'sel' : ''} ${isDone(t) ? 'done' : ''}" data-tube="${i}"
          aria-label="Tube ${i + 1} : ${t.length ? t.map((c) => COLOR_NAMES[c]).join(', ') : 'vide'}">${liquidHtml(t)}</button>`).join('')}
      </div>
      ${hint ? `<p class="game-hint">${hint}</p>` : ''}
    </div>
    <div class="game-actions">
      <button class="btn ghost" data-g="undo" ${g.history.length ? '' : 'disabled'}>↩️ Annuler</button>
      <button class="btn ghost" data-g="restart">🔄 Recommencer</button>
      <button class="btn ghost" data-g="extra" ${g.extraUsed ? 'disabled' : ''}>➕ Tube</button>
    </div>
    ${leaderboardHtml()}
    ${g.won ? winHtml() : ''}`;
}

function welcomeHtml() {
  return `<div class="card game-welcome">
    <h3>🎨 Le jeu des tubes</h3>
    <p class="muted">Transvase les liquides : chaque tube doit finir d’une seule couleur. 100 niveaux, de plus en plus corsés.</p>
    <label class="field-block">Ton pseudo pour le classement
      <input id="g-name" type="text" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="Ex. : Cléa">
    </label>
    <button class="btn primary big" data-g="start">C’est parti</button>
  </div>`;
}

function leaderboardHtml() {
  const me = myKey();
  const players = store.all('app_meta')
    .filter((r) => r.key.startsWith('game:') && r.value && r.value.name)
    .map((r) => ({ me: r.key === me, name: r.value.name, done: doneCount(r.value) }))
    .sort((a, b) => b.done - a.done);
  const medals = ['🥇', '🥈', '🥉'];
  return `<div class="card leaderboard">
    <h3>🏆 Classement</h3>
    ${players.map((pl) => {
      // Classement au seul niveau atteint : à niveau égal, même place
      const rank = players.filter((o) => o.done > pl.done).length;
      return `<div class="lb-row ${pl.me ? 'me' : ''}">
      <span class="lb-medal">${medals[rank] || rank + 1}</span>
      <span class="lb-name">${esc(pl.name)}${pl.me ? ' <small>(toi)</small>' : ''}</span>
      <span class="lb-score">niveau ${Math.min(pl.done + 1, LEVELS.length)}</span>
      ${pl.me ? '<button class="lb-edit" data-g="rename" aria-label="Changer de pseudo">✏️</button>' : ''}
    </div>`;
    }).join('')}
    <p class="muted small">${players.length < 2 ? 'L’autre joueur apparaîtra ici dès qu’il aura choisi son pseudo sur son téléphone.'
      : 'Le plus loin dans les niveaux est premier.'}</p>
  </div>`;
}

function winHtml() {
  const g = game;
  const rec = records(myProfile())[g.n];
  const last = g.n >= LEVELS.length;
  return `<div class="win-overlay">
    <div class="win-card">
      <div class="win-emoji">🎉</div>
      <h3>Niveau ${g.n} réussi !</h3>
      <p class="win-moves">en ${plural(g.history.length, 'coup')}</p>
      <p class="muted small">${g.newRecord ? '🏅 Nouveau record sur ce niveau' : `Ton record : ${plural(rec, 'coup')}`}</p>
      ${last ? '<p><b>Bravo, tu as fini les 100 niveaux ! 🏆</b></p>' : ''}
      <div class="btn-row center-row">
        <button class="btn ghost" data-g="replay">Rejouer</button>
        ${last ? '' : '<button class="btn primary" data-g="next">Niveau suivant →</button>'}
      </div>
    </div>
  </div>`;
}

function openLevels() {
  const p = myProfile();
  const unlocked = nextLevel(p);
  const body = openSheet(`
    <h3>Niveaux</h3>
    <p class="muted small">${doneCount(p)} réussi${doneCount(p) > 1 ? 's' : ''} sur ${LEVELS.length} · ${plural(totalMoves(p), 'coup')} au total</p>
    <div class="level-grid">
      ${LEVELS.map((_, k) => {
        const n = k + 1;
        const rec = records(p)[n];
        const locked = n > unlocked;
        return `<button class="level-cell ${locked ? 'locked' : ''} ${n === game.n ? 'cur' : ''}" data-level="${n}" ${locked ? 'disabled' : ''}>
          <b>${locked ? '🔒' : n}</b><small>${rec ? `✓ ${rec} c.` : '&nbsp;'}</small></button>`;
      }).join('')}
    </div>`);
  body.querySelector('.level-grid').onclick = (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    startLevel(Number(b.dataset.level));
    closeSheet();
    renderGame(root);
  };
}

function renameSheet() {
  const p = myProfile();
  const body = openSheet(`
    <h3>Ton pseudo</h3>
    <label class="field-block">Pseudo<input id="g-rename" type="text" maxlength="16" value="${esc(p.name)}" autocomplete="off"></label>
    <div class="sheet-actions"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="g-rename-ok">Enregistrer</button></div>`);
  body.querySelector('[data-close]').onclick = closeSheet;
  body.querySelector('#g-rename-ok').onclick = () => {
    const name = body.querySelector('#g-rename').value.trim();
    if (!name) return;
    saveProfile({ ...myProfile(), name });
    closeSheet();
    renderGame(root);
  };
}

// ---------- animation du versement ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function animatePour(i, j, before, k) {
  const src = root.querySelector(`[data-tube="${i}"]`);
  const dst = root.querySelector(`[data-tube="${j}"]`);
  const board = root.querySelector('.game-board');
  if (!src || !dst || !board || reduceMotion()) { pourSound(0.5); return; }

  const sr = src.getBoundingClientRect();
  const dr = dst.getBoundingClientRect();
  const br = board.getBoundingClientRect();
  const dir = dr.left + dr.width / 2 >= sr.left + sr.width / 2 ? 1 : -1;
  const rad = (70 * Math.PI) / 180;
  const h = sr.height;
  // Le goulot du tube penché arrive juste au-dessus du tube de destination
  const dx = dr.left + dr.width / 2 - dir * (h / 2) * Math.sin(rad) - (sr.left + sr.width / 2);
  const dy = dr.top - 10 + (h / 2) * Math.cos(rad) - (sr.top + sr.height / 2);
  const lifted = src.classList.contains('sel') ? 'translateY(-14px)' : 'translateY(0)';
  const tilted = `translate(${dx}px, ${dy}px) rotate(${dir * 70}deg)`;
  src.style.zIndex = 5;
  await src.animate([{ transform: lifted }, { transform: tilted }], { duration: 260, easing: 'ease-in-out', fill: 'forwards' }).finished;

  // Le filet de liquide, du goulot jusqu'à la surface du tube de destination
  const color = PALETTE[top(before[i])];
  const inner = dr.height - 10;
  const surface = dr.bottom - 6 - inner * ((before[j].length + k) * UNIT) / 100;
  const stream = document.createElement('span');
  stream.className = 'pour-stream';
  stream.style.cssText = `left:${dr.left + dr.width / 2 - br.left - 3}px;top:${dr.top - 10 - br.top}px;`
    + `height:${Math.max(0, surface - dr.top + 10)}px;background:${color}`;
  board.appendChild(stream);
  const dur = 280 + k * 70;
  pourSound(dur / 1000 + 0.1);
  stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 120, fill: 'forwards' });

  // La source se vide, la destination se remplit
  const srcTop = src.querySelector('.liquid').lastElementChild;
  srcTop.style.transition = `height ${dur}ms linear`;
  srcTop.style.height = `${(blocks(before[i]).at(-1).n - k) * UNIT}%`;
  const dstLiquid = dst.querySelector('.liquid');
  const dstTop = blocks(before[j]).at(-1);
  let target = dstLiquid.lastElementChild;
  let from = 0;
  if (target && dstTop && dstTop.c === top(before[i])) from = dstTop.n;
  else {
    target = document.createElement('i');
    target.style.cssText = `height:0%;--c:${color}`;
    dstLiquid.appendChild(target);
  }
  target.getBoundingClientRect(); // fixe le point de départ de la transition
  target.style.transition = `height ${dur}ms linear`;
  target.style.height = `${(from + k) * UNIT}%`;
  await wait(dur);

  stream.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
  await src.animate([{ transform: tilted }, { transform: 'translateY(0)' }], { duration: 230, easing: 'ease-in-out', fill: 'forwards' }).finished;
  stream.remove();
}

// ---------- actions ----------
async function tapTube(i) {
  const g = game;
  if (g.won || busy) return;
  unlockAudio();
  const t = g.tubes[i];
  if (g.selected === null) {
    if (t.length && !isDone(t)) g.selected = i;
  } else if (g.selected === i) {
    g.selected = null;
  } else if (canPour(g.tubes[g.selected], t)) {
    const from = g.selected;
    const before = g.tubes;
    const k = pourAmount(before[from], t);
    g.history.push(before);
    g.tubes = pour(before, from, i);
    g.selected = null;
    persist();
    busy = true;
    try {
      await animatePour(from, i, before, k);
    } finally {
      busy = false;
    }
    if (isSolved(g.tubes)) return win();
    renderGame(root);
    return;
  } else if (t.length && !isDone(t)) {
    g.selected = i; // on change de tube de départ
  } else {
    shake(i);
    return;
  }
  renderGame(root);
}

function win() {
  const g = game;
  const p = myProfile();
  g.won = true;
  const moves = { ...records(p) };
  const prev = moves[g.n];
  g.newRecord = !prev || g.history.length < prev;
  if (g.newRecord) moves[g.n] = g.history.length;
  saveProfile({ ...p, moves });
  winSound();
  renderGame(root);
  celebrate();
}

// Pluie de paillettes et de 💩 sur tout l'écran quand un niveau est réussi
function celebrate() {
  if (reduceMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const rand = (a, b) => a + Math.random() * (b - a);
  let html = '';
  for (let k = 0; k < 70; k++) {
    const poop = k % 3 === 0;
    const style = `left:${rand(0, 100)}%;--d:${rand(2.2, 3.6)}s;--delay:${rand(0, 0.9)}s;`
      + `--dx:${rand(-60, 60)}px;--r:${rand(-540, 540)}deg;`
      + (poop ? `font-size:${rand(24, 40)}px` : `background:${PALETTE[k % PALETTE.length]};width:${rand(6, 10)}px;height:${rand(9, 15)}px`);
    html += poop ? `<span class="poop" style="${style}">💩</span>` : `<span class="glitter" style="${style}"></span>`;
  }
  layer.innerHTML = html;
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 5000);
}

function shake(i) {
  const el = root.querySelector(`[data-tube="${i}"]`);
  if (el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 350); }
}

export function bindGame(container) {
  container.addEventListener('click', (e) => {
    const tube = e.target.closest('[data-tube]');
    if (tube) { tapTube(Number(tube.dataset.tube)); return; }
    const b = e.target.closest('[data-g]');
    if (!b || busy) return;
    const g = game;
    switch (b.dataset.g) {
      case 'start': {
        const name = container.querySelector('#g-name').value.trim();
        if (!name) { container.querySelector('#g-name').focus(); return; }
        saveProfile({ name, moves: {} });
        game = null;
        break;
      }
      case 'undo':
        if (g.history.length) { g.tubes = g.history.pop(); g.selected = null; persist(); }
        break;
      case 'restart':
        startLevel(g.n);
        break;
      case 'extra':
        if (!g.extraUsed) {
          g.tubes = [...g.tubes.map((t) => t.slice()), []];
          g.history = g.history.map((h) => [...h, []]); // « Annuler » garde le tube ajouté
          g.extraUsed = true;
          g.selected = null;
          persist();
          toast('Tube vide ajouté');
        }
        break;
      case 'sound':
        store.kvSet('gameSound', !soundOn());
        if (soundOn()) unlockAudio();
        break;
      case 'next':
        startLevel(Math.min(g.n + 1, LEVELS.length));
        break;
      case 'replay':
        startLevel(g.n);
        break;
      case 'levels':
        openLevels();
        return;
      case 'rename':
        renameSheet();
        return;
    }
    renderGame(container);
  });
}
