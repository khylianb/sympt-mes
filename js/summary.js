// Écran « Synthèse » : semaine / mois.

import { analyse, describeDetails, DIGESTIVE_THRESHOLD } from './analysis.js';
import {
  esc, toDay, addDays, startOfWeek, startOfMonth, endOfMonth, fmtDayShort, fmtMonthName,
  fmtDdMm, parseDay, intensityColor,
} from './util.js';
import { slotLabel, tagLabel } from './catalogue.js';

const state = { mode: 'week', anchor: toDay() };

export function periodBounds(mode, anchor) {
  if (mode === 'week') { const from = startOfWeek(anchor); return [from, addDays(from, 6)]; }
  return [startOfMonth(anchor), endOfMonth(anchor)];
}

export function renderSummary(container) {
  const [from, to] = periodBounds(state.mode, state.anchor);
  const a = analyse(from, to);
  const title = state.mode === 'week'
    ? `${fmtDdMm(from)} → ${fmtDdMm(to)}`
    : fmtMonthName(from);
  const isCurrent = to >= toDay();

  container.innerHTML = `
    <div class="seg">
      <button class="${state.mode === 'week' ? 'on' : ''}" data-mode="week">Semaine</button>
      <button class="${state.mode === 'month' ? 'on' : ''}" data-mode="month">Mois</button>
    </div>
    <div class="period-nav">
      <button class="icon-btn" data-nav="-1" aria-label="Période précédente">‹</button>
      <strong>${esc(title)}</strong>
      <button class="icon-btn" data-nav="1" aria-label="Période suivante" ${isCurrent ? 'disabled' : ''}>›</button>
    </div>

    <div class="stats">
      <div class="stat"><b>${a.filledDays}</b><span>jours remplis</span></div>
      <div class="stat"><b>${a.symptomDays}</b><span>jours avec symptômes</span></div>
      <div class="stat"><b>${a.avgMax == null ? '–' : a.avgMax.toFixed(1).replace('.', ',')}</b><span>intensité max moyenne</span></div>
    </div>

    ${a.alerts.length ? `<div class="card alert-card">
      <h3>⚠ À signaler au médecin</h3>
      ${a.alerts.map((x) => `<div class="alert-row"><span>${fmtDayShort(x.day)}</span>
        <b>${esc(x.log.def.label)}</b>${x.log.intensity != null && !x.log.def.noScale ? ` <span class="pill" style="background:${intensityColor(x.log.intensity)}">${x.log.intensity}</span>` : ''}
        ${describeDetails(x.log) ? `<small>${esc(describeDetails(x.log))}</small>` : ''}</div>`).join('')}
    </div>` : ''}

    <div class="card">
      <h3>Intensité par jour</h3>
      ${chartSvg(a.days, state.mode)}
      <div class="legend"><span><i class="l-max"></i>maximum</span><span><i class="l-avg"></i>moyenne</span><span><i class="l-urg"></i>à signaler</span></div>
    </div>

    ${state.mode === 'month' ? `<div class="card"><h3>Calendrier</h3>${calendarHtml(a.days)}</div>` : ''}

    <div class="card">
      <h3>Symptômes les plus fréquents</h3>
      ${a.top.length ? `<div class="toplist">${a.top.slice(0, 8).map((s) => `
        <div class="top-row ${s.urgent ? 'urgent' : ''}">
          <span class="top-label">${esc(s.label)}</span>
          <span class="top-bar"><i style="width:${Math.round((s.days / a.days.length) * 100)}%"></i></span>
          <span class="top-n">${s.days} j${s.avg != null ? ` · ${s.avg.toFixed(1).replace('.', ',')}/10` : ''}</span>
        </div>`).join('')}</div>` : '<p class="muted">Aucun symptôme sur la période.</p>'}
    </div>

    <div class="card">
      <h3>Jours les plus difficiles</h3>
      ${a.hardest.length ? a.hardest.map((d) => `
        <button class="hard-day" data-day="${d.day}">
          <span class="pill" style="background:${intensityColor(d.max)}">${d.max ?? '–'}</span>
          <span class="hd-main"><b>${fmtDayShort(d.day)}</b>
            <small>${d.logs.map((l) => `<span class="${l.def.urgent ? 'red' : ''}">${esc(l.def.label)}${l.intensity != null && !l.def.noScale ? ' ' + l.intensity : ''}</span>`).join(', ')}</small>
            ${d.meals.length ? `<small class="muted">🍽 ${d.meals.map((m) => `${esc(slotLabel(m.slot))} : ${esc((m.items || []).join(', '))}${(m.tags || []).length ? ` (${m.tags.map(tagLabel).join(', ')})` : ''}`).join(' · ')}</small>` : ''}
          </span>
        </button>`).join('') : '<p class="muted">Rien à afficher.</p>'}
    </div>

    <div class="card">
      <h3>Repas × symptômes</h3>
      ${crossingsHtml(a.crossings)}
    </div>`;
}

