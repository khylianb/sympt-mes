// Onglet « Jeux » : la liste des jeux, puis le jeu choisi en plein écran.
// Pour ajouter un jeu : un module qui exporte render / bind / cover…, puis une entrée dans GAMES.

import * as store from './store.js';
import { renderGame, bindGame, coverHtml, gameBusy, closeGameShop } from './game.js';
import { renderRun, bindRun, runCover, runBusy, leaveRun } from './run.js';

const GAMES = [
  { id: 'tubes', cover: coverHtml, render: renderGame, bind: bindGame, busy: gameBusy, leave: closeGameShop },
  { id: 'run', cover: runCover, render: renderRun, bind: bindRun, busy: runBusy, leave: leaveRun },
];

const KEY = 'gameView';
const current = () => GAMES.find((g) => g.id === store.kvGet(KEY)) || null;

function hubHtml() {
  return `<div class="arcade games-hub">
    <div class="arcade-bokeh" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="hub-head"><small>Salle de jeux</small><b>Choisis ton jeu</b></div>
    ${GAMES.map((g) => `<button class="hub-card" data-d="${g.id}">${g.cover()}</button>`).join('')}
    <div class="soon-card"><span>🎁</span><p><b>D’autres jeux arrivent bientôt</b><small>Chaque jeu rapporte des gouttes pour ton axolotl</small></p></div>
  </div>`;
}

export function renderGames(container) {
  const g = current();
  if (g) g.render(container);
  else container.innerHTML = hubHtml();
}

// Toucher l'onglet Jeux déjà ouvert ramène à la liste
export function gamesHome() {
  const g = current();
  if (g && g.leave) g.leave();
  store.kvSet(KEY, null);
}

export function bindGames(container) {
  for (const g of GAMES) g.bind(container);
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b || GAMES.some((g) => g.busy && g.busy())) return;
    const d = b.dataset.d;
    if (d === 'hub') gamesHome();
    else if (GAMES.some((g) => g.id === d)) store.kvSet(KEY, d);
    else return;
    renderGames(container);
    window.scrollTo(0, 0);
  });
}
