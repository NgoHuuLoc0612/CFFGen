# CFFGen

A browser-based editor for creating and managing [`CITATION.cff`](https://citation-file-format.github.io/) files — the standard format for making software and datasets formally citable.

No build step, no account required. Serve the folder and open `index.html`.

---

## Running locally

The app loads fonts and libraries from CDN, so it **must be served over HTTP** — opening `index.html` directly as a `file://` URL will block CDN requests in most browsers.

```bash
# Python
python -m http.server 5500 --directory cffgen/

# Node
npx serve cffgen/

# VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

Then open `http://localhost:5500`.

---

## Features

### Editor tabs

| Tab | Contents |
|-----|----------|
| Overview | Title, version, type, abstract, license, date, DOI, URL, keywords, repository links |
| Authors | Person and entity authors with ORCID, affiliation, drag-to-reorder |
| Identifiers | DOI, URL, SWH, and other identifiers |
| References | Full reference list (all CFF reference types) |
| Preferred Citation | Separate citation record pointing to a paper |
| Validator | Per-rule validation results with error / warning / pass levels |
| Preview | Live CFF YAML, BibTeX, APA, MLA, and JSON-LD views |
| Import / Export | All import sources and export formats |
| Templates | Six starter templates |
| Settings | Theme, font size, indent, autosave, realtime preview, CodeMirror theme |

### Storage

State is persisted with **IndexedDB** (primary) and **localStorage** (warm-cache fallback for synchronous reads). Both are written on every change. Autosave runs every 30 seconds and on navigation away. Data survives a full page refresh.

### Licenses

The SPDX license list (~700+ identifiers) is fetched at startup from [`spdx/license-list-data`](https://github.com/spdx/license-list-data) on GitHub, which serves with CORS headers. The result is cached in localStorage for 7 days. If the fetch fails (offline, network error), a built-in fallback of ~25 common licenses is used. The license field uses a searchable Select2 dropdown.

### Import

| Source | Detail |
|--------|--------|
| File drag-and-drop | `.cff`, `.bib`, `codemeta.json` |
| File picker | Same formats |
| Remote URL | Any raw URL to a `.cff`, `.bib`, or `.json` file |
| GitHub shorthand | `owner/repo` — fetches `CITATION.cff` from `HEAD` |
| Zenodo | DOI (`10.5281/zenodo.…`), full URL, or bare record ID |

### Zenodo sync

Calls `https://zenodo.org/api/records/{id}` and maps: title, version, abstract, DOI, publication date, URL, keywords, authors (name, ORCID, affiliation), and license.

License resolution uses the full live SPDX list rather than a hardcoded table. Matching is case-insensitive. A small alias table handles Zenodo-specific IDs that differ from SPDX:

- `cc-zero` → `CC0-1.0`
- Deprecated short-forms: `gpl-3.0` → `GPL-3.0-only`, `lgpl-2.1` → `LGPL-2.1-only`, etc.
- `+` variants: `gpl-3.0+` → `GPL-3.0-or-later`, etc.
- Non-SPDX Zenodo values (`other-open`, `other-closed`) → `null` (field left empty)

### Export

| Format | File |
|--------|------|
| CITATION.cff | `.cff` download |
| BibTeX | `.bib` download |
| RIS | `.ris` download |
| JSON-LD | `.json` download |
| CodeMeta | `codemeta.json` download |
| Clipboard | Raw CFF YAML copied inline |

### Validation

Rules cover: required fields (cff-version, message, title, type, authors), author name completeness, ORCID format (`https://orcid.org/…`), SPDX license identifier validity, date format (`YYYY-MM-DD`), URL format, version format, abstract length, and message customisation. Results render per-rule in the Validator tab; the sidebar badge updates in real time.

### Templates

Six pre-filled starters selectable from the Templates tab:

- **Python package** — PyPI-style metadata
- **R package** — CRAN / Bioconductor layout
- **Research software** — with a preferred citation pointing to a paper
- **ML model / AI system** — trained model or dataset release
- **Dataset** — published dataset with DOI
- **Organization project** — team or institutional software

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Download `CITATION.cff` |
| `Ctrl+Shift+C` | Copy CFF YAML to clipboard |
| `Ctrl+Shift+V` | Open Import / Export tab |
| `Ctrl+Z` | Undo (when focus is not in a text field) |
| `Ctrl+1` … `Ctrl+8` | Jump to tab by position |
| `Alt+T` | Start guided tour |
| `?` | Show shortcuts reference |
| `Esc` | Close open modal |

---

## File structure

```
CFFGen/
├── index.html
├── favicon.ico
├── css/
│   ├── main.css          # Layout, CSS variables, base styles
│   ├── components.css    # Buttons, cards, modals, form controls
│   ├── editor.css        # CodeMirror overrides
│   └── animations.css    # Transitions and loading states
└── js/
    ├── app.js            # State, undo history, autosave, hotkeys, tour, boot
    ├── data.js           # SPDX fetch/cache, CFF schema metadata, templates, validation rules
    ├── ui.js             # Tabs, sidebar, theme, CodeMirror init, preview rendering
    ├── authors.js        # Author / entity form and list
    ├── references.js     # References and preferred-citation handling
    ├── validator.js      # Validation engine and results UI
    ├── import-export.js  # All import paths and export format generators
    ├── zenodo.js         # Zenodo REST API sync and license mapping
    ├── templates.js      # Template application logic
    └── utils.js          # IndexedDB+localStorage storage, toast, YAML helpers, DOM utils
```

---

## Dependencies (all CDN)

All loaded from `cdnjs.cloudflare.com` unless noted.

| Library | Version | Purpose |
|---------|---------|---------|
| jQuery | 3.7.1 | DOM, Select2 requirement |
| js-yaml | 4.1.0 | YAML parse / serialise |
| CodeMirror | 5.65.16 | Preview editor (YAML + JS modes, folding, search) |
| Select2 | 4.0.13 | Searchable license dropdown |
| flatpickr | 4.6.13 | Date picker |
| Shepherd.js | 11.2.0 | Guided tour |
| Tippy.js | 6.3.7 | Tooltips (requires Popper.js 2.11.8) |
| Toastify | 1.12.0 | Toast notifications |
| NProgress | 0.2.0 | Top progress bar for async ops |
| SortableJS | 1.15.2 | Drag-to-reorder author / reference lists |
| Lodash | 4.17.21 | Debounce, throttle |
| dayjs | 1.11.10 | Date formatting |
| Fuse.js | 7.0.0 | Fuzzy search |
| FileSaver.js | 2.0.5 | File download |
| marked | 9.1.6 | Markdown rendering |
| DOMPurify | 3.0.6 | HTML sanitisation |
| Chart.js | 4.4.1 | (UI charts) |
| canvas-confetti | 1.9.2 | Completion celebration |
| clipboard.js | 2.0.11 | Clipboard fallback |
| uuid | 8.3.2 | Unique IDs for authors / references |
| intro.js | 7.2.0 | Alternative tour engine (loaded, Shepherd used by default) |
| Google Fonts | — | DM Sans, Syne, JetBrains Mono |
| Font Awesome | 6.5.2 | Icons |
| SPDX license data | — | Fetched from `raw.githubusercontent.com/spdx/license-list-data` |

---

## References

- [Citation File Format specification](https://github.com/citation-file-format/citation-file-format/blob/main/schema-guide.md)
- [SPDX license list](https://spdx.org/licenses/)
- [Zenodo REST API](https://developers.zenodo.org/)