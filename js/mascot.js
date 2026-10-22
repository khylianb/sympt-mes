// Mascotte de l'écran de victoire : une image choisie dans la galerie, détourée (fond uni retiré),
// enregistrée dans l'espace privé Supabase (app_meta) pour apparaître sur les deux téléphones.
// Elle n'est jamais mise dans le dépôt de code.

import * as store from './store.js';

const KEY = 'mascot';
const MAX_SIZE = 420;

export const mascotUrl = () => store.meta(KEY) || null;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

// Retire le fond s'il est uni (blanc, gris…) : remplissage depuis les bords, avec un contour adouci
function removeBackground(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  let r = 0; let g = 0; let b = 0; let opaque = 0;
  for (const i of border) {
    if (px[i * 4 + 3] < 128) continue; // déjà transparent
    r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; opaque++;
  }
  if (opaque < border.length * 0.5) return; // image déjà détourée
  r /= opaque; g /= opaque; b /= opaque;
  const dist = (i) => Math.hypot(px[i * 4] - r, px[i * 4 + 1] - g, px[i * 4 + 2] - b);
  if (border.filter((i) => dist(i) < 40).length < border.length * 0.8) return; // fond non uni : on garde tout

  const seen = new Uint8Array(w * h);
  const stack = border.filter((i) => dist(i) < 14);
  stack.forEach((i) => { seen[i] = 1; });
  while (stack.length) {
    const i = stack.pop();
    px[i * 4 + 3] = 0;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || seen[j]) continue;
      seen[j] = 1;
      const dj = dist(j);
      // Seul le fond très proche de sa couleur est suivi : le blanc des yeux, ombré, reste intact
      if (dj < 14) stack.push(j);
      else if (dj < 40) px[j * 4 + 3] = Math.round(px[j * 4 + 3] * (dj - 14) / 26); // contour adouci
    }
  }
  ctx.putImageData(data, 0, 0);
}

// Recadre au plus près du sujet (zones transparentes retirées)
function cropToContent(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return canvas;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(canvas, -x0, -y0);
  return out;
}

export async function setMascotFromFile(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  removeBackground(ctx, canvas.width, canvas.height);
  store.setMeta(KEY, cropToContent(canvas).toDataURL('image/png'));
}

export function clearMascot() {
  store.setMeta(KEY, null);
}

// Phrases de la mascotte sur l'écran de victoire
const CHEERS = ['Bravo !', 'Trop forte !', 'Incroyable !', 'Waouh !', 'Champion·ne !', 'Génial !', 'Encore !'];
export const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];
