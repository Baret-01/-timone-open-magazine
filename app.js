// ============================================================
//  OPEN Magazine — Timone Editoriale
// ============================================================

const CONFIG_KEY    = 'open_timone_config';
const MAGAZINE_NAME = 'OPEN Magazine 01-2026';

const SUPABASE_URL = 'https://bofntouxakshosdtgdfj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fn-3Mbq0vrNm2yZv1_EtZg_ubfAt6vu';

let db = null;
let realtimeChannel = null;
let state = {
  sections: [], contentTypes: [], statuses: [], materialiStatuses: [],
  currentView: 'lista',
};

const DEFAULT_TYPES = [
  { name: 'COVER',                  color: '#4A5568' },
  { name: 'ADV',                    color: '#E91E8C' },
  { name: 'REDAZIONALE',            color: '#5B9BD5' },
  { name: 'CORPORATE',              color: '#1E3A8A' },
  { name: 'ATTUALITA',              color: '#E07830' },
  { name: 'RETAIL',                 color: '#C8A820' },
  { name: 'LIFESTYLE',              color: '#AA3050' },
  { name: 'CATALOGO',               color: '#8090A0' },
  { name: 'AGRITECH',               color: '#3A9A58' },
  { name: 'PUBBLIREDAZIONALI',      color: '#FF69B4' },
  { name: 'CATALOGO COMBUSTIBILE',  color: '#E53935' },
  { name: 'CATALOGO SFP',           color: '#00BCD4' },
  { name: 'OPEN INSIEME',           color: '#009688' },
  { name: 'MONDO IQOS',             color: '#40E0D0' },
  { name: 'TEMPO LIBERO',           color: '#E53935' },
];
const DEFAULT_STATUSES = [
  { name: 'Da fare',        color: '#E2E8F0' },
  { name: 'Da richiedere',  color: '#DDD6FE' },
  { name: 'Richiesto',      color: '#BFDBFE' },
  { name: 'Attendiamo',     color: '#FED7AA' },
  { name: 'In lavorazione', color: '#FEF08A' },
  { name: 'Impaginato',     color: '#BBF7D0' },
  { name: 'Approvato',      color: '#6EE7B7' },
  { name: 'Consegnato',     color: '#34D399' },
];
const COLOR_PALETTE = [
  // Neutri
  { hex: '#FFFFFF', light: true }, { hex: '#F3F4F6', light: true }, { hex: '#E5E7EB', light: true },
  { hex: '#9CA3AF', light: true }, { hex: '#6B7280' }, { hex: '#374151' }, { hex: '#1a1a2e' },
  // Caldi
  { hex: '#FEE2E2', light: true }, { hex: '#FCA5A5', light: true }, { hex: '#EF4444' },
  { hex: '#DC2626' }, { hex: '#F97316' }, { hex: '#FBBF24', light: true }, { hex: '#F59E0B' },
  // Verdi / Teal
  { hex: '#D1FAE5', light: true }, { hex: '#34D399', light: true }, { hex: '#10B981' },
  { hex: '#059669' }, { hex: '#047857' }, { hex: '#06B6D4' }, { hex: '#0891B2' },
  // Blu / Viola / Rosa
  { hex: '#DBEAFE', light: true }, { hex: '#60A5FA', light: true }, { hex: '#3B82F6' },
  { hex: '#4F46E5' }, { hex: '#8B5CF6' }, { hex: '#EC4899' }, { hex: '#F472B6', light: true },
];

const DEFAULT_MATERIALI = [
  { name: 'Mancanti',  color: '#FCA5A5' },
  { name: 'In arrivo', color: '#FDB574' },
  { name: 'Ricevuti',  color: '#93C5FD' },
  { name: 'Ok',        color: '#6EE7B7' },
];

// ============================================================
//  INIT
// ============================================================

