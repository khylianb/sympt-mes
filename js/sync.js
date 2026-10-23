// Connexion Supabase (API REST, sans librairie) et synchronisation.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import * as store from './store.js';

const PAGE = 1000;
const PULL_MARGIN_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 15000;

// Sur un réseau mobile instable, une requête peut rester bloquée : on l'abandonne
function fetchT(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

let status = { state: 'idle', error: null };
const statusListeners = new Set();
export const onStatus = (fn) => { statusListeners.add(fn); fn(getStatus()); };
export const getStatus = () => ({ ...status, pending: store.pendingCount(), loggedIn: !!session() });
function setStatus(s) { status = { ...status, ...s }; for (const fn of statusListeners) fn(getStatus()); }
export const refreshStatus = () => setStatus({});

export const isConfigured = () => !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_KEY.includes('VOTRE-CLE');

// ---------- authentification ----------
const session = () => store.kvGet('session');

async function authFetch(path, { method = 'POST', body, token } = {}) {
  const res = await fetchT(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description || json.msg || json.message || `Erreur ${res.status}`);
    err.status = res.status;
    err.code = json.error_code || json.code;
    throw err;
  }
  return json;
}

// Enregistre la session ; si c'est un autre compte que celui des données locales, on repart de zéro
async function saveSession(json) {
  const userId = json.user && json.user.id;
  const owner = store.kvGet('owner');
  if (userId && owner && owner !== userId) await store.clearAll();
  await store.kvSet('session', {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at || Math.floor(Date.now() / 1000) + (Number(json.expires_in) || 3600),
    user_id: userId,
  });
  if (userId) await store.kvSet('owner', userId);
}

async function authRequest(grant, body) {
  await saveSession(await authFetch(`token?grant_type=${grant}`, { body }));
}

// Adresse de l'appli, où renvoient les liens reçus par email
const appUrl = () => location.origin + location.pathname;

export async function login(email, password) {
  await authRequest('password', { email, password });
  setStatus({ state: 'idle', error: null, authError: false });
}

// Création de compte ; renvoie true s'il faut d'abord confirmer l'email
export async function signup(email, password) {
  const json = await authFetch(`signup?redirect_to=${encodeURIComponent(appUrl())}`, { body: { email, password } });
  if (!json.access_token) return true;
  await saveSession(json);
  setStatus({ state: 'idle', error: null, authError: false });
  return false;
}

// Envoie l'email « mot de passe oublié »
export async function recover(email) {
  await authFetch(`recover?redirect_to=${encodeURIComponent(appUrl())}`, { body: { email } });
}

// Retour depuis un lien reçu par email (#access_token=…&type=recovery|signup) ; renvoie le type ou null
export async function sessionFromLink(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('error') || p.get('error_code')) {
    const err = new Error(p.get('error_code') === 'otp_expired' ? 'Ce lien a expiré : redemande un email.' : (p.get('error_description') || 'Lien invalide.'));
    err.link = true;
    throw err;
  }
  const token = p.get('access_token');
  if (!token) return null;
  const user = await authFetch('user', { method: 'GET', token });
  await saveSession({
    access_token: token, refresh_token: p.get('refresh_token'),
    expires_at: Number(p.get('expires_at')) || undefined, expires_in: p.get('expires_in'), user,
  });
  setStatus({ state: 'idle', error: null, authError: false });
  return p.get('type') || 'signup';
}

export async function updatePassword(password) {
  await authFetch('user', { method: 'PUT', body: { password }, token: await accessToken() });
}

export async function logout() {
  const s = session();
  if (s) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
  await store.clearAll();
  setStatus({ state: 'idle', error: null, authError: false });
}

async function accessToken() {
  const s = session();
  if (!s) throw Object.assign(new Error('Non connecté'), { auth: true });
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  try {
    await authRequest('refresh_token', { refresh_token: s.refresh_token });
  } catch (e) {
    if (e.status === 400 || e.status === 401) {
      // Session expirée : on garde les données locales, il faudra se reconnecter
      await store.kvSet('session', undefined);
      throw Object.assign(new Error('Session expirée, reconnectez-vous'), { auth: true });
    }
    throw e;
  }
  return session().access_token;
}

async function rest(path, opts = {}) {
  const token = await accessToken();
  const res = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    await store.kvSet('session', undefined);
    throw Object.assign(new Error('Session expirée, reconnectez-vous'), { auth: true });
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Serveur ${res.status} ${txt.slice(0, 200)}`);
  }
  return res;
}

// ---------- synchronisation ----------
async function push(table) {
  const def = store.TABLES[table];
  const dirty = store.all(table).filter((r) => r._dirty);
  for (let i = 0; i < dirty.length; i += 200) {
    const batch = dirty.slice(i, i + 200);
    const body = batch.map((r) => {
      const o = {};
      for (const c of def.cols) o[c] = r[c] === undefined ? null : r[c];
      return o;
    });
    await rest(`${table}?on_conflict=${def.conflict}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    for (const r of batch) store.markClean(table, def.key(r), r.updated_at);
  }
}

async function pull(table) {
  const cursorKey = `pull:${table}`;
  const since = store.kvGet(cursorKey);
  let filter = '';
  if (since) filter = `&synced_at=gt.${encodeURIComponent(new Date(Date.parse(since) - PULL_MARGIN_MS).toISOString())}`;
  let offset = 0;
  let maxSynced = since;
  let changed = false;
  for (;;) {
    const res = await rest(`${table}?select=*${filter}&order=synced_at.asc&limit=${PAGE}&offset=${offset}`);
    const rows = await res.json();
    for (const row of rows) {
      if (store.mergeRemote(table, row)) changed = true;
      if (!maxSynced || row.synced_at > maxSynced) maxSynced = row.synced_at;
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  if (maxSynced) await store.kvSet(cursorKey, maxSynced);
  if (changed) store.notify(table);
}

let running = null;
let again = false;

async function runSync() {
  try {
    do {
      again = false;
      if (!isConfigured() || !session()) { setStatus({ state: 'idle' }); return; }
      if (!navigator.onLine) { setStatus({ state: 'offline' }); return; }
      setStatus({ state: 'syncing', error: null, authError: false });
      for (const t of Object.keys(store.TABLES)) await push(t);
      for (const t of Object.keys(store.TABLES)) await pull(t);
      await store.kvSet('lastSync', new Date().toISOString());
      setStatus({ state: 'idle', error: null, authError: false });
    } while (again);
  } catch (e) {
    console.warn('Synchronisation', e);
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message, authError: !!e.auth });
  }
}

export async function syncNow() {
  if (running) { again = true; return running; }
  running = runSync();
  try { await running; } finally { running = null; }
}

let timer;
export function scheduleSync(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
  refreshStatus();
}

export function startAutoSync() {
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setStatus({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  setInterval(() => { if (!document.hidden) syncNow(); }, 60 * 1000);
  store.onChange((table, fromRemote) => { if (!fromRemote) scheduleSync(); });
  syncNow();
}
