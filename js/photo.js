// Photo d'accueil : la photo par défaut de l'appli, ou une photo choisie dans la galerie,
// redimensionnée puis gardée sur ce téléphone uniquement (jamais envoyée en ligne).

import * as store from './store.js';

const KEY = 'homePhoto';
const MAX_SIZE = 1400;
const DEFAULT_PHOTO = 'img/accueil.jpg';

// Vrai si une photo personnelle remplace la photo par défaut
export const hasPhoto = () => !!store.kvGet(KEY);
// Adresse absolue : une url() dans une variable CSS se résout par rapport à la feuille de style
export const photoUrl = () => store.kvGet(KEY) || new URL(DEFAULT_PHOTO, document.baseURI).href;

export function applyPhoto() {
  document.documentElement.style.setProperty('--home-photo', `url("${photoUrl()}")`);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

export async function setPhotoFromFile(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  await store.kvSet(KEY, canvas.toDataURL('image/jpeg', 0.82));
  applyPhoto();
}

export async function clearPhoto() {
  await store.kvSet(KEY, undefined);
  applyPhoto();
}
