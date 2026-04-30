// ============================================================
//  OPEN Magazine — Timone Editoriale
// ============================================================

const CONFIG_KEY = 'open_timone_config';
const MAGAZINE_NAME = 'OPEN Magazine 01-2026';

let db = null;
let realtimeChannel = null;

let state = {
  sections: [],
  contentTypes: [],
  statuses: [],
  currentView: 'lista',
};

const DEFAULT_TYPES = [
  { name: 'Articolo',           color: '#3B82F6' },
  { name: 'Cover Story',        color: '#EF4444' },
  { name: 'Editoriale',         color: '#8B5CF6' },
  { name: 'Rubrica',            color: '#10B981' },
  { name: 'Speciale',           color: '#EC4899' },
  { name: 'Publiredazionale',   color: '#F59E0B' },
  { name: 'ADV',                color: '#F97316' },
];
const DEFAULT_STATUSES = [
  { name: 'Da fare',        color: '#94A3B8' },
  { name: 'In lavorazione', color: '#3B82F6' },
  { name: 'In revisione',   color: '#F59E0B' },
  { name: 'Completato',     color: '#10B981' },
];

// ============================================================
//  INIT
// ============================================================

async function init() {
  document.getElementById('magazine-title').textContent = MAGAZINE_NAME;
  wireNavButtons();
  wireExportButtons();
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
  } catch (err) {
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
    el.textContent = errMsg;
    el.classList.remove('hidden');
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

function wireNavButtons() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      renderCurrentView();
    });
  });
}

function wireExportButtons() {
  document.getElementById('btn-export-excel').onclick = exportExcel;
  document.getElementById('btn-export-pdf').onclick = () => window.print();
}

// ============================================================
//  SUPABASE DATA
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
  state.sections = secRes.data || [];
  state.contentTypes = typRes.data || [];
  state.statuses = stRes.data || [];
}

function subscribeRealtime() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db
    .channel('timone-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
      await loadAll();
      renderCurrentView();
    })
    .subscribe();
}

// ============================================================
//  PAGE CALCULATION
// ============================================================

function calcPages(sections) {
  let page = 2;
  return sections.map(s => {
    const start = page;
    const end = page + s.pages_count - 1;
    page = end + 1;
    return { ...s, start_page: start, end_page: end };
  });
}

function totalPages(sections) {
  if (!sections.length) return 1;
  const withPages = calcPages(sections);
  return withPages[withPages.length - 1].end_page;
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
  if (state.currentView === 'lista')        renderLista(el);
  else if (state.currentView === 'timone')  renderTimone(el);
  else if (state.currentView === 'impostazioni') renderImpostazioni(el);
}

// ============================================================
//  LISTA SEZIONI
// ============================================================

