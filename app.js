// ============================================================
//  OPEN Magazine — Timone Editoriale
// ============================================================

const CONFIG_KEY   = 'open_timone_config';
const MAGAZINE_NAME = 'OPEN Magazine 01-2026';
const MATERIALI_OPTIONS = ['Mancanti', 'In arrivo', 'Ricevuti', 'OK'];

let db = null;
let realtimeChannel = null;
let state = { sections: [], contentTypes: [], statuses: [], currentView: 'lista' };

const DEFAULT_TYPES = [
  { name: 'COVER',        color: '#1a1a2e' },
  { name: 'ADV',          color: '#F97316' },
  { name: 'REDAZIONALE',  color: '#3B82F6' },
  { name: 'CORPORATE',    color: '#8B5CF6' },
  { name: 'ATTUALITA',    color: '#EF4444' },
  { name: 'RETAIL',       color: '#10B981' },
  { name: 'LIFESTYLE',    color: '#EC4899' },
  { name: 'CATALOGO',     color: '#64748B' },
];
const DEFAULT_STATUSES = [
  { name: 'Da fare',        color: '#94A3B8' },
  { name: 'Da richiedere',  color: '#C084FC' },
  { name: 'Richiesto',      color: '#60A5FA' },
  { name: 'Attendiamo',     color: '#FB923C' },
  { name: 'In lavorazione', color: '#FBBF24' },
  { name: 'Impaginato',     color: '#34D399' },
  { name: 'Approvato',      color: '#10B981' },
  { name: 'Consegnato',     color: '#047857' },
];

// ============================================================
//  INIT
// ============================================================

async function init() {
  document.getElementById('magazine-title').textContent = MAGAZINE_NAME;
  wireNav();
  wireHeaderButtons();
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  const config = getConfig();
  if (!config) { showConfigScreen(); return; }
  try {
    const { createClient } = window.supabase;
    db = createClient(config.url, config.key);
    await loadAll();
    showMainApp();
    renderCurrentView();
    subscribeRealtime();
  } catch {
    showConfigScreen('Errore di connessione. Controlla URL e chiave Supabase.');
  }
}

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; }
}

function showConfigScreen(errMsg) {
  document.getElementById('config-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  if (errMsg) {
    const el = document.getElementById('config-error');
    el.textContent = errMsg; el.classList.remove('hidden');
  }
  document.getElementById('cfg-save').onclick = async () => {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    if (!url || !key) return;
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
    await init();
  };
}

function showMainApp() {
  document.getElementById('config-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
}

function wireNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      renderCurrentView();
    });
  });
}

function wireHeaderButtons() {
  document.getElementById('btn-import-excel').onclick = importExcel;
  document.getElementById('btn-export-excel').onclick = exportExcel;
  document.getElementById('btn-export-pdf').onclick = () => window.print();
}

// ============================================================
//  SUPABASE
// ============================================================

async function loadAll() {
  const [secRes, typRes, stRes] = await Promise.all([
    db.from('sections').select('*').order('position'),
    db.from('content_types').select('*').order('name'),
    db.from('statuses').select('*').order('name'),
  ]);
  if (typRes.data && typRes.data.length === 0) {
    await db.from('content_types').insert(DEFAULT_TYPES);
    await db.from('statuses').insert(DEFAULT_STATUSES);
    return loadAll();
  }
  state.sections     = secRes.data || [];
  state.contentTypes = typRes.data || [];
  state.statuses     = stRes.data  || [];
}

function subscribeRealtime() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db.channel('timone')
    .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
      await loadAll(); renderCurrentView();
    }).subscribe();
}

// ============================================================
//  PAGE CALCULATION
// ============================================================

function calcPages(sections) {
  let page = 2;
  return sections.map(s => {
    const start = page;
    const end   = page + s.pages_count - 1;
    page = end + 1;
    return { ...s, start_page: start, end_page: end };
  });
}

function totalPages(sections) {
  if (!sections.length) return 1;
  const wp = calcPages(sections);
  return wp[wp.length - 1].end_page;
}

function nextMultiple(n, m) {
  if (n % m === 0) return n;
  return n + (m - (n % m));
}

// ============================================================
//  RENDER ROUTER
// ============================================================

function renderCurrentView() {
  const el = document.getElementById('main-content');
  if      (state.currentView === 'lista')         renderLista(el);
  else if (state.currentView === 'dashboard')     renderDashboard(el);
  else if (state.currentView === 'timone')        renderTimone(el);
  else if (state.currentView === 'impostazioni')  renderImpostazioni(el);
}

