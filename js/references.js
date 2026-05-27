/* ═══════════════════════════════════════════════
   CFFGen — references.js
   References + Identifiers CRUD, BibTeX import, DOI fetch
   ═══════════════════════════════════════════════ */

const References = (() => {

  let editingRefIndex = null;
  let editingIdIndex  = null;
  let doiFetchedData  = null;
  let parsedBibtexEntries = [];

  /* ════════════════════════════════════
     IDENTIFIERS
  ════════════════════════════════════ */

  const openIdentifierModal = (index = null) => {
    editingIdIndex = index;
    const titleEl = document.querySelector('#identifier-modal .modal-title');
    if (titleEl) titleEl.textContent = index !== null ? 'Edit Identifier' : 'Add Identifier';

    document.getElementById('id-type').value   = 'doi';
    document.getElementById('id-value').value  = '';
    document.getElementById('id-description').value = '';

    if (index !== null) {
      const id = CFFGen.state.identifiers[index];
      if (id) {
        document.getElementById('id-type').value  = id.type || 'doi';
        document.getElementById('id-value').value = id.value || '';
        document.getElementById('id-description').value = id.description || '';
      }
    }
    Utils.openModal('identifier-modal');
  };

  const saveIdentifier = () => {
    const type  = document.getElementById('id-type').value.trim();
    const value = document.getElementById('id-value').value.trim();
    const desc  = document.getElementById('id-description').value.trim();

    if (!value) { Utils.toast('Identifier value is required', 'error'); return; }

    const data = { type, value, ...(desc ? { description: desc } : {}) };

    if (editingIdIndex !== null) {
      CFFGen.state.identifiers[editingIdIndex] = data;
    } else {
      CFFGen.state.identifiers.push(data);
    }

    renderIdentifiers();
    Utils.closeModal('identifier-modal');
    CFFGen.debouncedUpdate();
    Utils.toast('Identifier saved', 'success');
  };

  const renderIdentifiers = () => {
    const list  = document.getElementById('identifiers-list');
    const empty = document.getElementById('identifiers-empty');
    if (!list) return;

    list.querySelectorAll('.item-card').forEach(c => c.remove());

    const ids = CFFGen.state.identifiers || [];
    Authors.updateCount('identifiers-count', ids.length, 'identifier');

    if (ids.length === 0) { if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';

    const typeIcons = { doi: 'fa-quote-right', url: 'fa-link', swh: 'fa-code-branch', other: 'fa-tag' };
    const typeColors = { doi: 'var(--accent)', url: 'var(--info)', swh: 'var(--success)', other: 'var(--warning)' };

    ids.forEach((id, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-avatar" style="background:${typeColors[id.type]||'var(--accent)'}; border-radius:var(--radius-md)">
          <i class="fa-solid ${typeIcons[id.type]||'fa-tag'}"></i>
        </div>
        <div class="item-info">
          <div class="item-name">${Utils.escapeHtml(id.value)}</div>
          <div class="item-meta">
            <span class="item-meta-chip"><i class="fa-solid fa-tag"></i>${id.type.toUpperCase()}</span>
            ${id.description ? `<span class="item-meta-chip"><i class="fa-solid fa-note-sticky"></i>${Utils.escapeHtml(id.description)}</span>` : ''}
          </div>
        </div>
        <div class="item-actions">
          <button class="icon-btn edit-id-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" title="Remove" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      card.querySelector('.edit-id-btn').addEventListener('click', () => openIdentifierModal(i));
      card.querySelector('.icon-btn:last-child').addEventListener('click', async () => {
        const ok = await Utils.confirm('Remove Identifier', 'Remove this identifier?', 'Remove');
        if (!ok) return;
        CFFGen.state.identifiers.splice(i, 1);
        renderIdentifiers();
        CFFGen.debouncedUpdate();
      });
      list.appendChild(card);
    });
  };

  /* ════════════════════════════════════
     REFERENCES
  ════════════════════════════════════ */

  const openReferenceModal = (index = null) => {
    editingRefIndex = index;
    const titleEl = document.getElementById('reference-modal-title');
    if (titleEl) titleEl.textContent = index !== null ? 'Edit Reference' : 'Add Reference';

    clearReferenceModal();

    if (index !== null) {
      const ref = CFFGen.state.references[index];
      if (ref) populateReferenceModal(ref);
    }

    // Set up ref-authors add btn for this index
    const addRefAuthorBtn = document.getElementById('add-ref-author-btn');
    if (addRefAuthorBtn) {
      addRefAuthorBtn.onclick = () => Authors.openModal(`ref-${editingRefIndex ?? '__new__'}`, null);
    }

    Utils.openModal('reference-modal');
  };

  const clearReferenceModal = () => {
    ['ref-type','ref-title','ref-year','ref-doi','ref-url','ref-journal',
     'ref-volume','ref-issue','ref-pages','ref-conference','ref-isbn','ref-issn','ref-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'ref-type' ? 'article' : '';
    });
    const list = document.getElementById('ref-authors-list');
    if (list) list.querySelectorAll('.item-card').forEach(c => c.remove());
    const empty = document.getElementById('ref-authors-empty');
    if (empty) empty.style.display = '';
  };

  const populateReferenceModal = (ref) => {
    const setV = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
    setV('ref-type',       ref.type);
    setV('ref-title',      ref.title);
    setV('ref-year',       ref.year);
    setV('ref-doi',        ref.doi);
    setV('ref-url',        ref.url);
    setV('ref-isbn',       ref.isbn);
    setV('ref-issn',       ref.issn);
    setV('ref-notes',      ref.notes);

    // Reverse-map journal/publisher/conference
    setV('ref-journal', ref['journal-title'] || (ref.publisher?.name) || (ref.conference?.name) || (ref.institution?.name) || '');
    setV('ref-volume',  ref.volume);
    setV('ref-issue',   ref.issue);
    if (ref.start && ref.end) setV('ref-pages', `${ref.start}-${ref.end}`);

    // Render existing authors
    if (Array.isArray(ref.authors) && ref.authors.length > 0) {
      Authors.renderList(ref.authors, 'ref-authors-list', 'ref-authors-empty', `ref-${editingRefIndex}`);
    }
  };

  const collectReferenceData = () => {
    const gv = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    return {
      type:       gv('ref-type') || 'article',
      title:      gv('ref-title'),
      year:       gv('ref-year') ? parseInt(gv('ref-year')) : null,
      doi:        gv('ref-doi'),
      url:        gv('ref-url'),
      journal:    gv('ref-journal'),
      volume:     gv('ref-volume'),
      issue:      gv('ref-issue'),
      pages:      gv('ref-pages'),
      conference: gv('ref-conference'),
      isbn:       gv('ref-isbn'),
      issn:       gv('ref-issn'),
      notes:      gv('ref-notes'),
      authors:    editingRefIndex !== null
        ? (CFFGen.state.references[editingRefIndex]?.authors || [])
        : [],
    };
  };

  const saveReference = () => {
    const data = collectReferenceData();
    if (!data.title) { Utils.toast('Reference title is required', 'error'); document.getElementById('ref-title').focus(); return; }

    if (editingRefIndex !== null) {
      CFFGen.state.references[editingRefIndex] = data;
    } else {
      // Capture ref-authors that were added while the modal was open with '__new__'
      CFFGen.state.references.push(data);
      const newIdx = CFFGen.state.references.length - 1;
      // Authors were stored under 'ref-__new__' context; move them
      const tmpAuthors = CFFGen.state._tmpRefAuthors || [];
      if (tmpAuthors.length) { CFFGen.state.references[newIdx].authors = tmpAuthors; }
      delete CFFGen.state._tmpRefAuthors;
    }

    renderReferences();
    Utils.closeModal('reference-modal');
    CFFGen.debouncedUpdate();
    Utils.toast('Reference saved', 'success');
  };

  const renderReferences = () => {
    const list  = document.getElementById('references-list');
    const empty = document.getElementById('references-empty');
    if (!list) return;

    list.querySelectorAll('.item-card').forEach(c => c.remove());

    const refs = CFFGen.state.references || [];
    Authors.updateCount('references-count', refs.length, 'reference');

    if (refs.length === 0) { if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';

    refs.forEach((ref, i) => {
      const card = createReferenceCard(ref, i);
      list.appendChild(card);
    });

    if (typeof Sortable !== 'undefined') {
      Sortable.create(list, {
        animation: 200,
        handle: '.item-drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
          const item = CFFGen.state.references.splice(evt.oldIndex, 1)[0];
          CFFGen.state.references.splice(evt.newIndex, 0, item);
          CFFGen.debouncedUpdate();
        }
      });
    }
  };

  const createReferenceCard = (ref, index) => {
    const type      = ref.type || 'misc';
    const title     = ref.title || 'Untitled Reference';
    const authors   = (ref.authors || []).map(a =>
      a.name || [a['given-names'], a['family-names']].filter(Boolean).join(' ')
    ).join(', ') || 'Unknown authors';
    const year      = ref.year || '';
    const journal   = ref['journal-title'] || ref.publisher?.name || ref.conference?.name || ref.institution?.name || '';

    const badgeClass = {
      article: 'badge-article', software: 'badge-software', book: 'badge-book',
      'conference-paper': 'badge-conference-paper', dataset: 'badge-dataset'
    }[type] || 'badge-default';

    const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
      <div class="item-avatar" style="background:linear-gradient(135deg,var(--bg-surface3),var(--bg-surface2));color:var(--text-muted);border-radius:var(--radius-md);font-size:0.75rem;">
        ${initials}
      </div>
      <div class="item-info">
        <div class="item-name">${Utils.escapeHtml(Utils.truncate(title, 70))}</div>
        <div class="item-meta">
          <span class="item-type-badge ${badgeClass}">${type}</span>
          ${authors ? `<span class="item-meta-chip"><i class="fa-solid fa-user"></i>${Utils.escapeHtml(Utils.truncate(authors, 40))}</span>` : ''}
          ${year ? `<span class="item-meta-chip"><i class="fa-solid fa-calendar"></i>${year}</span>` : ''}
          ${journal ? `<span class="item-meta-chip"><i class="fa-solid fa-book"></i>${Utils.escapeHtml(Utils.truncate(journal, 30))}</span>` : ''}
          ${ref.doi ? `<span class="item-meta-chip"><i class="fa-solid fa-quote-right"></i>DOI</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn edit-ref-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn del-ref-btn" title="Remove" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
      </div>`;

    card.querySelector('.edit-ref-btn').addEventListener('click', () => openReferenceModal(index));
    card.querySelector('.del-ref-btn').addEventListener('click', async () => {
      const ok = await Utils.confirm('Remove Reference', `Remove "${Utils.truncate(title, 50)}"?`, 'Remove');
      if (!ok) return;
      CFFGen.state.references.splice(index, 1);
      renderReferences();
      CFFGen.debouncedUpdate();
    });

    return card;
  };

  /* ════════════════════════════════════
     BIBTEX IMPORT
  ════════════════════════════════════ */

  const openBibTeXModal = () => {
    document.getElementById('bibtex-input').value = '';
    document.getElementById('bibtex-parse-result').innerHTML = '';
    document.getElementById('bibtex-import-btn').disabled = true;
    parsedBibtexEntries = [];
    Utils.openModal('bibtex-modal');
  };

  const parseBibTeX = () => {
    const text = document.getElementById('bibtex-input').value.trim();
    if (!text) { Utils.toast('Please paste BibTeX content first', 'warning'); return; }

    const entries = [];
    const entryRegex = /@(\w+)\s*\{([^,]+),([^@]*)\}/gs;
    let match;

    while ((match = entryRegex.exec(text)) !== null) {
      const entryType = match[1].toLowerCase();
      const fields = {};
      const body = match[3];
      const fieldRegex = /(\w+)\s*=\s*[{"']?((?:[^{}'"]*(?:\{[^{}]*\})?)*)[}"']?\s*,?/g;
      let fm;
      while ((fm = fieldRegex.exec(body)) !== null) {
        fields[fm[1].toLowerCase()] = fm[2].trim().replace(/[{}]/g, '');
      }

      // Map BibTeX type → CFF type
      const typeMap = {
        article: 'article', book: 'book', inproceedings: 'conference-paper',
        conference: 'conference-paper', misc: 'misc', techreport: 'report',
        phdthesis: 'thesis', mastersthesis: 'thesis', dataset: 'dataset',
        software: 'software', unpublished: 'unpublished', manual: 'manual',
      };

      // Parse authors
      const rawAuthors = fields.author || fields.authors || '';
      const authorList = rawAuthors.split(' and ').map(a => {
        const parts = a.trim().split(',').map(p => p.trim());
        if (parts.length >= 2) {
          return { type: 'person', 'family-names': parts[0], 'given-names': parts[1] };
        } else {
          const words = parts[0].split(' ');
          return { type: 'person', 'given-names': words.slice(0, -1).join(' '), 'family-names': words[words.length - 1] };
        }
      }).filter(a => a['family-names'] || a['given-names']);

      entries.push({
        type: typeMap[entryType] || 'misc',
        title:   fields.title || 'Untitled',
        year:    fields.year ? parseInt(fields.year) : null,
        doi:     fields.doi || '',
        url:     fields.url || '',
        journal: fields.journal || fields.booktitle || fields.publisher || '',
        volume:  fields.volume || '',
        issue:   fields.number || '',
        pages:   (fields.pages || '').replace(/--/g, '-'),
        isbn:    fields.isbn || '',
        issn:    fields.issn || '',
        notes:   fields.abstract || fields.note || '',
        authors: authorList,
      });
    }

    parsedBibtexEntries = entries;
    const resultEl = document.getElementById('bibtex-parse-result');

    if (entries.length === 0) {
      resultEl.innerHTML = `<div class="validation-item warning"><div class="validation-item-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="validation-item-body"><div class="validation-item-title">No entries found</div><div class="validation-item-desc">Could not parse any BibTeX entries. Check the format.</div></div></div>`;
      document.getElementById('bibtex-import-btn').disabled = true;
    } else {
      resultEl.innerHTML = `
        <div class="validation-item success" style="margin-bottom:10px">
          <div class="validation-item-icon"><i class="fa-solid fa-check"></i></div>
          <div class="validation-item-body"><div class="validation-item-title">Found ${entries.length} entr${entries.length > 1 ? 'ies' : 'y'}</div></div>
        </div>
        ${entries.map(e => `
          <div class="item-card item-card--compact">
            <div class="item-info">
              <div class="item-name">${Utils.escapeHtml(Utils.truncate(e.title, 60))}</div>
              <div class="item-meta">
                <span class="item-type-badge badge-${e.type === 'article' ? 'article' : 'default'}">${e.type}</span>
                ${e.year ? `<span class="item-meta-chip"><i class="fa-solid fa-calendar"></i>${e.year}</span>` : ''}
                ${e.authors.length ? `<span class="item-meta-chip"><i class="fa-solid fa-users"></i>${e.authors.length} author${e.authors.length > 1 ? 's' : ''}</span>` : ''}
                ${e.doi ? `<span class="item-meta-chip"><i class="fa-solid fa-quote-right"></i>DOI</span>` : ''}
              </div>
            </div>
          </div>`).join('')}`;
      document.getElementById('bibtex-import-btn').disabled = false;
    }
  };

  const importBibTeX = () => {
    if (!parsedBibtexEntries.length) return;
    CFFGen.state.references.push(...parsedBibtexEntries);
    renderReferences();
    Utils.closeModal('bibtex-modal');
    CFFGen.debouncedUpdate();
    Utils.toast(`Imported ${parsedBibtexEntries.length} reference${parsedBibtexEntries.length > 1 ? 's' : ''}`, 'success');
  };

  /* ════════════════════════════════════
     DOI FETCH (CrossRef)
  ════════════════════════════════════ */

  const openDOIModal = () => {
    document.getElementById('doi-fetch-input').value = '';
    document.getElementById('doi-fetch-result').innerHTML = '';
    document.getElementById('doi-add-btn').disabled = true;
    doiFetchedData = null;
    Utils.openModal('doi-modal');
  };

  const fetchDOI = async () => {
    const doi = document.getElementById('doi-fetch-input').value.trim()
      .replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '');

    if (!doi) { Utils.toast('Enter a DOI first', 'warning'); return; }

    const resultEl = document.getElementById('doi-fetch-result');
    const isZenodo = /^10\.5281\/zenodo\./i.test(doi);
    const source   = isZenodo ? 'Zenodo' : 'CrossRef';
    resultEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:12px;color:var(--text-muted)"><div class="spinner"></div> Fetching from ${source}...</div>`;
    document.getElementById('doi-add-btn').disabled = true;

    NProgress.start();
    try {
      let doiFetchResult;

      if (isZenodo) {
        // ── Zenodo API ────────────────────────────────────────────────
        const recordId = doi.replace(/^10\.5281\/zenodo\./i, '');
        const resp = await fetch(`https://zenodo.org/api/records/${recordId}`, {
          headers: { Accept: 'application/json' },
        });
        if (resp.status === 404) throw new Error(`Zenodo record not found: ${doi}`);
        if (!resp.ok)            throw new Error(`Zenodo API error (${resp.status})`);
        const json = await resp.json();

        const meta = json.metadata || {};
        const div  = document.createElement('div');
        div.innerHTML = meta.description || '';
        const abstract = (div.textContent || '').trim();

        const authors = (meta.creators || []).map(c => {
          const parts = (c.name || '').split(',').map(s => s.trim());
          return {
            type: 'person',
            'family-names': parts[0] || '',
            'given-names':  parts[1] || '',
            ...(c.affiliation ? { affiliation: c.affiliation } : {}),
            ...(c.orcid ? { orcid: c.orcid.startsWith('https://') ? c.orcid : `https://orcid.org/${c.orcid}` } : {}),
          };
        });

        const rtype = (meta.resource_type?.type || 'software').toLowerCase();
        const typeMap = { software: 'software', dataset: 'dataset', publication: 'misc', image: 'misc', video: 'misc' };

        doiFetchResult = {
          type:    typeMap[rtype] || 'software',
          title:   meta.title || 'Untitled',
          year:    meta.publication_date ? parseInt(meta.publication_date.slice(0, 4)) : null,
          doi:     json.doi || doi,
          url:     json.links?.html || `https://zenodo.org/records/${recordId}`,
          journal: meta.journal?.title || '',
          volume:  meta.journal?.volume || '',
          issue:   meta.journal?.issue || '',
          pages:   meta.journal?.pages || '',
          notes:   abstract.slice(0, 500),
          authors,
        };
      } else {
        // ── CrossRef API ──────────────────────────────────────────────
        const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
        if (!resp.ok) throw new Error(`CrossRef API error (${resp.status})`);
        const json = await resp.json();
        const w = json.message;

      const typeMap = {
        'journal-article': 'article', 'book': 'book', 'book-chapter': 'book',
        'proceedings-article': 'conference-paper', 'report': 'report',
        'dissertation': 'thesis', 'dataset': 'dataset', 'software': 'software',
      };

      const authors = (w.author || []).map(a => ({
        type: 'person',
        'family-names': a.family || '',
        'given-names': a.given || '',
        ...(a.ORCID ? { orcid: a.ORCID } : {}),
        ...(a.affiliation?.length ? { affiliation: a.affiliation[0].name } : {}),
      }));

      const year = w.published?.['date-parts']?.[0]?.[0]
        || w['published-print']?.['date-parts']?.[0]?.[0]
        || w['published-online']?.['date-parts']?.[0]?.[0]
        || null;

        doiFetchResult = {
          type:    typeMap[w.type] || 'misc',
          title:   (Array.isArray(w.title) ? w.title[0] : w.title) || 'Untitled',
          year,
          doi:     w.DOI,
          url:     w.URL || `https://doi.org/${w.DOI}`,
          journal: w['container-title']?.[0] || w.publisher || '',
          volume:  w.volume || '',
          issue:   w.issue || '',
          pages:   w.page || '',
          issn:    (w.ISSN || [])[0] || '',
          isbn:    (w.ISBN || [])[0] || '',
          notes:   w.abstract ? w.abstract.replace(/<[^>]+>/g, '') : '',
          authors,
        };
      } // end else CrossRef

      doiFetchedData = doiFetchResult;

      resultEl.innerHTML = `
        <div class="doi-result-card">
          <h4>${Utils.escapeHtml(doiFetchedData.title)}</h4>
          <p><strong>Type:</strong> ${doiFetchedData.type}</p>
          ${doiFetchedData.year ? `<p><strong>Year:</strong> ${doiFetchedData.year}</p>` : ''}
          ${doiFetchedData.journal ? `<p><strong>Journal/Publisher:</strong> ${Utils.escapeHtml(doiFetchedData.journal)}</p>` : ''}
          <p><strong>Authors:</strong> ${(doiFetchedData.authors||[]).map(a => [a['given-names'], a['family-names']].filter(Boolean).join(' ')).join(', ') || 'Unknown'}</p>
          <p><strong>DOI:</strong> <code>${doiFetchedData.doi}</code></p>
        </div>`;

      document.getElementById('doi-add-btn').disabled = false;
    } catch (e) {
      resultEl.innerHTML = `<div class="validation-item error"><div class="validation-item-icon"><i class="fa-solid fa-xmark"></i></div><div class="validation-item-body"><div class="validation-item-title">Fetch Failed</div><div class="validation-item-desc">${Utils.escapeHtml(e.message)}</div></div></div>`;
    } finally {
      NProgress.done();
    }
  };

  const addDOIReference = () => {
    if (!doiFetchedData) return;
    CFFGen.state.references.push(doiFetchedData);
    renderReferences();
    Utils.closeModal('doi-modal');
    CFFGen.debouncedUpdate();
    Utils.toast('Reference added from DOI', 'success');
  };

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */

  const init = () => {
    // Identifiers
    document.getElementById('add-identifier-btn').addEventListener('click', () => openIdentifierModal());
    document.getElementById('identifier-modal-save').addEventListener('click', saveIdentifier);
    document.getElementById('identifier-modal-cancel').addEventListener('click', () => Utils.closeModal('identifier-modal'));
    document.getElementById('identifier-modal-close').addEventListener('click', () => Utils.closeModal('identifier-modal'));
    document.getElementById('identifier-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'identifier-modal-overlay') Utils.closeModal('identifier-modal');
    });

    // References
    document.getElementById('add-reference-btn').addEventListener('click', () => openReferenceModal());
    document.getElementById('reference-modal-save').addEventListener('click', saveReference);
    document.getElementById('reference-modal-cancel').addEventListener('click', () => Utils.closeModal('reference-modal'));
    document.getElementById('reference-modal-close').addEventListener('click', () => Utils.closeModal('reference-modal'));
    document.getElementById('reference-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'reference-modal-overlay') Utils.closeModal('reference-modal');
    });

    // BibTeX import
    document.getElementById('import-bibtex-btn').addEventListener('click', openBibTeXModal);
    document.getElementById('bibtex-parse-btn').addEventListener('click', parseBibTeX);
    document.getElementById('bibtex-import-btn').addEventListener('click', importBibTeX);
    document.getElementById('bibtex-modal-cancel').addEventListener('click', () => Utils.closeModal('bibtex-modal'));
    document.getElementById('bibtex-modal-close').addEventListener('click', () => Utils.closeModal('bibtex-modal'));
    document.getElementById('bibtex-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'bibtex-modal-overlay') Utils.closeModal('bibtex-modal');
    });

    // DOI fetch
    document.getElementById('import-doi-btn').addEventListener('click', openDOIModal);
    document.getElementById('doi-fetch-btn').addEventListener('click', fetchDOI);
    document.getElementById('doi-fetch-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchDOI(); });
    document.getElementById('doi-add-btn').addEventListener('click', addDOIReference);
    document.getElementById('doi-modal-cancel').addEventListener('click', () => Utils.closeModal('doi-modal'));
    document.getElementById('doi-modal-close').addEventListener('click', () => Utils.closeModal('doi-modal'));
    document.getElementById('doi-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'doi-modal-overlay') Utils.closeModal('doi-modal');
    });
  };

  return { init, renderReferences, renderIdentifiers, openReferenceModal, openIdentifierModal };
})();
