/* ═══════════════════════════════════════════════
   CFFGen — utils.js
   Helper functions, DOM utilities, toast, confirm
   ═══════════════════════════════════════════════ */

const Utils = (() => {

  /* ─── Toast Notifications ─── */
  const toast = (msg, type = 'info', duration = 3500) => {
    const bg = {
      success: 'linear-gradient(135deg, #00C9A7, #00B4D8)',
      error:   'linear-gradient(135deg, #ff4d6d, #ff6b8a)',
      warning: 'linear-gradient(135deg, #F9A825, #FFB300)',
      info:    'linear-gradient(135deg, #6C63FF, #a78bfa)',
    }[type] || 'linear-gradient(135deg, #6C63FF, #a78bfa)';

    const icon = {
      success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
    }[type] || 'ℹ';

    Toastify({
      text: `<span style="font-weight:700;margin-right:8px">${icon}</span>${msg}`,
      duration,
      gravity: 'bottom',
      position: 'center',
      escapeMarkup: false,
      style: {
        background: bg,
        borderRadius: '12px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.875rem',
        fontWeight: '500',
        padding: '12px 18px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        maxWidth: '380px',
      },
      className: 'toast-custom',
    }).showToast();
  };

  /* ─── Confirm Dialog ─── */
  const confirm = (title, message, dangerLabel = 'Confirm') => {
    return new Promise(resolve => {
      const overlay = document.getElementById('confirm-modal-overlay');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const yesBtn = document.getElementById('confirm-modal-yes');
      const noBtn = document.getElementById('confirm-modal-no');
      const closeBtn = document.getElementById('confirm-modal-close');

      titleEl.textContent = title;
      msgEl.textContent = message;
      yesBtn.textContent = dangerLabel;

      overlay.classList.add('open');

      const cleanup = (result) => {
        overlay.classList.remove('open');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        closeBtn.removeEventListener('click', onNo);
        resolve(result);
      };
      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
      closeBtn.addEventListener('click', onNo);
    });
  };

  /* ─── DOM ─── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };

  /* ─── String ─── */
  const slugify = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const truncate = (str, n = 60) => str.length > n ? str.slice(0, n) + '…' : str;
  const escapeYaml = (str) => {
    if (!str) return str;
    if (/[:#\[\]{},&*?|<>=!%@`'"\\]/.test(str) || /^\s|\s$/.test(str) || /\n/.test(str)) {
      return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return str;
  };
  const escapeHtml = (str) => DOMPurify.sanitize(str || '');

  /* ─── Date ─── */
  const today = () => dayjs().format('YYYY-MM-DD');
  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

  /* ─── YAML building ─── */
  const indent = (str, n = 2) => str.split('\n').map(l => ' '.repeat(n) + l).join('\n');

  const yamlValue = (val, indentLevel = 0, indentSize = 2) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return String(val);
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
      // Multi-line: use block literal
      if (val.includes('\n')) return `|-\n${val.split('\n').map(l => ' '.repeat(indentSize) + l).join('\n')}`;
      return escapeYaml(val);
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.map(v => {
        if (typeof v === 'object' && v !== null) {
          const mapped = yamlObject(v, indentLevel + 1, indentSize);
          return '- ' + mapped.trimStart();
        }
        return `- ${yamlValue(v, indentLevel + 1, indentSize)}`;
      });
      return '\n' + items.map(i => ' '.repeat(indentLevel * indentSize) + i).join('\n');
    }
    if (typeof val === 'object') {
      return '\n' + yamlObject(val, indentLevel + 1, indentSize).split('\n')
        .map(l => ' '.repeat(indentSize) + l).join('\n');
    }
    return String(val);
  };

  const yamlObject = (obj, indentLevel = 0, indentSize = 2) => {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        const val = yamlValue(v, indentLevel, indentSize);
        if (Array.isArray(v) && v.length > 0) return `${k}:${val}`;
        if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
          return `${k}:${val}`;
        }
        return `${k}: ${val}`;
      }).join('\n');
  };

  /* ─── Download ─── */
  const downloadText = (content, filename, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    saveAs(blob, filename);
  };

  /* ─── Clipboard ─── */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  };

  /* ─── Debounce / Throttle ─── */
  const debounce = _.debounce;
  const throttle = _.throttle;

  /* ─── Storage — IndexedDB with localStorage fallback ─── */
  const storage = (() => {
    const DB_NAME    = 'cffgen-db';
    const DB_VERSION = 1;
    const STORE      = 'kv';
    let _db = null;

    /* Open (or reuse) the IDB connection */
    const openDB = () => {
      if (_db) return Promise.resolve(_db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore(STORE);
        };
        req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
        req.onerror   = () => reject(req.error);
      });
    };

    /* Thin IDB transaction wrappers */
    const idbGet = async (key) => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror   = () => reject(req.error);
      });
    };
    const idbSet = async (key, val) => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).put(val, key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      });
    };
    const idbDel = async (key) => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      });
    };

    /* localStorage sync helpers (fallback + warm-cache for synchronous callers) */
    const lsGet = (key, fallback = null) => {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    };
    const lsSet = (key, val) => {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch { return false; }
    };
    const lsDel = (key) => { try { localStorage.removeItem(key); } catch {} };

    return {
      /* Async IDB-first get; falls back to localStorage */
      getAsync: async (key, fallback = null) => {
        try {
          const val = await idbGet(key);
          return val !== null ? val : fallback;
        } catch {
          return lsGet(key, fallback);
        }
      },

      /* Synchronous get — reads from localStorage warm-cache only */
      get: (key, fallback = null) => lsGet(key, fallback),

      /* Write to IDB + localStorage simultaneously */
      set: (key, val) => {
        lsSet(key, val);                 // sync warm-cache
        idbSet(key, val).catch(() => {}); // async persistent store
        return true;
      },

      /* Delete from both */
      remove: (key) => {
        lsDel(key);
        idbDel(key).catch(() => {});
      },
    };
  })();

  /* ─── URL validation ─── */
  const isValidUrl = (s) => {
    try { return ['http:', 'https:'].includes(new URL(s).protocol); }
    catch { return false; }
  };

  /* ─── Avatar initials ─── */
  const initials = (name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /* ─── Progress ring ─── */
  const setProgress = (pct) => {
    const fill = document.getElementById('progress-ring-fill');
    const pctEl = document.getElementById('progress-pct');
    if (!fill || !pctEl) return;
    const circumference = 2 * Math.PI * 14; // r=14
    const offset = circumference - (pct / 100) * circumference;
    fill.style.strokeDashoffset = offset;
    pctEl.textContent = Math.round(pct) + '%';
  };

  /* ─── Ripple effect ─── */
  const addRipple = (btn) => {
    btn.addEventListener('click', (e) => {
      const r = document.createElement('span');
      r.className = 'ripple-wave';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
      btn.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  };

  /* ─── Open / Close Modal ─── */
  const openModal = (id) => {
    const overlay = document.getElementById(id + '-overlay');
    if (overlay) {
      overlay.classList.add('open');
      // Focus first input
      setTimeout(() => {
        const first = overlay.querySelector('input:not([type="hidden"]), select, textarea');
        if (first) first.focus();
      }, 100);
    }
  };
  const closeModal = (id) => {
    const overlay = document.getElementById(id + '-overlay');
    if (overlay) overlay.classList.remove('open');
  };

  /* ─── Unique ID ─── */
  const uid = () => uuid.v4 ? uuid.v4() : Math.random().toString(36).slice(2);

  return {
    toast, confirm, $, $$, el,
    slugify, truncate, escapeYaml, escapeHtml,
    today, isValidDate,
    yamlObject, yamlValue,
    downloadText, copyText,
    debounce, throttle,
    storage, isValidUrl,
    initials, setProgress,
    addRipple, openModal, closeModal,
    uid
  };
})();
