// Écran « Accueil » : état du jour, semaine en un coup d'œil, alertes récentes.

import * as store from './store.js';
import { analyse, describeDetails, streak } from './analysis.js';
import { greeting, toggleNothing } from './today.js';
import { esc, toDay, addDays, parseDay, fmtDayShort, intensityColor } from './util.js';

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function renderHome(container) {
  const today = toDay();
  const a = analyse(addDays(today, -6), today);
  const t = a.days[6];
  const y = a.days[5];
  const series = streak(today);

  const status = t.nothing ? '🌿 Journée sans symptôme enregistrée'
    : t.sick.length ? `✓ Journée remplie · ${t.sick.length} symptôme${t.sick.length > 1 ? 's' : ''}`
    : t.hasData ? '✓ Journée remplie'
    : 'Pas encore remplie aujourd’hui';

  let html = `
    <div class="hero home-hero photo">
      <p class="hero-hello">${esc(greeting(store.meta('first_name') || ''))}</p>
      <p class="hero-q">Comment te sens-tu aujourd’hui ?</p>
      <p class="hero-status ${t.hasData ? 'done' : ''}">${status}</p>
      <div class="hero-actions">
        <button class="btn primary" data-act="fill" data-day="${today}">✏️ ${t.hasData ? 'Modifier ma journée' : 'Remplir ma journée'}</button>
        ${t.hasData ? '' : '<button class="nothing" data-act="nothing">🌿 Rien à signaler</button>'}
      </div>
    </div>`;

  if (!y.hasData) {
    html += `<button class="card reminder" data-act="fill" data-day="${y.day}">
      <span class="rem-ico">⏰</span>
      <span class="rem-text"><b>Hier n’a pas été rempli</b><small>Toucher pour rattraper</small></span>
      <span class="chev">›</span>
    </button>`;
  }

  html += `<div class="card">
    <h3><span class="h-ico">🌤️</span>Ma semaine</h3>
    <div class="week">${a.days.map((d) => {
      const dt = parseDay(d.day);
      const isToday = d.day === today;
      return `<button class="wday ${isToday ? 'today' : ''}" data-act="fill" data-day="${d.day}">
        <span class="wd-l">${DAY_LETTERS[dt.getDay()]}</span>
        <span class="wd-dot ${d.max == null ? 'empty' : ''}" style="${d.max != null ? `background:${intensityColor(d.max)}` : ''}">${d.max == null ? (d.hasData ? '✓' : '') : d.max}</span>
        <span class="wd-n">${dt.getDate()}</span>
        ${d.urgent.length ? '<i class="wd-urg"></i>' : ''}
      </button>`;
    }).join('')}</div>
    <p class="week-sum">${a.filledDays} jour${a.filledDays > 1 ? 's' : ''} rempli${a.filledDays > 1 ? 's' : ''} sur 7${series > 1 ? ` · 🔥 ${series} jours d’affilée` : ''}</p>
  </div>`;

  if (a.alerts.length) {
    html += `<div class="card alert-card">
      <h3>⚠ À signaler · 7 derniers jours</h3>
      ${a.alerts.map((x) => `<div class="alert-row"><span>${fmtDayShort(x.day)}</span><b>${esc(x.log.def.label)}</b>
        ${describeDetails(x.log) ? `<small>${esc(describeDetails(x.log))}</small>` : ''}</div>`).join('')}
    </div>`;
  }

  html += `<div class="card">
    <h3><span class="h-ico">🔁</span>Cette semaine</h3>
    ${a.top.length ? `<div class="top-chips">${a.top.slice(0, 5).map((s) => `
      <span class="top-chip ${s.urgent ? 'urgent' : ''}">${esc(s.label)} <b>${s.days} j</b></span>`).join('')}</div>`
    : '<p class="muted">Aucun symptôme noté cette semaine.</p>'}
  </div>`;

  container.innerHTML = html;
}

export function bindHome(container, { onOpenDay, onRender }) {
  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'fill') onOpenDay(el.dataset.day);
    else if (el.dataset.act === 'nothing') { toggleNothing(toDay()); onRender(); }
  });
}
