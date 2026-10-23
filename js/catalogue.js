// Catalogue des symptômes, rangés par famille.
// urgent : symptôme « à signaler vite », affiché en rouge dans les synthèses.
// normal : état normal (ex. selles moulées) : ne compte pas comme un symptôme.
// noScale : pas de curseur d'intensité.
// fields : détails demandés quand le symptôme est coché :
//   choice (un seul choix), multi (plusieurs), number, zones (partie du corps + côté),
//   belly (zones du ventre).

// Parties du corps ; side: false = pas de côté (au milieu du corps)
export const BODY_PARTS = [
  { id: 'Cou / nuque', side: false },
  { id: 'Épaule' }, { id: 'Bras' }, { id: 'Coude' }, { id: 'Poignet' }, { id: 'Main' }, { id: 'Doigts' },
  { id: 'Haut du dos', side: false }, { id: 'Bas du dos', side: false },
  { id: 'Bassin / hanche' }, { id: 'Cuisse' }, { id: 'Genou' }, { id: 'Tibia / mollet' },
  { id: 'Cheville' }, { id: 'Pied' }, { id: 'Orteils' },
  { id: 'Autre', side: false },
];
export const SIDES = [
  { id: 'gauche', label: 'Gauche', text: 'côté gauche' },
  { id: 'droit', label: 'Droite', text: 'côté droit' },
  { id: 'deux', label: 'Les deux', text: 'des deux côtés' },
];

const ZONES = { id: 'zones', type: 'zones', label: 'Où ?' };
const SIDE = { id: 'side', type: 'choice', label: 'Côté', options: ['Gauche', 'Droite', 'Les deux'] };
const STOOL_COUNT = { id: 'count', type: 'number', label: 'Nombre de fois', unit: '' };
const STOOL_QTY = { id: 'qty', type: 'choice', label: 'Quantité', options: ['Faible', 'Normale', 'Abondante'] };

export const CATEGORIES = [
  { id: 'transit', label: 'Transit / selles', icon: '🚽' },
  { id: 'douleurs', label: 'Douleurs / articulations', icon: '🤕' },
  { id: 'ventre', label: 'Ventre / digestion', icon: '🌀' },
  { id: 'anal', label: 'Zone anale', icon: '🩹' },
  { id: 'neuro', label: 'Tête / neurologique', icon: '🧠' },
  { id: 'general', label: 'État général', icon: '🌡️' },
  { id: 'coeur', label: 'Cœur / respiration', icon: '❤️' },
  { id: 'urines', label: 'Reins / urines', icon: '💧' },
  { id: 'peau', label: 'États cutanés', icon: '🧴' },
];

// Anciennes familles → nouvelles (symptômes ajoutés à la main avant la réorganisation)
export const CATEGORY_ALIASES = { digestif: 'ventre', osteo: 'douleurs', renal: 'urines', thorax: 'coeur' };

// Ventre en 9 zones, vu comme on regarde son propre ventre (sa gauche à gauche)
export const BELLY = [
  ['Haut gauche', 'sous les côtes'], ['Haut milieu', 'estomac'], ['Haut droit', 'sous les côtes'],
  ['Flanc gauche', ''], ['Autour du nombril', ''], ['Flanc droit', ''],
  ['Bas gauche', 'près de la hanche'], ['Bas milieu', 'au-dessus du pubis'], ['Bas droit', 'près de la hanche'],
];

