// Export : PDF pour le médecin et sauvegarde complète (JSON), via la fenêtre de partage.

import * as store from './store.js';
import { analyse, describeDetails, firstDay, crossVerdict, CROSS_EXPLAIN } from './analysis.js';
import { slotLabel, tagLabel } from './catalogue.js';
import { esc, $, toDay, addDays, fmtDayFull, fmtDayShort, relativeDays, toast } from './util.js';
import { openSheet, closeSheet } from './ui.js';

// ---------- date de dernière sauvegarde ----------
export function lastBackupIso() {
  const a = store.meta('last_export');
  const b = store.meta('last_auto_backup');
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

export function backupLabel() {
  const iso = lastBackupIso();
  return iso ? `Dernière sauvegarde : ${relativeDays(iso)}` : 'Aucune sauvegarde pour l’instant';
}

export function backupIsOld() {
  const iso = lastBackupIso();
  return !iso || Date.now() - Date.parse(iso) > 8 * 86400000;
}

// ---------- partage ----------
async function shareFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: file.name });
    return true;
  }
  // Repli (ordinateur) : téléchargement
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// iOS exige que le partage parte directement d'un toucher : si le délai est
// dépassé, on propose un second bouton « Partager ».
async function deliver(file, body, onDone) {
  try {
    await shareFile(file);
    onDone && onDone();
    closeSheet();
  } catch (e) {
    if (e.name === 'AbortError') return;
    if (e.name === 'NotAllowedError') {
      const out = $('#exp-ready', body);
      out.innerHTML = `<button class="btn primary big" id="exp-share">📤 Partager ${esc(file.name)}</button>`;
      $('#exp-share', body).onclick = () => deliver(file, body, onDone);
      return;
    }
    console.error(e);
    toast('Échec du partage : ' + e.message);
  }
}

export function openExport() {
  const body = openSheet(`
    <h3>Enregistrer / Exporter</h3>
    <p class="muted small">${esc(backupLabel())}</p>
    <div class="sub">📄 PDF pour le médecin</div>
    <div class="seg" id="exp-period">
      <button data-p="7" class="on">7 jours</button>
      <button data-p="30">30 jours</button>
      <button data-p="all">Tout</button>
    </div>
    <button class="btn primary big" id="exp-pdf">Créer le PDF</button>
    <div class="sub">🗂 Sauvegarde complète</div>
    <p class="muted small">Toutes les données dans un fichier, à garder dans Fichiers / iCloud ou à envoyer par mail.</p>
    <button class="btn accent big" id="exp-json">Créer la sauvegarde</button>
    <div id="exp-ready"></div>`);

  let period = '7';
  $('#exp-period', body).onclick = (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    period = b.dataset.p;
    for (const x of body.querySelectorAll('#exp-period button')) x.classList.toggle('on', x === b);
  };

  $('#exp-pdf', body).onclick = () => {
    const to = toDay();
    const from = period === 'all' ? (firstDay() || to) : addDays(to, -(Number(period) - 1));
    let file;
    try {
      file = buildPdf(from, to);
    } catch (e) {
      console.error(e);
      toast('Erreur lors de la création du PDF');
      return;
    }
    deliver(file, body);
  };

  $('#exp-json', body).onclick = () => {
    const json = JSON.stringify(store.exportData(), null, 1);
    const file = new File([json], `sympt-mes-sauvegarde-${toDay()}.json`, { type: 'application/json' });
    deliver(file, body, () => {
      store.setMeta('last_export', new Date().toISOString());
      toast('Sauvegarde enregistrée ✓');
    });
  };
}

// ---------- PDF ----------

// Les polices standard du PDF ne couvrent pas tous les caractères
const clean = (s) => String(s ?? '')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"')
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/…/g, '...').replace(/[–—]/g, '-')
  .replace(/[^\x20-\x7E -ÿ\n]/g, '');

const RED = [200, 40, 40];
const DARK = [30, 35, 45];
const GREY = [110, 115, 125];
const ACCENT = [20, 110, 120];

function intensityRgb(v) {
  const stops = [[0, [76, 175, 125]], [5, [240, 170, 50]], [10, [214, 64, 64]]];
  let a = stops[0], b = stops[1];
  if (v > 5) { a = stops[1]; b = stops[2]; }
  const t = (v - a[0]) / (b[0] - a[0]);
  return a[1].map((x, i) => Math.round(x + (b[1][i] - x) * t));
}

