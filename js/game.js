// Onglet « Détente » : jeu des tubes de couleurs (100 niveaux), une progression par
// téléphone et un classement commun synchronisé (via app_meta, clés « game:<téléphone> »).

import * as store from './store.js';
import { LEVELS } from './levels.js';
import { esc, uuid, toast } from './util.js';
import { openSheet, closeSheet } from './ui.js';

const CAP = 4;
const PALETTE = ['#e5484d', '#f08c2e', '#f5d33d', '#8bd346', '#2f9e57', '#2ec4c9', '#3b7ddd', '#8e5bd8', '#f27bbd', '#9a6a4f'];
const COLOR_NAMES = ['rouge', 'orange', 'jaune', 'vert clair', 'vert', 'turquoise', 'bleu', 'violet', 'rose', 'marron'];

let root;
let game = null; // partie en cours : { n, tubes, history, extraUsed, selected, won }

// ---------- joueur de ce téléphone ----------
function deviceId() {
  let id = store.kvGet('deviceId');
  if (!id) { id = uuid(); store.kvSet('deviceId', id); }
  return id;
}
const myKey = () => `game:${deviceId()}`;
const myProfile = () => store.meta(myKey());
function saveProfile(p) { store.setMeta(myKey(), { ...p, updated: new Date().toISOString() }); }

const doneCount = (p) => Object.keys((p && p.best) || {}).length;
const starCount = (p) => Object.values((p && p.best) || {}).reduce((s, x) => s + x, 0);
function nextLevel(p) {
  for (let n = 1; n <= LEVELS.length; n++) if (!(p.best || {})[n]) return n;
  return LEVELS.length;
}

// ---------- règles ----------
function parse(n) {
  const [tubes, par] = LEVELS[n - 1].split(':');
  return { tubes: tubes.split('.').map((t) => [...t].map(Number)), par: Number(par) };
}
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
function pour(tubes, i, j) {
  const t = tubes.map((x) => x.slice());
  const k = Math.min(runLen(t[i]), CAP - t[j].length);
  for (let m = 0; m < k; m++) t[j].push(t[i].pop());
  return t;
}

function starsFor(moves, par, extraUsed) {
  let s = moves <= par + 2 ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1;
  if (extraUsed) s = Math.min(s, 2);
  return s;
}

