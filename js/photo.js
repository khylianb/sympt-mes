// Photo d'accueil choisie dans la galerie : redimensionnée puis gardée sur ce téléphone
// uniquement (stockage local), jamais envoyée en ligne.

import * as store from './store.js';

const KEY = 'homePhoto';
const MAX_SIZE = 1400;

export const hasPhoto = () => !!store.kvGet(KEY);
export const photoUrl = () => store.kvGet(KEY);

export function applyPhoto() {
  const p = store.kvGet(KEY);
  document.documentElement.style.setProperty('--home-photo', p ? `url("${p}")` : 'none');
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
