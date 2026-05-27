/* ═══════════════════════════════════════════════
   CFFGen — app.js
   Main application orchestrator
   State management, autosave, hotkeys, tour, init
   ═══════════════════════════════════════════════ */

const CFFGen = (() => {

  /* ════════════════════════════════════
     STATE
  ════════════════════════════════════ */

  const DEFAULT_STATE = () => ({
    'cff-version': '1.2.0',
    message: 'If you use this software, please cite it using the metadata from this file.',
    type: 'software',
    title: '',
    version: '',
    'date-released': '',
    abstract: '',
    license: '',
    'license-url': '',
    doi: '',
    url: '',
    repository: '',
    'repository-code': '',
    'repository-artifact': '',
    keywords: [],
    authors: [],
    identifiers: [],
    references: [],
    'preferred-citation': { enabled: false, authors: [] },
  });

  let state = DEFAULT_STATE();

  /* ─── History (undo) ─── */
  const MAX_HISTORY = 30;
  let history = [];
  let historyIndex = -1;

  const pushHistory = () => {
    const snap = JSON.stringify(state);
    if (history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
  };

  const undo = () => {
    if (historyIndex <= 0) { Utils.toast('Nothing to undo', 'info'); return; }
    historyIndex--;
    state = JSON.parse(history[historyIndex]);
    restoreStateToUI();
    UI.refreshPreview();
    Utils.toast('Undone', 'info', 1500);
  };

  /* ════════════════════════════════════
     COLLECT STATE FROM FORM
  ════════════════════════════════════ */

  const collectFromForm = () => {
    const gv = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };

    state['cff-version']         = gv('cff-version')            || '1.2.0';
    state.message                = gv('cff-message');
    state.type                   = gv('cff-type')               || 'software';
    state.title                  = gv('cff-title');
    state.version                = gv('cff-version-val');
    state['date-released']       = gv('cff-date-released');
    state.abstract               = gv('cff-abstract');
    state.license                = gv('cff-license');
    state['license-url']         = gv('cff-license-url');
    state.doi                    = gv('cff-doi');
    state.url                    = gv('cff-url');
    state.repository             = gv('cff-repository');
    state['repository-code']     = gv('cff-repository-code');
    state['repository-artifact'] = gv('cff-repository-artifact');

    // Preferred citation
    const pcEnabled = document.getElementById('enable-preferred-citation')?.checked;
    if (pcEnabled) {
      state['preferred-citation'].enabled   = true;
      state['preferred-citation'].type      = gv('pc-type');
      state['preferred-citation'].title     = gv('pc-title');
      state['preferred-citation'].year      = gv('pc-year') ? parseInt(gv('pc-year')) : null;
      state['preferred-citation'].doi       = gv('pc-doi');
      state['preferred-citation'].journal   = gv('pc-journal');
      state['preferred-citation'].volume    = gv('pc-volume');
      state['preferred-citation'].issue     = gv('pc-issue');
      state['preferred-citation'].pages     = gv('pc-pages');
      state['preferred-citation'].url       = gv('pc-url');
    } else {
      state['preferred-citation'].enabled = false;
    }
  };

  /* ════════════════════════════════════
     UPDATE (called on any form change)
  ════════════════════════════════════ */

  const update = () => {
    collectFromForm();
    pushHistory();

    if (UI.getSettings().realtime !== false) {
      UI.refreshPreview();
    }

    UI.updateProgress(state);
    autosaveNow();
  };

  const debouncedUpdate = Utils.debounce(update, 350);

  /* ════════════════════════════════════
     VALIDATION
  ════════════════════════════════════ */

  const runValidation = () => {
    collectFromForm();
    const results   = Validator.validate(state);
    const container = document.getElementById('validation-results');
    Validator.renderResults(results, container);
    Validator.updateBadge(results);

    const scoreData = Validator.computeScore(state);
    Validator.renderScore(scoreData);

    const errors = results.filter(r => !r.passed && r.level === 'error').length;
    if (errors === 0) Utils.toast('Validation passed!', 'success');
    else Utils.toast(`${errors} error${errors > 1 ? 's' : ''} found`, 'error');
  };

  /* ════════════════════════════════════
     EXPORT
  ════════════════════════════════════ */

  const exportAs = (format) => {
    collectFromForm();
    switch (format) {
      case 'cff':      ImportExport.exportCFF(state);      break;
      case 'bibtex':   ImportExport.exportBibTeX(state);   break;
      case 'ris':      ImportExport.exportRIS(state);      break;
      case 'jsonld':   ImportExport.exportJSONLD(state);   break;
      case 'codemeta': ImportExport.exportCodeMeta(state); break;
    }
  };

  const copyToClipboard = () => {
    collectFromForm();
    ImportExport.copyToClipboard(state);
  };

  /* ════════════════════════════════════
     AUTOSAVE
  ════════════════════════════════════ */

  let autosaveTimer = null;

  const autosaveNow = () => {
    if (!UI.getSettings().autosave) return;
    Utils.storage.set('cffgen-autosave', state);
  };

  const startAutosaveTimer = () => {
    clearInterval(autosaveTimer);
    autosaveTimer = setInterval(() => {
      if (UI.getSettings().autosave) {
        collectFromForm();
        autosaveNow();
      }
    }, 30000);
  };

  const loadAutosave = () => {
    const saved = Utils.storage.get('cffgen-autosave');
    if (!saved) return false;

    // Prompt user
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed; top:70px; left:50%; transform:translateX(-50%);
      background:var(--bg-surface); border:1px solid var(--border);
      border-radius:var(--radius-lg); padding:14px 20px;
      display:flex; align-items:center; gap:14px;
      box-shadow:var(--shadow-lg); z-index:300; font-size:0.875rem;
      color:var(--text-primary); max-width:460px; width:calc(100% - 32px);
      animation: fadeInDown 0.3s ease;
    `;
    banner.innerHTML = `
      <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent);font-size:1.1rem;flex-shrink:0"></i>
      <span style="flex:1">Unsaved session found. Restore it?</span>
      <button id="restore-yes" class="btn btn--primary btn--sm">Restore</button>
      <button id="restore-no" class="btn btn--ghost btn--sm">Dismiss</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('restore-yes').addEventListener('click', () => {
      applyStateToUI(saved);
      banner.remove();
      Utils.toast('Session restored!', 'success');
    });
    document.getElementById('restore-no').addEventListener('click', () => {
      Utils.storage.remove('cffgen-autosave');
      banner.remove();
    });

    return true;
  };

  /* ════════════════════════════════════
     STATE → UI
  ════════════════════════════════════ */

  const applyStateToUI = (s) => {
    state = { ...DEFAULT_STATE(), ...s };

    const setF = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };

    setF('cff-version',            state['cff-version']);
    setF('cff-message',            state.message);
    setF('cff-title',              state.title);
    setF('cff-version-val',        state.version);
    setF('cff-date-released',      state['date-released']);
    setF('cff-abstract',           state.abstract);
    setF('cff-license-url',        state['license-url']);
    setF('cff-doi',                state.doi);
    setF('cff-url',                state.url);
    setF('cff-repository',         state.repository);
    setF('cff-repository-code',    state['repository-code']);
    setF('cff-repository-artifact',state['repository-artifact']);

    if (state.license && window.$) $('#cff-license').val(state.license).trigger('change');
    if (state.type) {
      document.getElementById('cff-type').value = state.type;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.value === state.type));
    }

    // Abstract count
    const aCount = document.getElementById('abstract-count');
    const aTa    = document.getElementById('cff-abstract');
    if (aCount && aTa) aCount.textContent = aTa.value.length;

    // Keywords
    if (Array.isArray(state.keywords)) {
      const td = document.getElementById('keywords-tags');
      if (td) {
        td.innerHTML = '';
        state.keywords.forEach(kw => {
          const chip = document.createElement('div');
          chip.className = 'tag-chip';
          chip.innerHTML = `${Utils.escapeHtml(kw)}<button class="tag-remove"><i class="fa-solid fa-xmark"></i></button>`;
          chip.querySelector('.tag-remove').addEventListener('click', () => {
            state.keywords = state.keywords.filter(k => k !== kw);
            chip.remove(); debouncedUpdate();
          });
          td.appendChild(chip);
        });
      }
    }

    // Authors
    Authors.renderList(state.authors || [], 'authors-list', 'authors-empty', 'main');
    Authors.updateCount('authors-count', (state.authors || []).length, 'author');

    // Identifiers
    References.renderIdentifiers();

    // References
    References.renderReferences();

    // PC
    const pcEnabled = state['preferred-citation']?.enabled;
    const pcToggle  = document.getElementById('enable-preferred-citation');
    const pcFields  = document.getElementById('preferred-citation-fields');
    if (pcToggle) pcToggle.checked = !!pcEnabled;
    if (pcFields) pcFields.classList.toggle('expanded', !!pcEnabled);
    if (pcEnabled && state['preferred-citation']) {
      const pc = state['preferred-citation'];
      const s2 = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
      s2('pc-type', pc.type); s2('pc-title', pc.title); s2('pc-year', pc.year);
      s2('pc-doi', pc.doi); s2('pc-journal', pc.journal || '');
      s2('pc-volume', pc.volume); s2('pc-issue', pc.issue);
      s2('pc-pages', pc.pages || ''); s2('pc-url', pc.url);
      if (Array.isArray(pc.authors)) {
        Authors.renderList(pc.authors, 'pc-authors-list', 'pc-authors-empty', 'pc');
      }
    }

    UI.refreshPreview();
    UI.updateProgress(state);
  };

  const restoreStateToUI = () => applyStateToUI(state);

  /* ════════════════════════════════════
     CLEAR ALL
  ════════════════════════════════════ */

  const clearAll = (silent = false) => {
    state = DEFAULT_STATE();
    applyStateToUI(state);

    // Reset license select2
    if (window.$) $('#cff-license').val('').trigger('change');

    // Reset type
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.value === 'software'));
    document.getElementById('cff-type').value = 'software';

    Utils.storage.remove('cffgen-autosave');
    UI.refreshPreview();
    UI.updateProgress(state);
    if (!silent) Utils.toast('All data cleared', 'info');
  };

  /* ════════════════════════════════════
     SPDX LIVE HINT
  ════════════════════════════════════ */

  const initLicenseSPDXHint = () => {
    // Attach to both the Select2 change and any direct input on the field
    const showHint = (val) => {
      const hint = document.getElementById('license-spdx-hint');
      if (!hint) return;
      if (!val) { hint.textContent = ''; hint.className = 'spdx-hint'; return; }
      const { valid, reason } = Validator.validateSPDX(val);
      if (valid) {
        hint.textContent = '✓ Valid SPDX identifier';
        hint.className = 'spdx-hint spdx-hint--ok';
      } else {
        hint.textContent = reason || 'Not a recognized SPDX identifier';
        hint.className = 'spdx-hint spdx-hint--err';
      }
    };

    if (window.$) {
      $('#cff-license').on('change', function () { showHint(this.value); });
    }
    const sel = document.getElementById('cff-license');
    if (sel) sel.addEventListener('change', () => showHint(sel.value));
  };

  /* ════════════════════════════════════
     HOTKEYS
  ════════════════════════════════════ */

  const initHotkeys = () => {
    const tabs = ['overview','authors','identifiers','references','preferred-citation','validator','preview','import-export'];

    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName;
        const inInput = ['INPUT', 'TEXTAREA'].includes(tag);

        // Ctrl+S
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 's') {
          e.preventDefault(); exportAs('cff'); return;
        }
        // Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          e.preventDefault(); copyToClipboard(); return;
        }
        // Ctrl+Shift+V
        if (e.ctrlKey && e.shiftKey && e.key === 'V') {
          e.preventDefault(); UI.switchTab('validator'); setTimeout(runValidation, 100); return;
        }
        // Ctrl+Z (outside inputs)
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'z' && !inInput) {
          e.preventDefault(); undo(); return;
        }
        // Ctrl+1..8
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < tabs.length) {
            e.preventDefault(); UI.switchTab(tabs[idx]); return;
          }
        }
        // ? (outside inputs)
        if (e.key === '?' && !inInput) {
          document.getElementById('shortcuts-modal-overlay')?.classList.add('open'); return;
        }
        // Esc
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); return;
        }
        // Alt+T
        if (e.altKey && e.key === 't') {
          e.preventDefault(); document.getElementById('theme-toggle')?.click(); return;
        }
      });
  };

  /* ════════════════════════════════════
     TOUR
  ════════════════════════════════════ */

  const initTour = () => {
    document.getElementById('tour-btn').addEventListener('click', startTour);
  };

  const startTour = () => {
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
      },
    });

    const steps = [
      {
        id: 'welcome',
        text: `<strong>Welcome to CFFGen!</strong><br><br>This tour will walk you through the main features. CFFGen helps you create professional <code>CITATION.cff</code> files for your software and datasets.`,
        attachTo: { element: '.brand', on: 'right' },
        buttons: [{ text: 'Skip Tour', action: tour.cancel }, { text: 'Start →', action: tour.next }],
      },
      {
        id: 'overview',
        text: `<strong>Overview Tab</strong><br><br>Fill in basic metadata: title, version, license, and URLs. Required fields are marked with a red asterisk.`,
        attachTo: { element: '[data-tab="overview"]', on: 'right' },
        buttons: [{ text: '← Back', action: tour.back }, { text: 'Next →', action: tour.next }],
        beforeShowPromise: () => new Promise(r => { UI.switchTab('overview'); setTimeout(r, 200); }),
      },
      {
        id: 'authors',
        text: `<strong>Authors Tab</strong><br><br>Add people and organizations who authored the work. You can drag to reorder, and even fetch contributors from GitHub automatically!`,
        attachTo: { element: '[data-tab="authors"]', on: 'right' },
        buttons: [{ text: '← Back', action: tour.back }, { text: 'Next →', action: tour.next }],
        beforeShowPromise: () => new Promise(r => { UI.switchTab('authors'); setTimeout(r, 200); }),
      },
      {
        id: 'preview',
        text: `<strong>Live Preview</strong><br><br>See your CITATION.cff rendered in real time. Switch between CFF YAML, BibTeX, APA, MLA, and JSON-LD formats.`,
        attachTo: { element: '[data-tab="preview"]', on: 'right' },
        buttons: [{ text: '← Back', action: tour.back }, { text: 'Next →', action: tour.next }],
        beforeShowPromise: () => new Promise(r => { UI.switchTab('preview'); setTimeout(r, 200); }),
      },
      {
        id: 'validator',
        text: `<strong>Validator</strong><br><br>Run validation to check your file against the CFF specification. See a completeness score and fix any errors before publishing.`,
        attachTo: { element: '[data-tab="validator"]', on: 'right' },
        buttons: [{ text: '← Back', action: tour.back }, { text: 'Next →', action: tour.next }],
        beforeShowPromise: () => new Promise(r => { UI.switchTab('validator'); setTimeout(r, 200); }),
      },
      {
        id: 'export',
        text: `<strong>Export</strong><br><br>Download your <code>CITATION.cff</code> file, export to BibTeX/RIS/JSON-LD/CodeMeta, or copy to clipboard. Press <kbd>Ctrl+S</kbd> anytime to download!`,
        attachTo: { element: '#quick-download-btn', on: 'bottom' },
        buttons: [{ text: '← Back', action: tour.back }, { text: 'Finish!', action: tour.complete }],
        beforeShowPromise: () => new Promise(r => { UI.switchTab('overview'); setTimeout(r, 200); }),
      },
    ];

    steps.forEach(s => tour.addStep(s));
    tour.start();
  };

  /* ════════════════════════════════════
     FORM LISTENERS
  ════════════════════════════════════ */

  const attachFormListeners = () => {
    // All text inputs in overview tab
    const ids = [
      'cff-version','cff-message','cff-title','cff-version-val',
      'cff-date-released','cff-abstract','cff-license-url','cff-doi',
      'cff-url','cff-repository','cff-repository-code','cff-repository-artifact',
      'pc-type','pc-title','pc-year','pc-doi','pc-journal',
      'pc-volume','pc-issue','pc-pages','pc-url',
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', debouncedUpdate);
    });

    // Select elements
    ['cff-version', 'pc-type'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', debouncedUpdate);
    });

    // License Select2
    if (window.$) $('#cff-license').on('change', debouncedUpdate);

    // Abstract char count
    const abstract = document.getElementById('cff-abstract');
    if (abstract) {
      abstract.addEventListener('input', () => {
        const c = document.getElementById('abstract-count');
        if (c) c.textContent = abstract.value.length;
      });
    }
  };

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */

  const init = async () => {
    // Initialize all modules
    UI.init();
    UI.initPreferredCitationToggle();
    UI.initTypeSelector();
    UI.initAbstractCounter();
    UI.initKeywordsInput();

    Authors.init();
    References.init();
    ImportExport.init();
    Templates.init();
    Zenodo.init();

    attachFormListeners();
    initLicenseSPDXHint();
    initHotkeys();
    initTour();

    // Restore last tab
    const lastTab = Utils.storage.get('cffgen-active-tab', 'overview');
    UI.switchTab(lastTab);

    // Load autosave
    setTimeout(() => loadAutosave(), 600);

    // Start autosave timer
    startAutosaveTimer();

    // Initial preview render
    setTimeout(() => {
      UI.refreshPreview();
      UI.updateProgress(state);
    }, 300);

    // Close loading screen
    const loading = document.getElementById('loading-screen');
    if (loading) {
      setTimeout(() => loading.classList.add('hidden'), 1400);
    }

    // Close all modals on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
      }
    });

    // Confirm modals close on background click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !overlay.id.includes('confirm')) {
          overlay.classList.remove('open');
        }
      });
    });

    console.log('%cCFFGen v2.0.0 initialized ✓', 'color:#6C63FF;font-weight:700;font-size:14px');
  };

  /* ════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════ */

  return {
    get state() { return state; },
    set state(s) { state = s; },
    getState: () => state,
    init,
    update, debouncedUpdate, runValidation,
    exportAs, copyToClipboard,
    clearAll, undo,
    applyStateToUI,
  };

})();

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', async () => {
  // Update loading text while fetching SPDX licenses
  const loaderText = document.querySelector('.loader-text');
  if (loaderText) loaderText.textContent = 'Fetching SPDX license list…';

  await CFFData.loadSPDXLicenses();

  if (loaderText) loaderText.textContent = 'Initializing workspace…';
  CFFGen.init();
});
