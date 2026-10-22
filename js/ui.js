// Feuille glissante (bottom sheet) réutilisable.

import { $ } from './util.js';

let onCloseCb = null;

export function openSheet(html, { onClose } = {}) {
  const sheet = $('#sheet');
  $('#sheet-body').innerHTML = html;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  onCloseCb = onClose || null;
  return $('#sheet-body');
}

export function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  setTimeout(() => { sheet.hidden = true; $('#sheet-body').innerHTML = ''; }, 200);
  const cb = onCloseCb;
  onCloseCb = null;
  if (cb) cb();
}

export const sheetOpen = () => !$('#sheet').hidden;

export function initSheet() {
  $('#sheet-backdrop').addEventListener('click', closeSheet);
}