function chartSvg(days, mode) {
  const W = 340, H = 170, L = 22, R = 8, T = 10, B = 24;
  const n = days.length;
  const x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - v / 10) * (H - T - B);
  const line = (key) => {
    let d = '';
    let pen = false;
    days.forEach((day, i) => {
      const v = day[key];
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  let grid = '';
  for (const v of [0, 5, 10]) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`;
  }
  let labels = '';
  days.forEach((d, i) => {
    const dt = parseDay(d.day);
    const show = mode === 'week' || i === 0 || dt.getDate() % 5 === 0;
    if (!show) return;
    const txt = mode === 'week' ? ['D', 'L', 'M', 'M', 'J', 'V', 'S'][dt.getDay()] + dt.getDate() : dt.getDate();
    labels += `<text x="${x(i)}" y="${H - 6}" class="axis" text-anchor="middle">${txt}</text>`;
  });
  const dots = days.map((d, i) => d.max == null ? '' :
    `<circle cx="${x(i)}" cy="${y(d.max)}" r="${mode === 'week' ? 4.5 : 3}" fill="${intensityColor(d.max)}" ${d.urgent.length ? 'class="urg"' : ''}/>`).join('');
  const empty = days.every((d) => d.max == null);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Courbe d'intensité">
    ${grid}${labels}
    <path d="${line('avg')}" class="avg"/>
    <path d="${line('max')}" class="max"/>
    ${dots}
    ${empty ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="axis">Pas encore de données</text>` : ''}
  </svg>`;
}

function calendarHtml(days) {
  const first = parseDay(days[0].day);
  const offset = (first.getDay() + 6) % 7;
  let html = '<div class="cal">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cal-h">${d}</span>`).join('');
  for (let i = 0; i < offset; i++) html += '<span></span>';
  const today = toDay();
  for (const d of days) {
    const future = d.day > today;
    html += `<button class="cal-d ${future ? 'future' : ''}" data-day="${d.day}" ${future ? 'disabled' : ''}
      style="${d.max != null ? `background:${intensityColor(d.max)};color:#fff` : ''}">
      ${parseDay(d.day).getDate()}${d.urgent.length ? '<i class="cal-urg"></i>' : ''}</button>`;
  }
  return html + '</div>';
}

const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)} %`);

function crossingsHtml(c) {
  if (c.meals < 3) return '<p class="muted">Pas assez de repas saisis sur la période pour croiser avec les symptômes.</p>';
  const row = (r) => `<div class="cross-row">
    <div class="cross-label"><b>${esc(r.label)}</b> <small>${r.hits}/${r.n} repas${r.n < 5 ? ' · peu de données' : ''}</small></div>
    <div class="cross-bars">
      <span class="bar with"><i style="width:${(r.pctWith || 0) * 100}%"></i></span><small>avec ${pct(r.pctWith)}</small>
      <span class="bar without"><i style="width:${(r.pctWithout || 0) * 100}%"></i></span><small>sans ${pct(r.pctWithout)}</small>
    </div>
  </div>`;
  return `<p class="muted small">Part des repas suivis (le jour même ou le lendemain) d'un trouble digestif d'intensité ≥ ${DIGESTIVE_THRESHOLD}/10.</p>
    ${c.tags.length ? `<div class="sub">Par étiquette</div>${c.tags.map(row).join('')}` : '<p class="muted">Aucune étiquette utilisée au moins 2 fois.</p>'}
    ${c.foods.length ? `<div class="sub">Aliments fréquents</div>${c.foods.map(row).join('')}` : ''}
    <p class="muted small">Ce sont des observations, pas une preuve : à discuter avec le médecin.</p>`;
}

export function bindSummary(container, { onRender, onOpenDay }) {
  container.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    const nav = e.target.closest('[data-nav]');
    const dayBtn = e.target.closest('[data-day]');
    if (m) { state.mode = m.dataset.mode; onRender(); }
    else if (nav) {
      const dir = Number(nav.dataset.nav);
      if (state.mode === 'week') state.anchor = addDays(startOfWeek(state.anchor), 7 * dir);
      else {
        const d = parseDay(startOfMonth(state.anchor));
        d.setMonth(d.getMonth() + dir);
        state.anchor = toDay(d);
      }
      onRender();
    } else if (dayBtn) onOpenDay(dayBtn.dataset.day);
  });
}
