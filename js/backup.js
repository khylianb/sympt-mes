// Copie de secours (JSON) de la mascotte et des jeux, via la fenêtre de partage.

import * as store from './store.js';
import { $, esc, toDay, relativeDays, toast } from './util.js';
import { openSheet, closeSheet } from './ui.js';

// ---------- date de dernière sauvegarde ----------
export function lastBackupIso() {
  const a = store.meta('last_export');
  const b = store.meta('last_auto_backup');
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

export function backupLabel() {
  const iso = lastBackupIso();
  return iso ? `Dernière copie : ${relativeDays(iso)}` : 'Aucune copie pour l’instant';
}

// ---------- partage ----------
async function shareFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: file.name });
    return true;
  }
  // Repli (ordinateur) : téléchargement
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// iOS exige que le partage parte directement d'un toucher : si le délai est
// dépassé, on propose un second bouton « Partager ».
async function deliver(file, body, onDone) {
  try {
    await shareFile(file);
    onDone && onDone();
    closeSheet();
  } catch (e) {
    if (e.name === 'AbortError') return;
    if (e.name === 'NotAllowedError') {
      const out = $('#exp-ready', body);
      out.innerHTML = `<button class="btn primary big" id="exp-share">📤 Partager ${esc(file.name)}</button>`;
      $('#exp-share', body).onclick = () => deliver(file, body, onDone);
      return;
    }
    console.error(e);
    toast('Échec du partage : ' + e.message);
  }
}

// Copie de secours (Réglages)
export function openBackupExport(onDone) {
  const body = openSheet(`
    <h3>🗂 Copie de secours</h3>
    <p class="muted small">Les données sont déjà enregistrées en ligne automatiquement. Ce fichier est une copie en plus,
      à garder dans Fichiers / iCloud ou à s’envoyer par mail.</p>
    <button class="btn primary big" id="exp-json">Créer le fichier</button>
    <div id="exp-ready"></div>`);

  $('#exp-json', body).onclick = () => {
    const json = JSON.stringify(store.exportData(), null, 1);
    const file = new File([json], `sympt-mes-sauvegarde-${toDay()}.json`, { type: 'application/json' });
    deliver(file, body, () => {
      store.setMeta('last_export', new Date().toISOString());
      toast('Copie de secours créée ✓');
      if (onDone) onDone();
    });
  };
}
