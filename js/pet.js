// Onglet « Détente » : l'axolotl qui grandit quand la journée est remplie, et sa boutique.
// Tout est calculé à partir des journées remplies depuis l'éclosion (impossible de tricher ou de perdre) ;
// seuls le prénom, la date d'éclosion, les achats et ce qu'il porte sont enregistrés (app_meta « pet »).

import * as store from './store.js';
import { petSvg, eggSvg, STAGES, ITEMS } from './pet-art.js';
import { esc, toast, toDay, addDays, startOfWeek } from './util.js';
import { openSheet, closeSheet } from './ui.js';
import { DROPS, filledDays, wallet } from './wallet.js';

const KEY = 'pet';
const SLOTS = [['head', 'Tête'], ['neck', 'Cou'], ['eyes', 'Yeux'], ['body', 'Tenue'], ['color', 'Couleur']];

let root;
let view = 'home'; // home | shop
let shopSlot = 'head';
let tryOn = null; // article essayé dans la boutique
let busy = false;

export const getPet = () => store.meta(KEY) || null;
const savePet = (p) => store.setMeta(KEY, { ...p, updated: new Date().toISOString() });
export const petBusy = () => busy;

// ---------- calculs ----------
export function petState(pet = getPet()) {
  if (!pet) return null;
  const today = toDay();
  const days = [...filledDays()].filter((d) => d >= pet.hatched && d <= today);
  const set = new Set(days);
  // Une semaine (lundi → dimanche) compte quand au moins 5 jours sont remplis
  const perWeek = new Map();
  for (const d of days) { const k = startOfWeek(d); perWeek.set(k, (perWeek.get(k) || 0) + 1); }
  let si = 0;
  STAGES.forEach((s, i) => { if (days.length >= s.days) si = i; }); // Légendaire en 14 jours remplis
  const next = STAGES[si + 1] || null;
  const filledToday = set.has(today);
  let missed = 0;
  if (!filledToday) {
    for (let d = addDays(today, -1); d >= pet.hatched && !set.has(d); d = addDays(d, -1)) missed++;
  }
  const mood = filledToday ? 'joy' : missed === 0 ? 'happy' : missed === 1 ? 'sad' : 'cry';
  const weekStart = startOfWeek(today);
  return {
    stage: STAGES[si], next, filledCount: days.length, filledToday, missed, mood,
    balance: wallet().balance,
    weekDays: Array.from({ length: 7 }, (_, k) => { const d = addDays(weekStart, k); return { d, on: set.has(d), today: d === today, future: d > today }; }),
    weekCount: perWeek.get(weekStart) || 0,
  };
}

const look = (pet, extra = {}) => ({ color: pet.color || 'rose', equipped: { ...(pet.equipped || {}) }, ...extra });

// Petit axolotl pour l'accueil et la fin de niveau du jeu
export function petMini(size = 90, mood) {
  const pet = getPet();
  if (!pet) return '';
  const s = petState(pet);
  return petSvg({ ...look(pet), stage: s.stage.id, mood: mood || s.mood, size });
}

