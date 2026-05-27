/* ═══════════════════════════════════════════════
   CFFGen — templates.js
   Template gallery, fuzzy search, apply template
   ═══════════════════════════════════════════════ */

const Templates = (() => {

  let fuse = null;

  const init = () => {
    renderGallery(CFFData.TEMPLATES);
    initSearch();
  };

  /* ─── Render gallery ─── */
  const renderGallery = (templates) => {
    const grid = document.getElementById('templates-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!templates.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-layer-group"></i>
          <p>No templates match your search</p>
        </div>`;
      return;
    }

    templates.forEach((tpl, i) => {
      const card = document.createElement('div');
      card.className = 'template-card stagger';
      card.style.animationDelay = (i * 0.05) + 's';
      card.innerHTML = `
        <div class="template-icon" style="background:${tpl.iconColor}22;color:${tpl.iconColor}">
          <i class="${tpl.icon}"></i>
        </div>
        <div class="template-name">${Utils.escapeHtml(tpl.name)}</div>
        <div class="template-desc">${Utils.escapeHtml(tpl.description)}</div>
        <div class="template-tags">
          ${(tpl.tags || []).map(t => `<span class="template-tag">${Utils.escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="template-apply-btn">
          <button class="btn btn--primary btn--sm" style="width:100%;justify-content:center">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Use Template
          </button>
        </div>`;

      card.querySelector('button').addEventListener('click', () => applyTemplate(tpl));
      grid.appendChild(card);
    });
  };

  /* ─── Fuzzy search ─── */
  const initSearch = () => {
    fuse = new Fuse(CFFData.TEMPLATES, {
      keys: ['name', 'description', 'tags'],
      threshold: 0.4,
      includeScore: true,
    });

    const searchInput = document.getElementById('template-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', Utils.debounce(() => {
      const query = searchInput.value.trim();
      if (!query) {
        renderGallery(CFFData.TEMPLATES);
      } else {
        const results = fuse.search(query).map(r => r.item);
        renderGallery(results);
      }
    }, 200));
  };

  /* ─── Apply template ─── */
  const applyTemplate = async (tpl) => {
    const ok = await Utils.confirm(
      `Use "${tpl.name}" Template`,
      'This will overwrite your current data with template values. Continue?',
      'Apply Template'
    );
    if (!ok) return;

    NProgress.start();
    const data = tpl.data;
    const state = CFFGen.state;

    // Reset state
    CFFGen.clearAll(true /* silent */);

    // Apply fields
    const setF = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };

    setF('cff-version',            data['cff-version'] || '1.2.0');
    setF('cff-message',            data.message || '');
    setF('cff-title',              data.title   || '');
    setF('cff-version-val',        data.version ? String(data.version) : '');
    setF('cff-date-released',      data['date-released'] || '');
    setF('cff-abstract',           data.abstract || '');
    setF('cff-doi',                data.doi || '');
    setF('cff-url',                data.url || '');
    setF('cff-repository',         data.repository || '');
    setF('cff-repository-code',    data['repository-code'] || '');
    setF('cff-repository-artifact',data['repository-artifact'] || '');
    setF('cff-license-url',        data['license-url'] || '');

    // License
    if (data.license && window.$) {
      $('#cff-license').val(data.license).trigger('change');
    }

    // Type
    if (data.type) {
      document.getElementById('cff-type').value = data.type;
      document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === data.type);
      });
    }

    // Keywords
    if (Array.isArray(data.keywords)) {
      state.keywords = [...data.keywords];
      rebuildKeywordTags();
    }

    // Authors
    if (Array.isArray(data.authors)) {
      state.authors = data.authors.map(a => ({ ...a }));
      Authors.renderList(state.authors, 'authors-list', 'authors-empty', 'main');
      Authors.updateCount('authors-count', state.authors.length, 'author');
    }

    // Identifiers
    if (Array.isArray(data.identifiers)) {
      state.identifiers = [...data.identifiers];
      References.renderIdentifiers();
    }

    // Preferred citation
    if (data['preferred-citation']) {
      const pc = { ...data['preferred-citation'], enabled: true };
      state['preferred-citation'] = pc;
      document.getElementById('enable-preferred-citation').checked = true;
      document.getElementById('preferred-citation-fields').classList.add('expanded');
      // Populate PC fields
      const setPC = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
      setPC('pc-type',    pc.type);
      setPC('pc-title',   pc.title);
      setPC('pc-year',    pc.year);
      setPC('pc-doi',     pc.doi);
      setPC('pc-journal', pc.journal || '');
      if (Array.isArray(pc.authors)) {
        state['preferred-citation'].authors = pc.authors;
        Authors.renderList(pc.authors, 'pc-authors-list', 'pc-authors-empty', 'pc');
      }
    }

    // Update abstract count
    const abstractCount = document.getElementById('abstract-count');
    const abstractEl = document.getElementById('cff-abstract');
    if (abstractCount && abstractEl) abstractCount.textContent = abstractEl.value.length;

    NProgress.done();
    CFFGen.debouncedUpdate();
    UI.switchTab('overview');
    Utils.toast(`Template "${tpl.name}" applied!`, 'success');
  };

  /* ─── Rebuild keyword tag chips ─── */
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

  return { init, applyTemplate, renderGallery };
})();
