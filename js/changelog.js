// Notes de mise à jour, de la plus récente à la plus ancienne.
// La première entrée donne le numéro de version de l'appli : en ajouter une à chaque mise à jour.
export const CHANGELOG = [
  {
    version: '1.5.1',
    items: [
      '🔄 Les mises à jour s’installent toutes seules, plus besoin de toucher « Mettre à jour »',
      '🖼️ Réglages plus compacts : photo et mascotte en miniature',
    ],
  },
  {
    version: '1.5.0',
    items: [
      '🌌 Le jeu des tubes fait peau neuve : ambiance de nuit, tubes en verre',
      '🫧 Liquides lumineux avec des bulles, tubes terminés qui scintillent',
      '⭐ Écran de victoire animé, avec les étoiles qui apparaissent une à une',
      '🐿️ Mascotte de victoire au choix (Réglages) : elle saute de joie à chaque niveau réussi',
    ],
  },
  {
    version: '1.4.2',
    items: [
      '🎨 Nouvelle icône « SYMPT’MES » bien visible sur l’écran d’accueil',
    ],
  },
  {
    version: '1.4.1',
    items: [
      '↩️ « Rien à signaler » touché par erreur ? Il s’annule maintenant depuis l’accueil',
    ],
  },
  {
    version: '1.4.0',
    items: [
      '📝 Les nouveautés de chaque mise à jour s’affichent maintenant ici',
      '🧪 Le jeu des tubes a sa couverture et sa propre icône',
      '⭐ Retour des étoiles : à niveau égal, le plus d’étoiles l’emporte au classement',
      '➕ Ajouter un tube coûte une étoile sur le niveau',
      '🖼️ Un bel aperçu quand on partage le lien de l’appli',
    ],
  },
  {
    version: '1.3.0',
    items: [
      '🧪 Nouvel onglet Détente : le jeu des tubes, 100 niveaux de plus en plus corsés',
      '🫗 Le tube se penche et verse le liquide, avec un bruit d’écoulement (🔊 / 🔇)',
      '🎉 Pluie de paillettes et de 💩 à chaque niveau réussi',
      '🏆 Classement à deux',
    ],
  },
  {
    version: '1.2.0',
    items: [
      '👋 « Bonjour » / « Bonsoir » avec ton prénom (Réglages → Accueil)',
      '🌙 Appli claire en journée, foncée le soir',
      '🔄 Mises à jour plus rapides, avec le bandeau « Nouvelle version »',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;

const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let k = 0; k < 3; k++) if ((x[k] || 0) !== (y[k] || 0)) return (x[k] || 0) - (y[k] || 0);
  return 0;
};

// Entrées plus récentes que la version déjà vue
export const newerThan = (list, seen) => list.filter((e) => !seen || cmp(e.version, seen) > 0);

export function notesHtml(entries) {
  return entries.map((e) => `<div class="notes-block">
    <div class="sub">Version ${e.version}</div>
    <ul class="notes-list">${e.items.map((it) => `<li>${it}</li>`).join('')}</ul>
  </div>`).join('');
}
