// Notes de mise à jour, de la plus récente à la plus ancienne.
// La première entrée donne le numéro de version de l'appli : en ajouter une à chaque mise à jour.
export const CHANGELOG = [
  {
    version: '1.8.2',
    items: [
      '🩷 L’axolotl te dit chaque jour à quel point tu es formidable, sur l’accueil',
      '💬 Des phrases positives et encourageantes, même quand tu as oublié ta journée',
      '🫶 Les jours difficiles, il te réconforte ; et le bouton « 💗 Remonte-moi le moral » est là quand tu en as besoin',
    ],
  },
  {
    version: '1.8.1',
    items: [
      '📏 Jeu des tubes plus grand : la zone de jeu remplit l’écran et les tubes s’agrandissent',
    ],
  },
  {
    version: '1.8.0',
    items: [
      '🛍️ Boutique du jeu des tubes (bouton 🛍️) : grosse seringue 💉, flacon de potion, liquides pailletés, néon, lave, reflets irisés',
      '🌌 Nouveaux fonds (aurore boréale, coucher de soleil, océan, galaxie) et effets de victoire (cœurs, étoiles, bulles, feux d’artifice)',
      '💧 Une seule cagnotte de gouttes pour la boutique du jeu et celle de l’axolotl',
    ],
  },
  {
    version: '1.7.0',
    items: [
      '🥚 Un œuf t’attend dans Détente : choisis le prénom de ton axolotl et il éclot',
      '🩷 Il grandit à chaque journée remplie : légendaire en 2 semaines (Bébé → Petit → Ado → Adulte → Légendaire)',
      '😭 Il pleure si tu oublies ta journée, et saute de joie quand tu la remplis',
      '🛍️ Sa boutique : blouse d’infirmière, stéthoscope, coiffe, lunettes, couleurs… payés en gouttes 💧',
      '💧 +10 gouttes par journée remplie, +30 par semaine complète',
    ],
  },
  {
    version: '1.6.1',
    items: [
      '🧪 Jeu des tubes en solo : plus de classement ni de pseudo à choisir',
    ],
  },
  {
    version: '1.6.0',
    items: [
      '🔒 Jeu des tubes : ↩️ Annuler et ➕ Tube se débloquent chaque jour une fois ta journée remplie dans Saisie',
      '💡 Touche un bonus verrouillé pour savoir pourquoi, et remplir ta journée en un toucher',
    ],
  },
  {
    version: '1.5.2',
    items: [
      '🤕 Toutes les douleurs (ventre, anale, migraine, poitrine, reins, articulations…) sont regroupées dans « Douleurs »',
      '✅ Ce qui avait déjà été coché est conservé',
    ],
  },
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
