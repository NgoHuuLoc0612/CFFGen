/* ═══════════════════════════════════════════════
   CFFGen — ui.js
   Tabs, sidebar, theme, CodeMirror, preview
   ═══════════════════════════════════════════════ */

const UI = (() => {

  let previewEditor = null;
  let currentPreviewMode = 'cff';
  let settings = {
    theme: 'dark',
    fontSize: 13,
    cmTheme: 'dracula',
    indent: 2,
    autosave: true,
    realtime: true,
    accent: '#6C63FF'
  };

  /* ─── Init ─── */
  const init = () => {
    loadSettings();
    initTheme();
    initSidebar();
    initTabs();
    initTopbar();
    initCodeMirror();
    initPreviewTabs();
    initTooltips();
    initFAB();
    initLicenseSelect();
    initDatepickers();
    initThemeSwitcher();
    initSettingsControls();
    initKeyboardHints();
    initMobileMenu();
  };

  /* ─── Settings ─── */
  const loadSettings = () => {
    const saved = Utils.storage.get('cffgen-settings');
    if (saved) settings = { ...settings, ...saved };
  };
  const saveSettings = () => Utils.storage.set('cffgen-settings', settings);

  /* ─── Theme ─── */
  const initTheme = () => {
    applyTheme(settings.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(settings.theme);
      saveSettings();
    });
  };

  const applyTheme = (theme) => {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    settings.theme = theme;

    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = resolved === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    // Update CodeMirror theme
    if (previewEditor) {
      const cmTheme = resolved === 'dark' ? (settings.cmTheme || 'dracula') : 'eclipse';
      previewEditor.setOption('theme', cmTheme);
    }

    // Update active theme-opt buttons
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  };

  /* ─── Sidebar ─── */
  const initSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const toggleBtn = document.getElementById('sidebar-toggle');

    const collapsed = Utils.storage.get('cffgen-sidebar-collapsed', false);
    if (collapsed) {
      sidebar.classList.add('collapsed');
      mainContent.classList.add('sidebar-collapsed');
    }

    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('sidebar-collapsed', isCollapsed);
      Utils.storage.set('cffgen-sidebar-collapsed', isCollapsed);
    });
  };

  /* ─── Mobile Menu ─── */
  const initMobileMenu = () => {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:299;display:none';
    document.body.appendChild(overlay);

    btn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      overlay.style.display = 'block';
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.style.display = 'none';
    });
  };

  /* ─── Tabs ─── */
  const initTabs = () => {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');

    navItems.forEach((item, i) => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
  };

  const switchTab = (tab) => {
    document.querySelectorAll('.nav-item[data-tab]').forEach(i => {
      i.classList.toggle('active', i.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tab);
    });

    // Update breadcrumb
    const labelMap = {
      'overview': 'Overview', 'authors': 'Authors', 'identifiers': 'Identifiers',
      'references': 'References', 'preferred-citation': 'Preferred Citation',
      'validator': 'Validator', 'preview': 'Live Preview',
      'import-export': 'Import / Export', 'templates': 'Templates', 'settings': 'Settings'
    };
    const bcEl = document.getElementById('bc-current');
    if (bcEl) bcEl.textContent = labelMap[tab] || tab;

    // Refresh preview when switching to it
    if (tab === 'preview') refreshPreview();
    if (tab === 'validator') {/* lazy */}

    Utils.storage.set('cffgen-active-tab', tab);
  };

  /* ─── Topbar ─── */
  const initTopbar = () => {
    document.getElementById('quick-validate-btn').addEventListener('click', () => {
      switchTab('validator');
      setTimeout(() => CFFGen.runValidation(), 100);
    });
    document.getElementById('quick-copy-btn').addEventListener('click', () => CFFGen.copyToClipboard());
    document.getElementById('quick-download-btn').addEventListener('click', () => CFFGen.exportAs('cff'));
  };

  /* ─── CodeMirror Preview ─── */
  const initCodeMirror = () => {
    const textarea = document.getElementById('preview-editor');
    if (!textarea) return;

    previewEditor = CodeMirror.fromTextArea(textarea, {
      mode: 'yaml',
      theme: settings.theme === 'light' ? 'eclipse' : (settings.cmTheme || 'dracula'),
      lineNumbers: true,
      matchBrackets: true,
      styleActiveLine: true,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      readOnly: false,
      lineWrapping: false,
      fontSize: settings.fontSize,
      extraKeys: {
        'Ctrl-Z': (cm) => cm.undo(),
        'Ctrl-Y': (cm) => cm.redo(),
      }
    });

    previewEditor.setSize('100%', null);

    // Apply font size
    document.querySelector('.CodeMirror').style.fontSize = settings.fontSize + 'px';
  };

  /* ─── Preview Tabs ─── */
  const initPreviewTabs = () => {
    document.querySelectorAll('.preview-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPreviewMode = btn.dataset.preview;
        refreshPreview();

        // Update CodeMirror mode
        if (!previewEditor) return;
        const modeMap = {
          cff: 'yaml', bibtex: 'text/x-latex', apa: 'text/plain',
          mla: 'text/plain', json: 'application/json'
        };
        previewEditor.setOption('mode', modeMap[currentPreviewMode] || 'text/plain');
      });
    });

    // Copy preview button
    document.getElementById('copy-preview-btn').addEventListener('click', () => {
      if (!previewEditor) return;
      Utils.copyText(previewEditor.getValue()).then(ok => {
        Utils.toast(ok ? 'Copied to clipboard!' : 'Copy failed', ok ? 'success' : 'error');
      });
    });

    // Word wrap toggle
    document.getElementById('wrap-toggle-btn').addEventListener('click', () => {
      if (!previewEditor) return;
      const current = previewEditor.getOption('lineWrapping');
      previewEditor.setOption('lineWrapping', !current);
    });

    // Fullscreen
    const fsBtn = document.getElementById('fullscreen-preview-btn');
    const wrap = document.getElementById('preview-editor-wrap');
    fsBtn.addEventListener('click', () => {
      const isFs = wrap.classList.toggle('fullscreen');
      fsBtn.querySelector('i').className = isFs ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
      if (previewEditor) setTimeout(() => previewEditor.refresh(), 50);

      if (isFs) {
        const exitBtn = document.createElement('button');
        exitBtn.className = 'fullscreen-exit-btn';
        exitBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        exitBtn.onclick = () => fsBtn.click();
        exitBtn.id = 'fs-exit-btn';
        document.body.appendChild(exitBtn);
      } else {
        document.getElementById('fs-exit-btn')?.remove();
      }
    });
  };

  /* ─── Refresh Preview ─── */
  const refreshPreview = () => {
    if (!previewEditor) return;
    const state = CFFGen ? CFFGen.getState() : {};

    let content = '';
    try {
      const indent = parseInt(settings.indent) || 2;
      switch (currentPreviewMode) {
        case 'cff':     content = Generator.toCFF(state, indent); break;
        case 'bibtex':  content = Generator.toBibTeX(state); break;
        case 'apa':     content = Generator.toAPA(state); break;
        case 'mla':     content = Generator.toMLA(state); break;
        case 'json':    content = Generator.toJSONLD(state); break;
        default:        content = Generator.toCFF(state, indent);
      }
    } catch (e) {
      content = '# Error generating preview: ' + e.message;
    }

    const cursor = previewEditor.getCursor();
    previewEditor.setValue(content);
    previewEditor.setCursor(cursor);
  };

  /* ─── Tooltips (Tippy) ─── */
  const initTooltips = () => {
    document.querySelectorAll('[data-tippy]').forEach(el => {
      tippy(el, {
        content: el.dataset.tippy,
        theme: 'custom',
        placement: 'top',
        arrow: true,
        delay: [300, 0],
        maxWidth: 240,
      });
    });
  };

  const refreshTooltips = () => {
    document.querySelectorAll('[data-tippy]:not([data-tippy-initialized])').forEach(el => {
      el.setAttribute('data-tippy-initialized', 'true');
      tippy(el, {
        content: el.dataset.tippy,
        theme: 'custom',
        placement: 'top',
        arrow: true,
        delay: [300, 0],
        maxWidth: 240,
      });
    });
  };

  /* ─── FAB ─── */
  const initFAB = () => {
    const fabGroup = document.getElementById('fab-group');
    const fabMain = document.getElementById('fab-main');
    fabMain.addEventListener('click', () => {
      fabGroup.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!fabGroup.contains(e.target)) fabGroup.classList.remove('open');
    });
  };

  /* ─── License Select2 ─── */
  const initLicenseSelect = () => {
    const data = [{ id: '', text: 'Select license...' }].concat(
      CFFData.SPDX_LICENSES.map(l => ({ id: l, text: l }))
    );

    $('#cff-license').select2({
      data,
      placeholder: 'Select license...',
      allowClear: true,
      width: '100%',
    });

    $('#cff-license').on('change', () => CFFGen.debouncedUpdate());
  };

  /* ─── Datepickers ─── */
  const initDatepickers = () => {
    document.querySelectorAll('.datepicker').forEach(inp => {
      flatpickr(inp, {
        dateFormat: 'Y-m-d',
        allowInput: true,
        disableMobile: false,
      });
    });
  };

  /* ─── Theme Switcher (settings) ─── */
  const initThemeSwitcher = () => {
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
        saveSettings();
      });
    });

    // Color swatches
    document.querySelectorAll('.swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        settings.accent = sw.dataset.color;
        applyAccent(settings.accent);
        saveSettings();
      });
    });

    const customAccent = document.getElementById('custom-accent');
    customAccent.addEventListener('input', () => {
      settings.accent = customAccent.value;
      applyAccent(settings.accent);
    });
    customAccent.addEventListener('change', saveSettings);

    // Apply saved accent
    applyAccent(settings.accent);
  };

  const applyAccent = (color) => {
    document.documentElement.style.setProperty('--accent', color);
    // Generate light version
    document.documentElement.style.setProperty('--accent-light', color + '20');
    document.documentElement.style.setProperty('--accent-glow', color + '60');
    document.documentElement.style.setProperty('--accent-dark', adjustColor(color, -20));
  };

  const adjustColor = (hex, amount) => {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  };

  /* ─── Settings Controls ─── */
  const initSettingsControls = () => {
    // Font size slider
    const slider = document.getElementById('font-size-slider');
    const sliderVal = document.getElementById('font-size-val');
    if (slider) {
      slider.value = settings.fontSize;
      sliderVal.textContent = settings.fontSize + 'px';
      slider.addEventListener('input', () => {
        settings.fontSize = parseInt(slider.value);
        sliderVal.textContent = settings.fontSize + 'px';
        document.querySelector('.CodeMirror').style.fontSize = settings.fontSize + 'px';
        if (previewEditor) previewEditor.refresh();
        saveSettings();
      });
    }

    // CodeMirror theme
    const cmThemeSel = document.getElementById('setting-cm-theme');
    if (cmThemeSel) {
      cmThemeSel.value = settings.cmTheme;
      cmThemeSel.addEventListener('change', () => {
        settings.cmTheme = cmThemeSel.value;
        if (previewEditor) previewEditor.setOption('theme', settings.cmTheme);
        saveSettings();
      });
    }

    // Indent
    const indentSel = document.getElementById('setting-indent');
    if (indentSel) {
      indentSel.value = settings.indent;
      indentSel.addEventListener('change', () => {
        settings.indent = parseInt(indentSel.value);
        saveSettings();
        refreshPreview();
      });
    }

    // Autosave toggle
    const autosave = document.getElementById('setting-autosave');
    if (autosave) {
      autosave.checked = settings.autosave;
      autosave.addEventListener('change', () => {
        settings.autosave = autosave.checked;
        saveSettings();
      });
    }

    // Realtime toggle
    const realtime = document.getElementById('setting-realtime');
    if (realtime) {
      realtime.checked = settings.realtime;
      realtime.addEventListener('change', () => {
        settings.realtime = realtime.checked;
        saveSettings();
      });
    }

    // Clear all
    document.getElementById('clear-all-btn').addEventListener('click', async () => {
      const ok = await Utils.confirm('Clear All Data', 'This will reset all form fields. Are you sure?', 'Clear Everything');
      if (ok) {
        CFFGen.clearAll();
        Utils.toast('All data cleared', 'info');
      }
    });

    // Export settings
    document.getElementById('export-settings-btn').addEventListener('click', () => {
      Utils.downloadText(JSON.stringify(settings, null, 2), 'cffgen-settings.json', 'application/json');
    });

    // Import settings
    document.getElementById('import-settings-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        Object.assign(settings, imported);
        applyTheme(settings.theme);
        applyAccent(settings.accent);
        saveSettings();
        Utils.toast('Settings imported!', 'success');
      } catch {
        Utils.toast('Invalid settings file', 'error');
      }
    });
  };

  /* ─── Keyboard Hints ─── */
  const initKeyboardHints = () => {
    const btn = document.getElementById('keyboard-shortcuts-btn');
    const overlay = document.getElementById('shortcuts-modal-overlay');
    const closeBtn = document.getElementById('shortcuts-modal-close');

    btn.addEventListener('click', () => overlay.classList.add('open'));
    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  };

  /* ─── Update progress ring ─── */
  const updateProgress = (state) => {
    const { score } = Validator.computeScore(state);
    Utils.setProgress(score);
  };

  /* ─── Preferred citation toggle ─── */
  const initPreferredCitationToggle = () => {
    const toggle = document.getElementById('enable-preferred-citation');
    const fields = document.getElementById('preferred-citation-fields');
    if (!toggle || !fields) return;

    toggle.addEventListener('change', () => {
      fields.classList.toggle('expanded', toggle.checked);
      CFFGen.debouncedUpdate();
    });
  };

  /* ─── Keywords tag input ─── */
  const initKeywordsInput = () => {
    const container = document.getElementById('keywords-container');
    const tagsDisplay = document.getElementById('keywords-tags');
    const input = document.getElementById('keywords-input');

    if (!container || !input) return;

    container.addEventListener('click', () => input.focus());

    const addTag = (val) => {
      const v = val.trim().replace(/,/g, '');
      if (!v) return;
      if (CFFGen.state.keywords.includes(v)) {
        Utils.toast('Keyword already exists', 'warning');
        return;
      }
      CFFGen.state.keywords.push(v);
      renderTag(v);
      input.value = '';
      CFFGen.debouncedUpdate();
    };

    const renderTag = (v) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `${Utils.escapeHtml(v)}<button class="tag-remove" aria-label="Remove ${v}"><i class="fa-solid fa-xmark"></i></button>`;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        CFFGen.state.keywords = CFFGen.state.keywords.filter(k => k !== v);
        chip.remove();
        CFFGen.debouncedUpdate();
      });
      tagsDisplay.appendChild(chip);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(input.value);
      } else if (e.key === 'Backspace' && input.value === '' && CFFGen.state.keywords.length > 0) {
        const last = CFFGen.state.keywords.pop();
        tagsDisplay.lastElementChild?.remove();
        CFFGen.debouncedUpdate();
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) addTag(input.value);
    });

    return { renderTag };
  };

  /* ─── Type selector ─── */
  const initTypeSelector = () => {
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('cff-type').value = btn.dataset.value;
        CFFGen.debouncedUpdate();
      });
    });
  };

  /* ─── Abstract char counter ─── */
  const initAbstractCounter = () => {
    const textarea = document.getElementById('cff-abstract');
    const counter = document.getElementById('abstract-count');
    if (!textarea || !counter) return;
    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length;
    });
  };

  return {
    init, switchTab, refreshPreview, updateProgress,
    initPreferredCitationToggle, initKeywordsInput,
    initTypeSelector, initAbstractCounter,
    refreshTooltips, applyTheme,
    getSettings: () => settings
  };
})();
