/* ═══════════════════════════════════════════════
   CFFGen — validator.js
   CFF validation engine, YAML syntax, schema checks
   ═══════════════════════════════════════════════ */

const Validator = (() => {

  /* ─── Run all rules ─── */
  const validate = (state) => {
    const results = [];
    const data = Generator.buildCFFObject(state);

    CFFData.VALIDATION_RULES.forEach(rule => {
      const passed = rule.check(data);
      results.push({
        id: rule.id,
        level: passed ? 'success' : rule.level,
        field: rule.field,
        label: rule.label,
        description: rule.description,
        passed,
      });
    });

    // SPDX license validation — live check against full SPDX list
    if (data.license) {
      const spdx = validateSPDX(data.license);
      results.push({
        id: 'spdx-license-id',
        level: spdx.valid ? 'success' : 'error',
        field: 'license',
        label: 'Valid SPDX License Identifier',
        description: spdx.valid
          ? `"${data.license}" is a recognized SPDX identifier.`
          : (spdx.reason || `"${data.license}" is not a valid SPDX identifier. See https://spdx.org/licenses/`),
        passed: spdx.valid,
      });
    }

    return results;
  };

  /* ─── Validate SPDX license identifier ─── */
  const validateSPDX = (licenseId) => {
    if (!licenseId) return { valid: true, reason: null }; // empty is OK (use license-url instead)
    const id = licenseId.trim();

    // Allow SPDX expressions with AND/OR/WITH operators
    // Strip operators and check each identifier token
    const tokens = id
      .replace(/\bAND\b|\bOR\b|\bWITH\b/g, ' ')
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    const invalid = tokens.filter(t => !CFFData.SPDX_LICENSES.includes(t));
    if (invalid.length > 0) {
      return {
        valid: false,
        reason: `Unknown SPDX identifier${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`,
      };
    }
    return { valid: true, reason: null };
  };

  /* ─── Validate YAML syntax ─── */
  const validateYAML = (yamlStr) => {
    try {
      jsyaml.load(yamlStr);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  };

  /* ─── Compute completeness score ─── */
  const computeScore = (state) => {
    const data = Generator.buildCFFObject(state);

    const categories = {
      'Required Fields': {
        weight: 40,
        checks: [
          { label: 'CFF Version', ok: !!data['cff-version'] },
          { label: 'Message', ok: !!data.message },
          { label: 'Title', ok: !!data.title },
          { label: 'Type', ok: !!data.type },
          { label: 'Authors', ok: Array.isArray(data.authors) && data.authors.length > 0 },
        ]
      },
      'Recommended Fields': {
        weight: 35,
        checks: [
          { label: 'Version', ok: !!data.version },
          { label: 'Date Released', ok: !!data['date-released'] },
          { label: 'License', ok: !!(data.license || data['license-url']) },
          { label: 'Abstract', ok: !!data.abstract },
          { label: 'Repository URL', ok: !!(data['repository-code'] || data.repository) },
        ]
      },
      'Optional Metadata': {
        weight: 15,
        checks: [
          { label: 'DOI', ok: !!data.doi },
          { label: 'Keywords', ok: Array.isArray(data.keywords) && data.keywords.length > 0 },
          { label: 'Website URL', ok: !!data.url },
        ]
      },
      'Enhanced Citation': {
        weight: 10,
        checks: [
          { label: 'Author ORCID', ok: Array.isArray(data.authors) && data.authors.some(a => a.orcid) },
          { label: 'Author Affiliation', ok: Array.isArray(data.authors) && data.authors.some(a => a.affiliation) },
          { label: 'Identifiers', ok: Array.isArray(data.identifiers) && data.identifiers.length > 0 },
        ]
      }
    };

    let totalScore = 0;
    const breakdown = {};

    Object.entries(categories).forEach(([name, cat]) => {
      const passed = cat.checks.filter(c => c.ok).length;
      const total = cat.checks.length;
      const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
      const catScore = (pct / 100) * cat.weight;
      totalScore += catScore;
      breakdown[name] = { passed, total, pct, weight: cat.weight };
    });

    return {
      score: Math.round(totalScore),
      breakdown
    };
  };

  /* ─── Render validation results ─── */
  const renderResults = (results, container) => {
    container.innerHTML = '';

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="validation-placeholder"><i class="fa-solid fa-shield"></i><p>No validation results</p></div>';
      return;
    }

    const errors = results.filter(r => !r.passed && r.level === 'error');
    const warnings = results.filter(r => !r.passed && r.level === 'warning');
    const infos = results.filter(r => !r.passed && r.level === 'info');
    const successes = results.filter(r => r.passed);

    // Summary banner
    const summary = document.createElement('div');
    if (errors.length === 0 && warnings.length === 0) {
      summary.className = 'validation-summary all-good';
      summary.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <span>All checks passed! Your CITATION.cff is valid.</span>
        <div class="validation-summary-stats">
          <span class="v-stat" style="color:var(--success)"><i class="fa-solid fa-check"></i> ${successes.length} passed</span>
        </div>
      `;
    } else if (errors.length > 0) {
      summary.className = 'validation-summary has-errors';
      summary.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${errors.length} error${errors.length > 1 ? 's' : ''} found. Please fix before publishing.</span>
        <div class="validation-summary-stats">
          <span class="v-stat" style="color:var(--danger)"><i class="fa-solid fa-xmark"></i> ${errors.length} errors</span>
          <span class="v-stat" style="color:var(--warning)"><i class="fa-solid fa-triangle-exclamation"></i> ${warnings.length} warnings</span>
          <span class="v-stat" style="color:var(--success)"><i class="fa-solid fa-check"></i> ${successes.length} passed</span>
        </div>
      `;
    } else {
      summary.className = 'validation-summary has-warnings';
      summary.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${warnings.length} warning${warnings.length > 1 ? 's' : ''} — consider addressing these.</span>
        <div class="validation-summary-stats">
          <span class="v-stat" style="color:var(--warning)"><i class="fa-solid fa-triangle-exclamation"></i> ${warnings.length} warnings</span>
          <span class="v-stat" style="color:var(--success)"><i class="fa-solid fa-check"></i> ${successes.length} passed</span>
        </div>
      `;
    }
    container.appendChild(summary);

    // Group: Errors → Warnings → Info → Successes
    const groups = [
      { items: errors, level: 'error' },
      { items: warnings, level: 'warning' },
      { items: infos, level: 'info' },
      { items: successes, level: 'success' },
    ];

    const iconMap = { error: 'xmark', warning: 'triangle-exclamation', info: 'circle-info', success: 'check' };

    groups.forEach(({ items, level }) => {
      items.forEach(r => {
        const item = document.createElement('div');
        item.className = `validation-item ${level}`;
        item.innerHTML = `
          <div class="validation-item-icon">
            <i class="fa-solid fa-${iconMap[level]}"></i>
          </div>
          <div class="validation-item-body">
            <div class="validation-item-title">${r.label}</div>
            <div class="validation-item-desc">${r.description}</div>
            ${r.field ? `<span class="validation-item-field">${r.field}</span>` : ''}
          </div>
        `;
        container.appendChild(item);
      });
    });
  };

  /* ─── Render score ─── */
  const renderScore = (scoreData) => {
    const wrap = document.getElementById('validation-score-wrap');
    const scoreVal = document.getElementById('score-val');
    const arc = document.getElementById('score-arc');
    const breakdown = document.getElementById('score-breakdown');

    if (!wrap) return;
    wrap.style.display = 'block';

    const score = scoreData.score;
    scoreVal.textContent = score;

    // Arc color
    if (score >= 80) arc.style.stroke = '#00C9A7';
    else if (score >= 50) arc.style.stroke = '#F9A825';
    else arc.style.stroke = '#ff4d6d';

    // Animate arc
    const circumference = 282.7;
    const offset = circumference - (score / 100) * circumference;
    setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);

    // Breakdown
    breakdown.innerHTML = '';
    Object.entries(scoreData.breakdown).forEach(([name, cat]) => {
      const item = document.createElement('div');
      item.className = 'score-item';
      item.innerHTML = `
        <span class="score-item-label">${name}</span>
        <div class="score-bar-wrap">
          <div class="score-bar-fill" style="width:0%"></div>
        </div>
        <span class="score-item-val">${cat.pct}%</span>
      `;
      breakdown.appendChild(item);
      setTimeout(() => {
        item.querySelector('.score-bar-fill').style.width = cat.pct + '%';
      }, 200);
    });
  };

  /* ─── Update sidebar badge ─── */
  const updateBadge = (results) => {
    const badge = document.getElementById('sidebar-validation-badge');
    const text = document.getElementById('sidebar-validation-text');
    if (!badge || !text) return;

    const errors = results.filter(r => !r.passed && r.level === 'error').length;
    const warnings = results.filter(r => !r.passed && r.level === 'warning').length;

    badge.className = 'validation-badge';
    if (errors > 0) {
      badge.classList.add('invalid');
      badge.querySelector('i').className = 'fa-solid fa-circle-xmark';
      text.textContent = `${errors} error${errors > 1 ? 's' : ''}`;
    } else if (warnings > 0) {
      badge.classList.add('warning');
      badge.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
      text.textContent = `${warnings} warning${warnings > 1 ? 's' : ''}`;
    } else {
      badge.classList.add('valid');
      badge.querySelector('i').className = 'fa-solid fa-circle-check';
      text.textContent = 'Valid CFF';
    }
  };

  return { validate, validateYAML, validateSPDX, computeScore, renderResults, renderScore, updateBadge };
})();