async function init() {
  state.isReadonly = new URLSearchParams(window.location.search).get('readonly') === '1';
  if (state.isReadonly) document.body.classList.add('readonly-mode');

  document.getElementById('magazine-title').textContent = MAGAZINE_NAME;
  wireNav();
  wireHeaderButtons();
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  try {
    const { createClient } = window.supabase;
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    await loadAll();
    showMainApp();
    if (state.isReadonly) {
      state.currentView = 'timone';
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    }
    renderCurrentView();
    subscribeRealtime();
  } catch {
    showConfigScreen('Errore di connessione al database.');
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
  document.getElementById('btn-export-pdf').onclick   = () => window.print();
}

// ============================================================
//  SUPABASE
// ============================================================

async function loadAll() {
  const [secRes, typRes, stRes, matRes] = await Promise.all([
    db.from('sections').select('*').order('position'),
    db.from('content_types').select('*').order('name'),
    db.from('statuses').select('*').order('name'),
    db.from('materiali_statuses').select('*').order('name'),
  ]);
  if (typRes.data?.length === 0) await db.from('content_types').insert(DEFAULT_TYPES);
  if (stRes.data?.length === 0)  await db.from('statuses').insert(DEFAULT_STATUSES);
  if (matRes.data?.length === 0) await db.from('materiali_statuses').insert(DEFAULT_MATERIALI);
  if (!typRes.data?.length || !stRes.data?.length || !matRes.data?.length) return loadAll();

  state.sections          = secRes.data || [];
  state.contentTypes      = typRes.data || [];
  state.statuses          = stRes.data  || [];
  state.materialiStatuses = matRes.data || [];
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
//  La prima sezione della lista è sempre pagina 1 (la Cover).
// ============================================================

function calcPages(sections) {
  let page = 1;
  return sections.map(s => {
    const start = page;
    const end   = page + s.pages_count - 1;
    page = end + 1;
    return { ...s, start_page: start, end_page: end };
  });
}

function totalPages(sections) {
  if (!sections.length) return 0;
  return calcPages(sections).at(-1).end_page;
}

function nextMultiple(n, m) {
  return n % m === 0 ? n : n + (m - (n % m));
}

// ============================================================
//  RENDER ROUTER
// ============================================================

function renderCurrentView() {
  const el = document.getElementById('main-content');
  if      (state.currentView === 'lista')        renderLista(el);
  else if (state.currentView === 'dashboard')    renderDashboard(el);
  else if (state.currentView === 'timone')       renderTimone(el);
  else if (state.currentView === 'impostazioni') renderImpostazioni(el);
}

// ============================================================
//  LISTA — inline editing
// ============================================================

function renderLista(container) {
  const wp  = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const m16 = nextMultiple(tot, 16);
  const m8  = nextMultiple(tot, 8);
  const m4  = nextMultiple(tot, 4);

  let badge = '';
  if (!tot)                badge = '';
  else if (tot % 16 === 0) badge = `<span class="pc-badge pc-green">✓ Multiplo di 16 — ottimale</span>`;
  else if (tot % 8 === 0)  badge = `<span class="pc-badge pc-yellow">⚠ ×8</span><span class="pc-info">+${m16-tot}p per ${m16} (×16)</span>`;
  else if (tot % 4 === 0)  badge = `<span class="pc-badge pc-yellow">⚠ ×4</span><span class="pc-info">+${m8-tot}p per ${m8} (×8) · +${m16-tot}p per ${m16} (×16)</span>`;
  else                      badge = `<span class="pc-badge pc-red">✗ Non ×4</span><span class="pc-info">${m4}p (×4) · ${m8}p (×8) · ${m16}p (×16)</span>`;

  let rows = '';
  if (!wp.length) {
    rows = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📄</div><p>Nessuna sezione. Clicca "Aggiungi" o usa "Importa".</p></div></td></tr>`;
  } else {
    rows = wp.map((s, i) => {
      const tc  = getTypeColor(s.content_type);
      const tTC = isLight(tc) ? '#1a1a2e' : '#fff';
      const sc  = getStatusColor(s.status);
      const mc  = getMatColor(s.materiali);
      const mTC = isLight(mc) ? '#1a1a2e' : '#fff';

      const typeOpts = state.contentTypes.map(t =>
        `<option value="${escHtml(t.name)}" ${s.content_type===t.name?'selected':''}>${escHtml(t.name)}</option>`
      ).join('');
      const statOpts = state.statuses.map(t =>
        `<option value="${escHtml(t.name)}" ${s.status===t.name?'selected':''}>${escHtml(t.name)}</option>`
      ).join('');
      const matOpts = state.materialiStatuses.map(m =>
        `<option value="${escHtml(m.name)}" ${(s.materiali||'Mancanti')===m.name?'selected':''}>${escHtml(m.name)}</option>`
      ).join('');

      const urlCell = s.url
        ? `<a class="url-link" href="${escHtml(s.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗</a>`
        : `<span class="url-empty">—</span>`;

      return `<tr data-id="${s.id}">
        <td><span class="drag-handle">⠿</span></td>
        <td class="col-num">${i+1}</td>
        <td>
          <select class="inline-select status-sel" data-id="${s.id}" data-field="status"
            style="background:${sc};color:${isLight(sc)?'#1a1a2e':'#fff'}"
            onchange="updateField('${s.id}','status',this.value);updateStatusSelStyle(this)">${statOpts}</select>
        </td>
        <td>
          <select class="inline-select type-sel" data-id="${s.id}" data-field="content_type"
            style="background:${tc};color:${tTC}"
            onchange="updateField('${s.id}','content_type',this.value);updateTypeSelStyle(this)">${typeOpts}</select>
        </td>
        <td class="cell-edit" onclick="editCell(this,'${s.id}','title',false)">
          <span class="cell-val">${escHtml(s.title)}</span>
          ${s.notes ? `<span class="cell-notes">${escHtml(s.notes)}</span>` : ''}
        </td>
        <td>
          <select class="inline-select mat-sel" data-id="${s.id}" data-field="materiali"
            style="background:${mc};color:${mTC}"
            onchange="updateField('${s.id}','materiali',this.value);updateMatSelStyle(this)">${matOpts}</select>
        </td>
        <td class="cell-edit url-cell" onclick="editCell(this,'${s.id}','url',false)">${urlCell}</td>
        <td class="cell-edit num-cell" onclick="editCell(this,'${s.id}','pages_count',true)">
          <span class="cell-val">${s.pages_count}</span>
        </td>
        <td class="page-num-cell">${s.start_page}</td>
        <td class="page-num-cell">${s.end_page}</td>
        <td>
          <button class="btn-icon" onclick="confirmDelete('${s.id}','${escHtml(s.title).replace(/'/g,"\\'")}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="lista-header">
      <h2>Sezioni — ${escHtml(MAGAZINE_NAME)}</h2>
      <button class="btn-primary" onclick="openAddModal()">+ Aggiungi sezione</button>
    </div>
    <div class="page-counter-bar">
      <span class="pc-total">📄 Totale pagine: <strong>${tot}</strong></span>
      ${badge}
    </div>
    <div class="table-scroll-wrap">
    <table class="section-table">
      <thead><tr>
        <th style="width:28px"></th>
        <th style="width:26px">#</th>
        <th style="min-width:115px">Stato</th>
        <th style="min-width:105px">Tipo</th>
        <th>Titolo</th>
        <th style="min-width:100px">Materiali</th>
        <th style="width:38px">URL</th>
        <th style="width:52px">N.Pag</th>
        <th style="width:62px">P.Inizio</th>
        <th style="width:55px">P.Fine</th>
        <th style="width:34px"></th>
      </tr></thead>
      <tbody id="sections-tbody">${rows}</tbody>
    </table>
    </div>`;

  if (state.sections.length) initSortable();
}

// ============================================================
//  INLINE EDITING
// ============================================================

function editCell(td, id, field, isNumber) {
  if (td.querySelector('input')) return; // already editing

  const section = state.sections.find(s => s.id === id);
  const currentVal = section ? (section[field] ?? '') : '';

  const input = document.createElement('input');
  input.type  = isNumber ? 'number' : 'text';
  input.value = currentVal;
  input.className = 'inline-input';
  if (isNumber) { input.min = 1; input.max = 200; }

  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const save = async () => {
    if (done) return;
    done = true;
    const val = isNumber ? parseInt(input.value) : input.value.trim();
    if (isNumber && (!val || val < 1)) { renderCurrentView(); return; }
    await updateField(id, field, val);
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { done = true; renderCurrentView(); }
  });
}

async function updateField(id, field, value) {
  const payload = { [field]: value };
  await db.from('sections').update(payload).eq('id', id);
  const s = state.sections.find(x => x.id === id);
  if (s) Object.assign(s, payload);
  renderCurrentView();
}

function updateTypeSelStyle(sel) {
  const color = getTypeColor(sel.value);
  sel.style.background = color;
  sel.style.color = isLight(color) ? '#1a1a2e' : '#fff';
}

function updateMatSelStyle(sel) {
  const color = getMatColor(sel.value);
  sel.style.background = color;
  sel.style.color = isLight(color) ? '#1a1a2e' : '#fff';
}

function updateStatusSelStyle(sel) {
  const color = getStatusColor(sel.value);
  sel.style.background = color;
  sel.style.color = isLight(color) ? '#1a1a2e' : '#fff';
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
//  ADD MODAL (solo per nuove sezioni)
// ============================================================

function openAddModal() {
  const typeOpts = state.contentTypes.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`).join('');
  const statOpts = state.statuses.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`).join('');
  const matOpts  = state.materialiStatuses.map(m => `<option value="${escHtml(m.name)}">${escHtml(m.name)}</option>`).join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>➕ Nuova sezione</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Titolo *</label>
        <input type="text" id="f-title" placeholder="Es. Intervista con…">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tipo *</label><select id="f-type">${typeOpts}</select></div>
        <div class="form-group"><label>N. Pagine *</label><input type="number" id="f-pages" value="2" min="1" max="200"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Stato</label><select id="f-status">${statOpts}</select></div>
        <div class="form-group"><label>Materiali</label><select id="f-materiali">${matOpts}</select></div>
      </div>
      <div class="form-group"><label>URL Materiali</label><input type="url" id="f-url" placeholder="https://…"></div>
      <div class="form-group"><label>Note</label><textarea id="f-notes" rows="2"></textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveNewSection()">Aggiungi</button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-title').focus();
}

async function saveNewSection() {
  const title    = document.getElementById('f-title').value.trim();
  const type     = document.getElementById('f-type').value;
  const pages    = parseInt(document.getElementById('f-pages').value, 10);
  const status   = document.getElementById('f-status').value;
  const materiali = document.getElementById('f-materiali').value;
  const url      = document.getElementById('f-url').value.trim() || null;
  const notes    = document.getElementById('f-notes').value.trim() || null;
  if (!title)          { alert('Inserisci il titolo.'); return; }
  if (!pages || pages < 1) { alert('Numero pagine non valido.'); return; }
  const maxPos = state.sections.length ? Math.max(...state.sections.map(s => s.position)) + 1 : 0;
  await db.from('sections').insert({
    title, content_type: type, pages_count: pages, status, materiali, url, notes,
    color: getTypeColor(type), position: maxPos,
  });
  closeModal();
  await loadAll(); renderCurrentView();
}

function confirmDelete(id, title) {
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>🗑 Elimina sezione</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <p style="margin:.25rem 0 1.5rem">Eliminare "<strong>${escHtml(title)}</strong>"?</p>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-danger" onclick="doDelete('${id}')">Elimina</button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function doDelete(id) {
  closeModal();
  await db.from('sections').delete().eq('id', id);
  await loadAll();
  renderCurrentView();
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
  const pct = v => tot > 0 ? Math.round(v / tot * 100) : 0;

  const byType = {};
  state.contentTypes.forEach(t => { byType[t.name] = 0; });
  wp.forEach(s => { byType[s.content_type] = (byType[s.content_type]||0) + s.pages_count; });

  const byStatus = {};
  state.statuses.forEach(s => { byStatus[s.name] = 0; });
  wp.forEach(s => { byStatus[s.status] = (byStatus[s.status]||0) + s.pages_count; });

  const byMat = {};
  state.materialiStatuses.forEach(m => { byMat[m.name] = 0; });
  wp.forEach(s => { byMat[s.materiali||'Mancanti'] = (byMat[s.materiali||'Mancanti']||0) + s.pages_count; });

  const typeRows = state.contentTypes
    .filter(t => (byType[t.name]||0) > 0)
    .sort((a,b) => (byType[b.name]||0)-(byType[a.name]||0))
    .map(t => {
      const v = byType[t.name]||0, p = pct(v);
      return `<div class="type-bar-row">
        <div class="type-bar-color" style="background:${t.color}"></div>
        <div class="type-bar-name">${escHtml(t.name)}</div>
        <div class="type-bar-count">${v}p</div>
        <div class="type-bar-track"><div class="type-bar-fill" style="width:${p}%;background:${t.color}"></div></div>
        <div class="type-bar-pct">${p}%</div>
      </div>`;
    }).join('');

  const statusRows = state.statuses.map(s => {
    const v = byStatus[s.name]||0, p = pct(v);
    const ns = wp.filter(x => x.status === s.name).length;
    return `<div class="dash-stat-row">
      <span style="display:flex;align-items:center;gap:.4rem">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0"></span>
        ${escHtml(s.name)}
      </span>
      <span><strong>${v}p</strong><span class="dash-stat-pct">${ns} art. · ${p}%</span></span>
    </div>`;
  }).join('');

  const matRows = state.materialiStatuses.map(m => {
    const v = byMat[m.name]||0;
    const ns = wp.filter(s => (s.materiali||'Mancanti') === m.name).length;
    const tc = isLight(m.color) ? '#1a1a2e' : '#fff';
    return `<div class="dash-stat-row">
      <span><span class="mat-badge" style="background:${m.color};color:${tc}">${escHtml(m.name)}</span></span>
      <span><strong>${v}p</strong><span class="dash-stat-pct">${ns} art.</span></span>
    </div>`;
  }).join('');

  const mkSeg = (mul, target, diff) => {
    const ok = tot % mul === 0;
    return `<div class="segnatura-row">
      <div class="seg-light ${ok?'seg-green':'seg-red'}"></div>
      <div class="seg-label">Multiplo di ${mul}</div>
      <div class="seg-note">${ok ? '✓ OK' : `+${diff}p per ${target}`}</div>
    </div>`;
  };

  const adv = byType['ADV']||0;
  const red = ['REDAZIONALE','CORPORATE','ATTUALITA','LIFESTYLE','RETAIL'].reduce((a,k)=>a+(byType[k]||0),0);

  container.innerHTML = `
    <h2 style="margin-bottom:1.1rem">Dashboard — ${escHtml(MAGAZINE_NAME)}</h2>
    <div class="dashboard-grid">
      <div class="dash-card">
        <h3>Totali</h3>
        <div style="display:flex;gap:1.5rem;align-items:flex-end;margin-bottom:1rem">
          <div><div class="totale-big">${tot}</div><div class="totale-label">pagine totali</div></div>
          <div><div class="totale-big">${n}</div><div class="totale-label">sezioni</div></div>
        </div>
        <div class="dash-stat-row"><span>ADV</span><span><strong>${adv}p</strong><span class="dash-stat-pct">${pct(adv)}%</span></span></div>
        <div class="dash-stat-row"><span>Redazionale</span><span><strong>${red}p</strong><span class="dash-stat-pct">${pct(red)}%</span></span></div>
      </div>
      <div class="dash-card"><h3>Segnatura di stampa</h3>${mkSeg(16,m16,m16-tot)}${mkSeg(8,m8,m8-tot)}${mkSeg(4,m4,m4-tot)}</div>
      <div class="dash-card"><h3>Pagine per tipo</h3>${typeRows||'<p style="color:#9CA3AF;font-size:.85rem">Nessuna sezione.</p>'}</div>
      <div class="dash-card"><h3>Avanzamento lavorazione</h3>${statusRows}</div>
      <div class="dash-card"><h3>Stato materiali</h3>${matRows}</div>
    </div>`;
}

// ============================================================
//  TIMONE VISIVO
//  - Colori sempre derivati dal tipo (non dal campo color salvato)
//  - Cover p.1 a sinistra, IV copertina a destra nella stessa riga
// ============================================================

function renderTimone(container) {
  const wp  = calcPages(state.sections);
  const tot = totalPages(state.sections);
  const displayTotal = nextMultiple(Math.max(tot, 4), 4);

  // page → section map
  const pageMap = {};
  wp.forEach(s => { for (let p = s.start_page; p <= s.end_page; p++) pageMap[p] = s; });

  const firstSec = wp[0];
  const lastSec  = wp[wp.length - 1];
  const hasIV    = lastSec && lastSec.content_type?.toUpperCase() === 'COVER' && lastSec.id !== firstSec?.id;
  const ivPage   = hasIV ? lastSec.end_page : -1;

  // Cover cell (p.1)
  const cc  = getTypeColor(firstSec?.content_type || 'COVER');
  const cTC = isLight(cc) ? '#1a1a2e' : '#fff';
  const coverCell = `<div class="cover-single">
    <div class="cover-page" style="background:${cc};color:${cTC}">
      <div class="page-type-lbl">${escHtml(firstSec?.content_type||'COVER')}</div>
      <div class="page-title-lbl">${escHtml(firstSec?.title||'COVER')}</div>
    </div>
    <div class="page-num-below" style="text-align:center">1</div>
  </div>`;

  // IV copertina cell
  let ivCell = '';
  if (hasIV) {
    const ic = getTypeColor(lastSec.content_type);
    const it = isLight(ic) ? '#1a1a2e' : '#fff';
    ivCell = `<div class="cover-single">
      <div class="cover-page" style="background:${ic};color:${it}">
        <div class="page-type-lbl">${escHtml(lastSec.content_type)}</div>
        <div class="page-title-lbl">${escHtml(lastSec.title)}</div>
      </div>
      <div class="page-num-below" style="text-align:center">${lastSec.end_page}</div>
    </div>`;
  }

  // Spreads (pages 2..displayTotal, skip IV page)
  const spreads = [];
  for (let p = 2; p <= displayTotal; p += 2) {
    const lp = p, rp = p + 1;
    spreads.push(buildSpread(
      lp === ivPage ? null : pageMap[lp], lp,
      rp === ivPage ? null : pageMap[rp], rp
    ));
  }

  // Grid: cover row (IV on right), then rows of 4
  let gridHtml = `
    <div class="timone-cover-row">
      ${coverCell}
      ${ivCell}
    </div>`;

  for (let i = 0; i < spreads.length; i += 4) {
    const chunk = spreads.slice(i, i + 4);
    const fp = 2 + i * 2, lp2 = fp + chunk.length * 2 - 1;
    gridHtml += `<div class="spread-row">
      <div class="timone-row-label">pp. ${fp}–${lp2}</div>
      ${chunk.join('')}
    </div>`;
  }

  const usedTypes   = [...new Set(wp.map(s => s.content_type))];
  const legendItems = usedTypes.map(name => {
    const c = getTypeColor(name);
    return `<div class="legend-item"><div class="legend-color" style="background:${c}"></div>${escHtml(name)}</div>`;
  }).join('');

  const editingBtns = state.isReadonly ? '' : `
    <button class="btn-ghost" onclick="openReorderModal()">↕ Riordina</button>
    <button class="btn-ghost" onclick="copyShareUrl(this)">🔗 Condividi</button>`;

  container.innerHTML = `
    <div class="timone-header">
      <h2>Timone — ${escHtml(MAGAZINE_NAME)}</h2>
      <div style="display:flex;gap:.5rem">
        ${editingBtns}
        <button class="btn-ghost" onclick="window.print()">🖨 Stampa / PDF</button>
      </div>
    </div>
    <div class="timone-wrapper">
      <div class="timone-grid">${gridHtml}</div>
      ${legendItems ? `<div class="timone-legend"><span class="legend-label">Legenda:</span>${legendItems}</div>` : ''}
    </div>`;
}

function openReorderModal() {
  const wp = calcPages(state.sections);
  const items = wp.map(s => {
    const tc = getTypeColor(s.content_type);
    const tl = isLight(tc) ? '#1a1a2e' : '#fff';
    const pageRange = s.pages_count === 1 ? `p. ${s.start_page}` : `pp. ${s.start_page}–${s.end_page}`;
    return `<div class="reorder-item" data-id="${s.id}">
      <span class="drag-handle reorder-handle">⠿</span>
      <span class="reorder-type" style="background:${tc};color:${tl}">${escHtml(s.content_type)}</span>
      <span class="reorder-title">${escHtml(s.title)}</span>
      <span class="reorder-pages">${pageRange} · ${s.pages_count}p</span>
    </div>`;
  }).join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>↕ Riordina sezioni</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <p style="font-size:.82rem;color:#6B7280;margin:.1rem 0 .85rem">Trascina le righe per cambiare l'ordine nel timone.</p>
    <div id="reorder-list" class="reorder-list">${items}</div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveTimoneOrder()">Salva ordine</button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');

  Sortable.create(document.getElementById('reorder-list'), {
    handle: '.reorder-handle', animation: 150, ghostClass: 'sortable-ghost',
  });
}

async function saveTimoneOrder() {
  const ids = [...document.querySelectorAll('#reorder-list .reorder-item[data-id]')].map(el => el.dataset.id);
  await Promise.all(ids.map((id, i) => db.from('sections').update({ position: i }).eq('id', id)));
  state.sections = ids.map(id => state.sections.find(s => s.id === id));
  closeModal();
  renderCurrentView();
}

function copyShareUrl(btn) {
  const url = window.location.origin + window.location.pathname + '?readonly=1';
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copiato!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function buildSpread(leftSec, lp, rightSec, rp) {
  const lc = leftSec  ? getTypeColor(leftSec.content_type)  : '#F3F4F6';
  const rc = rightSec ? getTypeColor(rightSec.content_type) : '#F3F4F6';
  const lt = isLight(lc) ? '#1a1a2e' : '#fff';
  const rt = isLight(rc) ? '#1a1a2e' : '#fff';
  const isEmpty = !leftSec && !rightSec;

  return `<div class="spread${isEmpty?' empty-spread':''}">
    <div class="spread-pages">
      <div class="page-half" style="background:${lc};color:${lt}">
        ${leftSec  ? `<div class="page-type-lbl">${escHtml(leftSec.content_type)}</div><div class="page-title-lbl">${escHtml(leftSec.title)}</div>` : ''}
      </div>
      <div class="fold-line"></div>
      <div class="page-half" style="background:${rc};color:${rt}">
        ${rightSec ? `<div class="page-type-lbl">${escHtml(rightSec.content_type)}</div><div class="page-title-lbl">${escHtml(rightSec.title)}</div>` : ''}
      </div>
    </div>
    <div class="spread-nums">
      <span class="page-num-below">${lp}</span>
      <span class="page-num-below">${rp}</span>
    </div>
  </div>`;
}

// ============================================================
//  IMPOSTAZIONI
// ============================================================

function renderImpostazioni(container) {
  const mkList = (items, kind) => items.map(t => `
    <div class="type-item">
      <div class="type-item-color" style="background:${t.color}"></div>
      <div class="type-item-name">${escHtml(t.name)}</div>
      <div class="type-item-actions">
        <button class="btn-icon" onclick="openTypeEditor('${kind}','${t.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteEntry('${kind}','${t.id}','${escHtml(t.name).replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`).join('') || '<p style="color:#9CA3AF;font-size:.85rem">Nessuna voce.</p>';

  container.innerHTML = `
    <h2 style="margin-bottom:1.1rem">Tipi, Stati & Materiali</h2>
    <div class="settings-grid-3">
      <div class="settings-card">
        <h3>Tipi di contenuto
          <button class="btn-primary" style="font-size:.75rem;padding:.28rem .65rem" onclick="openTypeEditor('type',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${mkList(state.contentTypes,'type')}</div>
      </div>
      <div class="settings-card">
        <h3>Stato lavorazione
          <button class="btn-primary" style="font-size:.75rem;padding:.28rem .65rem" onclick="openTypeEditor('status',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${mkList(state.statuses,'status')}</div>
      </div>
      <div class="settings-card">
        <h3>Stato materiali
          <button class="btn-primary" style="font-size:.75rem;padding:.28rem .65rem" onclick="openTypeEditor('materiali',null)">+ Aggiungi</button>
        </h3>
        <div class="type-list">${mkList(state.materialiStatuses,'materiali')}</div>
      </div>
    </div>`;
}

function openTypeEditor(kind, id) {
  const list   = kind==='type' ? state.contentTypes : kind==='status' ? state.statuses : state.materialiStatuses;
  const item   = id ? list.find(x => x.id===id) : null;
  const labels = { type:'tipo', status:'stato lavorazione', materiali:'stato materiali' };
  const curColor = (item?.color || '#4F46E5').toLowerCase();

  const rowLabels = ['Neutri','Caldi','Verdi & Teal','Blu & Viola'];
  let swatchHtml = '';
  COLOR_PALETTE.forEach((c, i) => {
    if (i % 7 === 0) swatchHtml += `<div class="color-palette-label">${rowLabels[i/7]}</div>`;
    const active = c.hex.toLowerCase() === curColor ? 'active' : '';
    const tc = c.light ? '#374151' : '#ffffff';
    swatchHtml += `<div class="color-swatch ${active}" style="background:${c.hex};color:${tc}"
      title="${c.hex}" onclick="pickPaletteColor('${c.hex}')"></div>`;
  });

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span>${item?'✏️ Modifica':'➕ Nuovo'} ${labels[kind]}</span>
      <button class="btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Nome *</label>
        <input type="text" id="ft-name" value="${escHtml(item?.name||'')}">
      </div>
      <div class="form-group">
        <label>Colore</label>
        <div class="color-palette">${swatchHtml}</div>
        <div class="color-custom-row">
          <label>Personalizzato</label>
          <input type="color" id="ft-color" value="${curColor}"
            oninput="syncColorPicker(this)">
          <span class="color-preview-chip" id="ft-color-preview"
            style="background:${curColor};color:${isLight(curColor)?'#1a1a2e':'#fff'}">${curColor}</span>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Annulla</button>
      <button class="btn-primary" onclick="saveTypeOrStatus('${kind}','${id||''}')">
        ${item?'Salva':'Aggiungi'}
      </button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('ft-name').focus();
}

function pickPaletteColor(hex) {
  const input   = document.getElementById('ft-color');
  const preview = document.getElementById('ft-color-preview');
  if (!input) return;
  input.value = hex;
  preview.style.background = hex;
  preview.style.color = isLight(hex) ? '#1a1a2e' : '#fff';
  preview.textContent = hex;
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('active', s.title.toLowerCase() === hex.toLowerCase());
  });
}

function syncColorPicker(input) {
  const hex     = input.value;
  const preview = document.getElementById('ft-color-preview');
  preview.style.background = hex;
  preview.style.color = isLight(hex) ? '#1a1a2e' : '#fff';
  preview.textContent = hex;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
}

async function saveTypeOrStatus(kind, id) {
  const name  = document.getElementById('ft-name').value.trim();
  const color = document.getElementById('ft-color').value;
  if (!name) { alert('Inserisci un nome.'); return; }
  const table = kind==='type' ? 'content_types' : kind==='status' ? 'statuses' : 'materiali_statuses';
  if (id) await db.from(table).update({ name, color }).eq('id', id);
  else    await db.from(table).insert({ name, color });
  closeModal();
  await loadAll(); renderCurrentView();
}

async function deleteEntry(kind, id, name) {
  if (!confirm(`Eliminare "${name}"?`)) return;
  const table = kind==='type' ? 'content_types' : kind==='status' ? 'statuses' : 'materiali_statuses';
  await db.from(table).delete().eq('id', id);
  await loadAll(); renderCurrentView();
}

// ============================================================
//  IMPORT EXCEL
// ============================================================

function importExcel() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb  = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const ws  = wb.Sheets['LISTA'];
        if (!ws) { alert('Foglio "LISTA" non trovato.'); return; }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        let hi = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i]?.includes('Titolo') && rows[i]?.includes('Stato')) { hi = i; break; }
        }
        if (hi === -1) { alert('Intestazione non trovata.'); return; }

        const hdr = rows[hi];
        const col = n => hdr.indexOf(n);
        const iS=col('Stato'), iT=col('Tipo'), iTi=col('Titolo'),
              iP=col('N.Pagine'), iM=col('Materiali'), iU=col('URL'), iN=col('Note');

        const newT=new Set(), newS=new Set(), newM=new Set();
        const dataRows = [];
        for (let i = hi+1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || typeof r[iTi] !== 'string' || !r[iTi].trim()) continue;
          const pages = parseInt(r[iP]);
          if (!pages || pages < 1) continue;
          const tipo  = (r[iT]||'REDAZIONALE').toString().trim();
          const stato = (r[iS]||'Da fare').toString().trim();
          const mat   = r[iM] ? r[iM].toString().trim() : 'Mancanti';
          newT.add(tipo); newS.add(stato); newM.add(mat);
          dataRows.push({ tipo, stato, mat, title: r[iTi].trim(), pages_count: pages,
            url: r[iU]?.toString().trim()||null, notes: r[iN]?.toString().trim()||null });
        }
        if (!dataRows.length) { alert('Nessuna sezione trovata.'); return; }

        const existT = new Set(state.contentTypes.map(x=>x.name));
        const existS = new Set(state.statuses.map(x=>x.name));
        const existM = new Set(state.materialiStatuses.map(x=>x.name));
        const insT = [...newT].filter(x=>!existT.has(x)).map(n=>({name:n,color:'#6B7280'}));
        const insS = [...newS].filter(x=>!existS.has(x)).map(n=>({name:n,color:'#94A3B8'}));
        const insM = [...newM].filter(x=>!existM.has(x)).map(n=>({name:n,color:'#94A3B8'}));
        if (insT.length) await db.from('content_types').insert(insT);
        if (insS.length) await db.from('statuses').insert(insS);
        if (insM.length) await db.from('materiali_statuses').insert(insM);
        if (insT.length||insS.length||insM.length) await loadAll();

        const replace = confirm(`${dataRows.length} sezioni trovate.\n\nOK = Sostituisci tutto\nAnnulla = Aggiungi in fondo`);
        if (replace && state.sections.length)
          await db.from('sections').delete().neq('id','00000000-0000-0000-0000-000000000000');

        const base = replace ? 0 : (state.sections.length ? Math.max(...state.sections.map(s=>s.position))+1 : 0);
        const secs = dataRows.map((r,i) => ({
          title: r.title, content_type: r.tipo, pages_count: r.pages_count,
          status: r.stato, materiali: r.mat, url: r.url, notes: r.notes,
          color: getTypeColor(r.tipo), position: base+i,
        }));
        for (let i=0; i<secs.length; i+=50) await db.from('sections').insert(secs.slice(i,i+50));
        await loadAll(); renderCurrentView();
        alert(`✓ ${secs.length} sezioni importate!`);
      } catch(err) { alert('Errore: '+err.message); }
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
  const toRgb = hex => (hex||'#888888').replace('#','').toUpperCase().padEnd(6,'0');

  const hdrStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '1A1A2E' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: 'CCCCCC' } } },
  };
  const cellSt = (bgHex, fgHex) => ({
    fill: { patternType: 'solid', fgColor: { rgb: toRgb(bgHex) } },
    font: { color: { rgb: toRgb(fgHex) } },
    alignment: { vertical: 'center' },
  });
  const numSt = { alignment: { horizontal: 'center', vertical: 'center' } };

  const headers = ['#','Stato','Tipo','Titolo','N.Pagine','Pag.Inizio','Pag.Fine','Materiali','URL','Note'];
  const hRow = headers.map(h => ({ v: h, t: 's', s: hdrStyle }));

  const dataRows = wp.map((s, i) => {
    const sc = getStatusColor(s.status);
    const tc = getTypeColor(s.content_type);
    const mc = getMatColor(s.materiali || 'Mancanti');
    const sfg = isLight(sc) ? '#1a1a2e' : '#ffffff';
    const tfg = isLight(tc) ? '#1a1a2e' : '#ffffff';
    const mfg = isLight(mc) ? '#1a1a2e' : '#ffffff';
    return [
      { v: i + 1, t: 'n', s: numSt },
      { v: s.status || '', t: 's', s: cellSt(sc, sfg) },
      { v: s.content_type || '', t: 's', s: cellSt(tc, tfg) },
      { v: s.title || '', t: 's' },
      { v: s.pages_count, t: 'n', s: numSt },
      { v: s.start_page, t: 'n', s: numSt },
      { v: s.end_page, t: 'n', s: numSt },
      { v: s.materiali || 'Mancanti', t: 's', s: cellSt(mc, mfg) },
      { v: s.url || '', t: 's' },
      { v: s.notes || '', t: 's' },
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([hRow, ...dataRows]);
  ws['!cols'] = [5, 22, 18, 44, 9, 11, 9, 16, 40, 32].map(w => ({ wch: w }));
  ws['!rows'] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LISTA');
  XLSX.writeFile(wb, `Timone_${MAGAZINE_NAME.replace(/\s+/g, '_')}.xlsx`);
}

// ============================================================
//  HELPERS
// ============================================================

function getTypeColor(name) {
  return state.contentTypes.find(x=>x.name===name)?.color || '#6B7280';
}
function getStatusColor(name) {
  return state.statuses.find(x=>x.name===name)?.color || '#94A3B8';
}
function getMatColor(name) {
  return state.materialiStatuses.find(x=>x.name===name)?.color || '#94A3B8';
}
function isLight(hex) {
  const c=(hex||'#888').replace('#','');
  return (parseInt(c.substr(0,2),16)*299+parseInt(c.substr(2,2),16)*587+parseInt(c.substr(4,2),16)*114)/1000>150;
}
function escHtml(str) {
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

document.addEventListener('DOMContentLoaded', init);
