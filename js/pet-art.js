// Dessin de l'axolotl (SVG) : étapes, humeurs, couleurs et accessoires de la boutique.
// Coordonnées locales : pieds à y = 0, corps centré en (0, -38), rayon ~35.

export const COLORS = {
  rose: { main: '#ffb3cf', dark: '#e0709c', belly: '#ffe3ee', gills: '#ff6f9e' },
  lavande: { main: '#d9c8ff', dark: '#8f74d6', belly: '#f4efff', gills: '#b48cff' },
  menthe: { main: '#a8ecd0', dark: '#3fae86', belly: '#e9fff6', gills: '#4fcf9c' },
  peche: { main: '#ffd0a8', dark: '#dd8748', belly: '#fff1e4', gills: '#ff9a5c' },
};

export const STAGES = [
  { id: 'baby', label: 'Bébé', weeks: 0, scale: 0.6 },
  { id: 'kid', label: 'Petit', weeks: 1, scale: 0.74 },
  { id: 'teen', label: 'Ado', weeks: 3, scale: 0.87 },
  { id: 'adult', label: 'Adulte', weeks: 6, scale: 1 },
  { id: 'legend', label: 'Légendaire', weeks: 12, scale: 1 },
];

const INK = '#2a1f2a';
const star = (x, y, r, fill) => `<path d="M${x},${y - r} L${x + r * 0.28},${y - r * 0.28} L${x + r},${y} L${x + r * 0.28},${y + r * 0.28} L${x},${y + r} L${x - r * 0.28},${y + r * 0.28} L${x - r},${y} L${x - r * 0.28},${y - r * 0.28} Z" fill="${fill}"/>`;
const cross = (x, y, s) => `<path d="M${x - s / 3},${y - s} h${s * 2 / 3} v${s * 2 / 3} h${s * 2 / 3} v${s * 2 / 3} h${-s * 2 / 3} v${s * 2 / 3} h${-s * 2 / 3} v${-s * 2 / 3} h${-s * 2 / 3} v${-s * 2 / 3} h${s * 2 / 3} Z" fill="#ff4d6d"/>`;

