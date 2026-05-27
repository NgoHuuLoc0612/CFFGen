/* ═══════════════════════════════════════════════
   CFFGen — import-export.js
   File drag-drop, URL fetch, GitHub import, all exports
   ═══════════════════════════════════════════════ */

const ImportExport = (() => {

  /* ════════════════════════════════════
     IMPORT
  ════════════════════════════════════ */

  const init = () => {
    initDropZone();
    initFileInput();
    initURLImport();
    initGitHubImport();
  };

  /* ─── Drop Zone ─── */
  const initDropZone = () => {
    const zone = document.getElementById('import-drop-zone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    zone.addEventListener('click', () => document.getElementById('import-file-input').click());
  };

  /* ─── File Input ─── */
  const initFileInput = () => {
    const input = document.getElementById('import-file-input');
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
      input.value = '';
    });
  };

  /* ─── Handle uploaded file ─── */
  const handleFile = async (file) => {
    NProgress.start();
    try {
      const text = await file.text();
      const ext  = file.name.split('.').pop().toLowerCase();

      if (ext === 'cff' || ext === 'yaml' || ext === 'yml') {
        importCFF(text);
      } else if (ext === 'bib') {
        importBibTeXFile(text);
      } else if (ext === 'json') {
        importJSON(text);
      } else {
        // Try CFF/YAML first, fall back
        try { importCFF(text); }
        catch { Utils.toast('Unsupported file format', 'error'); }
      }
    } catch (e) {
      Utils.toast('Error reading file: ' + e.message, 'error');
    } finally {
      NProgress.done();
    }
  };

  /* ─── URL Import ─── */
  const initURLImport = () => {
    const btn   = document.getElementById('import-url-btn');
    const input = document.getElementById('import-url-input');
    if (!btn || !input) return;

    btn.addEventListener('click', () => fetchFromURL(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchFromURL(input.value.trim()); });
  };

  const fetchFromURL = async (url) => {
    if (!url) { Utils.toast('Enter a URL first', 'warning'); return; }
    if (!Utils.isValidUrl(url)) { Utils.toast('Invalid URL format', 'error'); return; }

    NProgress.start();
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const text = await resp.text();

      // Determine format by content or URL
      if (url.endsWith('.bib')) importBibTeXFile(text);
      else if (url.endsWith('.json')) importJSON(text);
      else importCFF(text);

    } catch (e) {
      // CORS might block — suggest raw GitHub URL
      Utils.toast('Fetch failed: ' + e.message + '. Try a raw.githubusercontent.com URL.', 'error');
    } finally {
      NProgress.done();
    }
  };

  /* ─── GitHub Shorthand ─── */
  const initGitHubImport = () => {
    const btn   = document.getElementById('import-github-btn');
    const input = document.getElementById('import-github-input');
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      let val = input.value.trim();
      if (!val) { Utils.toast('Enter owner/repo', 'warning'); return; }
      // Allow full GitHub URLs too
      const match = val.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) val = match[1];
      const raw = `https://raw.githubusercontent.com/${val}/HEAD/CITATION.cff`;
      fetchFromURL(raw);
    });

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  };

  /* ─── Import CFF YAML ─── */
  const importCFF = (text) => {
    let parsed;
    try {
      parsed = jsyaml.load(text);
    } catch (e) {
      Utils.toast('Invalid YAML: ' + e.message, 'error');
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      Utils.toast('Could not parse CITATION.cff content', 'error');
      return;
    }

    // Map parsed YAML → app state
    const state = CFFGen.state;

    // Overview fields
    if (parsed['cff-version'])            setField('cff-version',            parsed['cff-version']);
    if (parsed.message)                   setField('cff-message',             parsed.message);
    if (parsed.type)                      setTypeField(parsed.type);
    if (parsed.title)                     setField('cff-title',               parsed.title);
    if (parsed.version != null)           setField('cff-version-val',         String(parsed.version));
    if (parsed['date-released'])          setField('cff-date-released',       parsed['date-released']);
    if (parsed.abstract)                  setField('cff-abstract',            parsed.abstract);
    if (parsed.license)                   setSelect2('cff-license',           parsed.license);
    if (parsed['license-url'])            setField('cff-license-url',         parsed['license-url']);
    if (parsed.doi)                       setField('cff-doi',                 parsed.doi);
    if (parsed.url)                       setField('cff-url',                 parsed.url);
    if (parsed.repository)                setField('cff-repository',          parsed.repository);
    if (parsed['repository-code'])        setField('cff-repository-code',     parsed['repository-code']);
    if (parsed['repository-artifact'])    setField('cff-repository-artifact', parsed['repository-artifact']);

    // Keywords
    if (Array.isArray(parsed.keywords)) {
      state.keywords = parsed.keywords.map(String);
      rebuildKeywordTags();
    }

    // Authors
    if (Array.isArray(parsed.authors)) {
      state.authors = parsed.authors.map(normalizeAuthor);
      Authors.renderList(state.authors, 'authors-list', 'authors-empty', 'main');
      Authors.updateCount('authors-count', state.authors.length, 'author');
    }

    // Identifiers
    if (Array.isArray(parsed.identifiers)) {
      state.identifiers = parsed.identifiers;
      References.renderIdentifiers();
    }

    // References
    if (Array.isArray(parsed.references)) {
      state.references = parsed.references.map(normalizeReference);
      References.renderReferences();
    }

    // Preferred citation
    if (parsed['preferred-citation']) {
      const pc = normalizeReference(parsed['preferred-citation']);
      pc.enabled = true;
      state['preferred-citation'] = pc;
      document.getElementById('enable-preferred-citation').checked = true;
      document.getElementById('preferred-citation-fields').classList.add('expanded');
      populatePCFields(pc);
    }

    CFFGen.debouncedUpdate();
    updateAbstractCount();
    Utils.toast('CITATION.cff imported successfully!', 'success');

    // Switch to overview
    UI.switchTab('overview');
  };

  /* ─── Import BibTeX as references ─── */
  const importBibTeXFile = (text) => {
    // Delegate to References' parser
    document.getElementById('bibtex-input').value = text;
    Utils.openModal('bibtex-modal');
    setTimeout(() => document.getElementById('bibtex-parse-btn').click(), 150);
  };

  /* ─── Import JSON (CodeMeta / JSON-LD) ─── */
  const importJSON = (text) => {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { Utils.toast('Invalid JSON: ' + e.message, 'error'); return; }

    const state = CFFGen.state;

    // Map schema.org / codemeta fields
    if (obj.name)         setField('cff-title', obj.name);
    if (obj.description)  setField('cff-abstract', obj.description);
    if (obj.version)      setField('cff-version-val', obj.version);
    if (obj.datePublished) setField('cff-date-released', obj.datePublished);
    if (obj.codeRepository) setField('cff-repository-code', obj.codeRepository);
    if (obj.url)          setField('cff-url', obj.url);

    // License
    if (obj.license) {
      const lic = obj.license.split('/').pop().replace('.html','').replace('.txt','');
      setSelect2('cff-license', lic);
    }

    // Keywords
    if (typeof obj.keywords === 'string') {
      state.keywords = obj.keywords.split(',').map(k => k.trim()).filter(Boolean);
    } else if (Array.isArray(obj.keywords)) {
      state.keywords = obj.keywords;
    }
    rebuildKeywordTags();

    // Authors
    const rawAuthors = obj.author ? (Array.isArray(obj.author) ? obj.author : [obj.author]) : [];
    state.authors = rawAuthors.map(a => {
      if (a['@type'] === 'Organization') return { type: 'entity', name: a.name };
      return {
        type: 'person',
        'given-names': a.givenName || (a.name ? a.name.split(' ').slice(0,-1).join(' ') : ''),
        'family-names': a.familyName || (a.name ? a.name.split(' ').pop() : ''),
        ...(a['@id'] ? { orcid: a['@id'] } : {}),
        ...(a.email ? { email: a.email } : {}),
        ...(a.affiliation?.name ? { affiliation: a.affiliation.name } : {}),
      };
    });

    if (state.authors.length) {
      Authors.renderList(state.authors, 'authors-list', 'authors-empty', 'main');
      Authors.updateCount('authors-count', state.authors.length, 'author');
    }

    CFFGen.debouncedUpdate();
    Utils.toast('JSON metadata imported!', 'success');
    UI.switchTab('overview');
  };

  /* ─── Helpers ─── */
  const setField = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  const setSelect2 = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Check if Select2 is active on this element
    if (el.classList.contains('license-select2') && window.$) {
      $(`#${id}`).val(val).trigger('change');
    } else {
      el.value = val;
    }
  };

  const setTypeField = (type) => {
    document.getElementById('cff-type').value = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === type);
    });
  };

  const normalizeAuthor = (a) => {
    if (a.name && !a['family-names'] && !a['given-names']) {
      return { type: 'entity', name: a.name, email: a.email, website: a.website, alias: a.alias, location: a.location };
    }
    return {
      type: 'person',
      'family-names': a['family-names'] || '',
      'given-names':  a['given-names']  || '',
      'name-particle': a['name-particle'] || '',
      'name-suffix':  a['name-suffix']  || '',
      email:       a.email       || '',
      website:     a.website     || '',
      orcid:       a.orcid       || '',
      affiliation: a.affiliation || '',
      alias:       a.alias       || '',
    };
  };

  const normalizeReference = (ref) => {
    // Reverse-engineer journal/publisher from CFF nested objects
    const journal = ref['journal-title'] || ref.publisher?.name || ref.conference?.name || ref.institution?.name || '';
    const pages = (ref.start && ref.end) ? `${ref.start}-${ref.end}` : (ref.pages || '');
    return {
      type:      ref.type  || 'misc',
      title:     ref.title || '',
      year:      ref.year  || null,
      doi:       ref.doi   || '',
      url:       ref.url   || '',
      journal,
      volume:    ref.volume || '',
      issue:     ref.issue  || '',
      pages,
      isbn:      ref.isbn   || '',
      issn:      ref.issn   || '',
      notes:     ref.notes  || ref.abstract || '',
      authors:   Array.isArray(ref.authors) ? ref.authors.map(normalizeAuthor) : [],
    };
  };

  const populatePCFields = (pc) => {
    const setV = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
    setV('pc-type',    pc.type);
    setV('pc-title',   pc.title);
    setV('pc-year',    pc.year);
    setV('pc-doi',     pc.doi);
    setV('pc-journal', pc.journal || pc['journal-title'] || pc.publisher?.name || '');
    setV('pc-volume',  pc.volume);
    setV('pc-issue',   pc.issue);
    setV('pc-pages',   pc.pages || (pc.start && pc.end ? `${pc.start}-${pc.end}` : ''));
    setV('pc-url',     pc.url);
    if (Array.isArray(pc.authors)) {
      Authors.renderList(pc.authors, 'pc-authors-list', 'pc-authors-empty', 'pc');
    }
  };

  const rebuildKeywordTags = () => {
    const tagsDisplay = document.getElementById('keywords-tags');
    if (!tagsDisplay) return;
    tagsDisplay.innerHTML = '';
    CFFGen.state.keywords.forEach(kw => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `${Utils.escapeHtml(kw)}<button class="tag-remove"><i class="fa-solid fa-xmark"></i></button>`;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        CFFGen.state.keywords = CFFGen.state.keywords.filter(k => k !== kw);
        chip.remove();
        CFFGen.debouncedUpdate();
      });
      tagsDisplay.appendChild(chip);
    });
  };

  const updateAbstractCount = () => {
    const ta = document.getElementById('cff-abstract');
    const counter = document.getElementById('abstract-count');
    if (ta && counter) counter.textContent = ta.value.length;
  };

  /* ════════════════════════════════════
     EXPORT
  ════════════════════════════════════ */

  const exportCFF = (state) => {
    const indent = parseInt(UI.getSettings().indent) || 2;
    const content = Generator.toCFF(state, indent);
    Utils.downloadText(content, 'CITATION.cff', 'text/plain');
    celebrate();
    Utils.toast('CITATION.cff downloaded!', 'success');
  };

  const exportBibTeX = (state) => {
    const content = Generator.toBibTeX(state);
    Utils.downloadText(content, 'citation.bib', 'text/plain');
    Utils.toast('BibTeX exported!', 'success');
  };

  const exportRIS = (state) => {
    const content = Generator.toRIS(state);
    Utils.downloadText(content, 'citation.ris', 'text/plain');
    Utils.toast('RIS exported!', 'success');
  };

  const exportJSONLD = (state) => {
    const content = Generator.toJSONLD(state);
    Utils.downloadText(content, 'citation.jsonld', 'application/ld+json');
    Utils.toast('JSON-LD exported!', 'success');
  };

  const exportCodeMeta = (state) => {
    const content = Generator.toCodeMeta(state);
    Utils.downloadText(content, 'codemeta.json', 'application/json');
    Utils.toast('codemeta.json exported!', 'success');
  };

  const copyToClipboard = (state) => {
    const indent = parseInt(UI.getSettings().indent) || 2;
    const content = Generator.toCFF(state, indent);
    Utils.copyText(content).then(ok => {
      if (ok) {
        Utils.toast('Copied to clipboard!', 'success');
        celebrate(true);
      } else {
        Utils.toast('Could not copy to clipboard', 'error');
      }
    });
  };

  /* ─── Confetti celebration ─── */
  const celebrate = (mini = false) => {
    if (typeof confetti !== 'undefined') {
      if (mini) {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 }, colors: ['#6C63FF','#a78bfa','#00C9A7'] });
      } else {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: ['#6C63FF','#a78bfa','#00C9A7','#FF6584'] });
        setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.2, y: 0.6 } }), 200);
        setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.8, y: 0.6 } }), 400);
      }
    }
  };

  return {
    init,
    exportCFF, exportBibTeX, exportRIS, exportJSONLD, exportCodeMeta,
    copyToClipboard, importCFF, celebrate,
  };
})();
