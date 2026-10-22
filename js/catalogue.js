// Catalogue des symptômes, rangés par famille.
// urgent : symptôme « à signaler vite », affiché en rouge dans les synthèses.
// normal : état normal (ex. selles moulées) : ne compte pas comme un symptôme.
// noScale : pas de curseur d'intensité.
// fields : détails demandés quand le symptôme est coché :
//   choice (un seul choix), multi (plusieurs), number, zones (partie du corps + côté).

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
  { id: 'ventre', label: 'Ventre / digestion', icon: '🌀' },
  { id: 'anal', label: 'Zone anale', icon: '🩹' },
  { id: 'douleurs', label: 'Douleurs / articulations', icon: '🦴' },
  { id: 'neuro', label: 'Tête / neurologique', icon: '🧠' },
  { id: 'general', label: 'État général', icon: '🌡️' },
  { id: 'coeur', label: 'Cœur / respiration', icon: '❤️' },
  { id: 'urines', label: 'Reins / urines', icon: '💧' },
  { id: 'peau', label: 'Peau / bouche / yeux', icon: '👁️' },
];

// Anciennes familles → nouvelles (symptômes ajoutés à la main avant la réorganisation)
export const CATEGORY_ALIASES = { digestif: 'ventre', osteo: 'douleurs', renal: 'urines', thorax: 'coeur' };

export const SYMPTOMS = [
  // Transit / selles
  { key: 'stool_formed', cat: 'transit', label: 'Selles moulées (normales)', normal: true, noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'stool_soft', cat: 'transit', label: 'Selles molles', noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'stool_liquid', cat: 'transit', label: 'Selles liquides (diarrhée)', noScale: true, fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'constipation', cat: 'transit', label: 'Constipation / selles dures', fields: [STOOL_COUNT, STOOL_QTY] },
  { key: 'no_stool', cat: 'transit', label: 'Pas de selle aujourd’hui', noScale: true },
  { key: 'night_stool', cat: 'transit', label: 'Selles la nuit', noScale: true, fields: [STOOL_COUNT] },
  { key: 'urgency', cat: 'transit', label: 'Besoin urgent d’aller aux toilettes' },
  { key: 'tenesmus', cat: 'transit', label: 'Fausse envie' },
  { key: 'blood_stool', cat: 'transit', label: 'Sang dans les selles', urgent: true, noScale: true,
    fields: [{ id: 'qty', type: 'choice', label: 'Quantité', options: ['Traces', 'Visible', 'Abondant'] }] },
  { key: 'mucus_stool', cat: 'transit', label: 'Glaires dans les selles', noScale: true },

  // Ventre / digestion
  { key: 'abdo_pain', cat: 'ventre', label: 'Douleur au ventre',
    fields: [{ id: 'zone', type: 'multi', label: 'Où ?',
      options: ['Haut (estomac)', 'Autour du nombril', 'Bas droit', 'Bas gauche', 'Bas milieu', 'Tout le ventre'] }] },
  { key: 'bloating', cat: 'ventre', label: 'Ventre gonflé / ballonnements' },
  { key: 'gas', cat: 'ventre', label: 'Gaz' },
  { key: 'nausea', cat: 'ventre', label: 'Nausées' },
  { key: 'vomiting', cat: 'ventre', label: 'Vomissements', fields: [{ id: 'count', type: 'number', label: 'Nombre de fois', unit: '' }] },
  { key: 'reflux', cat: 'ventre', label: 'Brûlures d’estomac / reflux' },
  { key: 'appetite_loss', cat: 'ventre', label: 'Perte d’appétit' },

  // Zone anale
  { key: 'anal_pain', cat: 'anal', label: 'Douleur anale' },
  { key: 'fissure', cat: 'anal', label: 'Fissure' },
  { key: 'abscess', cat: 'anal', label: 'Abcès / gonflement anal' },

  // Douleurs / articulations / muscles
  { key: 'joint_pain', cat: 'douleurs', label: 'Douleur articulaire', fields: [ZONES] },
  { key: 'bone_pain', cat: 'douleurs', label: 'Douleur osseuse', fields: [ZONES] },
  { key: 'muscle_pain', cat: 'douleurs', label: 'Douleur musculaire', fields: [ZONES] },
  { key: 'swelling', cat: 'douleurs', label: 'Gonflement', fields: [ZONES] },
  { key: 'morning_stiffness', cat: 'douleurs', label: 'Raideur au réveil',
    fields: [ZONES, { id: 'minutes', type: 'number', label: 'Durée', unit: 'min' }] },
  { key: 'cracking', cat: 'douleurs', label: 'Craquements', fields: [ZONES] },
  { key: 'numbness', cat: 'douleurs', label: 'Engourdissement / fourmillements', fields: [ZONES] },

  // Tête / neurologique
  { key: 'migraine', cat: 'neuro', label: 'Migraine' },
  { key: 'headache', cat: 'neuro', label: 'Mal de tête' },
  { key: 'dizziness', cat: 'neuro', label: 'Vertiges' },
  { key: 'faintness', cat: 'neuro', label: 'Malaise' },
  { key: 'brain_fog', cat: 'neuro', label: 'Difficulté à se concentrer' },

  // État général
  { key: 'fatigue', cat: 'general', label: 'Fatigue' },
  { key: 'fever', cat: 'general', label: 'Fièvre',
    fields: [{ id: 'temp', type: 'number', label: 'Température', unit: '°C', step: 0.1 }] },
  { key: 'chills', cat: 'general', label: 'Frissons' },
  { key: 'night_sweats', cat: 'general', label: 'Sueurs la nuit' },
  { key: 'weight_loss', cat: 'general', label: 'Perte de poids', noScale: true,
    fields: [{ id: 'weight', type: 'number', label: 'Poids', unit: 'kg', step: 0.1 }] },
  { key: 'sleep', cat: 'general', label: 'Mauvais sommeil' },
  { key: 'fall', cat: 'general', label: 'Chute', urgent: true,
    fields: [{ id: 'minutes', type: 'number', label: 'Temps avant de pouvoir se relever', unit: 'min' }] },

  // Cœur / respiration
  { key: 'chest_pain', cat: 'coeur', label: 'Douleur dans la poitrine', urgent: true },
  { key: 'palpitations', cat: 'coeur', label: 'Palpitations' },
  { key: 'dyspnea', cat: 'coeur', label: 'Essoufflement', urgent: true },

  // Reins / urines
  { key: 'kidney_pain', cat: 'urines', label: 'Douleur aux reins', fields: [SIDE] },
  { key: 'blood_urine', cat: 'urines', label: 'Sang dans les urines', urgent: true, noScale: true },
  { key: 'dysuria', cat: 'urines', label: 'Brûlure en urinant' },

  // Peau / bouche / yeux
  { key: 'mouth_ulcers', cat: 'peau', label: 'Aphtes' },
  { key: 'red_patches', cat: 'peau', label: 'Plaques rouges sur la peau', fields: [ZONES] },
  { key: 'eyes', cat: 'peau', label: 'Yeux rouges ou douloureux', fields: [SIDE] },
];

export const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id;