export const SYMPTOMS = [
  // Transit / selles
  { key: 'stool_formed', cat: 'transit', label: 'Selles moulées (normales)', normal: true, noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'stool_liquid', cat: 'transit', label: 'Selles liquides (diarrhée)', noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'constipation', cat: 'transit', label: 'Constipation', noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'no_stool', cat: 'transit', label: 'Pas de selle aujourd’hui', noScale: true },
  { key: 'blood_stool', cat: 'transit', label: 'Sang dans les selles', urgent: true, noScale: true,
    fields: [{ id: 'qty', type: 'choice', label: 'Quantité', options: ['Traces', 'Visible', 'Abondant'] }] },
  { key: 'mucus_stool', cat: 'transit', label: 'Glaires dans les selles', noScale: true },

  // Ventre / digestion
  { key: 'bloating', cat: 'ventre', label: 'Ventre gonflé / ballonnements', noScale: true },
  { key: 'gas', cat: 'ventre', label: 'Gaz', noScale: true },
  { key: 'reflux', cat: 'ventre', label: 'Brûlures d’estomac / reflux' },

  // Zone anale
  { key: 'fissure', cat: 'anal', label: 'Fissure', noScale: true },
  { key: 'hemorrhoids', cat: 'anal', label: 'Hémorroïdes', noScale: true },
  { key: 'abscess', cat: 'anal', label: 'Abcès / gonflement anal', noScale: true },

  // Douleurs (toutes regroupées ici) / articulations
  { key: 'abdo_pain', cat: 'douleurs', label: 'Douleur au ventre',
    fields: [{ id: 'zone', type: 'belly', label: 'Où ? (comme si tu regardais ton ventre)' }] },
  { key: 'anal_pain', cat: 'douleurs', label: 'Douleur anale' },
  { key: 'migraine', cat: 'douleurs', label: 'Migraine' },
  { key: 'chest_pain', cat: 'douleurs', label: 'Douleur dans la poitrine', urgent: true },
  { key: 'kidney_pain', cat: 'douleurs', label: 'Douleur aux reins', fields: [SIDE] },
  { key: 'joint_pain', cat: 'douleurs', label: 'Douleur articulaire', fields: [ZONES] },
  { key: 'muscle_pain', cat: 'douleurs', label: 'Douleur musculaire', fields: [ZONES] },
  { key: 'swelling', cat: 'douleurs', label: 'Gonflement', noScale: true, fields: [ZONES] },
  { key: 'morning_stiffness', cat: 'douleurs', label: 'Raideur au réveil', noScale: true,
    fields: [ZONES, { id: 'minutes', type: 'number', label: 'Durée', unit: 'min' }] },
  { key: 'cracking', cat: 'douleurs', label: 'Envie de craquement', fields: [ZONES] },
  { key: 'numbness', cat: 'douleurs', label: 'Engourdissement / fourmillements', fields: [ZONES] },

  // Tête / neurologique
  { key: 'dizziness', cat: 'neuro', label: 'Vertiges', noScale: true },
  { key: 'brain_fog', cat: 'neuro', label: 'Difficulté à se concentrer', noScale: true },

  // État général
  { key: 'fatigue', cat: 'general', label: 'Fatigue' },
  { key: 'fever', cat: 'general', label: 'Fièvre', noScale: true,
    fields: [{ id: 'temp', type: 'number', label: 'Température', unit: '°C', step: 0.1 }] },
  { key: 'chills', cat: 'general', label: 'Frissons', noScale: true },
  { key: 'nausea', cat: 'general', label: 'Nausées' },
  { key: 'faintness', cat: 'general', label: 'Malaise', noScale: true },
  { key: 'night_sweats', cat: 'general', label: 'Sueurs nocturnes' },
  { key: 'sleep', cat: 'general', label: 'Mauvais sommeil', noScale: true },
  { key: 'fall', cat: 'general', label: 'Chute', urgent: true, noScale: true,
    fields: [{ id: 'minutes', type: 'number', label: 'Temps avant de pouvoir se relever', unit: 'min' }] },

  // Cœur / respiration
  { key: 'palpitations', cat: 'coeur', label: 'Palpitations', noScale: true },
  { key: 'dyspnea', cat: 'coeur', label: 'Essoufflement', urgent: true, noScale: true },

  // Reins / urines
  { key: 'blood_urine', cat: 'urines', label: 'Sang dans les urines', urgent: true, noScale: true },
  { key: 'dysuria', cat: 'urines', label: 'Brûlure en urinant' },

  // États cutanés
  { key: 'red_patches', cat: 'peau', label: 'Plaques rouges sur la peau', noScale: true, fields: [ZONES] },
];

// Symptômes retirés de la saisie : gardés pour afficher correctement l'historique
export const RETIRED = [
  { key: 'vomiting', cat: 'ventre', label: 'Vomissements', fields: [{ id: 'count', type: 'number', label: 'Nombre de fois', unit: '' }] },
  { key: 'headache', cat: 'neuro', label: 'Mal de tête' },
  { key: 'stool_soft', cat: 'transit', label: 'Selles molles', noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'night_stool', cat: 'transit', label: 'Selles la nuit', noScale: true, fields: [STOOL_COUNT] },
  { key: 'urgency', cat: 'transit', label: 'Besoin urgent d’aller aux toilettes' },
  { key: 'tenesmus', cat: 'transit', label: 'Fausse envie' },
  { key: 'bone_pain', cat: 'douleurs', label: 'Douleur osseuse', fields: [ZONES] },
  { key: 'appetite_loss', cat: 'ventre', label: 'Perte d’appétit' },
  { key: 'weight_loss', cat: 'general', label: 'Perte de poids', noScale: true,
    fields: [{ id: 'weight', type: 'number', label: 'Poids', unit: 'kg', step: 0.1 }] },
  { key: 'mouth_ulcers', cat: 'peau', label: 'Aphtes' },
  { key: 'eyes', cat: 'peau', label: 'Yeux rouges ou douloureux', fields: [SIDE] },
];

export const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id;
