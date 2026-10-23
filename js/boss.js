// Niveaux de boss du jeu des tubes (tous les 10 niveaux).
// Chaque boss a sa barre de vie (une couleur terminée = un coup) et un ou plusieurs pièges,
// tous temporaires pour que le niveau reste faisable : couleurs cachées qui se dévoilent en jouant,
// tube gelé qui fond après quelques coups, tube bouché qui saute au premier tube terminé (ou tout seul).
// En échange, chaque boss donne un tube vide en plus, sans perdre d'étoile.

export const BOSSES = {
  10: { emoji: '🦠', name: 'Microbe Grognon', traps: { mystery: 2 } },
  20: { emoji: '😴', name: 'Monsieur Fatigue', traps: { freeze: [6] } },
  30: { emoji: '🌫️', name: 'Brume Mystère', traps: { mystery: 99 } },
  40: { emoji: '🍬', name: 'Glouton Sucré', traps: { cork: true } },
  50: { emoji: '👻', name: 'Fantôme Farceur', traps: { mystery: 3, freeze: [6] } },
  60: { emoji: '🌪️', name: 'Tourbillon Glacé', traps: { freeze: [5, 8] } },
  70: { emoji: '🐙', name: 'Pieuvre Pagaille', traps: { mystery: 4, cork: true } },
  80: { emoji: '🦖', name: 'Dino Ronchon', traps: { freeze: [6], cork: true } },
  90: { emoji: '🐉', name: 'Dragon Grincheux', traps: { mystery: 99, freeze: [6], cork: true } },
  100: { emoji: '👑', name: 'Roi des Microbes', traps: { mystery: 99, freeze: [5, 8], cork: true } },
};
export const CORK_MOVES = 12; // le bouchon saute tout seul au bout de ce nombre de coups

export const bossOf = (n) => BOSSES[n] || null;

// Phrases qui décrivent les pièges, pour l'écran d'annonce
export function trapLines(b) {
  const out = [];
  if (b.traps.mystery) out.push(b.traps.mystery >= 99 ? '❓ Il cache les couleurs du fond de tous les tubes : elles se dévoilent quand tu les atteins'
    : `❓ Il cache les couleurs du fond de ${b.traps.mystery} tubes : elles se dévoilent quand tu les atteins`);
  for (const m of b.traps.freeze || []) out.push(`❄️ Il gèle un tube : il fond tout seul après ${m} coups`);
  if (b.traps.cork) out.push(`🍾 Il bouche un tube : le bouchon saute dès que tu termines une couleur (ou après ${CORK_MOVES} coups)`);
  return out;
}

const runStart = (t) => {
  let k = t.length - 1;
  while (k > 0 && t[k - 1] === t[t.length - 1]) k--;
  return k;
};

// Couleurs cachées encore invisibles : on retire celles qui font maintenant partie du dessus du tube
export function revealHidden(tubes, hidden) {
  return hidden.filter((key) => {
    const [t, k] = key.split(':').map(Number);
    return tubes[t] && k < tubes[t].length && k < runStart(tubes[t]);
  });
}

// Prépare le plateau du boss : tube vide en plus, couleurs cachées, tubes gelés et bouché
export function setupBoss(n, tubes) {
  const b = bossOf(n);
  const full = tubes.map((t, i) => (t.length ? i : -1)).filter((i) => i >= 0);
  const pickFrom = (list, k, offset) => Array.from({ length: Math.min(k, list.length) }, (_, j) => list[(offset + j * 3) % list.length]);
  let hidden = [];
  if (b.traps.mystery) {
    for (const t of pickFrom(full, b.traps.mystery, n % full.length)) {
      for (let k = 0; k < runStart(tubes[t]); k++) hidden.push(`${t}:${k}`);
    }
  }
  hidden = [...new Set(hidden)];
  const taken = new Set();
  const frozen = {};
  (b.traps.freeze || []).forEach((m, j) => {
    const t = full[(full.length - 1 - j * 2 + full.length) % full.length];
    frozen[t] = m;
    taken.add(t);
  });
  let corked = [];
  if (b.traps.cork) {
    const t = full.find((i, j) => j >= Math.floor(full.length / 2) && !taken.has(i));
    if (t !== undefined) corked = [t];
  }
  return {
    tubes: [...tubes.map((t) => t.slice()), []],
    hidden: revealHidden(tubes, hidden),
    frozen,
    corked,
    corkLeft: CORK_MOVES,
    hpMax: new Set(tubes.flat()).size,
  };
}
