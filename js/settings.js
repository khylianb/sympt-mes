// Écran « Réglages ».

import * as store from './store.js';
import * as sync from './sync.js';
import { CATEGORIES, catLabel } from './catalogue.js';
import { esc, $, toast, relativeDays } from './util.js';
import { openSheet, closeSheet } from './ui.js';
import { hasPhoto, photoUrl, setPhotoFromFile, clearPhoto } from './photo.js';

export const APP_VERSION = '1.0.0';

export function renderSettings(container) {
  const profile = store.meta('profile') || {};
  const custom = store.all('custom_symptoms').sort((a, b) => a.label.localeCompare(b.label));
  const st = sync.getStatus();
  const lastSync = store.kvGet('lastSync');
  const auto = store.meta('last_auto_backup');
  const demo = !sync.isConfigured();

  container.innerHTML = `
    <div class="card">
      <h3>Photo d’accueil</h3>
      <p class="muted small">Une photo de ta galerie en haut de l’accueil. Elle reste sur ce téléphone.</p>
      ${hasPhoto() ? `<div class="photo-thumb" style="background-image:url('${photoUrl()}')"></div>` : ''}
      <div class="btn-row">
        <label class="btn ghost file-btn">${hasPhoto() ? 'Changer la photo' : 'Choisir une photo'}<input type="file" id="st-photo" accept="image/*" hidden></label>
        ${hasPhoto() ? '<button class="btn ghost" id="st-photo-clear">Remettre l’illustration</button>' : ''}
      </div>
    </div>

    <div class="card">
      <h3>En-tête du PDF</h3>
      <p class="muted small">Facultatif. Laissez vide pour un PDF anonyme.</p>
      <label class="field-block">Prénom et nom<input id="pf-name" type="text" value="${esc(profile.name || '')}" autocomplete="off"></label>
      <label class="field-block">Date de naissance<input id="pf-birth" type="text" placeholder="jj/mm/aaaa" value="${esc(profile.birth || '')}" autocomplete="off"></label>
    </div>

    <div class="card">
      <h3>Mes symptômes ajoutés</h3>
      ${custom.length ? custom.map((c) => `
        <button class="list-row ${c.archived ? 'archived' : ''}" data-edit="${esc(c.key)}">
          <span>${esc(c.label)}${c.urgent ? ' <span class="dot"></span>' : ''}</span>
          <small>${esc(catLabel(c.category))}${c.archived ? ' · masqué' : ''}</small>
        </button>`).join('') : '<p class="muted">Aucun pour l’instant. Utilisez « + Ajouter un symptôme » sur l’écran du jour.</p>'}
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
      <p class="muted small">Sauvegarde automatique hebdomadaire : ${auto ? esc(relativeDays(auto)) : 'pas encore'}</p>
      <label class="btn ghost file-btn">Restaurer un fichier de sauvegarde…<input type="file" id="st-import" accept="application/json,.json" hidden></label>
    </div>

    ${demo ? '' : `<div class="card">
      <h3>Compte</h3>
      <button class="btn danger" id="st-logout">Se déconnecter de ce téléphone</button>
    </div>`}
    <p class="muted small center">Sympt'mes v${APP_VERSION} · les données restent dans votre espace Supabase.</p>`;
}

export function bindSettings(container, { onRender }) {
  const saveProfile = () => store.setMeta('profile', {
    name: $('#pf-name', container).value.trim(),
    birth: $('#pf-birth', container).value.trim(),
  });
  container.addEventListener('change', async (e) => {
    if (e.target.id === 'pf-name' || e.target.id === 'pf-birth') { saveProfile(); toast('Enregistré ✓'); }
    if (e.target.id === 'st-photo') {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await setPhotoFromFile(f);
        toast('Photo enregistrée ✓');
        onRender();
      } catch (err) {
        toast('Impossible de lire cette photo');
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
    if (e.target.closest('#st-photo-clear')) {
      await clearPhoto();
      onRender();
    } else if (e.target.closest('#st-demo-reset')) {
      await store.clearAll();
      location.reload();
    } else if (e.target.closest('#st-sync')) {
      await sync.syncNow();
      onRender();
      const st = sync.getStatus();
      toast(st.error ? 'Échec : ' + st.error : 'Synchronisé ✓');
    } else if (e.target.closest('#st-logout')) {
      const pending = store.pendingCount();
      const msg = pending
        ? `⚠ ${pending} modification(s) n'ont pas encore été envoyées et seront PERDUES. Se déconnecter quand même ?`
        : 'Se déconnecter ? Les données restent en ligne et reviendront à la prochaine connexion.';
      if (!confirm(msg)) return;
      await sync.logout();
      location.reload();
    } else {
      const b = e.target.closest('[data-edit]');
      if (b) editCustom(b.dataset.edit, onRender);
    }
  });
}

function editCustom(key, onRender) {
  const c = store.get('custom_symptoms', key);
  const body = openSheet(`
    <h3>Modifier le symptôme</h3>
    <label class="field-block">Nom<input id="es-label" type="text" value="${esc(c.label)}"></label>
    <label class="field-block">Catégorie
      <select id="es-cat">${CATEGORIES.map((x) => `<option value="${x.id}" ${x.id === c.category ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
    </label>
    <label class="check-line"><input id="es-urgent" type="checkbox" ${c.urgent ? 'checked' : ''}> À signaler vite (affiché en rouge)</label>
    <label class="check-line"><input id="es-arch" type="checkbox" ${c.archived ? 'checked' : ''}> Masquer de la saisie (l’historique est conservé)</label>
    <div class="sheet-actions">
      <button class="btn ghost" data-close>Annuler</button>
      <button class="btn primary" id="es-save">Enregistrer</button>
    </div>`, { onClose: onRender });
  $('[data-close]', body).onclick = closeSheet;
  $('#es-save', body).onclick = () => {
    const label = $('#es-label', body).value.trim();
    if (!label) return;
    store.save('custom_symptoms', {
      ...c, label, category: $('#es-cat', body).value,
      urgent: $('#es-urgent', body).checked, archived: $('#es-arch', body).checked,
    });
    closeSheet();
  };
}
