/* ═══════════════════════════════════════════════
   CFFGen — zenodo.js
   Zenodo record sync via public REST API
   ═══════════════════════════════════════════════ */

const Zenodo = (() => {

  /* ─── Parse Zenodo record ID from various input forms ─── */
  const parseRecordId = (input) => {
    input = input.trim();

    // Full DOI: 10.5281/zenodo.1234567
    const doiMatch = input.match(/10\.5281\/zenodo\.(\d+)/i);
    if (doiMatch) return doiMatch[1];

    // Full URL: https://zenodo.org/records/1234567 or /record/1234567
    const urlMatch = input.match(/zenodo\.org\/(?:records?|deposit)\/(\d+)/i);
    if (urlMatch) return urlMatch[1];

    // Bare number
    if (/^\d+$/.test(input)) return input;

    return null;
  };

  /* ─── Fetch record metadata from Zenodo REST API ─── */
  const fetchRecord = async (recordId) => {
    const url = `https://zenodo.org/api/records/${recordId}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      if (resp.status === 404) throw new Error(`Zenodo record ${recordId} not found`);
      throw new Error(`Zenodo API error: HTTP ${resp.status}`);
    }
    return resp.json();
  };

  /* ─── Map Zenodo record → CFFGen state fields ─── */
  const mapToState = (record) => {
    const meta = record.metadata || {};
    const mapped = {};

    // Title
    if (meta.title) mapped.title = meta.title;

    // Version
    if (meta.version) mapped.version = String(meta.version);

    // DOI
    if (record.doi) mapped.doi = record.doi;
    else if (meta.doi) mapped.doi = meta.doi;

    // Abstract / description
    if (meta.description) {
      // Strip HTML tags that Zenodo sometimes includes
      const div = document.createElement('div');
      div.innerHTML = meta.description;
      mapped.abstract = (div.textContent || div.innerText || '').trim();
    }

    // License — map Zenodo license id to SPDX where possible
    if (meta.license) {
      const lid = (meta.license.id || meta.license || '').toString();
      const spdx = zenodoLicenseToSPDX(lid);
      if (spdx) mapped.license = spdx;
    }

    // Keywords
    if (Array.isArray(meta.keywords) && meta.keywords.length > 0) {
      mapped.keywords = meta.keywords.map(String);
    }

    // Publication date → date-released
    if (meta.publication_date) {
      mapped['date-released'] = meta.publication_date;
    }

    // URL to Zenodo record page
    if (record.links?.html) mapped.url = record.links.html;
    else if (record.id) mapped.url = `https://zenodo.org/records/${record.id}`;

    // Authors
    if (Array.isArray(meta.creators) && meta.creators.length > 0) {
      mapped.authors = meta.creators.map(mapCreator).filter(Boolean);
    }

    // Related identifiers → identifiers
    if (Array.isArray(meta.related_identifiers)) {
      const ids = meta.related_identifiers
        .filter(r => r.relation === 'isSupplementTo' || r.scheme === 'url' || r.scheme === 'doi')
        .slice(0, 5)
        .map(r => ({
          type: r.scheme === 'doi' ? 'doi' : 'url',
          value: r.identifier,
          description: r.relation || '',
        }));
      if (ids.length > 0) mapped.identifiers = ids;
    }

    return mapped;
  };

  /* ─── Map a Zenodo creator object → CFFGen author ─── */
  const mapCreator = (creator) => {
    if (!creator) return null;

    // Zenodo name format: "Family, Given" or just "Name"
    const nameParts = (creator.name || '').split(',').map(s => s.trim());
    const familyNames = nameParts[0] || '';
    const givenNames  = nameParts[1] || '';

    const author = {
      type: 'person',
      'family-names': familyNames,
      'given-names':  givenNames,
    };

    if (creator.affiliation) author.affiliation = creator.affiliation;

    if (creator.orcid) {
      author.orcid = creator.orcid.startsWith('https://')
        ? creator.orcid
        : `https://orcid.org/${creator.orcid}`;
    }

    return author;
  };

  /* ─── Zenodo license id → SPDX identifier ───────────────────────────
     Uses the full SPDX list already loaded by CFFData.loadSPDXLicenses().
     Strategy (in order):
       1. Hard-coded aliases for Zenodo-specific ids that differ from SPDX
          (e.g. "cc-zero" → "CC0-1.0", deprecated short-form GPL ids → -only)
       2. Case-insensitive direct match against all SPDX licenseIds
       3. Return null if no match found
  ────────────────────────────────────────────────────────────────────── */
  const ZENODO_ALIASES = {
    // Zenodo-specific names that don't match any SPDX id
    'cc-zero':              'CC0-1.0',
    'cc-pddc':              'CC-PDDC',
    'other-open':           null,
    'other-at':             null,
    'other-closed':         null,
    // Deprecated SPDX short-forms Zenodo still uses → preferred current ids
    'gpl-2.0':              'GPL-2.0-only',
    'gpl-3.0':              'GPL-3.0-only',
    'lgpl-2.0':             'LGPL-2.0-only',
    'lgpl-2.1':             'LGPL-2.1-only',
    'lgpl-3.0':             'LGPL-3.0-only',
    'agpl-3.0':             'AGPL-3.0-only',
    'gpl-2.0+':             'GPL-2.0-or-later',
    'gpl-3.0+':             'GPL-3.0-or-later',
    'lgpl-2.0+':            'LGPL-2.0-or-later',
    'lgpl-2.1+':            'LGPL-2.1-or-later',
    'lgpl-3.0+':            'LGPL-3.0-or-later',
    'agpl-3.0+':            'AGPL-3.0-or-later',
  };

  const zenodoLicenseToSPDX = (id) => {
    if (!id) return null;
    const key = id.toLowerCase().trim();

    // 1. Explicit alias table (handles Zenodo-specific and deprecated ids)
    if (Object.prototype.hasOwnProperty.call(ZENODO_ALIASES, key)) {
      return ZENODO_ALIASES[key]; // may be null for non-SPDX Zenodo licenses
    }

    // 2. Case-insensitive match against the full live SPDX list
    const spdxList = CFFData.SPDX_LICENSES;
    const match = spdxList.find(l => l.toLowerCase() === key);
    if (match) return match;

    // 3. No match
    return null;
  };

  /* ─── Apply mapped state to form ─── */
  const applyToForm = (mapped) => {
    const setF = (id, v) => {
      if (!v) return;
      const el = document.getElementById(id);
      if (el) el.value = v;
    };

    if (mapped.title)          setF('cff-title', mapped.title);
    if (mapped.version)        setF('cff-version-val', mapped.version);
    if (mapped['date-released']) setF('cff-date-released', mapped['date-released']);
    if (mapped.abstract)       setF('cff-abstract', mapped.abstract);
    if (mapped.doi)            setF('cff-doi', mapped.doi);
    if (mapped.url)            setF('cff-url', mapped.url);

    // License via Select2
    if (mapped.license && window.$) {
      $('#cff-license').val(mapped.license).trigger('change');
    }

    // Keywords
    if (Array.isArray(mapped.keywords) && mapped.keywords.length > 0) {
      CFFGen.state.keywords = [
        ...new Set([...(CFFGen.state.keywords || []), ...mapped.keywords])
      ];
      // Rebuild keyword tags
      const td = document.getElementById('keywords-tags');
      if (td) {
        td.innerHTML = '';
        CFFGen.state.keywords.forEach(kw => {
          const chip = document.createElement('div');
          chip.className = 'tag-chip';
          chip.innerHTML = `${Utils.escapeHtml(kw)}<button class="tag-remove"><i class="fa-solid fa-xmark"></i></button>`;
          chip.querySelector('.tag-remove').addEventListener('click', () => {
            CFFGen.state.keywords = CFFGen.state.keywords.filter(k => k !== kw);
            chip.remove();
            CFFGen.debouncedUpdate();
          });
          td.appendChild(chip);
        });
      }
    }

    // Authors — merge, no duplicates by family name
    if (Array.isArray(mapped.authors) && mapped.authors.length > 0) {
      const existing = CFFGen.state.authors || [];
      let added = 0;
      for (const a of mapped.authors) {
        const dup = existing.some(e =>
          e['family-names'] && a['family-names'] &&
          e['family-names'].toLowerCase() === a['family-names'].toLowerCase()
        );
        if (!dup) { existing.push(a); added++; }
      }
      CFFGen.state.authors = existing;
      if (typeof Authors !== 'undefined') {
        Authors.renderList(existing, 'authors-list', 'authors-empty', 'main');
        Authors.updateCount('authors-count', existing.length, 'author');
      }
    }

    // Identifiers — merge
    if (Array.isArray(mapped.identifiers) && mapped.identifiers.length > 0) {
      CFFGen.state.identifiers = [
        ...(CFFGen.state.identifiers || []),
        ...mapped.identifiers,
      ];
    }

    CFFGen.debouncedUpdate();
  };

  /* ─── Main sync entry point ─── */
  const sync = async (input) => {
    const recordId = parseRecordId(input);
    if (!recordId) {
      Utils.toast('Enter a valid Zenodo DOI, URL, or record ID', 'error');
      return false;
    }

    NProgress.start();
    try {
      const record  = await fetchRecord(recordId);
      const mapped  = mapToState(record);
      applyToForm(mapped);

      const title = mapped.title ? `"${mapped.title.slice(0, 40)}${mapped.title.length > 40 ? '…' : ''}"` : `record ${recordId}`;
      Utils.toast(`Synced from Zenodo: ${title}`, 'success', 4000);
      return true;
    } catch (e) {
      Utils.toast(e.message, 'error');
      return false;
    } finally {
      NProgress.done();
    }
  };

  /* ─── Init UI ─── */
  const init = () => {
    const btn   = document.getElementById('zenodo-sync-btn');
    const input = document.getElementById('zenodo-sync-input');
    if (!btn || !input) return;

    const doSync = () => {
      const val = input.value.trim();
      if (!val) { Utils.toast('Enter a Zenodo DOI or record ID', 'warning'); return; }
      sync(val);
    };

    btn.addEventListener('click', doSync);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSync(); });
  };

  return { init, sync, parseRecordId, fetchRecord, mapToState };
})();
