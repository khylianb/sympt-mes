// Écran « Réglages ».

import * as store from './store.js';
import * as sync from './sync.js';
import { esc, $, toast, relativeDays } from './util.js';
import { openSheet, closeSheet } from './ui.js';
import { CHANGELOG, APP_VERSION, notesHtml } from './changelog.js';
import { mascotUrl, setMascotFromFile, clearMascot } from './mascot.js';
import { openBackupExport, backupLabel } from './backup.js';


export function renderSettings(container) {
  const st = sync.getStatus();
  const lastSync = store.kvGet('lastSync');
  const auto = store.meta('last_auto_backup');
  const demo = !sync.isConfigured();

  container.innerHTML = `
    <div class="card">
      <h3>Toi</h3>
      <label class="field-block">Ton prénom (l’axolotl l’utilise dans ses compliments)<input id="pf-first" type="text" value="${esc(store.meta('first_name') || '')}" autocomplete="off" autocapitalize="words"></label>
    </div>
    <div class="card">
      <h3>Mascotte de victoire</h3>
      <p class="muted small">Elle saute de joie à chaque niveau réussi. Fond retiré tout seul, visible sur les deux téléphones.</p>
      <div class="media-row">
        ${mascotUrl() ? `<div class="mascot-thumb"><img src="${mascotUrl()}" alt="Mascotte"></div>` : ''}
        <div class="btn-row">
          <label class="btn ghost small file-btn">${mascotUrl() ? 'Changer' : 'Choisir une image'}<input type="file" id="st-mascot" accept="image/*" hidden></label>
          ${mascotUrl() ? '<button class="btn ghost small" id="st-mascot-clear">Retirer</button>' : ''}
        </div>
      </div>
    </div>

    ${demo ? `<div class="card">
      <h3>Mode démo</h3>
      <p class="muted small">Tes essais restent seulement dans ce navigateur, rien n’est envoyé en ligne.</p>
      <button class="btn ghost" id="st-demo-reset">Tout effacer et recommencer</button>
    </div>` : `<div class="card">
      <h3>Synchronisation</h3>
      <p>${st.pending ? `⏳ ${st.pending} modification(s) en attente d’envoi` : '✓ Tout est synchronisé'}</p>
      <p class="muted small">Dernière synchronisation : ${lastSync ? esc(relativeDays(lastSync)) + ' à ' + new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'jamais'}</p>
      ${st.error ? `<p class="red small">${esc(st.error)}</p>` : ''}
      <button class="btn ghost" id="st-sync">Synchroniser maintenant</button>
    </div>`}

    <div class="card">
      <h3>Sauvegardes</h3>
      <p class="muted small">Tout est enregistré en ligne automatiquement. Une copie de secours en plus, de temps en temps, est une bonne précaution.</p>
      <p class="muted small">${esc(backupLabel())} · sauvegarde automatique : ${auto ? esc(relativeDays(auto)) : 'pas encore activée'}</p>
      <div class="btn-row">
        <button class="btn ghost" id="st-backup">Créer une copie de secours</button>
        <label class="btn ghost file-btn">Restaurer un fichier de sauvegarde…<input type="file" id="st-import" accept="application/json,.json" hidden></label>
      </div>
    </div>

    ${demo ? '' : `<div class="card">
      <h3>Compte</h3>
      <div class="btn-row">
        <button class="btn ghost" id="st-password">🔑 Changer le mot de passe</button>
        <button class="btn danger" id="st-logout">Se déconnecter de ce téléphone</button>
      </div>
    </div>`}
    <div class="center">
      <div class="btn-row center-row">
        <button class="btn ghost" id="st-notes">📝 Nouveautés</button>
        <button class="btn ghost" id="st-reload">🔄 Recharger l’appli</button>
      </div>
      <p class="muted small">Sympt'mes v${APP_VERSION} · les données restent dans ton espace Supabase.</p>
    </div>`;
}

