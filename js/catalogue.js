// Catalogue des symptômes par défaut.
// urgent : symptôme « à signaler vite », affiché en rouge dans les synthèses.
// fields : détails supplémentaires demandés quand le symptôme est coché.
// noScale : pas de curseur d'intensité (ex. « pas de selle »).

const JOINTS = ['Genoux', 'Hanches', 'Tibias', 'Pied', 'Dos', 'Autre'];

export const CATEGORIES = [
  { id: 'digestif', label: 'Digestifs / transit' },
  { id: 'general', label: 'Général' },
  { id: 'osteo', label: 'Ostéo-articulaires' },
  { id: 'renal', label: 'Rénaux' },
  { id: 'thorax', label: 'Thoraciques / cardiaques' },
  { id: 'neuro', label: 'Neurologiques' },
  { id: 'peau', label: 'Bouche / peau / yeux' },
];

export const SYMPTOMS = [
  // Digestifs / transit
  { key: 'abdo_pain', cat: 'digestif', label: 'Douleurs abdominales',
    fields: [{ id: 'zone', type: 'multi', label: 'Zone',
      options: ['Haut (estomac)', 'Autour du nombril', 'Bas droit', 'Bas gauche', 'Bas milieu', 'Diffuse'] }] },
  { key: 'diarrhea', cat: 'digestif', label: 'Diarrhée',
    fields: [{ id: 'count', type: 'number', label: 'Nombre de selles', unit: '' }] },
  { key: 'stool_liquid', cat: 'digestif', label: 'Selles liquides' },
  { key: 'stool_soft', cat: 'digestif', label: 'Selles intermédiaires (molles)' },
  { key: 'constipation', cat: 'digestif', label: 'Constipation' },
  { key: 'no_stool', cat: 'digestif', label: 'Pas de selle', noScale: true },
  { key: 'urgency', cat: 'digestif', label: 'Besoin impérieux' },
  { key: 'tenesmus', cat: 'digestif', label: 'Fausse envie' },
  { key: 'night_stool', cat: 'digestif', label: 'Selles nocturnes',
    fields: [{ id: 'count', type: 'number', label: 'Combien de fois', unit: '' }] },
  { key: 'blood_stool', cat: 'digestif', label: 'Sang ou glaires dans les selles', urgent: true },
  { key: 'bloating', cat: 'digestif', label: 'Ballonnements / distension' },
  { key: 'gas', cat: 'digestif', label: 'Gaz' },
  { key: 'nausea', cat: 'digestif', label: 'Nausées' },
  { key: 'vomiting', cat: 'digestif', label: 'Vomissements' },
  { key: 'appetite_loss', cat: 'digestif', label: "Perte d'appétit" },
  { key: 'anal_pain', cat: 'digestif', label: 'Douleur ou fissure anale' },
  { key: 'abscess', cat: 'digestif', label: 'Abcès' },

  // Général
  { key: 'fatigue', cat: 'general', label: 'Fatigue' },
  { key: 'fever', cat: 'general', label: 'Fièvre',
    fields: [{ id: 'temp', type: 'number', label: 'Température', unit: '°C', step: 0.1 }] },
  { key: 'night_sweats', cat: 'general', label: 'Sueurs nocturnes' },
  { key: 'chills', cat: 'general', label: 'Frissons' },
  { key: 'weight_loss', cat: 'general', label: 'Perte de poids',
    fields: [{ id: 'weight', type: 'number', label: 'Poids', unit: 'kg', step: 0.1 }] },
  { key: 'sleep', cat: 'general', label: 'Sommeil perturbé' },

  // Ostéo-articulaires
  { key: 'joint_pain', cat: 'osteo', label: 'Douleurs articulaires / osseuses',
    fields: [{ id: 'where', type: 'multi', label: 'Où', options: JOINTS }] },
  { key: 'swelling', cat: 'osteo', label: 'Gonflement',
    fields: [{ id: 'where', type: 'multi', label: 'Où', options: JOINTS }] },
  { key: 'morning_stiffness', cat: 'osteo', label: 'Raideur matinale',
    fields: [{ id: 'minutes', type: 'number', label: 'Durée', unit: 'min' }] },
  { key: 'cracking', cat: 'osteo', label: 'Craquements' },
  { key: 'numbness', cat: 'osteo', label: 'Engourdissement' },
  { key: 'fall', cat: 'osteo', label: 'Chute', urgent: true,
    fields: [{ id: 'minutes', type: 'number', label: 'Temps avant de pouvoir se relever', unit: 'min' }] },

  // Rénaux
  { key: 'kidney_pain', cat: 'renal', label: 'Douleur rénale' },
  { key: 'blood_urine', cat: 'renal', label: 'Sang dans les urines', urgent: true },
  { key: 'dysuria', cat: 'renal', label: 'Douleur en urinant' },

  // Thoraciques / cardiaques
  { key: 'chest_pain', cat: 'thorax', label: 'Douleur au cœur / thoracique', urgent: true },
  { key: 'palpitations', cat: 'thorax', label: 'Palpitations' },
  { key: 'dyspnea', cat: 'thorax', label: 'Essoufflement / dyspnée', urgent: true },

  // Neurologiques
  { key: 'migraine', cat: 'neuro', label: 'Migraine' },
  { key: 'dizziness', cat: 'neuro', label: 'Vertiges' },
  { key: 'faintness', cat: 'neuro', label: 'Malaise' },

  // Bouche / peau / yeux
  { key: 'mouth_ulcers', cat: 'peau', label: 'Aphtes' },
  { key: 'red_patches', cat: 'peau', label: 'Plaques rouges sur les jambes' },
  { key: 'eyes', cat: 'peau', label: 'Yeux rouges ou douloureux' },
];

export const DIGESTIVE_CAT = 'digestif';

export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Petit-déj', icon: '☕' },
  { id: 'lunch', label: 'Déjeuner', icon: '🍽️' },
  { id: 'dinner', label: 'Dîner', icon: '🍲' },
  { id: 'snack', label: 'Collations', icon: '🍎' },
  { id: 'drinks', label: 'Boissons', icon: '🥤' },
];

export const MEAL_TAGS = [
  { id: 'gras', label: 'Gras' },
  { id: 'laitier', label: 'Laitier' },
  { id: 'epice', label: 'Épicé' },
  { id: 'cafe', label: 'Café' },
  { id: 'alcool', label: 'Alcool' },
  { id: 'fibres', label: 'Fibres' },
];

export const slotLabel = (id) => (MEAL_SLOTS.find((s) => s.id === id) || {}).label || id;
export const tagLabel = (id) => (MEAL_TAGS.find((t) => t.id === id) || {}).label || id;
export const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id;