function renderLista(container) {
  const withPages = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const m16 = nextMultiple(tot, 16);
  const m8  = nextMultiple(tot, 8);
  const m4  = nextMultiple(tot, 4);
  const isM16 = tot % 16 === 0;
  const isM8  = tot % 8 === 0;
  const isM4  = tot % 4 === 0;

  let counterBadge = '';
  if (isM16) {
    counterBadge = `<span class="pc-badge pc-green">✓ Multiplo di 16 — ottimale per la stampa</span>`;
  } else if (isM8) {
    counterBadge = `<span class="pc-badge pc-yellow">⚠ Multiplo di 8 — accettabile</span>
    <span class="pc-info">Aggiungi ${m16 - tot}p per arrivare a ${m16} (multiplo di 16)</span>`;
  } else if (isM4) {
    counterBadge = `<span class="pc-badge pc-yellow">⚠ Multiplo di 4</span>
    <span class="pc-info">Aggiungi ${m8 - tot}p per ${m8} (×8) oppure ${m16 - tot}p per ${m16} (×16)</span>`;
  } else {
    counterBadge = `<span class="pc-badge pc-red">✗ Non multiplo di 4</span>
    <span class="pc-info">Prossimi: ${m4}p (×4), ${m8}p (×8), ${m16}p (×16)</span>`;
  }

  let rows = '';
  if (withPages.length === 0) {
    rows = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p>Nessuna sezione ancora. Inizia aggiungendo la prima!</p>
      </div>
    </td></tr>`;
  } else {
    rows = withPages.map((s, i) => {
      const typeColor = getTypeColor(s.content_type);
      const statusColor = getStatusColor(s.status);
      return `<tr data-id="${s.id}">
        <td><span class="drag-handle" title="Trascina per riordinare">⠿</span></td>
        <td><span class="type-badge" style="background:${typeColor}">${escHtml(s.content_type)}</span></td>
        <td style="max-width:260px"><strong>${escHtml(s.title)}</strong>${s.notes ? `<br><small style="color:#6B7280">${escHtml(s.notes)}</small>` : ''}</td>
        <td><span class="status-dot" style="color:${statusColor}">${escHtml(s.status)}</span></td>
        <td class="pages-count">${s.pages_count}p</td>
        <td class="page-range">${s.start_page}–${s.end_page}</td>
        <td class="row-actions">
          <button class="btn-icon" onclick="openEditor('${s.id}')" title="Modifica">✏️</button>
          <button class="btn-icon" onclick="confirmDelete('${s.id}','${escHtml(s.title).replace(/'/g,'\\\'')}')" title="Elimina">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="lista-header">
      <h2>Sezioni del magazine</h2>
      <button class="btn-primary" onclick="openEditor(null)">+ Aggiungi sezione</button>
    </div>
    <div class="page-counter-bar">
      <span class="pc-total">📄 Totale pagine: <strong>${tot}</strong> (inclusa cover)</span>
      ${counterBadge}
    </div>
    <table class="section-table">
      <thead>
        <tr>
          <th style="width:36px"></th>
          <th>Tipo</th>
          <th>Titolo</th>
          <th>Stato</th>
          <th>Pagine</th>
          <th>Posizione</th>
          <th style="width:80px"></th>
        </tr>
      </thead>
      <tbody id="sections-tbody">${rows}</tbody>
    </table>`;

  if (state.sections.length > 0) initSortable();
}

function initSortable() {
  const tbody = document.getElementById('sections-tbody');
  if (!tbody) return;
  Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async (evt) => {
      const rows = [...tbody.querySelectorAll('tr[data-id]')];
      const newOrder = rows.map(r => r.dataset.id);
      const updates = newOrder.map((id, i) => db.from('sections').update({ position: i }).eq('id', id));
      await Promise.all(updates);
      // reorder local state immediately
      const sorted = newOrder.map(id => state.sections.find(s => s.id === id));
      state.sections = sorted;
      renderCurrentView();
    }
  });
}

// ============================================================
//  EDITOR (MODAL)
// ============================================================

function openEditor(id) {
  const section = id ? state.sections.find(s => s.id === id) : null;
  const isNew = !section;
  const typeOptions = state.contentTypes.map(t =>
    `<option value="${escHtml(t.name)}" ${section?.content_type === t.name ? 'selected' : ''}>${escHtml(t.name)}</option>`
  ).join('');
  const statusOptions = state.statuses.map(t =>
    `<option value="${escHtml(t.name)}" ${section?.status === t.name ? 'selected' : ''}>${escHtml(t.name)}</option>`
  ).join('');

  const html = `
    <div class="modal-title">
      <span>${isNew ? '➕ Nuova sezione' : '✏️ Modifica sezione'}</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Titolo *</label>
        <input type="text" id="f-title" value="${escHtml(section?.title || '')}" placeholder="Es. Intervista con…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo di contenuto *</label>
          <select id="f-type">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label>Numero di pagine *</label>
          <input type="number" id="f-pages" value="${section?.pages_count || 2}" min="1" max="100">
        </div>
      </div>
      <div class="form-group">
        <label>Stato</label>
        <select id="f-status">${statusOptions}</select>
      </div>
      <div class="form-group">
        <label>Note (opzionale)</label>
        <textarea id="f-notes" rows="2" placeholder="Autore, brief, riferimenti…">${escHtml(section?.notes || '')}</textarea>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveSection('${id || ''}')">
        ${isNew ? 'Aggiungi sezione' : 'Salva modifiche'}
      </button>
    </div>`;

  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-title').focus();
}

async function saveSection(id) {
  const title  = document.getElementById('f-title').value.trim();
  const type   = document.getElementById('f-type').value;
  const pages  = parseInt(document.getElementById('f-pages').value, 10);
  const status = document.getElementById('f-status').value;
  const notes  = document.getElementById('f-notes').value.trim();

  if (!title) { alert('Inserisci il titolo della sezione.'); return; }
  if (!pages || pages < 1) { alert('Il numero di pagine deve essere almeno 1.'); return; }

  const payload = {
    title,
    content_type: type,
    pages_count: pages,
    status,
    notes,
    color: getTypeColor(type),
  };

  if (id) {
    await db.from('sections').update(payload).eq('id', id);
  } else {
    const maxPos = state.sections.length > 0
      ? Math.max(...state.sections.map(s => s.position)) + 1
      : 0;
    await db.from('sections').insert({ ...payload, position: maxPos });
  }

  closeModal();
  await loadAll();
  renderCurrentView();
}

function confirmDelete(id, title) {
  if (!confirm(`Eliminare la sezione "${title}"?`)) return;
  deleteSection(id);
}

async function deleteSection(id) {
  await db.from('sections').delete().eq('id', id);
  await loadAll();
  renderCurrentView();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ============================================================
//  TIMONE VISIVO
// ============================================================

function renderTimone(container) {
  const withPages = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const m16 = nextMultiple(tot, 16);

  // Build page-to-section lookup
  const pageMap = {};
  withPages.forEach(s => {
    for (let p = s.start_page; p <= s.end_page; p++) pageMap[p] = s;
  });

  // Total cells needed (rounded to next multiple of 4 at minimum for display)
  const displayTotal = nextMultiple(Math.max(tot, 4), 4);

  // Cover cell
  const coverCell = `
    <div class="cover-cell">
      <div class="cell-pages">p. 1</div>
      <div class="cell-title">COVER</div>
      <div class="cell-type">Copertina</div>
    </div>`;

  // Build spread cells: spreads start at page 2
  // spread index 0 = pages 2-3, index 1 = pages 4-5, ...
  const spreads = [];
  for (let p = 2; p <= displayTotal; p += 2) {
    const leftPage  = p;
    const rightPage = p + 1;
    const leftSec   = pageMap[leftPage];
    const rightSec  = pageMap[rightPage];

    if (!leftSec && !rightSec) {
      // Empty spread (padding pages)
      spreads.push(`
        <div class="spread-cell empty-spread">
          <div class="cell-pages" style="color:#9CA3AF">p. ${leftPage}–${rightPage}</div>
          <div class="cell-type" style="color:#D1D5DB">—</div>
        </div>`);
    } else if (leftSec && rightSec && leftSec.id === rightSec.id) {
      // Same section both pages
      const color = leftSec.color || getTypeColor(leftSec.content_type);
      const textColor = isLight(color) ? '#1a1a2e' : '#ffffff';
      spreads.push(`
        <div class="spread-cell" style="background:${color};color:${textColor}">
          <div class="cell-pages">p. ${leftPage}–${rightPage}</div>
          <div class="cell-title">${escHtml(leftSec.title)}</div>
          <div class="cell-type">${escHtml(leftSec.content_type)}</div>
          <div class="cell-status">${escHtml(leftSec.status)}</div>
        </div>`);
    } else {
      // Split spread — two different sections (or one empty)
      const leftColor  = leftSec  ? (leftSec.color  || getTypeColor(leftSec.content_type))  : '#F3F4F6';
      const rightColor = rightSec ? (rightSec.color || getTypeColor(rightSec.content_type)) : '#F3F4F6';
      const leftText   = isLight(leftColor)  ? '#1a1a2e' : '#ffffff';
      const rightText  = isLight(rightColor) ? '#1a1a2e' : '#ffffff';
      spreads.push(`
        <div class="spread-cell-split">
          <div class="split-half" style="background:${leftColor};color:${leftText}">
            <div class="cell-pages">p. ${leftPage}</div>
            <div class="cell-title">${leftSec  ? escHtml(leftSec.title)  : '—'}</div>
            <div class="cell-type">${leftSec   ? escHtml(leftSec.content_type) : ''}</div>
          </div>
          <div class="split-half" style="background:${rightColor};color:${rightText}">
            <div class="cell-pages">p. ${rightPage}</div>
            <div class="cell-title">${rightSec ? escHtml(rightSec.title) : '—'}</div>
            <div class="cell-type">${rightSec  ? escHtml(rightSec.content_type) : ''}</div>
          </div>
        </div>`);
    }
  }

  // Lay out into rows of 4 spreads
  let gridHtml = `<div class="timone-cover-row">${coverCell}</div>`;
  for (let i = 0; i < spreads.length; i += 4) {
    const rowSpreads = spreads.slice(i, i + 4);
    const firstSpreadPage = 2 + i * 2;
    const lastSpreadPage  = firstSpreadPage + rowSpreads.length * 2 - 1;
    gridHtml += `
      <div class="spread-row">
        <div class="timone-row-label">pp. ${firstSpreadPage}–${lastSpreadPage}</div>
        ${rowSpreads.join('')}
      </div>`;
  }

  // Legend
  const usedTypes = [...new Set(state.sections.map(s => s.content_type))];
  const legendItems = usedTypes.map(name => {
    const color = getTypeColor(name);
    return `<div class="legend-item"><div class="legend-color" style="background:${color}"></div>${escHtml(name)}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="timone-header">
      <h2>Timone — ${escHtml(MAGAZINE_NAME)}</h2>
      <div style="display:flex;gap:.5rem">
        <button class="btn-ghost" onclick="window.print()">🖨 Stampa / PDF</button>
      </div>
    </div>
    <div class="timone-wrapper">
      <div class="timone-grid">${gridHtml}</div>
      ${legendItems ? `<div class="timone-legend"><span class="legend-label">Legenda:</span>${legendItems}</div>` : ''}
    </div>`;
}

// ============================================================
//  IMPOSTAZIONI — Tipi & Stati
// ============================================================

function renderImpostazioni(container) {
  const typesList = state.contentTypes.map(t => `
    <div class="type-item" data-id="${t.id}">
      <div class="type-item-color" style="background:${t.color}"></div>
      <div class="type-item-name">${escHtml(t.name)}</div>
      <div class="type-item-actions">
        <button class="btn-icon" onclick="openTypeEditor('type','${t.id}')" title="Modifica">✏️</button>
        <button class="btn-icon" onclick="deleteType('${t.id}','${escHtml(t.name).replace(/'/g,'\\\'')}')" title="Elimina">🗑</button>
      </div>
    </div>`).join('');

  const statusList = state.statuses.map(s => `
    <div class="type-item" data-id="${s.id}">
      <div class="type-item-color" style="background:${s.color}"></div>
      <div class="type-item-name">${escHtml(s.name)}</div>
      <div class="type-item-actions">
        <button class="btn-icon" onclick="openTypeEditor('status','${s.id}')" title="Modifica">✏️</button>
        <button class="btn-icon" onclick="deleteStatus('${s.id}','${escHtml(s.name).replace(/'/g,'\\\'')}')" title="Elimina">🗑</button>
      </div>
    </div>`).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:1.25rem">Tipi di contenuto & Stati</h2>
    <div class="settings-grid">
      <div class="settings-card">
        <h3>Tipi di contenuto
          <button class="btn-primary" style="font-size:.78rem;padding:.3rem .7rem" onclick="openTypeEditor('type',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${typesList || '<p style="color:#9CA3AF;font-size:.85rem">Nessun tipo.</p>'}</div>
      </div>
      <div class="settings-card">
        <h3>Stati di lavorazione
          <button class="btn-primary" style="font-size:.78rem;padding:.3rem .7rem" onclick="openTypeEditor('status',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${statusList || '<p style="color:#9CA3AF;font-size:.85rem">Nessuno stato.</p>'}</div>
      </div>
    </div>`;
}

function openTypeEditor(kind, id) {
  const list   = kind === 'type' ? state.contentTypes : state.statuses;
  const item   = id ? list.find(x => x.id === id) : null;
  const label  = kind === 'type' ? 'tipo di contenuto' : 'stato';

  const html = `
    <div class="modal-title">
      <span>${item ? `✏️ Modifica ${label}` : `➕ Nuovo ${label}`}</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" id="ft-name" value="${escHtml(item?.name || '')}" placeholder="Es. Intervista">
      </div>
      <div class="form-group">
        <label>Colore</label>
        <input type="color" id="ft-color" value="${item?.color || '#4F46E5'}">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveTypeOrStatus('${kind}','${id || ''}')">
        ${item ? 'Salva' : 'Aggiungi'}
      </button>
    </div>`;

  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('ft-name').focus();
}

async function saveTypeOrStatus(kind, id) {
  const name  = document.getElementById('ft-name').value.trim();
  const color = document.getElementById('ft-color').value;
  if (!name) { alert('Inserisci un nome.'); return; }

  const table = kind === 'type' ? 'content_types' : 'statuses';
  if (id) {
    await db.from(table).update({ name, color }).eq('id', id);
  } else {
    await db.from(table).insert({ name, color });
  }
  closeModal();
  await loadAll();
  renderCurrentView();
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
//  EXPORT EXCEL
// ============================================================

function exportExcel() {
  const withPages = calcPages(state.sections);
  const rows = withPages.map(s => ({
    'Posizione':       withPages.indexOf(s) + 1,
    'Titolo':          s.title,
    'Tipo':            s.content_type,
    'Pagine':          s.pages_count,
    'Pagina inizio':   s.start_page,
    'Pagina fine':     s.end_page,
    'Stato':           s.status,
    'Note':            s.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [8,35,20,8,14,12,18,30].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timone');
  XLSX.writeFile(wb, `Timone_${MAGAZINE_NAME.replace(/\s+/g,'_')}.xlsx`);
}

// ============================================================
//  HELPERS
// ============================================================

function getTypeColor(typeName) {
  const t = state.contentTypes.find(x => x.name === typeName);
  return t ? t.color : '#6B7280';
}

function getStatusColor(statusName) {
  const s = state.statuses.find(x => x.name === statusName);
  return s ? s.color : '#94A3B8';
}

function isLight(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ============================================================
//  START
// ============================================================

document.addEventListener('DOMContentLoaded', init);
