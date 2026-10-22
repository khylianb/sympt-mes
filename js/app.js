// Point d'entrée : connexion, onglets, en-tête, bouton d'export.

import * as store from './store.js';
import * as sync from './sync.js';
import { renderToday, bindToday } from './today.js';
import { renderSummary, bindSummary } from './summary.js';
import { renderSettings, bindSettings } from './settings.js';
import { openExport, backupLabel, backupIsOld } from './export.js';
import { initSheet, sheetOpen } from './ui.js';
import { $, $$, toDay, addDays, fmtDayLong, esc } from './util.js';

const state = { tab: 'today', day: toDay() };
const views = {};
const demo = !sync.isConfigured();

function render() {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== state.tab;
  for (const b of $$('.tabbar button')) b.classList.toggle('on', b.dataset.tab === state.tab);
  renderHeader();
  if (state.tab === 'today') renderToday(views.today, state.day);
  if (state.tab === 'summary') renderSummary(views.summary);
  if (state.tab === 'settings') renderSettings(views.settings);
  renderFab();
}

function renderHeader() {
  const h = $('#header-main');
  if (state.tab === 'today') {
    const today = toDay();
    const label = state.day === today ? "Aujourd'hui" : state.day === addDays(today, -1) ? 'Hier' : '';
    h.innerHTML = `
      <button class="icon-btn" id="day-prev" aria-label="Jour précédent"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="day-title"><small>${label}</small><span>${esc(fmtDayLong(state.day))}</span></div>
      <button class="icon-btn" id="day-next" aria-label="Jour suivant" ${state.day >= today ? 'disabled' : ''}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  } else {
    h.innerHTML = `<div class="day-title"><span>${state.tab === 'summary' ? 'Synthèse' : 'Réglages'}</span></div>`;
  }
}

function renderStatus(st) {
  const el = $('#sync-status');
  let txt, cls;
  if (demo) { txt = 'démo'; cls = 'muted'; }
  else if (st.authError) { txt = '⚠ se reconnecter'; cls = 'warn'; }
  else if (st.state === 'syncing') { txt = '⟳'; cls = ''; }
  else if (st.state === 'offline') { txt = st.pending ? `hors ligne · ${st.pending}` : 'hors ligne'; cls = 'muted'; }
  else if (st.state === 'error') { txt = '⚠ erreur'; cls = 'warn'; }
  else if (st.pending) { txt = `⏳ ${st.pending}`; cls = ''; }
  else { txt = '✓'; cls = 'ok'; }
  el.textContent = txt;
  el.className = `sync-pill ${cls}`;
  el.title = st.error || '';
}

function renderFab() {
  $('#fab-note').textContent = backupLabel();
  $('#fab-note').classList.toggle('old', backupIsOld());
}

// Re-rendu après des données reçues de l'autre téléphone, sans gêner la saisie
let pendingRender = false;
function safeRender() {
  const a = document.activeElement;
  const typing = a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox'));
  if (typing || sheetOpen()) { pendingRender = true; return; }
  pendingRender = false;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

function showLogin(message) {
  $('#app').hidden = true;
  const box = $('#login');
  box.hidden = false;
  if (!sync.isConfigured()) {
    $('#login-form').hidden = true;
    $('#login-msg').textContent = 'L’application n’est pas encore reliée à Supabase : renseignez js/config.js.';
    return;
  }
  if (message) $('#login-msg').textContent = message;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    btn.disabled = true;
    $('#login-msg').textContent = 'Connexion…';
    try {
      await sync.login($('#login-email').value.trim(), $('#login-password').value);
      $('#login-password').value = '';
      box.hidden = true;
      startApp();
    } catch (err) {
      $('#login-msg').textContent = navigator.onLine
        ? (/invalid/i.test(err.message) ? 'Email ou mot de passe incorrect.' : err.message)
        : 'Pas de connexion internet.';
    } finally {
      btn.disabled = false;
    }
  };
}

let started = false;
function startApp() {
  $('#app').hidden = false;
  render();
  if (started) { sync.syncNow(); return; }
  started = true;
  sync.startAutoSync();
}

async function main() {
  initSheet();
  // Démo : base locale séparée, vide, jamais synchronisée
  await store.init(demo ? 'symptmes-demo-vide' : undefined);
  if (demo) $('#demo-banner').hidden = false;

  views.today = $('#view-today');
  views.summary = $('#view-summary');
  views.settings = $('#view-settings');
  bindToday(views.today);
  bindSummary(views.summary, {
    onRender: () => renderSummary(views.summary),
    onOpenDay: (day) => { state.day = day; state.tab = 'today'; render(); window.scrollTo(0, 0); },
  });
  bindSettings(views.settings, { onRender: () => renderSettings(views.settings) });

  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    if (state.tab === 'today' && b.classList.contains('on')) state.day = toDay();
    render();
    window.scrollTo(0, 0);
  });
  $('#header-main').addEventListener('click', (e) => {
    if (e.target.closest('#day-prev')) state.day = addDays(state.day, -1);
    else if (e.target.closest('#day-next') && state.day < toDay()) state.day = addDays(state.day, 1);
    else return;
    render();
  });
  $('#fab').addEventListener('click', openExport);
  $('#sync-status').addEventListener('click', () => {
    const st = sync.getStatus();
    if (st.authError || !st.loggedIn) showLogin('Session expirée : reconnectez-vous (vos saisies sont conservées).');
    else sync.syncNow();
  });

  store.onChange((table, fromRemote) => {
    if (fromRemote) safeRender();
    else if (table === 'app_meta') renderFab();
  });
  document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) safeRender(); }, 300));
  new MutationObserver(() => { if (pendingRender && !sheetOpen()) safeRender(); })
    .observe($('#sheet'), { attributes: true, attributeFilter: ['hidden'] });

  sync.onStatus((st) => {
    renderStatus(st);
    if (st.authError) showLogin('Session expirée : reconnectez-vous (vos saisies sont conservées).');
  });

  // Après minuit, l'appli restée ouverte repasse sur le nouveau jour
  let lastToday = toDay();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const t = toDay();
    if (t !== lastToday) {
      if (state.day === lastToday) state.day = t;
      lastToday = t;
      render();
    } else renderFab();
  });

  if (demo || store.kvGet('session')) startApp();
  else showLogin();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

main().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<p class="fatal">Erreur au démarrage : ${esc(e.message)}</p>`);
});
