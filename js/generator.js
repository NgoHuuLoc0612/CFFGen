/* ═══════════════════════════════════════════════
   CFFGen — generator.js
   Generate CFF YAML, BibTeX, APA, MLA, JSON-LD, CodeMeta, RIS
   ═══════════════════════════════════════════════ */

const Generator = (() => {

  /* ─── Build the CFF data object from app state ─── */
  const buildCFFObject = (state) => {
    const obj = {};

    // Header fields (ordered per spec)
    obj['cff-version'] = state['cff-version'] || '1.2.0';
    obj.message = state.message || 'If you use this software, please cite it using the metadata from this file.';
    obj.type = state.type || 'software';

    if (state.title) obj.title = state.title;
    if (state.version) obj.version = String(state.version);
    if (state['date-released']) obj['date-released'] = state['date-released'];
    if (state.abstract) obj.abstract = state.abstract;
    if (state.license) obj.license = state.license;
    if (state['license-url']) obj['license-url'] = state['license-url'];
    if (state.doi) obj.doi = state.doi;
    if (state.url) obj.url = state.url;
    if (state.repository) obj.repository = state.repository;
    if (state['repository-code']) obj['repository-code'] = state['repository-code'];
    if (state['repository-artifact']) obj['repository-artifact'] = state['repository-artifact'];

    // Keywords
    if (Array.isArray(state.keywords) && state.keywords.length > 0) {
      obj.keywords = state.keywords;
    }

    // Authors
    if (Array.isArray(state.authors) && state.authors.length > 0) {
      obj.authors = state.authors.map(formatAuthor);
    }

    // Identifiers
    if (Array.isArray(state.identifiers) && state.identifiers.length > 0) {
      obj.identifiers = state.identifiers.map(id => {
        const o = { type: id.type, value: id.value };
        if (id.description) o.description = id.description;
        return o;
      });
    }

    // References
    if (Array.isArray(state.references) && state.references.length > 0) {
      obj.references = state.references.map(formatReference);
    }

    // Preferred Citation
    if (state['preferred-citation'] && state['preferred-citation'].enabled) {
      obj['preferred-citation'] = formatReference(state['preferred-citation']);
    }

    return obj;
  };

  const formatAuthor = (a) => {
    if (a.type === 'entity') {
      const o = {};
      if (a.name) o.name = a.name;
      if (a.alias) o.alias = a.alias;
      if (a.email) o.email = a.email;
      if (a.website) o.website = a.website;
      if (a.location) o.location = a.location;
      if (a['date-start']) o['date-start'] = a['date-start'];
      if (a['date-end']) o['date-end'] = a['date-end'];
      return o;
    } else {
      const o = {};
      if (a['family-names']) o['family-names'] = a['family-names'];
      if (a['given-names']) o['given-names'] = a['given-names'];
      if (a['name-particle']) o['name-particle'] = a['name-particle'];
      if (a['name-suffix']) o['name-suffix'] = a['name-suffix'];
      if (a.alias) o.alias = a.alias;
      if (a.affiliation) o.affiliation = a.affiliation;
      if (a.orcid) {
        // Ensure full URL format
        o.orcid = a.orcid.startsWith('https://') ? a.orcid : `https://orcid.org/${a.orcid}`;
      }
      if (a.email) o.email = a.email;
      if (a.website) o.website = a.website;
      return o;
    }
  };

  const formatReference = (ref) => {
    const o = {};
    if (ref.type) o.type = ref.type;
    if (ref.title) o.title = ref.title;
    if (ref.year) o.year = Number(ref.year);
    if (ref.doi) o.doi = ref.doi;
    if (ref.url) o.url = ref.url;
    if (ref.isbn) o.isbn = ref.isbn;
    if (ref.issn) o.issn = ref.issn;
    if (ref.notes) o.notes = ref.notes;

    if (Array.isArray(ref.authors) && ref.authors.length > 0) {
      o.authors = ref.authors.map(formatAuthor);
    }

    // Journal / publisher field mapping
    if (ref.type === 'article' || ref.type === 'magazine-article') {
      if (ref.journal) o['journal-title'] = ref.journal;
      if (ref.volume) o.volume = ref.volume;
      if (ref.issue) o.issue = ref.issue;
      if (ref.pages) {
        const pp = ref.pages.replace('--', '-').split('-');
        if (pp.length === 2) { o['start'] = pp[0].trim(); o['end'] = pp[1].trim(); }
      }
    } else if (ref.type === 'book' || ref.type === 'edited-work') {
      if (ref.journal) o.publisher = { name: ref.journal };
    } else if (ref.type === 'conference-paper') {
      if (ref.conference || ref.journal) o.conference = { name: ref.conference || ref.journal };
      if (ref.volume) o.volume = ref.volume;
      if (ref.pages) {
        const pp = ref.pages.replace('--', '-').split('-');
        if (pp.length === 2) { o.start = pp[0].trim(); o.end = pp[1].trim(); }
      }
    } else if (ref.type === 'thesis') {
      if (ref.journal) o.institution = { name: ref.journal };
    } else if (ref.type === 'report') {
      if (ref.journal) o.institution = { name: ref.journal };
    } else {
      if (ref.journal) o.publisher = { name: ref.journal };
    }

    return o;
  };

  /* ─── CFF YAML ─── */
  const toCFF = (state, indentSize = 2) => {
    const obj = buildCFFObject(state);

    const lines = [];
    lines.push('# This CITATION.cff file was generated with CFFGen');
    lines.push('# Visit https://github.com/citation-file-format/citation-file-format for the spec');
    lines.push('# Source code, issue tracking, and contributions are available at: https://github.com/NgoHuuLoc0612/CFFGen');
    lines.push('');

    // Serialize manually for exact CFF spec ordering and formatting
    const serializeValue = (val, depth = 0) => {
      const pad = ' '.repeat(depth * indentSize);
      const childPad = ' '.repeat((depth + 1) * indentSize);

      if (val === null || val === undefined) return 'null';
      if (typeof val === 'boolean') return String(val);
      if (typeof val === 'number') return String(val);
      if (typeof val === 'string') {
        if (val.includes('\n')) {
          const escaped = val.split('\n').map(l => childPad + l).join('\n');
          return `|-\n${escaped}`;
        }
        return Utils.escapeYaml(val);
      }
      return '';
    };

    const serializeKey = (key, val, depth = 0) => {
      const pad = ' '.repeat(depth * indentSize);
      const childPad = ' '.repeat((depth + 1) * indentSize);

      if (Array.isArray(val)) {
        const out = [`${pad}${key}:`];
        val.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item).filter(([, v]) => v !== undefined && v !== null && v !== '');
            if (entries.length === 0) return;
            const [firstKey, firstVal] = entries[0];
            if (typeof firstVal === 'object') {
              out.push(`${pad}- ${firstKey}:`);
              // Handle nested objects in list
            } else {
              out.push(`${pad}- ${firstKey}: ${serializeValue(firstVal, depth+1)}`);
            }
            entries.slice(1).forEach(([k, v]) => {
              if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
                out.push(`${childPad}  ${k}:`);
                Object.entries(v).filter(([, x]) => x).forEach(([kk, vv]) => {
                  out.push(`${childPad}    ${kk}: ${serializeValue(vv, depth+2)}`);
                });
              } else if (Array.isArray(v) && v.length > 0) {
                const sub = serializeKey(k, v, depth + 1);
                out.push(...sub.split('\n').map(l => '  ' + l));
              } else if (v !== undefined && v !== null && v !== '') {
                out.push(`${childPad}  ${k}: ${serializeValue(v, depth+1)}`);
              }
            });
          } else {
            out.push(`${pad}- ${serializeValue(item, depth)}`);
          }
        });
        return out.join('\n');
      }

      if (typeof val === 'object' && val !== null) {
        const out = [`${pad}${key}:`];
        Object.entries(val).filter(([, v]) => v !== undefined && v !== null && v !== '').forEach(([k, v]) => {
          out.push(serializeKey(k, v, depth + 1));
        });
        return out.join('\n');
      }

      return `${pad}${key}: ${serializeValue(val, depth)}`;
    };

    // CFF spec field order
    const ORDER = [
      'cff-version','message','type','title','version','date-released',
      'abstract','license','license-url','doi','url','repository',
      'repository-code','repository-artifact','keywords','authors',
      'identifiers','references','preferred-citation'
    ];

    ORDER.forEach(k => {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        if (Array.isArray(obj[k]) && obj[k].length === 0) return;
        lines.push(serializeKey(k, obj[k], 0));
      }
    });

    // Remaining keys
    Object.keys(obj).filter(k => !ORDER.includes(k)).forEach(k => {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        lines.push(serializeKey(k, obj[k], 0));
      }
    });

    return lines.join('\n');
  };

  /* ─── BibTeX ─── */
  const toBibTeX = (state) => {
    const obj = buildCFFObject(state);
    const type = state.type === 'dataset' ? 'misc' : 'software';
    const key = Utils.slugify((obj.title || 'software') + (obj.version ? '_v' + obj.version : '') + (new Date().getFullYear()));

    const authorStr = (Array.isArray(obj.authors) ? obj.authors : []).map(a => {
      if (a.name) return a.name;
      const parts = [];
      if (a['family-names']) parts.push(a['family-names']);
      if (a['given-names']) parts.push(a['given-names']);
      return parts.join(', ');
    }).join(' and ');

    const fields = [];
    if (obj.title) fields.push(`  title        = {${obj.title}}`);
    if (authorStr) fields.push(`  author       = {${authorStr}}`);
    if (obj.version) fields.push(`  version      = {${obj.version}}`);
    if (obj['date-released']) fields.push(`  year         = {${obj['date-released'].slice(0, 4)}}`);
    if (obj.url) fields.push(`  url          = {${obj.url}}`);
    if (obj['repository-code']) fields.push(`  url          = {${obj['repository-code']}}`);
    if (obj.doi) fields.push(`  doi          = {${obj.doi}}`);
    if (obj.abstract) fields.push(`  abstract     = {${obj.abstract}}`);
    if (obj.license) fields.push(`  license      = {${obj.license}}`);
    if (obj.keywords && obj.keywords.length) fields.push(`  keywords     = {${obj.keywords.join(', ')}}`);
    if (obj['date-released']) fields.push(`  month        = {${obj['date-released'].slice(5, 7)}}`);
    fields.push(`  howpublished = {\\url{${obj['repository-code'] || obj.url || ''}}}`);

    return `@${type}{${key},\n${fields.join(',\n')}\n}`;
  };

  /* ─── APA ─── */
  const toAPA = (state) => {
    const obj = buildCFFObject(state);
    const authors = (obj.authors || []).map(a => {
      if (a.name) return a.name;
      const family = a['family-names'] || '';
      const given = a['given-names'] ? a['given-names'].split(' ').map(n => n[0] + '.').join(' ') : '';
      return given ? `${family}, ${given}` : family;
    });

    let author = '';
    if (authors.length === 1) author = authors[0];
    else if (authors.length === 2) author = authors.join(' & ');
    else if (authors.length <= 20) author = authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1];
    else author = authors.slice(0, 19).join(', ') + '... ' + authors[authors.length - 1];

    const year = obj['date-released'] ? obj['date-released'].slice(0, 4) : 'n.d.';
    const title = obj.title || 'Untitled';
    const version = obj.version ? ` (Version ${obj.version})` : '';
    const url = obj['repository-code'] || obj.url || '';
    const doi = obj.doi ? `https://doi.org/${obj.doi}` : '';

    let ref = `${author}. (${year}). *${title}*${version} [Computer software]`;
    if (doi) ref += `. ${doi}`;
    else if (url) ref += `. ${url}`;
    ref += '.';
    return ref;
  };

  /* ─── MLA ─── */
  const toMLA = (state) => {
    const obj = buildCFFObject(state);
    const authors = (obj.authors || []).map(a => {
      if (a.name) return a.name;
      const parts = [];
      if (a['family-names']) parts.push(a['family-names']);
      if (a['given-names']) parts.push(a['given-names']);
      return parts.join(', ');
    });

    let author = '';
    if (authors.length === 1) author = authors[0];
    else if (authors.length === 2) author = `${authors[0]}, and ${authors[1]}`;
    else author = `${authors[0]}, et al`;

    const year = obj['date-released'] ? obj['date-released'].slice(0, 4) : 'n.d.';
    const title = obj.title || 'Untitled';
    const version = obj.version ? `, version ${obj.version}` : '';
    const url = obj['repository-code'] || obj.url || '';

    return `${author}. *${title}*${version}. ${year}${url ? ', ' + url : ''}.`;
  };

  /* ─── JSON-LD / Schema.org ─── */
  const toJSONLD = (state) => {
    const obj = buildCFFObject(state);
    const authors = (obj.authors || []).map(a => {
      if (a.name) return { '@type': 'Organization', name: a.name };
      return {
        '@type': 'Person',
        name: [a['given-names'], a['family-names']].filter(Boolean).join(' '),
        ...(a.orcid ? { '@id': a.orcid } : {}),
        ...(a.affiliation ? { affiliation: { '@type': 'Organization', name: a.affiliation } } : {}),
        ...(a.email ? { email: a.email } : {}),
      };
    });

    const jsonld = {
      '@context': 'https://schema.org',
      '@type': state.type === 'dataset' ? 'Dataset' : 'SoftwareSourceCode',
      name: obj.title,
      ...(obj.abstract ? { description: obj.abstract } : {}),
      ...(obj.version ? { version: obj.version } : {}),
      ...(obj['date-released'] ? { datePublished: obj['date-released'] } : {}),
      ...(obj.license ? { license: `https://spdx.org/licenses/${obj.license}.html` } : {}),
      ...(obj.url ? { url: obj.url } : {}),
      ...(obj['repository-code'] ? { codeRepository: obj['repository-code'] } : {}),
      ...(obj.doi ? { identifier: `https://doi.org/${obj.doi}` } : {}),
      ...(authors.length ? { author: authors.length === 1 ? authors[0] : authors } : {}),
      ...(obj.keywords ? { keywords: obj.keywords.join(', ') } : {}),
    };

    return JSON.stringify(jsonld, null, 2);
  };

  /* ─── CodeMeta ─── */
  const toCodeMeta = (state) => {
    const obj = buildCFFObject(state);
    const authors = (obj.authors || []).map(a => {
      if (a.name) return { '@type': 'Organization', name: a.name };
      return {
        '@type': 'Person',
        givenName: a['given-names'],
        familyName: a['family-names'],
        ...(a.orcid ? { '@id': a.orcid } : {}),
        ...(a.affiliation ? { affiliation: { '@type': 'Organization', name: a.affiliation } } : {}),
        ...(a.email ? { email: a.email } : {}),
      };
    });

    const codemeta = {
      '@context': 'https://w3id.org/codemeta/3.0',
      type: 'SoftwareSourceCode',
      name: obj.title,
      ...(obj.abstract ? { description: obj.abstract } : {}),
      ...(obj.version ? { version: obj.version } : {}),
      ...(obj['date-released'] ? { datePublished: obj['date-released'] } : {}),
      ...(obj.license ? { license: `https://spdx.org/licenses/${obj.license}.html` } : {}),
      ...(obj['repository-code'] ? { codeRepository: obj['repository-code'] } : {}),
      ...(obj.url ? { url: obj.url } : {}),
      ...(obj.doi ? { identifier: `https://doi.org/${obj.doi}` } : {}),
      ...(authors.length ? { author: authors.length === 1 ? authors[0] : authors } : {}),
      ...(obj.keywords ? { keywords: obj.keywords } : {}),
      ...(obj['date-released'] ? { dateModified: obj['date-released'] } : {}),
    };

    return JSON.stringify(codemeta, null, 2);
  };

  /* ─── RIS ─── */
  const toRIS = (state) => {
    const obj = buildCFFObject(state);
    const type = state.type === 'dataset' ? 'DATA' : 'COMP';
    const lines = [`TY  - ${type}`];
    if (obj.title) lines.push(`TI  - ${obj.title}`);
    (obj.authors || []).forEach(a => {
      if (a.name) lines.push(`AU  - ${a.name}`);
      else lines.push(`AU  - ${[a['family-names'], a['given-names']].filter(Boolean).join(', ')}`);
    });
    if (obj['date-released']) lines.push(`PY  - ${obj['date-released'].slice(0, 4)}`);
    if (obj.abstract) lines.push(`AB  - ${obj.abstract}`);
    if (obj.doi) lines.push(`DO  - ${obj.doi}`);
    if (obj.url) lines.push(`UR  - ${obj.url}`);
    if (obj['repository-code']) lines.push(`UR  - ${obj['repository-code']}`);
    if (obj.version) lines.push(`VL  - ${obj.version}`);
    if (obj.license) lines.push(`RI  - ${obj.license}`);
    (obj.keywords || []).forEach(k => lines.push(`KW  - ${k}`));
    lines.push('ER  - ');
    return lines.join('\n');
  };

  return { buildCFFObject, toCFF, toBibTeX, toAPA, toMLA, toJSONLD, toCodeMeta, toRIS, formatAuthor, formatReference };
})();