export function buildPdf(from, to) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const a = analyse(from, to);
  const PW = 210, M = 15, CW = PW - 2 * M, PH = 297;
  let y = M;

  const ensure = (h) => { if (y + h > PH - M) { doc.addPage(); y = M; } };
  const text = (s, x, opts = {}) => {
    const { size = 10, color = DARK, bold = false, width = CW - (x - M) } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(s), width);
    const lh = size * 0.42;
    for (const line of lines) { ensure(lh); doc.text(line, x, y + lh * 0.8); y += lh; }
  };
  const heading = (s) => {
    ensure(14);
    y += 4;
    text(s, M, { size: 13, bold: true, color: ACCENT });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(M, y + 0.5, M + CW, y + 0.5);
    y += 3;
  };

  // En-tête
  const profile = store.meta('profile') || {};
  text('Suivi des symptômes', M, { size: 18, bold: true });
  if (profile.name || profile.birth) {
    text([profile.name, profile.birth ? `date de naissance : ${profile.birth}` : ''].filter(Boolean).join(' - '), M, { size: 11 });
  }
  text(`Période : du ${fmtDayFull(from)} au ${fmtDayFull(to)} (${a.days.length} jours)`, M, { size: 10, color: GREY });
  text(`Document généré le ${fmtDayFull(toDay())}`, M, { size: 9, color: GREY });
  y += 2;

  // Résumé
  heading('Résumé');
  text(`Jours renseignés : ${a.filledDays} / ${a.days.length}   -   Jours avec symptômes : ${a.symptomDays}   -   Intensité maximale moyenne : ${a.avgMax == null ? '-' : a.avgMax.toFixed(1).replace('.', ',') + '/10'}`, M);

  // Alertes
  if (a.alerts.length) {
    heading('À signaler');
    for (const x of a.alerts) {
      const det = describeDetails(x.log);
      text(`- ${fmtDayShort(x.day)} : ${x.log.def.label}${x.log.intensity != null && !x.log.def.noScale ? ` (${x.log.intensity}/10)` : ''}${det ? ' - ' + det : ''}`, M, { color: RED, bold: true });
    }
  }

  // Courbe
  heading('Intensité par jour');
  const chartH = 45;
  ensure(chartH + 8);
  const cx0 = M + 8, cw = CW - 10, cy0 = y + 2;
  const cxp = (i) => cx0 + (a.days.length === 1 ? cw / 2 : (i * cw) / (a.days.length - 1));
  const cyp = (v) => cy0 + (1 - v / 10) * chartH;
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.2);
  for (const v of [0, 5, 10]) { doc.line(cx0, cyp(v), cx0 + cw, cyp(v)); doc.text(String(v), cx0 - 3, cyp(v) + 1, { align: 'right' }); }
  const step = Math.max(1, Math.ceil(a.days.length / 15));
  a.days.forEach((d, i) => { if (i % step === 0) doc.text(`${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`, cxp(i), cy0 + chartH + 4, { align: 'center' }); });
  doc.setLineWidth(0.6);
  doc.setDrawColor(...ACCENT);
  let prev = null;
  a.days.forEach((d, i) => {
    if (d.max == null) { prev = null; return; }
    if (prev) doc.line(cxp(prev.i), cyp(prev.v), cxp(i), cyp(d.max));
    prev = { i, v: d.max };
  });
  const r = a.days.length > 60 ? 0.6 : 1.1;
  a.days.forEach((d, i) => {
    if (d.max == null) return;
    doc.setFillColor(...intensityRgb(d.max));
    doc.circle(cxp(i), cyp(d.max), r, 'F');
    if (d.urgent.length) { doc.setDrawColor(...RED); doc.setLineWidth(0.4); doc.circle(cxp(i), cyp(d.max), r + 0.9, 'S'); }
  });
  y = cy0 + chartH + 7;
  text('Courbe : intensité maximale du jour (0 à 10). Cercle rouge : symptôme à signaler.', M, { size: 8, color: GREY });

  // Symptômes fréquents
  heading('Symptômes les plus fréquents');
  if (!a.top.length) text('Aucun symptôme sur la période.', M, { color: GREY });
  const col = [M, M + 95, M + 125, M + 155];
  if (a.top.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREY);
    ensure(5);
    doc.text('Symptôme', col[0], y + 3); doc.text('Jours', col[1], y + 3); doc.text('Moyenne', col[2], y + 3); doc.text('Max', col[3], y + 3);
    y += 5;
  }
  for (const s of a.top) {
    ensure(5);
    doc.setFont('helvetica', s.urgent ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...(s.urgent ? RED : DARK));
    doc.text(clean(s.label).slice(0, 55), col[0], y + 3);
    doc.text(`${s.days}`, col[1], y + 3);
    doc.text(s.avg == null ? '-' : `${s.avg.toFixed(1).replace('.', ',')}/10`, col[2], y + 3);
    doc.text(s.avg == null ? '-' : `${s.max}/10`, col[3], y + 3);
    y += 5;
  }

  // Repas × symptômes
  const c = a.crossings;
  if (c.tags.length || c.foods.length) {
    heading('Repas et symptômes digestifs');
    text(`${CROSS_EXPLAIN} Observations, pas une preuve.`, M, { size: 9, color: GREY });
    y += 2;
    const cc = [M, M + 45, M + 92, M + 122];
    const head = () => {
      ensure(9);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GREY);
      doc.text('Aliment', cc[0], y + 3);
      doc.text(clean('Repas avec cet aliment'), cc[1], y + 3);
      doc.text(clean('suivis de troubles'), cc[1], y + 6.5);
      doc.text('Autres repas', cc[2], y + 3);
      doc.text('Conclusion', cc[3], y + 3);
      y += 9;
    };
    const row = (r) => {
      const v = crossVerdict(r);
      ensure(5.5);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
      doc.text(clean(r.label.charAt(0).toUpperCase() + r.label.slice(1)).slice(0, 26), cc[0], y + 3);
      doc.setFont('helvetica', 'normal');
      doc.text(clean(`${Math.round((r.pctWith || 0) * 100)} %  (${r.hits} sur ${r.n})`), cc[1], y + 3);
      doc.text(r.pctWithout == null ? '-' : `${Math.round(r.pctWithout * 100)} %`, cc[2], y + 3);
      const col = v.level === 'high' ? RED : v.level === 'mid' ? [190, 110, 20] : GREY;
      doc.setFont('helvetica', v.level === 'high' || v.level === 'mid' ? 'bold' : 'normal');
      doc.setTextColor(...col);
      doc.text(clean(v.text), cc[3], y + 3);
      y += 5.5;
    };
    if (c.tags.length) { text('Par étiquette', M, { bold: true, size: 9.5, color: ACCENT }); head(); c.tags.forEach(row); y += 2; }
    if (c.foods.length) { text('Aliments fréquents', M, { bold: true, size: 9.5, color: ACCENT }); head(); c.foods.forEach(row); }
  }

  // Journal
  heading('Journal jour par jour');
  for (const d of [...a.days].reverse()) {
    if (!d.hasData) continue;
    ensure(10);
    y += 1.5;
    text(fmtDayShort(d.day) + (d.max != null ? `  -  max ${d.max}/10` : ''), M, { bold: true, size: 10.5 });
    if (d.nothing) text('Rien à signaler', M + 4, { color: GREY });
    for (const l of d.logs) {
      const det = describeDetails(l);
      text(`${l.def.label}${l.intensity != null && !l.def.noScale ? ` : ${l.intensity}/10` : ''}${det ? ' (' + det + ')' : ''}`, M + 4, { color: l.def.urgent ? RED : DARK, bold: !!l.def.urgent, size: 9.5 });
    }
    if (d.note) text(`Note : ${d.note}`, M + 4, { color: GREY, size: 9.5 });
    for (const m of d.meals) {
      text(`${m.time ? m.time + ' ' : ''}${slotLabel(m.slot)} : ${(m.items || []).join(', ') || '-'}${(m.tags || []).length ? ' [' + m.tags.map(tagLabel).join(', ') + ']' : ''}`, M + 4, { color: GREY, size: 9 });
    }
  }

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(clean(`Sympt'mes - ${fmtDayFull(from)} au ${fmtDayFull(to)} - page ${i}/${pages}`), PW / 2, PH - 8, { align: 'center' });
  }

  const blob = doc.output('blob');
  return new File([blob], `symptomes-${from}-au-${to}.pdf`, { type: 'application/pdf' });
}