// ============================================================
//  LISTA
// ============================================================

function renderLista(container) {
  const wp  = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const m16 = nextMultiple(tot, 16);
  const m8  = nextMultiple(tot, 8);
  const m4  = nextMultiple(tot, 4);

  let badge = '';
  if (tot % 16 === 0)      badge = `<span class="pc-badge pc-green">✓ Multiplo di 16 — ottimale</span>`;
  else if (tot % 8 === 0)  badge = `<span class="pc-badge pc-yellow">⚠ Multiplo di 8 — accettabile</span><span class="pc-info">+${m16-tot}p per ${m16} (×16)</span>`;
  else if (tot % 4 === 0)  badge = `<span class="pc-badge pc-yellow">⚠ Multiplo di 4</span><span class="pc-info">+${m8-tot}p per ${m8} (×8) · +${m16-tot}p per ${m16} (×16)</span>`;
  else                      badge = `<span class="pc-badge pc-red">✗ Non multiplo di 4</span><span class="pc-info">Prossimi: ${m4}p (×4) · ${m8}p (×8) · ${m16}p (×16)</span>`;

  let rows = '';
  if (!wp.length) {
    rows = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📄</div><p>Nessuna sezione. Inizia aggiungendo la prima!</p></div></td></tr>`;
  } else {
    rows = wp.map(s => {
      const tc = getTypeColor(s.content_type);
      const sc = getStatusColor(s.status);
      const matClass = { 'Mancanti':'mat-mancanti','In arrivo':'mat-inarrivo','Ricevuti':'mat-ricevuti','OK':'mat-ok' }[s.materiali] || 'mat-mancanti';
      const urlHtml  = s.url ? `<a class="url-link" href="${escHtml(s.url)}" target="_blank" rel="noopener">🔗</a>` : '';
      return `<tr data-id="${s.id}">
        <td><span class="drag-handle">⠿</span></td>
        <td><span class="type-badge" style="background:${tc}">${escHtml(s.content_type)}</span></td>
        <td style="max-width:250px">
          <strong>${escHtml(s.title)}</strong>
          ${s.notes ? `<br><small style="color:#6B7280">${escHtml(s.notes)}</small>` : ''}
        </td>
        <td><span class="status-dot" style="color:${sc}">${escHtml(s.status)}</span></td>
        <td><span class="mat-badge ${matClass}">${escHtml(s.materiali || 'Mancanti')}</span></td>
        <td>${urlHtml}</td>
        <td class="pages-count">${s.pages_count}p</td>
        <td class="page-range">${s.start_page}–${s.end_page}</td>
        <td class="row-actions">
          <button class="btn-icon" onclick="openEditor('${s.id}')" title="Modifica">✏️</button>
          <button class="btn-icon" onclick="confirmDelete('${s.id}','${escHtml(s.title).replace(/'/g,"\\'")}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="lista-header">
      <h2>Sezioni — ${escHtml(MAGAZINE_NAME)}</h2>
      <button class="btn-primary" onclick="openEditor(null)">+ Aggiungi sezione</button>
    </div>
    <div class="page-counter-bar">
      <span class="pc-total">📄 Totale pagine: <strong>${tot}</strong></span>
      ${badge}
    </div>
    <table class="section-table">
      <thead><tr>
        <th style="width:32px"></th>
        <th>Tipo</th><th>Titolo</th><th>Stato</th><th>Materiali</th>
        <th style="width:32px">URL</th><th>Pag.</th><th>Posizione</th>
        <th style="width:72px"></th>
      </tr></thead>
      <tbody id="sections-tbody">${rows}</tbody>
    </table>`;

  if (state.sections.length) initSortable();
}

function initSortable() {
  const tbody = document.getElementById('sections-tbody');
  if (!tbody) return;
  Sortable.create(tbody, {
    handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const ids = [...tbody.querySelectorAll('tr[data-id]')].map(r => r.dataset.id);
      await Promise.all(ids.map((id, i) => db.from('sections').update({ position: i }).eq('id', id)));
      state.sections = ids.map(id => state.sections.find(s => s.id === id));
      renderCurrentView();
    }
  });
}

// ============================================================
//  EDITOR MODAL
// ============================================================

function openEditor(id) {
  const s    = id ? state.sections.find(x => x.id === id) : null;
  const isNew = !s;

  const typeOpts = state.contentTypes.map(t =>
    `<option value="${escHtml(t.name)}" ${s?.content_type === t.name ? 'selected':''}>${escHtml(t.name)}</option>`
  ).join('');
  const statOpts = state.statuses.map(t =>
    `<option value="${escHtml(t.name)}" ${s?.status === t.name ? 'selected':''}>${escHtml(t.name)}</option>`
  ).join('');
  const matOpts  = MATERIALI_OPTIONS.map(m =>
    `<option value="${m}" ${(s?.materiali||'Mancanti') === m ? 'selected':''}>${m}</option>`
  ).join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>${isNew ? '➕ Nuova sezione' : '✏️ Modifica sezione'}</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Titolo *</label>
        <input type="text" id="f-title" value="${escHtml(s?.title||'')}" placeholder="Es. Intervista con…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo *</label>
          <select id="f-type">${typeOpts}</select>
        </div>
        <div class="form-group">
          <label>N. Pagine *</label>
          <input type="number" id="f-pages" value="${s?.pages_count||2}" min="1" max="200">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stato</label>
          <select id="f-status">${statOpts}</select>
        </div>
        <div class="form-group">
          <label>Materiali</label>
          <select id="f-materiali">${matOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>URL Materiali (Dropbox, Drive…)</label>
        <input type="url" id="f-url" value="${escHtml(s?.url||'')}" placeholder="https://…">
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea id="f-notes" rows="2">${escHtml(s?.notes||'')}</textarea>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveSection('${id||''}')">
        ${isNew ? 'Aggiungi' : 'Salva'}
      </button>
    </div>`;

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-title').focus();
}

async function saveSection(id) {
  const title    = document.getElementById('f-title').value.trim();
  const type     = document.getElementById('f-type').value;
  const pages    = parseInt(document.getElementById('f-pages').value, 10);
  const status   = document.getElementById('f-status').value;
  const materiali = document.getElementById('f-materiali').value;
  const url      = document.getElementById('f-url').value.trim() || null;
  const notes    = document.getElementById('f-notes').value.trim() || null;

  if (!title) { alert('Inserisci il titolo.'); return; }
  if (!pages || pages < 1) { alert('Numero pagine non valido.'); return; }

  const payload = { title, content_type: type, pages_count: pages, status, materiali, url, notes, color: getTypeColor(type) };

  if (id) {
    await db.from('sections').update(payload).eq('id', id);
  } else {
    const maxPos = state.sections.length ? Math.max(...state.sections.map(s => s.position)) + 1 : 0;
    await db.from('sections').insert({ ...payload, position: maxPos });
  }
  closeModal();
  await loadAll();
  renderCurrentView();
}

function confirmDelete(id, title) {
  if (!confirm(`Eliminare "${title}"?`)) return;
  db.from('sections').delete().eq('id', id).then(() => { loadAll().then(renderCurrentView); });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ============================================================
//  DASHBOARD
// ============================================================

function renderDashboard(container) {
  const wp  = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const n   = state.sections.length;

  const m16 = nextMultiple(tot, 16);
  const m8  = nextMultiple(tot, 8);
  const m4  = nextMultiple(tot, 4);

  // Pages per type
  const byType = {};
  state.contentTypes.forEach(t => { byType[t.name] = 0; });
  wp.forEach(s => { byType[s.content_type] = (byType[s.content_type] || 0) + s.pages_count; });

  // Pages per status
  const byStatus = {};
  state.statuses.forEach(s => { byStatus[s.name] = 0; });
  wp.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + s.pages_count; });

  // Pages per materiali
  const byMat = { 'Mancanti': 0, 'In arrivo': 0, 'Ricevuti': 0, 'OK': 0 };
  wp.forEach(s => { byMat[s.materiali||'Mancanti'] = (byMat[s.materiali||'Mancanti']||0) + s.pages_count; });

  const pct = (v) => tot > 1 ? Math.round(v / (tot - 1) * 100) : 0;

  const typeRows = state.contentTypes
    .filter(t => (byType[t.name]||0) > 0)
    .sort((a,b) => (byType[b.name]||0) - (byType[a.name]||0))
    .map(t => {
      const v = byType[t.name] || 0;
      const p = pct(v);
      return `<div class="type-bar-row">
        <div class="type-bar-color" style="background:${t.color}"></div>
        <div class="type-bar-name">${escHtml(t.name)}</div>
        <div class="type-bar-count">${v}p</div>
        <div class="type-bar-track"><div class="type-bar-fill" style="width:${p}%;background:${t.color}"></div></div>
        <div class="type-bar-pct">${p}%</div>
      </div>`;
    }).join('');

  const statusRows = state.statuses
    .map(s => {
      const v  = byStatus[s.name] || 0;
      const p  = pct(v);
      const ns = wp.filter(x => x.status === s.name).length;
      return `<div class="dash-stat-row">
        <span style="display:flex;align-items:center;gap:.4rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0"></span>
          ${escHtml(s.name)}
        </span>
        <span><strong>${v}p</strong> <span class="dash-stat-pct">(${ns} art. · ${p}%)</span></span>
      </div>`;
    }).join('');

  const matClass = { 'Mancanti':'mat-mancanti','In arrivo':'mat-inarrivo','Ricevuti':'mat-ricevuti','OK':'mat-ok' };
  const matRows = MATERIALI_OPTIONS.map(m => {
    const v  = byMat[m] || 0;
    const ns = wp.filter(s => (s.materiali||'Mancanti') === m).length;
    return `<div class="dash-stat-row">
      <span><span class="mat-badge ${matClass[m]}">${m}</span></span>
      <span><strong>${v}p</strong> <span class="dash-stat-pct">(${ns} art.)</span></span>
    </div>`;
  }).join('');

  const mkSeg = (mul, target, diff) => {
    const ok = tot % mul === 0;
    return `<div class="segnatura-row">
      <div class="seg-light ${ok?'seg-green':'seg-red'}"></div>
      <div class="seg-label">Multiplo di ${mul}</div>
      <div class="seg-note">${ok ? '✓ OK' : `+${diff}p per arrivare a ${target}`}</div>
    </div>`;
  };

  const adv     = byType['ADV'] || 0;
  const advPct  = pct(adv);
  const red     = (byType['REDAZIONALE'] || 0) + (byType['CORPORATE'] || 0) + (byType['ATTUALITA'] || 0) + (byType['LIFESTYLE'] || 0) + (byType['RETAIL'] || 0);
  const redPct  = pct(red);

  container.innerHTML = `
    <h2 style="margin-bottom:1.1rem">Dashboard — ${escHtml(MAGAZINE_NAME)}</h2>
    <div class="dashboard-grid">

      <div class="dash-card">
        <h3>Totali</h3>
        <div style="display:flex;gap:1.5rem;align-items:flex-end;margin-bottom:1rem">
          <div><div class="totale-big">${tot}</div><div class="totale-label">pagine totali</div></div>
          <div><div class="totale-big">${n}</div><div class="totale-label">sezioni</div></div>
        </div>
        <div class="dash-stat-row"><span>ADV</span><span><strong>${adv}p</strong><span class="dash-stat-pct">${advPct}%</span></span></div>
        <div class="dash-stat-row"><span>Redazionale</span><span><strong>${red}p</strong><span class="dash-stat-pct">${redPct}%</span></span></div>
      </div>

      <div class="dash-card">
        <h3>Segnatura di stampa</h3>
        ${mkSeg(16, m16, m16 - tot)}
        ${mkSeg(8, m8, m8 - tot)}
        ${mkSeg(4, m4, m4 - tot)}
      </div>

      <div class="dash-card">
        <h3>Pagine per tipo</h3>
        ${typeRows || '<p style="color:#9CA3AF;font-size:.85rem">Nessuna sezione.</p>'}
      </div>

      <div class="dash-card">
        <h3>Avanzamento lavorazione</h3>
        ${statusRows}
      </div>

      <div class="dash-card">
        <h3>Stato materiali</h3>
        ${matRows}
      </div>

    </div>`;
}

