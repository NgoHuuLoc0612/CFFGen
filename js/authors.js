/* ═══════════════════════════════════════════════
   CFFGen — authors.js
   Author CRUD, rendering, GitHub fetch
   ═══════════════════════════════════════════════ */

const Authors = (() => {

  let editingIndex = null;
  let editingContext = 'main'; // 'main' | 'pc' | 'ref-{i}'

  /* ─── Open modal ─── */
  const openModal = (context = 'main', index = null, existingData = null) => {
    editingIndex = index;
    editingContext = context;

    const modal = document.getElementById('author-modal');
    const titleEl = document.getElementById('author-modal-title');
    titleEl.textContent = index !== null ? 'Edit Author' : 'Add Author';

    clearModal();

    if (existingData) {
      populateModal(existingData);
    }

    Utils.openModal('author-modal');
  };

  const clearModal = () => {
    const fields = [
      'author-given-names','author-family-names','author-name-particle',
      'author-name-suffix','author-email','author-website','author-orcid',
      'author-affiliation','author-alias',
      'author-entity-name','author-entity-email','author-entity-website',
      'author-entity-alias','author-entity-location',
      'author-entity-date-start','author-entity-date-end'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Default to person tab
    switchAuthorType('person');
  };

  const populateModal = (data) => {
    if (data.type === 'entity') {
      switchAuthorType('entity');
      setValue('author-entity-name', data.name);
      setValue('author-entity-email', data.email);
      setValue('author-entity-website', data.website);
      setValue('author-entity-alias', data.alias);
      setValue('author-entity-location', data.location);
      setValue('author-entity-date-start', data['date-start']);
      setValue('author-entity-date-end', data['date-end']);
    } else {
      switchAuthorType('person');
      setValue('author-given-names', data['given-names']);
      setValue('author-family-names', data['family-names']);
      setValue('author-name-particle', data['name-particle']);
      setValue('author-name-suffix', data['name-suffix']);
      setValue('author-email', data.email);
      setValue('author-website', data.website);
      const orcid = data.orcid ? data.orcid.replace('https://orcid.org/', '') : '';
      setValue('author-orcid', orcid);
      setValue('author-affiliation', data.affiliation);
      setValue('author-alias', data.alias);
    }
  };

  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };

  /* ─── Author type tabs ─── */
  const switchAuthorType = (type) => {
    document.querySelectorAll('.author-type-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.authorType === type);
    });
    document.getElementById('author-person-fields').classList.toggle('hidden', type === 'entity');
    document.getElementById('author-entity-fields').classList.toggle('hidden', type === 'person');
  };

  /* ─── Collect modal data ─── */
  const collectModalData = () => {
    const personTab = document.querySelector('.author-type-tab.active');
    const type = personTab ? personTab.dataset.authorType : 'person';

    if (type === 'entity') {
      return {
        type: 'entity',
        name: val('author-entity-name'),
        email: val('author-entity-email'),
        website: val('author-entity-website'),
        alias: val('author-entity-alias'),
        location: val('author-entity-location'),
        'date-start': val('author-entity-date-start'),
        'date-end': val('author-entity-date-end'),
      };
    } else {
      const orcid = val('author-orcid');
      return {
        type: 'person',
        'family-names': val('author-family-names'),
        'given-names': val('author-given-names'),
        'name-particle': val('author-name-particle'),
        'name-suffix': val('author-name-suffix'),
        email: val('author-email'),
        website: val('author-website'),
        orcid: orcid ? (orcid.startsWith('https://') ? orcid : `https://orcid.org/${orcid}`) : '',
        affiliation: val('author-affiliation'),
        alias: val('author-alias'),
      };
    }
  };

  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  /* ─── Validate ─── */
  const validateAuthor = (data) => {
    if (data.type === 'entity' && !data.name) {
      Utils.toast('Entity name is required', 'error');
      document.getElementById('author-entity-name').focus();
      return false;
    }
    if (data.type !== 'entity' && !data['family-names']) {
      Utils.toast('Family name is required', 'error');
      document.getElementById('author-family-names').focus();
      return false;
    }
    return true;
  };

  /* ─── Save from modal ─── */
  const saveFromModal = () => {
    const data = collectModalData();
    if (!validateAuthor(data)) return;

    if (editingContext === 'main') {
      if (editingIndex !== null) {
        CFFGen.state.authors[editingIndex] = data;
      } else {
        CFFGen.state.authors.push(data);
      }
      renderList(CFFGen.state.authors, 'authors-list', 'authors-empty', 'main');
      updateCount('authors-count', CFFGen.state.authors.length, 'author');
    } else if (editingContext === 'pc') {
      if (!CFFGen.state['preferred-citation'].authors) {
        CFFGen.state['preferred-citation'].authors = [];
      }
      if (editingIndex !== null) {
        CFFGen.state['preferred-citation'].authors[editingIndex] = data;
      } else {
        CFFGen.state['preferred-citation'].authors.push(data);
      }
      renderList(CFFGen.state['preferred-citation'].authors, 'pc-authors-list', 'pc-authors-empty', 'pc');
    } else if (editingContext.startsWith('ref-')) {
      const refIdx = parseInt(editingContext.split('-')[1]);
      if (!CFFGen.state.references[refIdx].authors) CFFGen.state.references[refIdx].authors = [];
      if (editingIndex !== null) {
        CFFGen.state.references[refIdx].authors[editingIndex] = data;
      } else {
        CFFGen.state.references[refIdx].authors.push(data);
      }
      renderList(CFFGen.state.references[refIdx].authors, 'ref-authors-list', 'ref-authors-empty', editingContext);
    }

    Utils.closeModal('author-modal');
    CFFGen.debouncedUpdate();
    Utils.toast('Author saved', 'success');
  };

  /* ─── Render author list ─── */
  const renderList = (authors, listId, emptyId, context) => {
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    if (!list) return;

    // Remove existing cards
    list.querySelectorAll('.item-card').forEach(c => c.remove());

    if (!authors || authors.length === 0) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    authors.forEach((author, i) => {
      const card = createAuthorCard(author, i, context);
      list.appendChild(card);
    });

    // Sortable for main authors
    if (context === 'main' && typeof Sortable !== 'undefined') {
      Sortable.create(list, {
        animation: 200,
        handle: '.item-drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: (evt) => {
          const item = CFFGen.state.authors.splice(evt.oldIndex, 1)[0];
          CFFGen.state.authors.splice(evt.newIndex, 0, item);
          CFFGen.debouncedUpdate();
        }
      });
    }
  };

  const createAuthorCard = (author, index, context) => {
    const isEntity = author.type === 'entity';
    const name = isEntity
      ? (author.name || 'Unnamed Entity')
      : [author['given-names'], author['name-particle'], author['family-names']].filter(Boolean).join(' ') || 'Unnamed';
    const initials = Utils.initials(name);

    const meta = [];
    if (!isEntity && author.affiliation) meta.push(`<span class="item-meta-chip"><i class="fa-solid fa-building"></i>${Utils.escapeHtml(author.affiliation)}</span>`);
    if (author.email) meta.push(`<span class="item-meta-chip"><i class="fa-solid fa-envelope"></i>${Utils.escapeHtml(author.email)}</span>`);
    if (!isEntity && author.orcid) meta.push(`<span class="item-meta-chip"><i class="fa-solid fa-id-badge"></i>ORCID</span>`);
    if (author.website) meta.push(`<span class="item-meta-chip"><i class="fa-solid fa-globe"></i>Website</span>`);

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></div>
      <div class="item-avatar ${isEntity ? 'item-avatar--entity' : ''}">${initials}</div>
      <div class="item-info">
        <div class="item-name">${Utils.escapeHtml(name)}</div>
        <div class="item-meta">
          <span class="item-meta-chip"><i class="fa-solid fa-${isEntity ? 'building' : 'user'}"></i>${isEntity ? 'Entity' : 'Person'}</span>
          ${meta.join('')}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn edit-author-btn" title="Edit author"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn delete-author-btn" title="Remove author" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    card.querySelector('.edit-author-btn').addEventListener('click', () => {
      openModal(context, index, author);
    });
    card.querySelector('.delete-author-btn').addEventListener('click', async () => {
      const ok = await Utils.confirm('Remove Author', `Remove "${name}" from the list?`, 'Remove');
      if (!ok) return;
      if (context === 'main') {
        CFFGen.state.authors.splice(index, 1);
        renderList(CFFGen.state.authors, 'authors-list', 'authors-empty', 'main');
        updateCount('authors-count', CFFGen.state.authors.length, 'author');
      } else if (context === 'pc') {
        CFFGen.state['preferred-citation'].authors.splice(index, 1);
        renderList(CFFGen.state['preferred-citation'].authors, 'pc-authors-list', 'pc-authors-empty', 'pc');
      } else if (context.startsWith('ref-')) {
        const ri = parseInt(context.split('-')[1]);
        CFFGen.state.references[ri].authors.splice(index, 1);
        renderList(CFFGen.state.references[ri].authors, 'ref-authors-list', 'ref-authors-empty', context);
      }
      CFFGen.debouncedUpdate();
    });

    return card;
  };

  /* ─── Update count display ─── */
  const updateCount = (countId, count, noun) => {
    const el = document.getElementById(countId);
    if (el) el.textContent = `${count} ${noun}${count !== 1 ? 's' : ''}`;
  };

  /* ─── ORCID API lookup ─── */
  const lookupORCID = async () => {
    const orcidInput = document.getElementById('author-orcid');
    if (!orcidInput) return;

    const raw = orcidInput.value.trim().replace(/^https?:\/\/orcid\.org\//i, '');
    if (!raw) { Utils.toast('Enter an ORCID iD first', 'warning'); return; }

    // Validate format: 0000-0000-0000-000X
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(raw)) {
      Utils.toast('Invalid ORCID format (0000-0001-2345-6789)', 'error');
      return;
    }

    NProgress.start();
    try {
      // ORCID public API — no auth required for public profiles
      const resp = await fetch(`https://pub.orcid.org/v3.0/${raw}/person`, {
        headers: { Accept: 'application/json' },
      });

      if (resp.status === 404) throw new Error('ORCID profile not found or set to private');
      if (!resp.ok)            throw new Error(`ORCID API error: HTTP ${resp.status}`);

      const data = await resp.json();
      const name = data.name || {};

      const givenNames  = name['given-names']?.value  || '';
      const familyNames = name['family-name']?.value  || '';

      const setValue = (id, v) => {
        const el = document.getElementById(id);
        if (el && v) el.value = v;
      };

      if (givenNames)  setValue('author-given-names',  givenNames);
      if (familyNames) setValue('author-family-names', familyNames);

      // Biography → not stored, but use for affiliation hint via employments
      const employments = data['activities-summary']?.employments?.['affiliation-group'] || [];
      if (employments.length > 0) {
        const latest = employments[0]?.summaries?.[0]?.['employment-summary'];
        const org = latest?.organization?.name;
        if (org) setValue('author-affiliation', org);
      }

      // Confirmed ORCID
      orcidInput.value = raw;

      Utils.toast(`Loaded profile: ${givenNames} ${familyNames}`, 'success');
    } catch (e) {
      Utils.toast('ORCID lookup failed: ' + e.message, 'error');
    } finally {
      NProgress.done();
    }
  };

  /* ─── GitHub fetch ─── */
  const fetchFromGitHub = async () => {
    const repoUrl = document.getElementById('cff-repository-code')?.value
      || document.getElementById('cff-repository')?.value;

    if (!repoUrl) {
      Utils.toast('Please enter a repository URL first', 'warning');
      return;
    }

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      Utils.toast('Not a valid GitHub URL', 'error');
      return;
    }

    const [, owner, repo] = match;
    NProgress.start();

    try {
      // Fetch contributors
      const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`);
      if (!resp.ok) throw new Error('GitHub API error: ' + resp.statusText);
      const contributors = await resp.json();

      let added = 0;
      for (const c of contributors) {
        const userResp = await fetch(`https://api.github.com/users/${c.login}`);
        if (!userResp.ok) continue;
        const user = await userResp.json();

        const nameParts = (user.name || c.login).split(' ');
        const authorData = {
          type: 'person',
          'given-names': nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '',
          'family-names': nameParts[nameParts.length - 1] || c.login,
          alias: c.login,
          ...(user.company ? { affiliation: user.company.replace(/^@/, '') } : {}),
          ...(user.email ? { email: user.email } : {}),
          ...(user.blog ? { website: user.blog.startsWith('http') ? user.blog : 'https://' + user.blog } : {}),
        };

        // Don't add duplicates
        const exists = CFFGen.state.authors.some(a =>
          a.alias === c.login || (a['family-names'] === authorData['family-names'] && a['given-names'] === authorData['given-names'])
        );
        if (!exists) {
          CFFGen.state.authors.push(authorData);
          added++;
        }
      }

      renderList(CFFGen.state.authors, 'authors-list', 'authors-empty', 'main');
      updateCount('authors-count', CFFGen.state.authors.length, 'author');
      CFFGen.debouncedUpdate();
      Utils.toast(`Fetched ${added} contributor${added !== 1 ? 's' : ''} from GitHub`, 'success');
    } catch (e) {
      Utils.toast('Failed to fetch from GitHub: ' + e.message, 'error');
    } finally {
      NProgress.done();
    }
  };

  /* ─── Init ─── */
  const init = () => {
    // Author type tabs
    document.querySelectorAll('.author-type-tab').forEach(tab => {
      tab.addEventListener('click', () => switchAuthorType(tab.dataset.authorType));
    });

    // Main author buttons
    document.getElementById('add-author-btn').addEventListener('click', () => openModal('main'));
    document.getElementById('add-entity-author-btn').addEventListener('click', () => {
      openModal('main');
      switchAuthorType('entity');
    });
    document.getElementById('fetch-github-authors-btn').addEventListener('click', fetchFromGitHub);

    // PC authors button
    document.getElementById('add-pc-author-btn')?.addEventListener('click', () => openModal('pc'));

    // Ref authors button (will be set up by references.js when modal opens)

    // ORCID lookup button
    document.getElementById('orcid-lookup-btn')?.addEventListener('click', lookupORCID);

    // Modal save
    document.getElementById('author-modal-save').addEventListener('click', saveFromModal);
    document.getElementById('author-modal-cancel').addEventListener('click', () => Utils.closeModal('author-modal'));
    document.getElementById('author-modal-close').addEventListener('click', () => Utils.closeModal('author-modal'));

    // Modal overlay click
    document.getElementById('author-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'author-modal-overlay') Utils.closeModal('author-modal');
    });
  };

  return { init, openModal, renderList, updateCount, switchAuthorType, fetchFromGitHub, lookupORCID };
})();
