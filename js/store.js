// Stockage local (IndexedDB) : tout est lu en mémoire au démarrage,
// chaque modification est écrite immédiatement et marquée « à envoyer » (_dirty).

import { SYMPTOMS, CATEGORY_ALIASES } from './catalogue.js';

const DB_NAME = 'symptmes';
const DB_VERSION = 1;

export const TABLES = {
  symptom_logs: { key: (r) => `${r.day}|${r.symptom_key}`, conflict: 'owner,day,symptom_key',
    cols: ['day', 'symptom_key', 'intensity', 'details', 'deleted', 'updated_at'] },
  // Repas : plus saisis dans l'appli, table conservée pour la compatibilité des sauvegardes
  meals: { key: (r) => r.id, conflict: 'id',
    cols: ['id', 'day', 'slot', 'time', 'items', 'tags', 'deleted', 'updated_at'] },
  day_notes: { key: (r) => r.day, conflict: 'owner,day',
    cols: ['day', 'note', 'nothing', 'updated_at'] },
  custom_symptoms: { key: (r) => r.key, conflict: 'owner,key',
    cols: ['key', 'label', 'category', 'urgent', 'archived', 'updated_at'] },
  app_meta: { key: (r) => r.key, conflict: 'owner,key',
    cols: ['key', 'value', 'updated_at'] },
};

const mem = {};
for (const t of Object.keys(TABLES)) mem[t] = new Map();
const listeners = new Set();
let db;

function openDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const t of Object.keys(TABLES)) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t);
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const out = [];
    const req = os.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    if (value === undefined) tx.objectStore(store).delete(key);
    else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// name : base séparée pour le mode démo
export async function init(name = DB_NAME) {
  db = await openDb(name);
  for (const t of Object.keys(TABLES)) {
    for (const [k, v] of await idbAll(t)) mem[t].set(k, v);
  }
  for (const [k, v] of await idbAll('kv')) kvCache.set(k, v);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// ---------- petites valeurs locales (session, curseurs de synchro…) ----------
const kvCache = new Map();
export const kvGet = (k) => kvCache.get(k);
export function kvSet(k, v) {
  if (v === undefined) kvCache.delete(k); else kvCache.set(k, v);
  return idbPut('kv', k, v);
}

// ---------- accès aux données ----------
export const all = (table) => [...mem[table].values()];
export const get = (table, key) => mem[table].get(key);

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(table, fromRemote) { for (const fn of listeners) fn(table, fromRemote); }

const nowIso = () => new Date().toISOString();

// Écriture locale : la ligne est marquée à envoyer
export function save(table, row) {
  const rec = { ...row, updated_at: nowIso(), _dirty: true };
  const key = TABLES[table].key(rec);
  mem[table].set(key, rec);
  idbPut(table, key, rec);
  emit(table, false);
  return rec;
}

// Fusion d'une ligne venue du serveur (ou d'un import) : la plus récente gagne
export function mergeRemote(table, row, { markDirty = false } = {}) {
  const key = TABLES[table].key(row);
  const local = mem[table].get(key);
  if (local && local.updated_at > row.updated_at) return false;
  if (markDirty && local && local.updated_at === row.updated_at) return false;
  const rec = {};
  for (const c of TABLES[table].cols) if (c in row) rec[c] = row[c];
  if (markDirty) rec._dirty = true;
  mem[table].set(key, rec);
  idbPut(table, key, rec);
  return true;
}

export function markClean(table, key, updatedAt) {
  const rec = mem[table].get(key);
  if (rec && rec._dirty && rec.updated_at === updatedAt) {
    delete rec._dirty;
    idbPut(table, key, rec);
  }
}

export const notify = (table) => emit(table, true);

export function pendingCount() {
  let n = 0;
  for (const t of Object.keys(TABLES)) for (const r of mem[t].values()) if (r._dirty) n++;
  return n;
}

export async function clearAll() {
  for (const t of Object.keys(TABLES)) {
    for (const k of mem[t].keys()) await idbPut(t, k, undefined);
    mem[t].clear();
  }
  for (const k of [...kvCache.keys()]) await kvSet(k, undefined);
}

// ---------- helpers métier ----------

export function symptomDefs({ includeArchived = false } = {}) {
  const custom = all('custom_symptoms')
    .filter((c) => includeArchived || !c.archived)
    .map((c) => ({ key: c.key, cat: CATEGORY_ALIASES[c.category] || c.category, label: c.label, urgent: !!c.urgent, custom: true, archived: c.archived }));
  return [...SYMPTOMS, ...custom];
}

export function symptomDef(key) {
  return symptomDefs({ includeArchived: true }).find((s) => s.key === key)
    || { key, cat: 'general', label: key };
}

export const logsForDay = (day) => all('symptom_logs').filter((r) => r.day === day && !r.deleted);
export const noteForDay = (day) => get('day_notes', day) || { day, note: '', nothing: false };

export function meta(key) {
  const r = get('app_meta', key);
  return r ? r.value : undefined;
}
export const setMeta = (key, value) => save('app_meta', { key, value });

// Export complet au format de sauvegarde (identique à la sauvegarde automatique)
export function exportData() {
  const data = {};
  for (const t of Object.keys(TABLES)) {
    data[t] = all(t).map((r) => {
      const o = {};
      for (const c of TABLES[t].cols) o[c] = r[c];
      return o;
    });
  }
  return { app: 'sympt-mes', version: 1, exported_at: nowIso(), data };
}

export function importData(json) {
  if (!json || json.app !== 'sympt-mes' || !json.data) throw new Error('Fichier non reconnu');
  let n = 0;
  for (const t of Object.keys(TABLES)) {
    for (const row of json.data[t] || []) {
      if (!row.updated_at) continue;
      if (mergeRemote(t, row, { markDirty: true })) n++;
    }
    emit(t, true);
  }
  return n;
}