// ---------- phrases ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// Phrases positives : il fait des compliments et encourage, même quand il est triste
export const COMPLIMENTS = [
  'Tu es exceptionnelle, ne l’oublie jamais ✨', 'Tu es une femme incroyable 👑', 'Tu es tellement forte, je t’admire 💪',
  'Tu es la plus courageuse que je connaisse 🦁', 'Tu illumines la vie de tous ceux qui t’entourent ☀️', 'Ta gentillesse change la vie des gens 🩷',
  'Tu es une infirmière en or 💉✨', 'Tes patients ont une chance folle de t’avoir 🍀', 'Tu es magnifique, à l’intérieur comme à l’extérieur 🌸',
  'Tu es une source d’inspiration 🌟', 'Tu affrontes tout avec une force incroyable 🔥', 'Tu es précieuse, vraiment précieuse 💎',
  'Le monde est plus beau parce que tu es là 🌍', 'Tu es brillante, drôle et pleine de cœur 💖', 'Tu mérites tout le bonheur du monde 🌈',
  'Tu es une vraie warrior, et je suis tellement fier de toi ⚔️', 'Ton courage me bluffe chaque jour 🥹', 'Tu as un cœur immense 🫶',
  'Tu es rayonnante aujourd’hui ✨', 'Tu es une reine, ne l’oublie pas 👑', 'Personne ne prend soin des autres comme toi 💉',
  'Tu es plus forte que tout ce que tu traverses 💪', 'Tu es une personne rare et merveilleuse 🦄', 'Tu rends fiers tous ceux qui t’aiment 🏅',
  'Tu es belle quand tu souris… et même quand tu ne souris pas 😍', 'Ta force tranquille est impressionnante 🌊', 'Tu es une héroïne, ici et à l’hôpital 🦸‍♀️',
  'Tu as tout pour toi : le cœur, la force et le sourire 💫', 'Tu mérites d’être fière de toi, autant que je le suis 🥰', 'Tu es incroyable, et je ne le dirai jamais assez ✨',
  'Je suis tellement fier de toi, tu n’imagines pas 🩷', 'Je t’admire plus que tout 🌟',
];
// Citations (auteurs vérifiés), mêlées aux compliments
export const CITATIONS = [
  ['On ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux.', 'Antoine de Saint-Exupéry'],
  ['Aimer, ce n’est pas se regarder l’un l’autre, c’est regarder ensemble dans la même direction.', 'Antoine de Saint-Exupéry'],
  ['C’est le temps que tu as perdu pour ta rose qui fait ta rose si importante.', 'Antoine de Saint-Exupéry'],
  ['Ce n’est pas parce que les choses sont difficiles que nous n’osons pas, c’est parce que nous n’osons pas qu’elles sont difficiles.', 'Sénèque'],
  ['Dans la vie, rien n’est à craindre, tout est à comprendre.', 'Marie Curie'],
  ['Je dois mon succès à ceci : je n’ai jamais donné ni accepté d’excuse.', 'Florence Nightingale'],
  ['L’espoir est la chose avec des plumes qui se perche dans l’âme.', 'Emily Dickinson'],
  ['Il faut cultiver notre jardin.', 'Voltaire'],
  ['À cœur vaillant, rien d’impossible.', 'Jacques Cœur'],
  ['Petit à petit, l’oiseau fait son nid.', 'Proverbe'],
  ['Après la pluie, le beau temps.', 'Proverbe'],
].map(([t, a]) => `« ${t} » — ${a}`);
// La phrase du jour reste la même toute la journée : surtout des compliments, parfois une citation,
// souvent précédée de son prénom (Réglages → Accueil)
function withName(text, n) {
  const name = (store.meta('first_name') || '').trim();
  return name && n % 2 === 0 && text.startsWith('Tu ') ? `${name}, t${text.slice(1)}` : text;
}
export function dailyCompliment() {
  let h = 0;
  for (const ch of toDay()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (hardDay()) return withName(COMFORT[h % COMFORT.length], h >>> 3);
  if (h % 5 === 0) return CITATIONS[h % CITATIONS.length];
  return withName(COMPLIMENTS[h % COMPLIMENTS.length], h >>> 3);
}
// Coup de blues ou journée difficile : que des mots de réconfort, toujours positifs
export const COMFORT = [
  'Les jours difficiles passent, ta force, elle, reste 🌈', 'Tu traverses ça avec un courage immense, je t’admire 🦁',
  'Même fatiguée, tu restes incroyable 🩷', 'Repose-toi, tu l’as tellement mérité 🛋️', 'Je suis là, tout près de toi 🫶',
  'Tu es plus forte que cette journée 💪', 'Chaque petit pas compte, et tu en fais plein ✨', 'Tu as le droit d’aller doucement aujourd’hui 🌸',
  'Demain sera plus doux, et tu seras toujours aussi formidable ☀️', 'Je t’envoie un énorme câlin 🤗', 'Tu es une battante, et je suis tellement fier de toi 🥹',
  'Tu n’as rien à prouver : tu es déjà extraordinaire 💎', 'Prends soin de toi comme tu prends soin des autres 💉🩷', 'Tu es aimée, tellement aimée 💖',
];
// Journée difficile : forte douleur, symptôme à signaler, ou au moins 3 symptômes aujourd'hui
export function hardDay() {
  const logs = store.logsForDay(toDay()).map((l) => ({ l, def: store.symptomDef(l.symptom_key) })).filter((x) => x.def && !x.def.normal);
  return logs.some((x) => (x.l.intensity || 0) >= 6 || x.def.urgent) || logs.length >= 3;
}
const randomPhrase = () => (Math.random() < 0.85 ? withName(pick(COMPLIMENTS), Math.floor(Math.random() * 4)) : pick(CITATIONS));
export function encouragement(s) {
  return {
    joy: hardDay() ? 'Journée pas facile… mais tu l’as remplie, quelle force 🩷' : 'Merci d’avoir pris soin de toi, tu es formidable 🩷',
    happy: 'Prends une minute pour toi et ta journée : tu le mérites ✏️',
    sad: 'Tu m’as manqué hier ! Tu restes incroyable, on reprend ensemble 🩷',
    cry: 'Tu me manques… et tu es toujours aussi formidable 🩷',
  }[s.mood];
}
function moodLine(pet, s) {
  return s.mood === 'joy' || s.mood === 'happy' ? dailyCompliment() : encouragement(s);
}

// ---------- écrans ----------
function bubblesHtml() {
  return `<div class="tank-bubbles" aria-hidden="true">${Array.from({ length: 9 }, (_, k) => `<i style="left:${8 + k * 10.5}%;--d:${4 + (k % 4)}s;--delay:${-k * 0.9}s;--s:${4 + (k % 3) * 3}px"></i>`).join('')}</div>
    <div class="tank-plants" aria-hidden="true"><span>🌿</span><span>🪸 🌱</span></div>`;
}

function hatchHtml() {
  return `<div class="arcade pet-page">
    <div class="arcade-bokeh" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="game-top"><div class="game-top-left">
      <button class="icon-btn" data-d="hub" aria-label="Retour">‹</button>
      <div class="game-level"><small>Détente</small><b>Un œuf mystère</b></div>
    </div></div>
    <div class="tank">${bubblesHtml()}<div class="pet-stage egg-stage">${eggSvg(150, 1)}</div></div>
    <p class="pet-intro">Un petit axolotl attend de naître 🩷 Il grandit à chaque journée remplie, jusqu’à devenir légendaire en 2 semaines… et il pleure si tu l’oublies !</p>
    <label class="pet-name-field">Choisis son prénom
      <input id="pet-name" type="text" maxlength="14" autocomplete="off" autocapitalize="words" placeholder="Ex. : Bulle">
    </label>
    <button class="btn primary big arcade-go" data-p="hatch">🥚 Faire éclore</button>
  </div>`;
}

function homeHtml(pet, s) {
  const nextTxt = s.next
    ? `Encore ${s.next.days - s.filledCount} journée${s.next.days - s.filledCount > 1 ? 's' : ''} remplie${s.next.days - s.filledCount > 1 ? 's' : ''} pour devenir <b>${s.next.label}</b>`
    : '<b>Forme légendaire atteinte !</b> 👑';
  return `<div class="arcade pet-page">
    <div class="arcade-bokeh" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="game-top">
      <div class="game-top-left">
        <button class="icon-btn" data-d="hub" aria-label="Retour">‹</button>
        <div class="game-level"><small>${esc(s.stage.label)}</small><b>${esc(pet.name)}</b></div>
      </div>
      <button class="drops-pill" data-p="drops">💧 ${s.balance}</button>
    </div>
    <div class="tank mood-${s.mood}">
      ${bubblesHtml()}
      <span class="pet-bubble">${moodLine(pet, s)}</span>
      <button class="pet-stage" data-p="pet" aria-label="Caresser ${esc(pet.name)}">${petSvg({ ...look(pet), stage: s.stage.id, mood: s.mood, size: s.stage.id === 'baby' ? 260 : 230 })}</button>
    </div>
    ${s.filledToday ? '' : `<button class="bonus-banner" data-p="fill"><span class="bb-ico">${s.mood === 'happy' ? '✏️' : '😢'}</span>
      <span class="bb-text"><b>${s.mood === 'happy' ? 'Remplis ta journée' : `${esc(pet.name)} t’attend`}</b><small>${s.mood === 'happy' ? `+${DROPS.day} 💧 et ${esc(pet.name)} sera tout content` : 'Remplis ta journée pour lui faire un câlin 🩷'}</small></span>
      <span class="bb-go">Remplir</span></button>`}
    <div class="pet-progress">
      <div class="pp-head"><span>Cette semaine</span><b>${s.weekCount} / 5 jours</b></div>
      <div class="pp-days">${s.weekDays.map((d, k) => `<span class="${d.on ? 'on' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}"><i>${d.on ? '✓' : ''}</i>${'LMMJVSD'[k]}</span>`).join('')}</div>
      <p class="pp-next">${nextTxt}</p>
    </div>
    <button class="btn primary big arcade-go cheer-btn" data-p="cheer">💗 Remonte-moi le moral</button>
    <div class="game-actions">
      <button class="glass-btn wide" data-p="shop">🛍️ Sa boutique</button>
      <button class="glass-btn wide" data-p="drops">💧 Gagner des gouttes</button>
    </div>
  </div>`;
}

function shopHtml(pet, s) {
  const owned = new Set(pet.owned || []);
  const eq = look(pet).equipped;
  const items = ITEMS.filter((i) => i.slot === shopSlot);
  const preview = look(pet);
  if (tryOn) {
    const it = ITEMS.find((i) => i.id === tryOn);
    if (it.slot === 'color') preview.color = it.id; else preview.equipped[it.slot] = it.id;
  }
  return `<div class="arcade pet-page">
    <div class="arcade-bokeh" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="game-top">
      <div class="game-top-left">
        <button class="icon-btn" data-p="back" aria-label="Retour">‹</button>
        <div class="game-level"><small>Boutique</small><b>${esc(pet.name)}</b></div>
      </div>
      <button class="drops-pill" data-p="drops">💧 ${s.balance}</button>
    </div>
    <div class="tank small">${bubblesHtml()}<div class="pet-stage">${petSvg({ ...preview, stage: s.stage.id, mood: 'happy', size: 150 })}</div>
      ${tryOn ? '<span class="try-tag">Essayage 👀</span>' : ''}</div>
    <div class="shop-tabs">${SLOTS.map(([id, label]) => `<button class="${id === shopSlot ? 'on' : ''}" data-slot="${id}">${label}</button>`).join('')}</div>
    <div class="shop-grid">
      ${items.map((it) => {
        const has = it.slot === 'color' ? owned.has(it.id) : owned.has(it.id);
        const worn = it.slot === 'color' ? (pet.color || 'rose') === it.id : eq[it.slot] === it.id;
        const mini = it.slot === 'color' ? { color: it.id, equipped: {} } : { color: pet.color || 'rose', equipped: { [it.slot]: it.id } };
        const btn = worn ? '<span class="price eq">✓ Porté</span>' : has ? '<span class="price owned">Mettre</span>' : `<span class="price ${s.balance >= it.price ? '' : 'poor'}">💧 ${it.price}</span>`;
        return `<button class="shop-item ${worn ? 'worn' : ''} ${tryOn === it.id ? 'trying' : ''}" data-item="${it.id}">
          ${it.nurse ? '<span class="badge">💉 Infirmière</span>' : ''}
          ${petSvg({ ...mini, stage: 'adult', mood: 'happy', size: 84, shadow: false })}
          <b>${esc(it.label)}</b>${btn}</button>`;
      }).join('')}
      ${shopSlot === 'color' ? `<button class="shop-item ${(pet.color || 'rose') === 'rose' ? 'worn' : ''}" data-item="rose">${petSvg({ color: 'rose', stage: 'adult', mood: 'happy', size: 84, shadow: false })}<b>Couleur rose</b>${(pet.color || 'rose') === 'rose' ? '<span class="price eq">✓ Porté</span>' : '<span class="price owned">Mettre</span>'}</button>` : ''}
    </div>
    ${tryOn && !owned.has(tryOn) ? (() => {
      const it = ITEMS.find((i) => i.id === tryOn);
      return s.balance >= it.price
        ? `<button class="btn primary big arcade-go" data-p="buy">Acheter « ${esc(it.label)} » · 💧 ${it.price}</button>`
        : `<button class="glass-btn wide shop-poor" data-p="drops">Il te manque ${it.price - s.balance} 💧 · comment en gagner ?</button>`;
    })() : ''}
  </div>`;
}

export function renderPet(container) {
  root = container;
  if (busy) return;
  const pet = getPet();
  if (!pet) { container.innerHTML = hatchHtml(); return; }
  const s = petState(pet);
  container.innerHTML = view === 'shop' ? shopHtml(pet, s) : homeHtml(pet, s);
}

// Revient sur sa page (et pas la boutique) quand on rouvre Détente
export function resetPetView() { view = 'home'; tryOn = null; }

// ---------- actions ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function hatch() {
  const input = root.querySelector('#pet-name');
  const name = input.value.trim();
  if (!name) { toast('Choisis d’abord son prénom 🩷'); input.focus(); return; }
  busy = true;
  try {
    const stage = root.querySelector('.egg-stage');
    stage.classList.add('hatching');
    await wait(1400);
    stage.classList.add('flash');
    await wait(350);
    savePet({ name, hatched: toDay(), color: 'rose', owned: [], equipped: {}, spent: 0 });
  } finally {
    busy = false;
  }
  view = 'home';
  renderPet(root);
  const st = root.querySelector('.pet-stage');
  if (st) st.classList.add('born');
  root.querySelector('.pet-bubble').textContent = `Coucou ! Moi c’est ${name} 🩷`;
  sparkle();
}

