// Point d'entrée : connexion, onglets, en-tête, bouton d'export.

import * as store from './store.js';
import * as sync from './sync.js';
import { renderToday, bindToday } from './today.js';
import { renderHome, bindHome } from './home.js';
import { renderSummary, bindSummary } from './summary.js';
import { renderSettings, bindSettings } from './settings.js';
import { renderGame, bindGame } from './game.js';
import { initSheet, sheetOpen, openSheet } from './ui.js';
import { CHANGELOG, APP_VERSION, newerThan, notesHtml } from './changelog.js';
import { applyPhoto } from './photo.js';
import { $, $$, toDay, addDays, fmtDayLong, esc, isEvening } from './util.js';

const state = { tab: 'home', day: toDay() };
const views = {};
const demo = !sync.isConfigured();

function render() {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== state.tab;
  for (const b of $$('.tabbar button')) b.classList.toggle('on', b.dataset.tab === state.tab);
  renderHeader();
  if (state.tab === 'home') renderHome(views.home);
  if (state.tab === 'today') renderToday(views.today, state.day);
  if (state.tab === 'summary') renderSummary(views.summary);
  if (state.tab === 'settings') renderSettings(views.settings);
  if (state.tab === 'game') renderGame(views.game);
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
  } else if (state.tab === 'home') {
    h.innerHTML = `<div class="day-title"><small>Sympt'mes</small><span>${esc(fmtDayLong(toDay()))}</span></div>`;
  } else {
    const titles = { summary: 'Synthèse', settings: 'Réglages', game: 'Détente' };
    h.innerHTML = `<div class="day-title"><span>${titles[state.tab]}</span></div>`;
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


// Re-rendu après des données reçues de l'autre téléphone, sans gêner la saisie
let pendingRender = false;
function safeRender() {
  if (isTyping() || sheetOpen()) { pendingRender = true; return; }
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
      store.kvSet('seenVersion', APP_VERSION); // nouvelle installation : pas de « Quoi de neuf »
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

// Mises à jour : sur iPhone, l'appli installée reste souvent ouverte en arrière-plan
// avec l'ancienne version. On vérifie au retour dans l'appli et toutes les 15 min.
// La nouvelle version s'applique toute seule (les données sont déjà enregistrées) :
// tout de suite si l'appli vient d'être ouverte ou est en arrière-plan, sinon dès qu'on la quitte.
// Le bandeau reste proposé pour l'appliquer sans attendre.
const isTyping = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox'));
};

function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let shownAt = Date.now();
  let reloadPending = false;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (reloadPending) location.reload(); return; }
      shownAt = Date.now();
      check();
    });
    setInterval(() => { if (!document.hidden) check(); }, 15 * 60 * 1000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const justOpened = Date.now() - shownAt < 20 * 1000;
    if (document.hidden || (justOpened && !isTyping() && !sheetOpen())) { location.reload(); return; }
    reloadPending = true;
    showUpdateBanner();
  });
  $('#update-btn').addEventListener('click', () => location.reload());
}

// Le bandeau va chercher les notes de la nouvelle version (le code en cours est encore l'ancien)
async function showUpdateBanner() {
  $('#update-banner').hidden = false;
  try {
    const { CHANGELOG: latest } = await import(`./changelog.js?v=${Date.now()}`);
    const fresh = newerThan(latest, APP_VERSION);
    if (!fresh.length) return;
    $('#update-title').textContent = `✨ Nouvelle version ${fresh[0].version}`;
    $('#update-notes').innerHTML = notesHtml(fresh.slice(0, 1));
    store.kvSet('notesShown', fresh[0].version);
  } catch { /* hors ligne : bandeau simple */ }
}

// Après une mise à jour : montre une fois les nouveautés, si le bandeau ne l'a pas déjà fait
function showNotesAfterUpdate() {
  const seen = store.kvGet('seenVersion');
  store.kvSet('seenVersion', APP_VERSION);
  if (seen === APP_VERSION) return;
  const used = seen || store.kvGet('session') || store.kvGet('deviceId') || store.all('symptom_logs').length;
  if (!used || store.kvGet('notesShown') === APP_VERSION) return;
  const fresh = newerThan(CHANGELOG, seen).slice(0, seen ? 3 : 1);
  if (fresh.length) openSheet(`<h3>✨ Quoi de neuf ?</h3>${notesHtml(fresh)}`);
}

// Thème selon l'heure : clair en journée, foncé le soir
function applyTimeTheme() {
  const dark = isEvening();
  const theme = dark ? 'dark' : 'light';
  if (document.documentElement.dataset.theme === theme) return false;
  document.documentElement.dataset.theme = theme;
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1a1c' : '#eaf4f2');
  return true;
}

async function main() {
  applyTimeTheme();
  // Bascule à 18 h / 5 h même si l'appli reste ouverte (le message d'accueil suit)
  setInterval(() => { if (applyTimeTheme() && state.tab === 'home') safeRender(); }, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && applyTimeTheme()) safeRender(); });
  initSheet();
  // Démo : base locale séparée, vide, jamais synchronisée
  await store.init(demo ? 'symptmes-demo-v3' : undefined);
  applyPhoto();
  if (demo) $('#demo-banner').hidden = false;

  views.home = $('#view-home');
  views.today = $('#view-today');
  views.summary = $('#view-summary');
  views.settings = $('#view-settings');
  views.game = $('#view-game');
  bindGame(views.game);
  bindToday(views.today);
  const openDay = (day) => { state.day = day; state.tab = 'today'; render(); window.scrollTo(0, 0); };
  bindHome(views.home, { onOpenDay: openDay, onRender: () => renderHome(views.home) });
  bindSummary(views.summary, {
    onRender: () => renderSummary(views.summary),
    onOpenDay: openDay,
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
  // Le jeu envoie vers la saisie du jour (bonus verrouillés tant qu'elle n'est pas remplie)
  document.addEventListener('open-today', () => openDay(toDay()));
  $('#header-main').addEventListener('click', (e) => {
    if (e.target.closest('#day-prev')) state.day = addDays(state.day, -1);
    else if (e.target.closest('#day-next') && state.day < toDay()) state.day = addDays(state.day, 1);
    else return;
    render();
  });
  $('#sync-status').addEventListener('click', () => {
    const st = sync.getStatus();
    if (st.authError || !st.loggedIn) showLogin('Session expirée : reconnectez-vous (vos saisies sont conservées).');
    else sync.syncNow();
  });

  store.onChange((table, fromRemote) => {
    if (fromRemote) safeRender();
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
    }
  });

  if (demo || store.kvGet('session')) { startApp(); showNotesAfterUpdate(); }
  else showLogin();

  setupUpdates();
}

main().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<p class="fatal">Erreur au démarrage : ${esc(e.message)}</p>`);
});