// ============================================================
//  TIMONE VISIVO
// ============================================================

function renderTimone(container) {
  const wp  = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const displayTotal = nextMultiple(Math.max(tot, 4), 4);

  // Build page → section map
  const pageMap = {};
  wp.forEach(s => {
    for (let p = s.start_page; p <= s.end_page; p++) pageMap[p] = s;
  });

  // Detect cover (first section, COVER type, page 1) and IV copertina (last section, COVER type)
  const firstSec = wp[0];
  const lastSec  = wp[wp.length - 1];
  const hasIV    = lastSec && lastSec.content_type?.toUpperCase() === 'COVER';

  // Cover cell (page 1)
  const coverColor     = firstSec ? (firstSec.color || getTypeColor(firstSec.content_type)) : '#1a1a2e';
  const coverTextColor = isLight(coverColor) ? '#1a1a2e' : '#fff';
  const coverCell = `
    <div class="cover-single">
      <div class="cover-page" style="background:${coverColor};color:${coverTextColor}">
        <div class="page-num">p. 1</div>
        <div class="page-type-lbl">${escHtml(firstSec?.content_type || 'COVER')}</div>
        <div class="page-title-lbl">${escHtml(firstSec?.title || 'COVER')}</div>
      </div>
    </div>`;

  // IV copertina cell
  let ivCell = '';
  if (hasIV) {
    const ivColor     = lastSec.color || getTypeColor(lastSec.content_type);
    const ivTextColor = isLight(ivColor) ? '#1a1a2e' : '#fff';
    ivCell = `
      <div class="cover-single">
        <div class="cover-page" style="background:${ivColor};color:${ivTextColor}">
          <div class="page-num">p. ${lastSec.end_page}</div>
          <div class="page-type-lbl">${escHtml(lastSec.content_type)}</div>
          <div class="page-title-lbl">${escHtml(lastSec.title)}</div>
        </div>
      </div>`;
  }

  // Build spread cells for pages 2 .. displayTotal (skip last page if IV copertina)
  const ivPage  = hasIV ? lastSec.end_page : -1;
  const spreads = [];

  for (let p = 2; p <= displayTotal; p += 2) {
    const lp = p, rp = p + 1;
    if (lp === ivPage || rp === ivPage) {
      // Skip the IV copertina page in main grid
      spreads.push(buildSpread(lp === ivPage ? null : pageMap[lp], lp,
                               rp === ivPage ? null : pageMap[rp], rp));
    } else {
      spreads.push(buildSpread(pageMap[lp], lp, pageMap[rp], rp));
    }
  }

  // Rows of 4 spreads
  let gridHtml = `<div class="timone-cover-row">${coverCell}</div>`;
  for (let i = 0; i < spreads.length; i += 4) {
    const chunk = spreads.slice(i, i + 4);
    const fp    = 2 + i * 2;
    const lp2   = fp + chunk.length * 2 - 1;
    gridHtml += `
      <div class="spread-row">
        <div class="timone-row-label">pp. ${fp}–${lp2}</div>
        ${chunk.join('')}
      </div>`;
  }

  if (hasIV) {
    gridHtml += `<div class="timone-bottom-row">${ivCell}</div>`;
  }

  // Legend
  const usedTypes = [...new Set(wp.map(s => s.content_type))];
  const legendItems = usedTypes.map(name => {
    const c = getTypeColor(name);
    return `<div class="legend-item"><div class="legend-color" style="background:${c}"></div>${escHtml(name)}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="timone-header">
      <h2>Timone — ${escHtml(MAGAZINE_NAME)}</h2>
      <button class="btn-ghost" onclick="window.print()">🖨 Stampa / PDF</button>
    </div>
    <div class="timone-wrapper">
      <div class="timone-grid">${gridHtml}</div>
      ${legendItems ? `<div class="timone-legend"><span class="legend-label">Legenda:</span>${legendItems}</div>` : ''}
    </div>`;
}

function buildSpread(leftSec, lp, rightSec, rp) {
  if (!leftSec && !rightSec) {
    return `<div class="spread empty-spread">
      <div class="page-half"><span class="page-empty-lbl">—</span></div>
      <div class="fold-line"></div>
      <div class="page-half"><span class="page-empty-lbl">—</span></div>
    </div>`;
  }

  const lc  = leftSec  ? (leftSec.color  || getTypeColor(leftSec.content_type))  : '#F3F4F6';
  const rc  = rightSec ? (rightSec.color || getTypeColor(rightSec.content_type)) : '#F3F4F6';
  const lt  = isLight(lc) ? '#1a1a2e' : '#fff';
  const rt  = isLight(rc) ? '#1a1a2e' : '#fff';

  const leftHtml  = `<div class="page-half" style="background:${lc};color:${lt}">
    <div class="page-num">p. ${lp}</div>
    ${leftSec  ? `<div class="page-type-lbl">${escHtml(leftSec.content_type)}</div><div class="page-title-lbl">${escHtml(leftSec.title)}</div>` : '<span class="page-empty-lbl">—</span>'}
  </div>`;
  const rightHtml = `<div class="page-half" style="background:${rc};color:${rt}">
    <div class="page-num">p. ${rp}</div>
    ${rightSec ? `<div class="page-type-lbl">${escHtml(rightSec.content_type)}</div><div class="page-title-lbl">${escHtml(rightSec.title)}</div>` : '<span class="page-empty-lbl">—</span>'}
  </div>`;

  return `<div class="spread">${leftHtml}<div class="fold-line"></div>${rightHtml}</div>`;
}

// ============================================================
//  IMPOSTAZIONI
// ============================================================

function renderImpostazioni(container) {
  const typesList = state.contentTypes.map(t => `
    <div class="type-item">
      <div class="type-item-color" style="background:${t.color}"></div>
      <div class="type-item-name">${escHtml(t.name)}</div>
      <div class="type-item-actions">
        <button class="btn-icon" onclick="openTypeEditor('type','${t.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteType('${t.id}','${escHtml(t.name).replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`).join('');

  const statusList = state.statuses.map(s => `
    <div class="type-item">
      <div class="type-item-color" style="background:${s.color}"></div>
      <div class="type-item-name">${escHtml(s.name)}</div>
      <div class="type-item-actions">
        <button class="btn-icon" onclick="openTypeEditor('status','${s.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteStatus('${s.id}','${escHtml(s.name).replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:1.1rem">Tipi di contenuto & Stati</h2>
    <div class="settings-grid">
      <div class="settings-card">
        <h3>Tipi di contenuto
          <button class="btn-primary" style="font-size:.75rem;padding:.28rem .65rem" onclick="openTypeEditor('type',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${typesList || '<p style="color:#9CA3AF;font-size:.85rem">Nessun tipo.</p>'}</div>
      </div>
      <div class="settings-card">
        <h3>Stati di lavorazione
          <button class="btn-primary" style="font-size:.75rem;padding:.28rem .65rem" onclick="openTypeEditor('status',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${statusList || '<p style="color:#9CA3AF;font-size:.85rem">Nessuno stato.</p>'}</div>
      </div>
    </div>`;
}

function openTypeEditor(kind, id) {
  const list  = kind === 'type' ? state.contentTypes : state.statuses;
  const item  = id ? list.find(x => x.id === id) : null;
  const label = kind === 'type' ? 'tipo' : 'stato';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>${item ? `✏️ Modifica ${label}` : `➕ Nuovo ${label}`}</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Nome *</label>
        <input type="text" id="ft-name" value="${escHtml(item?.name||'')}" placeholder="Es. INTERVISTA">
      </div>
      <div class="form-group"><label>Colore</label>
        <input type="color" id="ft-color" value="${item?.color||'#4F46E5'}">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveTypeOrStatus('${kind}','${id||''}')">
        ${item ? 'Salva' : 'Aggiungi'}
      </button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('ft-name').focus();
}

async function saveTypeOrStatus(kind, id) {
  const name  = document.getElementById('ft-name').value.trim();
  const color = document.getElementById('ft-color').value;
  if (!name) { alert('Inserisci un nome.'); return; }
  const table = kind === 'type' ? 'content_types' : 'statuses';
  if (id) await db.from(table).update({ name, color }).eq('id', id);
  else    await db.from(table).insert({ name, color });
  closeModal();
  await loadAll(); renderCurrentView();
}

async function deleteType(id, name) {
  if (!confirm(`Eliminare il tipo "${name}"?`)) return;
  await db.from('content_types').delete().eq('id', id);
  await loadAll(); renderCurrentView();
}
async function deleteStatus(id, name) {
  if (!confirm(`Eliminare lo stato "${name}"?`)) return;
  await db.from('statuses').delete().eq('id', id);
  await loadAll(); renderCurrentView();
}

// ============================================================
//  IMPORT EXCEL
// ============================================================

function importExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
  if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets['LISTA'];
        if (!ws) { alert('Foglio LISTA non trovato nel file.'); return; }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // Find header row
        let hi = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].includes('Titolo') && rows[i].includes('Stato')) { hi = i; break; }
        }
        if (hi === -1) { alert('Intestazione non trovata.'); return; }

        const hdr = rows[hi];
        const col = name => hdr.indexOf(name);
        const iS  = col('Stato');
        const iT  = col('Tipo');
        const iTi = col('Titolo');
        const iP  = col('N.Pagine');
        const iM  = col('Materiali');
        const iU  = col('URL');
        const iN  = col('Note');

        // Ensure content types exist for all imported types
        const importedTypes = new Set();
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i];
          if (r && r[iTi] && typeof r[iTi] === 'string' && r[iTi].trim()) {
            importedTypes.add((r[iT] || 'REDAZIONALE').toString().trim().toUpperCase());
          }
        }
        const existingTypeNames = new Set(state.contentTypes.map(t => t.name.toUpperCase()));
        const newTypes = [...importedTypes].filter(t => !existingTypeNames.has(t));
        if (newTypes.length) {
          await db.from('content_types').insert(newTypes.map(name => ({ name, color: '#6B7280' })));
        }

        // Ensure statuses exist
        const importedStats = new Set();
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i];
          if (r && r[iTi] && typeof r[iTi] === 'string' && r[iTi].trim()) {
            importedStats.add((r[iS] || 'Da fare').toString().trim());
          }
        }
        const existingStatNames = new Set(state.statuses.map(s => s.name));
        const newStats = [...importedStats].filter(s => !existingStatNames.has(s));
        if (newStats.length) {
          await db.from('statuses').insert(newStats.map(name => ({ name, color: '#94A3B8' })));
          await loadAll(); // reload to get updated types
        } else {
          await loadAll();
        }

        // Build sections array
        const sections = [];
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[iTi] || typeof r[iTi] !== 'string' || !r[iTi].trim()) continue;
          const pages = parseInt(r[iP]);
          if (!pages || pages < 1) continue;
          sections.push({
            title:        r[iTi].trim(),
            content_type: (r[iT]||'REDAZIONALE').toString().trim(),
            pages_count:  pages,
            status:       (r[iS]||'Da fare').toString().trim(),
            materiali:    MATERIALI_OPTIONS.includes(r[iM]) ? r[iM] : 'Mancanti',
            url:          r[iU] ? r[iU].toString().trim() : null,
            notes:        r[iN] ? r[iN].toString().trim() : null,
            color:        getTypeColor((r[iT]||'REDAZIONALE').toString().trim()),
            position:     sections.length,
          });
        }

        if (!sections.length) { alert('Nessuna sezione trovata nel file.'); return; }

        const replace = confirm(
          `Trovate ${sections.length} sezioni nel file Excel.\n\n` +
          `OK = Sostituisci tutte le sezioni esistenti\n` +
          `Annulla = Aggiungi in fondo alle esistenti`
        );

        if (replace) {
          if (state.sections.length) {
            await db.from('sections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          const maxPos = state.sections.length ? Math.max(...state.sections.map(s => s.position)) + 1 : 0;
          sections.forEach((s, i) => s.position = maxPos + i);
        }

        await db.from('sections').insert(sections);
        await loadAll();
        renderCurrentView();
        alert(`✓ ${sections.length} sezioni importate con successo!`);
      } catch (err) {
        alert('Errore durante l\'importazione: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

// ============================================================
//  EXPORT EXCEL
// ============================================================

function exportExcel() {
  const wp = calcPages(state.sections);
  const rows = wp.map((s, i) => ({
    '#':              i + 1,
    'Stato':          s.status,
    'Tipo':           s.content_type,
    'Titolo':         s.title,
    'N.Pagine':       s.pages_count,
    'Pag.Inizio':     s.start_page,
    'Pag.Fine':       s.end_page,
    'Materiali':      s.materiali || 'Mancanti',
    'URL':            s.url || '',
    'Note':           s.notes || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [6,18,16,40,9,12,10,14,40,30].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timone');
  XLSX.writeFile(wb, `Timone_${MAGAZINE_NAME.replace(/\s+/g,'_')}.xlsx`);
}

// ============================================================
//  HELPERS
// ============================================================

function getTypeColor(name) {
  const t = state.contentTypes.find(x => x.name === name);
  return t ? t.color : '#6B7280';
}
function getStatusColor(name) {
  const s = state.statuses.find(x => x.name === name);
  return s ? s.color : '#94A3B8';
}
function isLight(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  return (r*299 + g*587 + b*114) / 1000 > 150;
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================
//  START
// ============================================================
document.addEventListener('DOMContentLoaded', init);
