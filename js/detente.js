// Onglet « Détente » : choix entre l'axolotl et le jeu des tubes.

import * as store from './store.js';
import { renderGame, bindGame, coverHtml, gameBusy, closeGameShop } from './game.js';
import { renderPet, bindPet, getPet, petState, petMini, petBusy, resetPetView } from './pet.js';
import { eggSvg } from './pet-art.js';
import { esc } from './util.js';

const current = () => store.kvGet('detenteView') || 'hub';
export const openDetente = (v) => { store.kvSet('detenteView', v); if (v === 'pet') resetPetView(); };

function petCardHtml() {
  const pet = getPet();
  if (!pet) {
    return `<button class="hub-card pet-card" data-d="pet">
      <span class="pc-art">${eggSvg(110, 1)}</span>
      <span class="pc-text"><small>Nouveau !</small><b>Un œuf mystère 🥚</b><span>Fais-le éclore et choisis son prénom</span></span>
    </button>`;
  }
  const s = petState(pet);
  const line = { joy: 'Tout content aujourd’hui 🩷', happy: 'T’attend pour ta journée ✏️', sad: 'Un peu triste… 🥲', cry: 'Pleure, il t’attend 😭' }[s.mood];
  return `<button class="hub-card pet-card mood-${s.mood}" data-d="pet">
    <span class="pc-art">${petMini(110)}</span>
    <span class="pc-text"><small>${esc(s.stage.label)} · 💧 ${s.balance}</small><b>${esc(pet.name)}</b><span>${line}</span></span>
  </button>`;
}

export function renderDetente(container) {
  const v = current();
  if (v === 'pet') { renderPet(container); return; }
  if (v === 'tubes') { renderGame(container); return; }
  container.innerHTML = `<div class="hub">
    ${petCardHtml()}
    <button class="hub-card" data-d="tubes">${coverHtml()}</button>
  </div>`;
}

// Toucher l'onglet Détente déjà ouvert ramène au choix
export const detenteHome = () => { closeGameShop(); store.kvSet('detenteView', 'hub'); };

export function bindDetente(container) {
  bindGame(container);
  bindPet(container);
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b || gameBusy() || petBusy()) return;
    const d = b.dataset.d;
    if (d === 'hub') detenteHome();
    else if (d === 'pet' || d === 'tubes') openDetente(d);
    else return;
    renderDetente(container);
    window.scrollTo(0, 0);
  });
}