// ---------- accessoires ----------
const ITEMS_ART = {
  // Tête
  nurse_cap: () => `<path d="M-18,-66 C-16,-82 16,-82 18,-66 L14,-62 C6,-66 -6,-66 -14,-62 Z" fill="#fff" stroke="#c9d6e0" stroke-width="2" stroke-linejoin="round"/>${cross(0, -73, 5)}`,
  flowers: () => [[-24, -60, '#ff8fb8'], [-14, -70, '#ffd23f'], [0, -74, '#ff8fb8'], [14, -70, '#a0e7ff'], [24, -60, '#ffd23f']]
    .map(([x, y, c]) => `<g>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - 4}" rx="2.6" ry="4.2" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`).join('')}<circle cx="${x}" cy="${y}" r="2.4" fill="#fff6b0"/></g>`).join(''),
  bow: () => '<g transform="translate(18 -66) rotate(18)"><path d="M0,0 L-13,-8 C-16,-2 -16,4 -13,8 Z M0,0 L13,-8 C16,-2 16,4 13,8 Z" fill="#ff4f9a" stroke="#c2185b" stroke-width="1.6" stroke-linejoin="round"/><circle r="3.6" fill="#ff7ab3" stroke="#c2185b" stroke-width="1.4"/></g>',
  beanie: () => '<path d="M-27,-56 C-26,-84 26,-84 27,-56 Z" fill="#7c9cff" stroke="#4b63c9" stroke-width="2"/><rect x="-29" y="-60" width="58" height="9" rx="4.5" fill="#a9bdff" stroke="#4b63c9" stroke-width="2"/><circle cx="0" cy="-82" r="6" fill="#fff" stroke="#c9d6e0" stroke-width="1.6"/>'
    + [-14, -4, 6, 16].map((x) => `<path d="M${x},-62 L${x + 2},-76" stroke="#5f7ee0" stroke-width="1.6" opacity=".6"/>`).join(''),
  straw_hat: () => '<ellipse cx="0" cy="-62" rx="38" ry="8" fill="#f6d27a" stroke="#c99a3a" stroke-width="2"/><path d="M-18,-63 C-18,-82 18,-82 18,-63 Z" fill="#f9dc8c" stroke="#c99a3a" stroke-width="2"/><path d="M-18,-66 C-6,-62 6,-62 18,-66 L18,-70 C6,-66 -6,-66 -18,-70 Z" fill="#ff6f9e"/>',
  // Cou
  stethoscope: () => '<path d="M-16,-22 C-20,-6 -6,-2 2,-6 C8,-9 10,-14 10,-18" fill="none" stroke="#5b6b7c" stroke-width="3" stroke-linecap="round"/><path d="M16,-22 C18,-14 14,-10 10,-18" fill="none" stroke="#5b6b7c" stroke-width="3" stroke-linecap="round"/><circle cx="10" cy="-19" r="4.6" fill="#d7e0e8" stroke="#5b6b7c" stroke-width="2"/><circle cx="10" cy="-19" r="2" fill="#9fb0c0"/>',
  scarf: () => '<path d="M-26,-22 C-10,-14 10,-14 26,-22 L26,-14 C10,-6 -10,-6 -26,-14 Z" fill="#ff5c7a" stroke="#c2304f" stroke-width="2" stroke-linejoin="round"/><path d="M12,-12 L18,6 L10,7 L6,-10 Z" fill="#ff5c7a" stroke="#c2304f" stroke-width="2" stroke-linejoin="round"/>'
    + [-16, -4, 8, 20].map((x) => `<path d="M${x},-20 L${x + 1},-12" stroke="#fff" stroke-width="2.2" opacity=".75"/>`).join(''),
  bowtie: () => '<g transform="translate(0 -18)"><path d="M0,0 L-11,-6 L-11,6 Z M0,0 L11,-6 L11,6 Z" fill="#3b7ddd" stroke="#21508f" stroke-width="1.6" stroke-linejoin="round"/><circle r="3" fill="#5b9bff" stroke="#21508f" stroke-width="1.4"/></g>',
  // Yeux
  round_glasses: () => '<circle cx="-12" cy="-42" r="9" fill="rgba(255,255,255,.18)" stroke="#3a2a2a" stroke-width="2.4"/><circle cx="12" cy="-42" r="9" fill="rgba(255,255,255,.18)" stroke="#3a2a2a" stroke-width="2.4"/><path d="M-3,-43 Q0,-46 3,-43" fill="none" stroke="#3a2a2a" stroke-width="2.2"/>',
  heart_glasses: () => ['-12', '12'].map((x) => `<path transform="translate(${x} -43)" d="M0,7 C-10,0 -11,-7 -6,-9 C-3,-10 -1,-8 0,-6 C1,-8 3,-10 6,-9 C11,-7 10,0 0,7 Z" fill="#ff4f9a" stroke="#b3175c" stroke-width="1.6"/>`).join('') + '<path d="M-4,-45 L4,-45" stroke="#b3175c" stroke-width="2"/>',
  // Corps
  nurse_coat: () => '<path d="M-30,-22 C-34,-6 -26,4 -14,4 L14,4 C26,4 34,-6 30,-22 C20,-14 10,-12 0,-12 C-10,-12 -20,-14 -30,-22 Z" fill="#ffffff" stroke="#b8c6d2" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M-10,-13 L0,-2 L10,-13" fill="none" stroke="#b8c6d2" stroke-width="2" stroke-linejoin="round"/><path d="M0,-2 L0,4" stroke="#b8c6d2" stroke-width="1.6"/>'
    + '<rect x="-24" y="-8" width="10" height="8" rx="2" fill="#eef3f7" stroke="#b8c6d2" stroke-width="1.4"/><path d="M-21,-12 L-21,-6" stroke="#3b7ddd" stroke-width="2.2" stroke-linecap="round"/>'
    + cross(18, -6, 3.6),
};

export const ITEMS = [
  { id: 'nurse_cap', slot: 'head', label: 'Coiffe d’infirmière', price: 80, nurse: true },
  { id: 'flowers', slot: 'head', label: 'Couronne de fleurs', price: 60 },
  { id: 'bow', slot: 'head', label: 'Nœud rose', price: 30 },
  { id: 'beanie', slot: 'head', label: 'Bonnet', price: 50 },
  { id: 'straw_hat', slot: 'head', label: 'Chapeau de paille', price: 70 },
  { id: 'nurse_coat', slot: 'body', label: 'Blouse d’infirmière', price: 120, nurse: true },
  { id: 'stethoscope', slot: 'neck', label: 'Stéthoscope', price: 90, nurse: true },
  { id: 'scarf', slot: 'neck', label: 'Écharpe', price: 40 },
  { id: 'bowtie', slot: 'neck', label: 'Nœud papillon', price: 30 },
  { id: 'round_glasses', slot: 'eyes', label: 'Lunettes rondes', price: 40 },
  { id: 'heart_glasses', slot: 'eyes', label: 'Lunettes cœur', price: 60 },
  { id: 'lavande', slot: 'color', label: 'Couleur lavande', price: 100 },
  { id: 'menthe', slot: 'color', label: 'Couleur menthe', price: 100 },
  { id: 'peche', slot: 'color', label: 'Couleur pêche', price: 100 },
];

// ---------- l'axolotl ----------
// mood : joy | happy | sad | cry
function body(c, stage, mood, eq) {
  const s = [];
  const st = c.dark;
  // queue
  s.push(`<path class="pet-tail" d="M26,-16 C46,-14 58,-26 60,-40 C50,-34 40,-30 26,-30 Z" fill="${c.belly}" stroke="${st}" stroke-width="2.6"/>`);
  // branchies
  s.push('<g class="pet-gills">');
  for (const sx of [-1, 1]) {
    for (const [dy, ang] of [[-60, -30], [-50, -5], [-40, 20]]) {
      s.push(`<ellipse cx="${sx * 36}" cy="${dy}" rx="11" ry="4.5" transform="rotate(${sx * ang} ${sx * 36} ${dy})" fill="${c.gills}" stroke="${st}" stroke-width="1.8"/>`);
    }
  }
  s.push('</g>');
  // pieds et corps
  for (const sx of [-1, 1]) s.push(`<ellipse cx="${sx * 14}" cy="-3" rx="10" ry="5.5" fill="${c.main}" stroke="${st}" stroke-width="2.6"/>`);
  s.push(`<ellipse cx="0" cy="-38" rx="35" ry="34" fill="${c.main}" stroke="${st}" stroke-width="2.6"/>`);
  s.push(`<ellipse cx="0" cy="-22" rx="21" ry="15" fill="${c.belly}"/>`);
  if (eq.body) s.push(ITEMS_ART[eq.body]());
  if (eq.neck) s.push(ITEMS_ART[eq.neck]());
  // visage
  const big = stage === 'baby';
  const ex = 12; const ey = -42;
  s.push('<g class="pet-eyes">');
  if (mood === 'joy') {
    for (const sx of [-1, 1]) s.push(`<path d="M${sx * ex - 6},${ey + 2} Q${sx * ex},${ey - 6} ${sx * ex + 6},${ey + 2}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`);
  } else if (stage === 'teen' && !eq.eyes && mood === 'happy') {
    s.push(`<rect x="-22" y="${ey - 6}" width="18" height="11" rx="4" fill="#1d1d2b"/><rect x="4" y="${ey - 6}" width="18" height="11" rx="4" fill="#1d1d2b"/><path d="M-4,${ey - 2} L4,${ey - 2}" stroke="#1d1d2b" stroke-width="2.5"/>`
      + `<path d="M-19,${ey - 3} L-12,${ey - 3}" stroke="#7f8cff" stroke-width="2" stroke-linecap="round"/><path d="M7,${ey - 3} L14,${ey - 3}" stroke="#7f8cff" stroke-width="2" stroke-linecap="round"/>`);
  } else {
    const [rx, ry] = big ? [6.6, 7.6] : [5.2, 6.2];
    for (const sx of [-1, 1]) {
      s.push(`<g class="pet-eye"><ellipse cx="${sx * ex}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${sx * ex + 1.8}" cy="${ey - 2.6}" r="${big ? 2.2 : 1.8}" fill="#fff"/><circle cx="${sx * ex - 1.8}" cy="${ey + 2.2}" r="1" fill="#fff"/></g>`);
      if (mood === 'sad' || mood === 'cry') s.push(`<path d="M${sx * (ex + 7)},${ey - 7} Q${sx * (ex + 1)},${ey - 9} ${sx * (ex - 5)},${ey - 12}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`);
    }
  }
  s.push('</g>');
  for (const sx of [-1, 1]) s.push(`<ellipse cx="${sx * 21}" cy="-32" rx="6" ry="3.6" fill="#ff7aa8" opacity=".55"/>`);
  const mouth = { joy: 'M-6,-32 Q0,-22 6,-32 Z', sad: 'M-6,-28 Q0,-34 6,-28', cry: 'M-7,-27 Q0,-37 7,-27 Z' }[mood] || 'M-5,-31 Q-2.5,-27 0,-31 Q2.5,-27 5,-31';
  s.push(`<path d="${mouth}" fill="${mood === 'joy' || mood === 'cry' ? '#ff6f8f' : 'none'}" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (mood === 'sad') s.push(`<path class="pet-tear" d="M-15,-36 C-19,-30 -17,-25 -14,-25 C-11,-25 -11,-30 -15,-36 Z" fill="#7fd3ff" stroke="#3aa0d8" stroke-width="1.2"/>`);
  if (mood === 'cry') {
    for (const sx of [-1, 1]) {
      s.push(`<path class="pet-stream" d="M${sx * (ex - 1)},${ey + 6} C${sx * (ex - 3)},${ey + 20} ${sx * (ex + 1)},${ey + 30} ${sx * (ex + 4)},${ey + 40}" fill="none" stroke="#7fd3ff" stroke-width="4.5" stroke-linecap="round"/>`);
      s.push(`<circle class="pet-drop" cx="${sx * (ex + 12)}" cy="${ey + 44}" r="2.6" fill="#7fd3ff"/>`);
    }
  }
  if (eq.eyes && mood !== 'joy') s.push(ITEMS_ART[eq.eyes]());
  // tête
  if (eq.head) s.push(ITEMS_ART[eq.head]());
  else if (stage === 'baby') s.push('<path d="M-20,-66 L-14,-74 L-8,-67 L-2,-75 L4,-67 L10,-74 L16,-67 L20,-70 C14,-80 -14,-80 -20,-66 Z" fill="#fffaf0" stroke="#d8cfb8" stroke-width="2" stroke-linejoin="round"/>');
  else if (stage === 'legend') s.push('<path d="M-14,-70 L-16,-84 L-8,-77 L0,-88 L8,-77 L16,-84 L14,-70 Z" fill="#ffd23f" stroke="#c99a00" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="-82" r="2.4" fill="#ff4f9a"/>');
  return s.join('');
}

// SVG complet. size : largeur en px ; opts.stage/mood/color/equipped
export function petSvg({ stage = 'baby', mood = 'happy', color = 'rose', equipped = {}, size = 200, shadow = true } = {}) {
  const c = COLORS[color] || COLORS.rose;
  const st = STAGES.find((x) => x.id === stage) || STAGES[0];
  const w = 140; const h = 150;
  let bg = '';
  if (stage === 'legend') {
    bg = `<circle cx="70" cy="92" r="58" fill="url(#pet-aura)"/>${[[18, 34], [122, 44], [116, 104], [22, 98], [70, 14]].map(([x, y]) => star(x, y, 6, '#fff6b0')).join('')}`;
  }
  return `<svg class="pet-svg" width="${size}" height="${Math.round(size * h / w)}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs><radialGradient id="pet-aura"><stop offset="0" stop-color="#ffe680" stop-opacity=".9"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient></defs>
    ${bg}${shadow ? `<ellipse class="pet-shadow" cx="70" cy="140" rx="${30 * st.scale + 6}" ry="5" fill="rgba(0,0,0,.25)"/>` : ''}
    <g transform="translate(70 138) scale(${st.scale})"><g class="pet-body">${body(c, stage, mood, equipped)}</g></g>
  </svg>`;
}

// Œuf avant l'éclosion
export function eggSvg(size = 160, cracked = 0) {
  const spots = [[-10, -46, 6], [9, -30, 7], [-6, -18, 4.5], [12, -56, 4], [-14, -28, 3.5]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#ffb3cf" opacity=".85"/>`).join('');
  const crack = cracked ? '<path d="M-25,-40 L-14,-34 L-8,-42 L0,-35 L8,-43 L14,-36 L25,-41" fill="none" stroke="#e0709c" stroke-width="2.2" stroke-linejoin="round"/>' : '';
  return `<svg class="egg-svg" width="${size}" height="${Math.round(size * 150 / 140)}" viewBox="0 0 140 150" aria-hidden="true">
    <ellipse cx="70" cy="140" rx="24" ry="5" fill="rgba(0,0,0,.25)"/>
    <g transform="translate(70 138) scale(1.2)"><g class="egg-body"><ellipse cx="0" cy="-36" rx="26" ry="33" fill="#fffaf0" stroke="#e0709c" stroke-width="2.6"/>${spots}${crack}<ellipse cx="-9" cy="-56" rx="5" ry="8" fill="#fff" opacity=".8"/></g></g>
  </svg>`;
}