export function bindSettings(container, { onRender }) {
  container.addEventListener('change', async (e) => {
    if (e.target.id === 'pf-first') { store.setMeta('first_name', e.target.value.trim()); toast('Enregistré ✓'); }
    if (e.target.id === 'st-mascot') {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await setMascotFromFile(f);
        toast('Mascotte enregistrée ✓');
        onRender();
      } catch (err) {
        toast('Impossible de lire cette image');
      }
      e.target.value = '';
    }
    if (e.target.id === 'st-import') {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const n = store.importData(JSON.parse(await f.text()));
        toast(`${n} élément(s) restauré(s)`);
        sync.scheduleSync(200);
        onRender();
      } catch (err) {
        alert('Impossible de lire ce fichier : ' + err.message);
      }
      e.target.value = '';
    }
  });

  container.addEventListener('click', async (e) => {
    if (e.target.closest('#st-notes')) {
      openSheet(`<h3>📝 Nouveautés</h3>${notesHtml(CHANGELOG)}`);
    } else if (e.target.closest('#st-reload')) {
      // Cherche d'abord une nouvelle version, puis recharge (les données sont déjà enregistrées)
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
      } catch { /* hors ligne : on recharge quand même */ }
      location.reload();
    } else if (e.target.closest('#st-backup')) {
      openBackupExport(onRender);
    } else if (e.target.closest('#st-mascot-clear')) {
      clearMascot();
      onRender();
    } else if (e.target.closest('#st-demo-reset')) {
      await store.clearAll();
      location.reload();
    } else if (e.target.closest('#st-sync')) {
      await sync.syncNow();
      onRender();
      const st = sync.getStatus();
      toast(st.error ? 'Échec : ' + st.error : 'Synchronisé ✓');
    } else if (e.target.closest('#st-password')) {
      passwordSheet();
    } else if (e.target.closest('#st-logout')) {
      const pending = store.pendingCount();
      const msg = pending
        ? `⚠ ${pending} modification(s) n'ont pas encore été envoyées et seront PERDUES. Se déconnecter quand même ?`
        : 'Se déconnecter ? Les données restent en ligne et reviendront à la prochaine connexion.';
      if (!confirm(msg)) return;
      await sync.logout();
      location.reload();
    }
  });
}

function passwordSheet() {
  const body = openSheet(`
    <h3>🔑 Changer le mot de passe</h3>
    <form id="pw-form" class="field-block">
      <input id="pw-new" type="password" placeholder="Nouveau mot de passe (6 caractères min.)" autocomplete="new-password" minlength="6" required>
      <input id="pw-new2" type="password" placeholder="Confirme le mot de passe" autocomplete="new-password" minlength="6" required>
      <p class="muted small" id="pw-msg"></p>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-close>Annuler</button>
        <button class="btn primary" id="pw-save">Enregistrer</button>
      </div>
    </form>`);
  body.querySelector('[data-close]').onclick = closeSheet;
  body.querySelector('#pw-form').onsubmit = async (e) => {
    e.preventDefault();
    const pw = body.querySelector('#pw-new').value;
    const msg = body.querySelector('#pw-msg');
    if (pw !== body.querySelector('#pw-new2').value) { msg.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    const btn = body.querySelector('#pw-save');
    btn.disabled = true;
    msg.textContent = 'Enregistrement…';
    try {
      await sync.updatePassword(pw);
      closeSheet();
      toast('Nouveau mot de passe enregistré ✓');
    } catch (err) {
      msg.textContent = !navigator.onLine ? 'Pas de connexion internet.'
        : /same_password|different/i.test(err.message + err.code) ? 'Choisis un mot de passe différent de l’ancien.'
        : /weak|should be/i.test(err.message + err.code) ? 'Mot de passe trop court ou trop simple (6 caractères minimum).'
        : err.message;
    } finally {
      btn.disabled = false;
    }
  };
}