function sparkle() {
  const tank = root.querySelector('.tank');
  if (!tank) return;
  for (let k = 0; k < 14; k++) {
    const el = document.createElement('span');
    el.className = 'tank-spark';
    el.textContent = ['✨', '🩷', '⭐', '🫧'][k % 4];
    el.style.cssText = `left:${10 + Math.random() * 80}%;top:${20 + Math.random() * 60}%;animation-delay:${Math.random() * 0.4}s`;
    tank.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}

function petTap() {
  const pet = getPet();
  const s = petState(pet);
  const stage = root.querySelector('.pet-stage');
  stage.classList.remove('boing');
  stage.getBoundingClientRect();
  stage.classList.add('boing');
  const heart = document.createElement('span'); // petit cœur à chaque caresse
  heart.className = 'tank-heart';
  heart.textContent = '🩷';
  root.querySelector('.tank').appendChild(heart);
  setTimeout(() => heart.remove(), 1200);
  root.querySelector('.pet-bubble').textContent = randomPhrase();
}

// « Remonte-moi le moral » : il saute, envoie une pluie de cœurs et un mot de réconfort
function cheerUp() {
  const stage = root.querySelector('.pet-stage');
  stage.classList.remove('boing');
  stage.getBoundingClientRect();
  stage.classList.add('boing');
  root.querySelector('.pet-bubble').textContent = withName(pick(COMFORT), Math.floor(Math.random() * 4));
  const tank = root.querySelector('.tank');
  for (let k = 0; k < 16; k++) {
    const el = document.createElement('span');
    el.className = 'tank-spark';
    el.textContent = ['💖', '💗', '✨', '🩷'][k % 4];
    el.style.cssText = `left:${8 + Math.random() * 84}%;top:${25 + Math.random() * 55}%;animation-delay:${Math.random() * 0.6}s`;
    tank.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

function dropsSheet() {
  const pet = getPet();
  const s = petState(pet);
  const body = openSheet(`
    <h3>💧 Gagner des gouttes</h3>
    <p>Tu as <b>${s.balance} 💧</b> à dépenser dans la boutique de ${esc(pet.name)} et celle du jeu des tubes.</p>
    <div class="drops-list">
      <div><span>✏️ Chaque journée remplie</span><b>+${DROPS.day} 💧</b></div>
      <div><span>📅 Chaque semaine complète (5 jours sur 7)</span><b>+${DROPS.week} 💧</b></div>
      <div><span>🎁 Cadeau de bienvenue</span><b>+${DROPS.welcome} 💧</b></div>
    </div>
    <p class="muted small">Une journée compte comme remplie avec au moins un symptôme, « Rien à signaler » ou une note. Chaque journée remplie fait aussi grandir ${esc(pet.name)} : Petit après 3 jours, Ado après 6, Adulte après 10, Légendaire après 14.</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>Fermer</button>${s.filledToday ? '' : '<button class="btn primary" id="pet-fill">✏️ Remplir ma journée</button>'}</div>`);
  body.querySelector('[data-close]').onclick = closeSheet;
  const f = body.querySelector('#pet-fill');
  if (f) f.onclick = () => { closeSheet(); document.dispatchEvent(new CustomEvent('open-today')); };
}

function itemTap(id) {
  const pet = getPet();
  const owned = new Set(pet.owned || []);
  if (id === 'rose') { savePet({ ...pet, color: 'rose' }); tryOn = null; return; }
  const it = ITEMS.find((i) => i.id === id);
  if (owned.has(id)) {
    tryOn = null;
    if (it.slot === 'color') savePet({ ...pet, color: id });
    else {
      const equipped = { ...(pet.equipped || {}) };
      if (equipped[it.slot] === id) delete equipped[it.slot]; else equipped[it.slot] = id;
      savePet({ ...pet, equipped });
    }
    return;
  }
  tryOn = tryOn === id ? null : id;
}

function buy() {
  const pet = getPet();
  const s = petState(pet);
  const it = ITEMS.find((i) => i.id === tryOn);
  if (!it) return;
  if (s.balance < it.price) {
    toast(`Il te manque ${it.price - s.balance} 💧 : remplis tes journées pour en gagner`);
    return;
  }
  const equipped = { ...(pet.equipped || {}) };
  const next = { ...pet, owned: [...(pet.owned || []), it.id], spent: (pet.spent || 0) + it.price, equipped };
  if (it.slot === 'color') next.color = it.id; else equipped[it.slot] = it.id;
  savePet(next);
  tryOn = null;
  toast(`${it.label} : c’est à ${pet.name} ! 🎉`);
}

export function bindPet(container) {
  container.addEventListener('click', (e) => {
    if (!container.querySelector('.pet-page') || busy) return;
    const slot = e.target.closest('[data-slot]');
    if (slot) { shopSlot = slot.dataset.slot; tryOn = null; renderPet(container); return; }
    const item = e.target.closest('[data-item]');
    if (item) { itemTap(item.dataset.item); renderPet(container); return; }
    const b = e.target.closest('[data-p]');
    if (!b) return;
    switch (b.dataset.p) {
      case 'hatch': hatch(); return;
      case 'pet': petTap(); return;
      case 'cheer': cheerUp(); return;
      case 'shop': view = 'shop'; tryOn = null; break;
      case 'back': view = 'home'; tryOn = null; break;
      case 'buy': buy(); break;
      case 'drops': dropsSheet(); return;
      case 'fill': document.dispatchEvent(new CustomEvent('open-today')); return;
      default: return;
    }
    renderPet(container);
    window.scrollTo(0, 0);
  });
}