// ---------- partie ----------
function startLevel(n) {
  game = { n, tubes: parse(n).tubes, history: [], extraUsed: false, selected: null, won: false };
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
const starsHtml = (s) => '⭐'.repeat(s) + '<span class="star-off">☆</span>'.repeat(3 - s);

export function renderGame(container) {
  root = container;
  const p = myProfile();
  if (!p || !p.name) { container.innerHTML = welcomeHtml(); return; }
  ensureGame(p);
  const g = game;
  const { par } = parse(g.n);
  const cols = g.tubes.length <= 6 ? g.tubes.length : Math.ceil(g.tubes.length / 2);

  container.innerHTML = `
    <div class="game-top">
      <button class="game-level" data-g="levels"><b>Niveau ${g.n}</b><small> / ${LEVELS.length} ▾</small></button>
      <span class="game-moves">${g.history.length} coup${g.history.length > 1 ? 's' : ''}</span>
    </div>
    <div class="card game-board">
      <div class="tubes ${g.tubes.length > 6 ? 'two-rows' : ''}" style="--cols:${cols}">
        ${g.tubes.map((t, i) => `<button class="tube ${g.selected === i ? 'sel' : ''} ${isDone(t) ? 'done' : ''}" data-tube="${i}"
          aria-label="Tube ${i + 1} : ${t.length ? t.map((c) => COLOR_NAMES[c]).join(', ') : 'vide'}">
          ${t.map((c) => `<i style="background:${PALETTE[c]}"></i>`).join('')}
        </button>`).join('')}
      </div>
      <p class="game-hint">${g.n <= 3 ? (g.selected === null ? 'Touche un tube, puis celui où verser.<br>' : 'Où veux-tu verser ?<br>') : ''}Objectif ⭐⭐⭐ : ${par + 2} coups max</p>
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
    <p class="muted">Trie les couleurs : chaque tube doit finir d’une seule couleur. 100 niveaux, de plus en plus corsés.</p>
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
    .map((r) => ({ me: r.key === me, name: r.value.name, done: doneCount(r.value), stars: starCount(r.value) }))
    .sort((a, b) => b.done - a.done || b.stars - a.stars);
  const medals = ['🥇', '🥈', '🥉'];
  return `<div class="card leaderboard">
    <h3>🏆 Classement</h3>
    ${players.map((pl, i) => `<div class="lb-row ${pl.me ? 'me' : ''}">
      <span class="lb-medal">${medals[i] || i + 1}</span>
      <span class="lb-name">${esc(pl.name)}${pl.me ? ' <small>(toi)</small>' : ''}</span>
      <span class="lb-score">niveau ${Math.min(pl.done + 1, LEVELS.length)} · ${pl.stars} ⭐</span>
      ${pl.me ? '<button class="lb-edit" data-g="rename" aria-label="Changer de pseudo">✏️</button>' : ''}
    </div>`).join('')}
    ${players.length < 2 ? '<p class="muted small">L’autre joueur apparaîtra ici dès qu’il aura choisi son pseudo sur son téléphone.</p>' : ''}
  </div>`;
}

function winHtml() {
  const g = game;
  const p = myProfile();
  const s = (p.best || {})[g.n] || 0;
  const last = g.n >= LEVELS.length;
  return `<div class="win-overlay">
    <div class="win-card">
      <div class="win-emoji">🎉</div>
      <h3>Niveau ${g.n} réussi !</h3>
      <p class="win-stars">${starsHtml(g.stars)}</p>
      <p class="muted small">${g.history.length} coups${s > g.stars ? ` · ton record : ${s} ⭐` : ''}</p>
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
    <p class="muted small">${doneCount(p)} réussi${doneCount(p) > 1 ? 's' : ''} sur ${LEVELS.length} · ${starCount(p)} ⭐</p>
    <div class="level-grid">
      ${LEVELS.map((_, k) => {
        const n = k + 1;
        const s = (p.best || {})[n] || 0;
        const locked = n > unlocked;
        return `<button class="level-cell ${locked ? 'locked' : ''} ${n === game.n ? 'cur' : ''}" data-level="${n}" ${locked ? 'disabled' : ''}>
          <b>${locked ? '🔒' : n}</b><small>${s ? '⭐'.repeat(s) : '&nbsp;'}</small></button>`;
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

// ---------- actions ----------
function tapTube(i) {
  const g = game;
  if (g.won) return;
  const t = g.tubes[i];
  if (g.selected === null) {
    if (t.length && !isDone(t)) g.selected = i;
  } else if (g.selected === i) {
    g.selected = null;
  } else if (canPour(g.tubes[g.selected], t)) {
    g.history.push(g.tubes);
    g.tubes = pour(g.tubes, g.selected, i);
    g.selected = null;
    persist();
    if (isSolved(g.tubes)) return win(i);
    renderGame(root);
    bump(i);
    return;
  } else if (t.length && !isDone(t)) {
    g.selected = i; // on change de tube de départ
  } else {
    shake(i);
    return;
  }
  renderGame(root);
}

function win(lastTube) {
  const g = game;
  const p = myProfile();
  g.won = true;
  g.stars = starsFor(g.history.length, parse(g.n).par, g.extraUsed);
  const best = { ...(p.best || {}) };
  best[g.n] = Math.max(best[g.n] || 0, g.stars);
  saveProfile({ ...p, best });
  renderGame(root);
  bump(lastTube);
}

function bump(i) {
  const el = root.querySelector(`[data-tube="${i}"]`);
  if (el) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 300); }
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
    if (!b) return;
    const g = game;
    switch (b.dataset.g) {
      case 'start': {
        const name = container.querySelector('#g-name').value.trim();
        if (!name) { container.querySelector('#g-name').focus(); return; }
        saveProfile({ name, best: {} });
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
          toast('Tube vide ajouté (3 ⭐ impossibles sur ce niveau)');
        }
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
