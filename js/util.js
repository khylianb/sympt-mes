// Petits utilitaires : dates locales, DOM, échappement.

export const pad = (n) => String(n).padStart(2, '0');

export function toDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(day, n) {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}
export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export function startOfWeek(day) {
  const d = parseDay(day);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return addDays(day, -dow);
}
export function startOfMonth(day) { return day.slice(0, 8) + '01'; }
export function endOfMonth(day) {
  const d = parseDay(startOfMonth(day));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toDay(d);
}

const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtFull = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtDayLong = (day) => cap(fmtLong.format(parseDay(day)));
export const fmtDayShort = (day) => cap(fmtShort.format(parseDay(day)));
export const fmtDayFull = (day) => fmtFull.format(parseDay(day));
export const fmtMonthName = (day) => cap(fmtMonth.format(parseDay(day)));
export const fmtDdMm = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Couleur d'intensité 0–10 (vert → orange → rouge)
export function intensityColor(v) {
  if (v == null) return 'var(--empty)';
  const stops = [[0, [76, 175, 125]], [5, [240, 170, 50]], [10, [214, 64, 64]]];
  let a = stops[0], b = stops[1];
  if (v > 5) { a = stops[1]; b = stops[2]; }
  const t = (v - a[0]) / (b[0] - a[0]);
  const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * t));
  return `rgb(${c.join(',')})`;
}

export function relativeDays(iso) {
  if (!iso) return null;
  const n = daysBetween(toDay(new Date(iso)), toDay());
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  return `il y a ${n} jours`;
}

export function toast(msg) {
  let el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}
