/* ═══════════════════════════════════════════════
   CFFGen — data.js
   SPDX licenses, schema metadata, templates
   ═══════════════════════════════════════════════ */

const CFFData = (() => {

  /* ─── SPDX license list (fetched from spdx.org, fallback to common licenses) ─── */
  const SPDX_FALLBACK = [
    'MIT','Apache-2.0','GPL-2.0-only','GPL-2.0-or-later','GPL-3.0-only',
    'GPL-3.0-or-later','LGPL-2.1-only','LGPL-2.1-or-later','LGPL-3.0-only',
    'LGPL-3.0-or-later','BSD-2-Clause','BSD-3-Clause','MPL-2.0','EUPL-1.2',
    'AGPL-3.0-only','AGPL-3.0-or-later','ISC','Zlib','Unlicense','CC0-1.0',
    'CC-BY-4.0','CC-BY-SA-4.0','0BSD','BSL-1.0','EPL-2.0',
  ];

  let SPDX_LICENSES = [...SPDX_FALLBACK];

  const SPDX_SOURCE_URL = 'https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json';
  const SPDX_CACHE_KEY  = 'cffgen-spdx-licenses';
  const SPDX_CACHE_TTL  = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Fetch the SPDX license list from spdx.org.
   * Returns a Promise that resolves when the list is ready (from cache or network).
   * On any error, silently keeps the fallback list.
   */
  const loadSPDXLicenses = async () => {
    // Try cache first
    try {
      const cached = localStorage.getItem(SPDX_CACHE_KEY);
      if (cached) {
        const { ts, licenses } = JSON.parse(cached);
        if (Date.now() - ts < SPDX_CACHE_TTL && Array.isArray(licenses) && licenses.length > 0) {
          SPDX_LICENSES = licenses;
          return;
        }
      }
    } catch (_) { /* ignore cache errors */ }

    // Fetch from network
    try {
      const res = await fetch(SPDX_SOURCE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const licenses = json.licenses
        .map(l => l.licenseId)
        .sort((a, b) => a.localeCompare(b));
      if (licenses.length > 0) {
        SPDX_LICENSES = licenses;
        try {
          localStorage.setItem(SPDX_CACHE_KEY, JSON.stringify({ ts: Date.now(), licenses }));
        } catch (_) { /* quota exceeded — skip caching */ }
      }
    } catch (err) {
      console.warn('[CFFGen] Could not fetch SPDX license list — using fallback.', err);
    }
  };

  const CFF_REFERENCE_TYPES = [
    { value: 'art', label: 'Art' },
    { value: 'article', label: 'Journal Article' },
    { value: 'audiovisual', label: 'Audiovisual' },
    { value: 'bill', label: 'Bill' },
    { value: 'blog', label: 'Blog' },
    { value: 'book', label: 'Book' },
    { value: 'catalogue', label: 'Catalogue' },
    { value: 'conference', label: 'Conference' },
    { value: 'conference-paper', label: 'Conference Paper' },
    { value: 'data', label: 'Data' },
    { value: 'database', label: 'Database' },
    { value: 'dataset', label: 'Dataset' },
    { value: 'dictionary', label: 'Dictionary' },
    { value: 'edited-work', label: 'Edited Work' },
    { value: 'encyclopedia', label: 'Encyclopedia' },
    { value: 'film-broadcast', label: 'Film/Broadcast' },
    { value: 'generic', label: 'Generic' },
    { value: 'government-document', label: 'Government Document' },
    { value: 'grant', label: 'Grant' },
    { value: 'hearing', label: 'Hearing' },
    { value: 'historical-work', label: 'Historical Work' },
    { value: 'legal-case', label: 'Legal Case' },
    { value: 'legal-rule', label: 'Legal Rule' },
    { value: 'magazine-article', label: 'Magazine Article' },
    { value: 'manual', label: 'Manual' },
    { value: 'map', label: 'Map' },
    { value: 'misc', label: 'Misc' },
    { value: 'music', label: 'Music' },
    { value: 'newspaper-article', label: 'Newspaper Article' },
    { value: 'pamphlet', label: 'Pamphlet' },
    { value: 'patent', label: 'Patent' },
    { value: 'personal-communication', label: 'Personal Communication' },
    { value: 'proceedings', label: 'Proceedings' },
    { value: 'report', label: 'Report' },
    { value: 'serial', label: 'Serial' },
    { value: 'slides', label: 'Slides' },
    { value: 'software', label: 'Software' },
    { value: 'software-code', label: 'Software Code' },
    { value: 'software-container', label: 'Software Container' },
    { value: 'software-executable', label: 'Software Executable' },
    { value: 'software-virtual-machine', label: 'Software Virtual Machine' },
    { value: 'sound-recording', label: 'Sound Recording' },
    { value: 'standard', label: 'Standard' },
    { value: 'statute', label: 'Statute' },
    { value: 'thesis', label: 'Thesis' },
    { value: 'unpublished', label: 'Unpublished' },
    { value: 'url', label: 'Web Resource / URL' },
    { value: 'video', label: 'Video' },
    { value: 'website', label: 'Website' },
  ];

  const IDENTIFIER_TYPES = [
    { value: 'doi', label: 'DOI', placeholder: '10.5281/zenodo.1234567', hint: 'Digital Object Identifier' },
    { value: 'url', label: 'URL', placeholder: 'https://example.com', hint: 'Uniform Resource Locator' },
    { value: 'swh', label: 'SWH', placeholder: 'swh:1:cnt:...', hint: 'Software Heritage Identifier' },
    { value: 'other', label: 'Other', placeholder: 'custom identifier', hint: 'Any other unique identifier' },
  ];

  const TEMPLATES = [
    {
      id: 'python-package',
      name: 'Python Package',
      icon: 'fa-brands fa-python',
      iconColor: '#3776AB',
      description: 'Template for a Python package published on PyPI with standard open-source metadata.',
      tags: ['python', 'package', 'pypi', 'software'],
      data: {
        'cff-version': '1.2.0',
        type: 'software',
        title: 'My Python Package',
        version: '1.0.0',
        message: 'If you use this software, please cite it using the metadata from this file.',
        abstract: 'A Python package for ...',
        license: 'MIT',
        'repository-code': 'https://github.com/username/my-package',
        'repository-artifact': 'https://pypi.org/project/my-package',
        keywords: ['python', 'science'],
        authors: [{
          type: 'person',
          'given-names': 'Jane',
          'family-names': 'Doe',
          email: 'jane@example.com',
          orcid: 'https://orcid.org/0000-0000-0000-0000',
          affiliation: 'My University'
        }]
      }
    },
    {
      id: 'r-package',
      name: 'R Package',
      icon: 'fa-brands fa-r-project',
      iconColor: '#276DC3',
      description: 'Template for an R package published on CRAN or Bioconductor.',
      tags: ['r', 'cran', 'statistics', 'software'],
      data: {
        'cff-version': '1.2.0',
        type: 'software',
        title: 'My R Package',
        version: '0.1.0',
        message: 'If you use this software, please cite it using the metadata from this file.',
        abstract: 'An R package implementing ...',
        license: 'GPL-3.0-only',
        'repository-code': 'https://github.com/username/mypackage',
        'repository-artifact': 'https://CRAN.R-project.org/package=mypackage',
        keywords: ['r', 'statistics'],
        authors: [{
          type: 'person',
          'given-names': 'John',
          'family-names': 'Smith',
          email: 'john@example.com',
          affiliation: 'Statistics Department'
        }]
      }
    },
    {
      id: 'research-software',
      name: 'Research Software',
      icon: 'fa-solid fa-flask',
      iconColor: '#00C9A7',
      description: 'Template for academic research software with a preferred citation pointing to a publication.',
      tags: ['research', 'academic', 'publication', 'preferred-citation'],
      data: {
        'cff-version': '1.2.0',
        type: 'software',
        title: 'Research Software Name',
        version: '2.0.0',
        message: 'Please cite our paper when using this software.',
        abstract: 'This software implements methods described in our paper.',
        license: 'Apache-2.0',
        'repository-code': 'https://github.com/research-group/software',
        keywords: ['research', 'simulation', 'computational'],
        authors: [{
          type: 'person',
          'given-names': 'Alice',
          'family-names': 'Researcher',
          orcid: 'https://orcid.org/0000-0000-0000-0001',
          affiliation: 'Research Institute'
        }],
        'preferred-citation': {
          type: 'article',
          title: 'Our Method Paper Title',
          year: 2024,
          journal: 'Journal of Computational Science',
          doi: '10.1234/example',
          authors: [{
            type: 'person',
            'given-names': 'Alice',
            'family-names': 'Researcher'
          }]
        }
      }
    },
    {
      id: 'ml-model',
      name: 'Machine Learning Model',
      icon: 'fa-solid fa-brain',
      iconColor: '#FF6584',
      description: 'Template for a trained ML model, dataset, or AI system released for research.',
      tags: ['ai', 'machine-learning', 'model', 'dataset'],
      data: {
        'cff-version': '1.2.0',
        type: 'software',
        title: 'My ML Model',
        version: '1.0.0',
        message: 'If you use this model in your research, please cite it.',
        abstract: 'A neural network model for ...',
        license: 'CC-BY-4.0',
        'repository-code': 'https://github.com/username/ml-model',
        url: 'https://huggingface.co/username/ml-model',
        keywords: ['machine-learning', 'deep-learning', 'neural-network'],
        authors: [{
          type: 'person',
          'given-names': 'Bob',
          'family-names': 'Scientist',
          affiliation: 'AI Research Lab'
        }]
      }
    },
    {
      id: 'dataset',
      name: 'Dataset',
      icon: 'fa-solid fa-database',
      iconColor: '#F9A825',
      description: 'Template for a published dataset with DOI and proper data citation metadata.',
      tags: ['dataset', 'data', 'zenodo', 'figshare'],
      data: {
        'cff-version': '1.2.0',
        type: 'dataset',
        title: 'My Research Dataset',
        version: '1.0',
        message: 'If you use this dataset, please cite it using the metadata from this file.',
        abstract: 'Dataset containing measurements of ...',
        license: 'CC0-1.0',
        url: 'https://zenodo.org/record/1234567',
        keywords: ['data', 'measurements'],
        authors: [{
          type: 'person',
          'given-names': 'Carol',
          'family-names': 'DataScientist',
          affiliation: 'Data Center'
        }],
        identifiers: [{
          type: 'doi',
          value: '10.5281/zenodo.1234567',
          description: 'Zenodo DOI'
        }]
      }
    },
    {
      id: 'organization',
      name: 'Organization / Team Project',
      icon: 'fa-solid fa-building',
      iconColor: '#29B6F6',
      description: 'Template for software developed by an organization or larger team.',
      tags: ['organization', 'team', 'enterprise'],
      data: {
        'cff-version': '1.2.0',
        type: 'software',
        title: 'Organization Project Name',
        version: '3.1.0',
        message: 'If you use this software, please cite it using the metadata from this file.',
        abstract: 'Enterprise software developed by Our Organization.',
        license: 'Apache-2.0',
        'repository-code': 'https://github.com/organization/project',
        url: 'https://project.organization.org',
        keywords: ['enterprise', 'production'],
        authors: [
          {
            type: 'entity',
            name: 'Our Organization',
            website: 'https://organization.org',
            email: 'contact@organization.org'
          },
          {
            type: 'person',
            'given-names': 'Lead',
            'family-names': 'Developer',
            email: 'lead@organization.org',
            affiliation: 'Our Organization'
          }
        ]
      }
    }
  ];

  const VALIDATION_RULES = [
    {
      id: 'required-cff-version',
      level: 'error',
      field: 'cff-version',
      label: 'CFF Version Required',
      description: 'The cff-version field is mandatory.',
      check: (data) => !!data['cff-version']
    },
    {
      id: 'required-message',
      level: 'error',
      field: 'message',
      label: 'Message Required',
      description: 'The message field is mandatory and should tell users how to cite.',
      check: (data) => !!data.message && data.message.trim().length > 0
    },
    {
      id: 'required-title',
      level: 'error',
      field: 'title',
      label: 'Title Required',
      description: 'The title field is mandatory.',
      check: (data) => !!data.title && data.title.trim().length > 0
    },
    {
      id: 'required-type',
      level: 'error',
      field: 'type',
      label: 'Type Required',
      description: 'The type field must be "software" or "dataset".',
      check: (data) => ['software','dataset'].includes(data.type)
    },
    {
      id: 'required-authors',
      level: 'error',
      field: 'authors',
      label: 'At Least One Author Required',
      description: 'The authors field must contain at least one author.',
      check: (data) => Array.isArray(data.authors) && data.authors.length > 0
    },
    {
      id: 'author-has-name',
      level: 'error',
      field: 'authors',
      label: 'All Authors Must Have a Name',
      description: 'Every person author needs family-names; every entity author needs name.',
      check: (data) => {
        if (!Array.isArray(data.authors)) return true;
        return data.authors.every(a =>
          a.type === 'entity' ? !!a.name : !!a['family-names']
        );
      }
    },
    {
      id: 'orcid-format',
      level: 'warning',
      field: 'authors',
      label: 'ORCID Format Should Be URL',
      description: 'ORCID should be a full URL: https://orcid.org/XXXX-XXXX-XXXX-XXXX',
      check: (data) => {
        if (!Array.isArray(data.authors)) return true;
        return data.authors.every(a => {
          if (!a.orcid) return true;
          return /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(a.orcid);
        });
      }
    },
    {
      id: 'version-semver',
      level: 'warning',
      field: 'version',
      label: 'Version Should Follow Semver',
      description: 'Version should follow semantic versioning (e.g. 1.0.0).',
      check: (data) => {
        if (!data.version) return true;
        return /^\d+\.\d+(\.\d+)?/.test(String(data.version));
      }
    },
    {
      id: 'date-released-format',
      level: 'error',
      field: 'date-released',
      label: 'Date Released Format',
      description: 'date-released must be in YYYY-MM-DD format.',
      check: (data) => {
        if (!data['date-released']) return true;
        return /^\d{4}-\d{2}-\d{2}$/.test(data['date-released']);
      }
    },
    {
      id: 'has-version',
      level: 'warning',
      field: 'version',
      label: 'Version Recommended',
      description: 'Adding a version number helps users cite a specific release.',
      check: (data) => !!data.version
    },
    {
      id: 'has-date-released',
      level: 'warning',
      field: 'date-released',
      label: 'Date Released Recommended',
      description: 'Adding a release date helps users identify the exact release.',
      check: (data) => !!data['date-released']
    },
    {
      id: 'has-license',
      level: 'warning',
      field: 'license',
      label: 'License Recommended',
      description: 'Specifying a license helps users understand how they can use the software.',
      check: (data) => !!(data.license || data['license-url'])
    },
    {
      id: 'has-repository',
      level: 'info',
      field: 'repository-code',
      label: 'Repository URL Recommended',
      description: 'A repository URL helps users find the source code.',
      check: (data) => !!(data['repository-code'] || data.repository || data.url)
    },
    {
      id: 'has-abstract',
      level: 'info',
      field: 'abstract',
      label: 'Abstract Recommended',
      description: 'An abstract gives context about what the software does.',
      check: (data) => !!data.abstract && data.abstract.trim().length > 10
    },
    {
      id: 'has-keywords',
      level: 'info',
      field: 'keywords',
      label: 'Keywords Recommended',
      description: 'Keywords improve discoverability of your software.',
      check: (data) => Array.isArray(data.keywords) && data.keywords.length > 0
    },
    {
      id: 'doi-format',
      level: 'warning',
      field: 'doi',
      label: 'DOI Should Not Have Prefix',
      description: 'The doi field should contain only the DOI, not the full URL.',
      check: (data) => {
        if (!data.doi) return true;
        return !data.doi.startsWith('http') && !data.doi.startsWith('doi:');
      }
    },
    {
      id: 'url-format',
      level: 'error',
      field: 'url',
      label: 'URL Must Be Valid',
      description: 'URLs must start with http:// or https://',
      check: (data) => {
        const urls = [data.url, data['repository-code'], data['repository-artifact'], data.repository].filter(Boolean);
        return urls.every(u => /^https?:\/\//.test(u));
      }
    },
    {
      id: 'message-not-empty-default',
      level: 'warning',
      field: 'message',
      label: 'Message Should Be Meaningful',
      description: 'Consider customizing the message beyond the default text.',
      check: (data) => {
        if (!data.message) return true;
        return data.message.trim().length > 20;
      }
    }
  ];

  return { get SPDX_LICENSES() { return SPDX_LICENSES; }, loadSPDXLicenses, CFF_REFERENCE_TYPES, IDENTIFIER_TYPES, TEMPLATES, VALIDATION_RULES };
})();
