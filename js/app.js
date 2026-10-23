// Point d'entrée : connexion, onglets (axolotl, jeux, réglages), mises à jour.

import * as store from './store.js';
import * as sync from './sync.js';
import { renderPet, bindPet, resetPetView, getPet } from './pet.js';
import { renderGames, bindGames, gamesHome } from './games.js';
import { renderSettings, bindSettings } from './settings.js';
import { migrateLegacy } from './care.js';
import { initSheet, sheetOpen, openSheet } from './ui.js';
import { CHANGELOG, APP_VERSION, newerThan, notesHtml } from './changelog.js';
import { $, $$, esc, isEvening, toast } from './util.js';

const state = { tab: 'pet' };
const views = {};
const demo = !sync.isConfigured();

// L'onglet de l'axolotl porte son prénom
function petTabLabel() {
  const pet = getPet();
  $('#tab-pet-label').textContent = pet ? pet.name : 'Axolotl';
}

function render() {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== state.tab;
  for (const b of $$('.tabbar button')) b.classList.toggle('on', b.dataset.tab === state.tab);
  petTabLabel();
  if (state.tab === 'pet') renderPet(views.pet);
  if (state.tab === 'games') renderGames(views.games);
  if (state.tab === 'settings') { $('#header-main').innerHTML = '<div class="day-title"><span>Réglages</span></div>'; renderSettings(views.settings); }
  syncImmersive();
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

// Écran de connexion : se connecter, créer un compte, mot de passe oublié, nouveau mot de passe
const LOGIN_MODES = {
  login: { title: '', btn: 'Se connecter', email: true, pw: 'Mot de passe', links: [['signup', 'Créer un compte'], ['forgot', 'Mot de passe oublié ?']] },
  signup: { title: 'Créer un compte', btn: 'Créer mon compte', email: true, pw: 'Mot de passe (6 caractères min.)', pw2: true, links: [['login', 'J’ai déjà un compte']] },
  forgot: { title: 'Mot de passe oublié', btn: 'Recevoir un lien par email', email: true, links: [['login', '‹ Retour à la connexion']] },
  reset: { title: 'Choisis un nouveau mot de passe', btn: 'Enregistrer', pw: 'Nouveau mot de passe (6 caractères min.)', pw2: true, links: [] },
};
let loginMode = 'login';

function loginMsg(text, ok = false) {
  const m = $('#login-msg');
  m.textContent = text;
  m.classList.toggle('ok', ok);
}

function setLoginMode(mode, message = '') {
  loginMode = mode;
  const m = LOGIN_MODES[mode];
  $('#login-title').textContent = m.title;
  const email = $('#login-email'); const pw = $('#login-password'); const pw2 = $('#login-password2');
  email.hidden = !m.email; email.required = !!m.email;
  pw.hidden = !m.pw; pw.required = !!m.pw; pw.placeholder = m.pw || '';
  pw.minLength = m.pw2 ? 6 : 0;
  pw.autocomplete = m.pw2 ? 'new-password' : 'current-password';
  pw2.hidden = !m.pw2; pw2.required = !!m.pw2; pw2.value = '';
  $('#login-btn').textContent = m.btn;
  $('#login-links').innerHTML = m.links.map(([id, label]) => `<button type="button" data-login-mode="${id}">${label}</button>`).join('');
  loginMsg(message);
}

function loginDone() {
  $('#login-password').value = '';
  $('#login-password2').value = '';
  $('#login').hidden = true;
  store.kvSet('seenVersion', APP_VERSION); // nouvelle installation : pas de « Quoi de neuf »
  startApp();
}

async function submitLogin() {
  const email = $('#login-email').value.trim();
  const pw = $('#login-password').value;
  if (LOGIN_MODES[loginMode].pw2 && pw !== $('#login-password2').value) { loginMsg('Les deux mots de passe ne sont pas identiques.'); return; }
  if (loginMode === 'login') {
    loginMsg('Connexion…');
    await sync.login(email, pw);
    loginDone();
  } else if (loginMode === 'signup') {
    loginMsg('Création du compte…');
    const mustConfirm = await sync.signup(email, pw);
    if (!mustConfirm) { loginDone(); return; }
    setLoginMode('login', `📧 Compte créé ! Ouvre l’email envoyé à ${email} et clique sur le lien pour l’activer.`);
    $('#login-msg').classList.add('ok');
  } else if (loginMode === 'forgot') {
    loginMsg('Envoi…');
    await sync.recover(email);
    setLoginMode('login', `📧 Si un compte existe pour ${email}, un email avec un lien vient d’être envoyé. Ouvre-le sur ce téléphone pour choisir un nouveau mot de passe.`);
    $('#login-msg').classList.add('ok');
  } else if (loginMode === 'reset') {
    loginMsg('Enregistrement…');
    await sync.updatePassword(pw);
    toast('Nouveau mot de passe enregistré ✓');
    loginDone();
  }
}

function loginError(err) {
  if (!navigator.onLine) return 'Pas de connexion internet.';
  const msg = err.message || '';
  if (/invalid login|invalid_credentials/i.test(msg + err.code)) return 'Email ou mot de passe incorrect.';
  if (/not confirmed/i.test(msg)) return 'Ton email n’est pas encore confirmé : clique sur le lien reçu par email.';
  if (/signups? not allowed|signup_disabled/i.test(msg + err.code)) return 'La création de compte est fermée pour le moment.';
  if (/already registered|user_already_exists/i.test(msg + err.code)) return 'Un compte existe déjà avec cet email : connecte-toi ou utilise « Mot de passe oublié ».';
  if (/rate limit|over_email_send_rate_limit/i.test(msg + err.code)) return 'Trop d’emails envoyés : réessaie dans une heure.';
  if (/password should be|weak_password/i.test(msg + err.code)) return 'Mot de passe trop court ou trop simple (6 caractères minimum).';
  if (/same_password|should be different/i.test(msg + err.code)) return 'Choisis un mot de passe différent de l’ancien.';
  if (/valid email|email_address_invalid/i.test(msg + err.code)) return 'Adresse email invalide.';
  return msg;
}

function showLogin(message, mode = 'login') {
  $('#app').hidden = true;
  const box = $('#login');
  box.hidden = false;
  if (!sync.isConfigured()) {
    $('#login-form').hidden = true;
    loginMsg('L’application n’est pas encore reliée à Supabase : renseignez js/config.js.');
    return;
  }
  setLoginMode(mode, message);
  $('#login-links').onclick = (e) => {
    const b = e.target.closest('[data-login-mode]');
    if (b) setLoginMode(b.dataset.loginMode);
  };
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    btn.disabled = true;
    try {
      await submitLogin();
    } catch (err) {
      loginMsg(loginError(err));
    } finally {
      btn.disabled = false;
    }
  };
}

// Lien reçu par email (confirmation de compte ou mot de passe oublié) : renvoie true s'il a été traité
async function handleAuthLink() {
  const hash = location.hash;
  if (!/access_token=|error_code=|error=/.test(hash)) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const type = await sync.sessionFromLink(hash);
    if (type === 'recovery') { showLogin('', 'reset'); return true; }
    if (type) { startApp(); toast('Compte activé, bienvenue 💜'); return true; }
  } catch (err) {
    showLogin(navigator.onLine ? err.message : 'Pas de connexion internet.', err.link ? 'forgot' : 'login');
    return true;
  }
  return false;
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
  const used = seen || store.kvGet('session') || store.kvGet('deviceId');
  if (!used || store.kvGet('notesShown') === APP_VERSION) return;
  const fresh = newerThan(CHANGELOG, seen).slice(0, seen ? 3 : 1);
  if (fresh.length) openSheet(`<h3>✨ Quoi de neuf ?</h3>${notesHtml(fresh)}`);
}

// Jeu, boutiques et axolotl en plein écran : pas d'en-tête, décor d'un bord à l'autre
function syncImmersive() {
  const v = views[state.tab];
  const on = state.tab !== 'settings' && !!v && !!v.querySelector('.arcade');
  if (document.body.classList.contains('immersive') === on) return;
  document.body.classList.toggle('immersive', on);
  $('meta[name="theme-color"]')?.setAttribute('content', on ? '#0b0e26' : isEvening() ? '#0e1a1c' : '#eaf4f2');
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
  // Bascule à 18 h / 5 h même si l'appli reste ouverte
  setInterval(() => { if (applyTimeTheme() && state.tab === 'settings') safeRender(); }, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && applyTimeTheme()) safeRender(); });
  initSheet();
  // Démo : base locale séparée, vide, jamais synchronisée
  await store.init(demo ? 'symptmes-demo-v3' : undefined);
  await migrateLegacy();
  if (demo) $('#demo-banner').hidden = false;

  views.pet = $('#view-pet');
  views.games = $('#view-games');
  views.settings = $('#view-settings');
  bindPet(views.pet);
  bindGames(views.games);
  for (const v of [views.pet, views.games]) new MutationObserver(syncImmersive).observe(v, { childList: true });
  bindSettings(views.settings, { onRender: () => renderSettings(views.settings) });

  const openTab = (tab) => { state.tab = tab; render(); window.scrollTo(0, 0); };
  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'games' && b.classList.contains('on')) gamesHome();
    if (b.dataset.tab === 'pet') resetPetView();
    openTab(b.dataset.tab);
  });
  // Les jeux renvoient vers l'axolotl (bonus débloqués quand il a mangé)
  document.addEventListener('open-pet', () => { resetPetView(); openTab('pet'); });
  $('#sync-status').addEventListener('click', () => {
    const st = sync.getStatus();
    if (st.authError || !st.loggedIn) showLogin('Session expirée : reconnecte-toi (rien n’est perdu).');
    else sync.syncNow();
  });

  store.onChange((table, fromRemote) => {
    petTabLabel();
    if (fromRemote) safeRender();
  });
  document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) safeRender(); }, 300));
  new MutationObserver(() => { if (pendingRender && !sheetOpen()) safeRender(); })
    .observe($('#sheet'), { attributes: true, attributeFilter: ['hidden'] });

  sync.onStatus((st) => {
    renderStatus(st);
    if (st.authError) showLogin('Session expirée : reconnecte-toi (rien n’est perdu).');
  });

  // Après minuit, l'appli restée ouverte passe au nouveau jour (l'axolotl a de nouveau faim)
  let lastDay = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || new Date().toDateString() === lastDay) return;
    lastDay = new Date().toDateString();
    safeRender();
  });

  if (!demo && await handleAuthLink()) { /* lien email traité */ }
  else if (demo || store.kvGet('session')) { startApp(); showNotesAfterUpdate(); }
  else showLogin();

  setupUpdates();
}

main().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<p class="fatal">Erreur au démarrage : ${esc(e.message)}</p>`);
});
