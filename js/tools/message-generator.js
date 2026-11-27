/*!
 * MC Toolkit — Message Generator
 * UI for building colored Minecraft messages and exporting them as YAML.
 * Depends on: js/site.js (MCT), js/lib/mc-text.js (MCText)
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function () {
  'use strict';

  var MCText = window.MCText;
  var MCT = window.MCT;
  if (!MCText || !MCT) return;

  var MAX_STOPS = 8;
  var MAX_TEXT = 2000;

  var DEFAULTS = {
    text: 'Welcome to the server, %player_name%!',
    mode: 'gradient',
    colors: ['8ccfff', 'a78bfa'],
    formats: { bold: true },
    protect: true,
    format: 'hex',
    key: 'messages.welcome',
    quote: 'single',
    view: 'yaml',
    bg: 'chat'
  };

  var PRESETS = [
    { name: 'Celestial', colors: ['8ccfff', 'a78bfa'] },
    { name: 'Aurora', colors: ['00f5a0', '00d9f5', 'a78bfa'] },
    { name: 'Ocean', colors: ['00c6ff', '0072ff'] },
    { name: 'Sunset', colors: ['ff7e5f', 'feb47b'] },
    { name: 'Ember', colors: ['ff512f', 'f09819'] },
    { name: 'Gold', colors: ['fff1a8', 'f5b700', 'c98a00'] },
    { name: 'Mint', colors: ['43e97b', '38f9d7'] },
    { name: 'Blossom', colors: ['ff9a9e', 'fecfef', 'a18cd1'] },
    { name: 'Toxic', colors: ['b6ff00', '00ff6a'] },
    { name: 'Mono', colors: ['ffffff', '8a8a8a'] }
  ];

  var FORMAT_HINTS = {
    hex: 'Most widely supported hex format: EssentialsX, TAB, DeluxeMenus and many more. Requires 1.16+.',
    minimessage: 'Paper / Adventure format. The plugin computes the gradient, so the output stays short.',
    spigot: 'For plugins that translate & codes with Bukkit’s standard method. Requires 1.16+.',
    legacy: 'Works on every version and plugin. Gradients are approximated with the 16 classic colors.',
    section: 'Pre-translated § codes for places that read raw formatting codes.',
    cmi: 'For CMI and plugins built on CMILib.'
  };

  var FORMAT_LETTERS = { bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', obfuscated: 'k' };

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  /** Reads state from the URL (?t=...&m=...) so links can be shared. */
  function stateFromUrl() {
    var s = cloneDefaults();
    var p;
    try {
      p = new URLSearchParams(window.location.search);
    } catch (e) {
      return s;
    }
    if (!p.toString()) return s;

    if (p.has('t')) s.text = p.get('t').slice(0, MAX_TEXT);
    if (['solid', 'gradient', 'rainbow'].indexOf(p.get('m')) !== -1) s.mode = p.get('m');
    if (p.has('c')) {
      var colors = p.get('c').split(/[,\s]+/).map(MCText.normalizeHex).filter(Boolean).slice(0, MAX_STOPS);
      if (colors.length) s.colors = colors;
    }
    if (p.has('f')) {
      s.formats = {};
      var letters = p.get('f');
      Object.keys(FORMAT_LETTERS).forEach(function (k) {
        if (letters.indexOf(FORMAT_LETTERS[k]) !== -1) s.formats[k] = true;
      });
    }
    if (p.has('p')) s.protect = p.get('p') !== '0';
    if (FORMAT_HINTS[p.get('o')]) s.format = p.get('o');
    if (p.has('k')) s.key = p.get('k').slice(0, 200);
    if (p.get('q') === 'double') s.quote = 'double';
    return s;
  }

  function shareUrl() {
    var p = new URLSearchParams();
    p.set('t', state.text);
    p.set('m', state.mode);
    p.set('c', state.colors.join(','));
    p.set('f', Object.keys(FORMAT_LETTERS).filter(function (k) { return state.formats[k]; })
      .map(function (k) { return FORMAT_LETTERS[k]; }).join(''));
    p.set('p', state.protect ? '1' : '0');
    p.set('o', state.format);
    p.set('k', state.key);
    p.set('q', state.quote);
    return window.location.origin + window.location.pathname + '?' + p.toString();
  }

  var state = stateFromUrl();

  /* ------------------------------------------------------------------ */
  /* Elements                                                            */
  /* ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }

  var el = {
    text: $('mg-text'),
    stops: $('mg-stops'),
    addStop: $('mg-add-stop'),
    reverse: $('mg-reverse'),
    bar: $('mg-gradient-bar'),
    colorsField: $('mg-colors-field'),
    presetsField: $('mg-presets-field'),
    presets: $('mg-presets'),
    protect: $('mg-protect'),
    format: $('mg-format'),
    formatHint: $('mg-format-hint'),
    key: $('mg-key'),
    quote: $('mg-quote'),
    output: $('mg-output'),
    copy: $('mg-copy'),
    share: $('mg-share'),
    stats: $('mg-stats'),
    preview: $('mg-preview'),
    reset: $('mg-reset')
  };

  /* ------------------------------------------------------------------ */
  /* Color stops                                                         */
  /* ------------------------------------------------------------------ */

  var REMOVE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function visibleStopCount() {
    return state.mode === 'solid' ? 1 : state.colors.length;
  }

  function renderStops() {
    var count = visibleStopCount();
    el.stops.textContent = '';

    for (var i = 0; i < count; i++) {
      var row = document.createElement('div');
      row.className = 'stop';
      row.dataset.index = String(i);

      var picker = document.createElement('input');
      picker.type = 'color';
      picker.value = '#' + state.colors[i];
      picker.setAttribute('aria-label', 'Color ' + (i + 1) + ' picker');
      picker.dataset.role = 'picker';

      var hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'input input-mono';
      hex.value = '#' + state.colors[i];
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.autocomplete = 'off';
      hex.setAttribute('autocapitalize', 'off');
      hex.setAttribute('aria-label', 'Color ' + (i + 1) + ' hex code');
      hex.dataset.role = 'hex';

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-ghost btn-icon';
      remove.innerHTML = REMOVE_ICON;
      remove.setAttribute('aria-label', 'Remove color ' + (i + 1));
      remove.dataset.role = 'remove';
      remove.disabled = count <= 2;
      remove.style.visibility = state.mode === 'solid' ? 'hidden' : '';

      row.appendChild(picker);
      row.appendChild(hex);
      row.appendChild(remove);
      el.stops.appendChild(row);
    }

    el.addStop.hidden = state.mode === 'solid';
    el.reverse.hidden = state.mode === 'solid';
    el.addStop.disabled = state.colors.length >= MAX_STOPS;
    renderBar();
  }

  function renderBar() {
    var colors = state.mode === 'solid' ? [state.colors[0], state.colors[0]] : state.colors;
    el.bar.style.background = 'linear-gradient(90deg, ' + colors.map(function (c) { return '#' + c; }).join(', ') + ')';
  }

  /** Updates one stop without re-rendering the list (keeps focus while typing). */
  function setStop(index, hex, source) {
    state.colors[index] = hex;
    var row = el.stops.querySelector('[data-index="' + index + '"]');
    if (row) {
      if (source !== 'picker') row.querySelector('[data-role="picker"]').value = '#' + hex;
      if (source !== 'hex') row.querySelector('[data-role="hex"]').value = '#' + hex;
    }
    renderBar();
    update();
  }

  el.stops.addEventListener('input', function (e) {
    var row = e.target.closest('.stop');
    if (!row) return;
    var index = Number(row.dataset.index);
    var role = e.target.dataset.role;
    if (role === 'picker') {
      setStop(index, MCText.normalizeHex(e.target.value), 'picker');
    } else if (role === 'hex') {
      var hex = MCText.normalizeHex(e.target.value);
      e.target.setAttribute('aria-invalid', hex ? 'false' : 'true');
      if (hex && e.target.value.replace('#', '').length === 6) setStop(index, hex, 'hex');
    }
  });

  el.stops.addEventListener('change', function (e) {
    if (e.target.dataset.role !== 'hex') return;
    var index = Number(e.target.closest('.stop').dataset.index);
    var hex = MCText.normalizeHex(e.target.value);
    if (hex) setStop(index, hex, 'blur');
    else e.target.value = '#' + state.colors[index];
    e.target.setAttribute('aria-invalid', 'false');
  });

  el.stops.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-role="remove"]');
    if (!btn || state.colors.length <= 2) return;
    state.colors.splice(Number(btn.closest('.stop').dataset.index), 1);
    renderStops();
    update();
  });

  el.addStop.addEventListener('click', function () {
    if (state.colors.length >= MAX_STOPS) return;
    // New stop starts as a lighter shade of the current last color.
    var last = state.colors[state.colors.length - 1];
    var next = MCText.sampleGradient([last, 'ffffff'], 0.35);
    state.colors.push(next);
    renderStops();
    update();
    var inputs = el.stops.querySelectorAll('[data-role="hex"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  el.reverse.addEventListener('click', function () {
    state.colors.reverse();
    renderStops();
    update();
  });

  /* ------------------------------------------------------------------ */
  /* Presets                                                             */
  /* ------------------------------------------------------------------ */

  PRESETS.forEach(function (preset) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset';
    var dot = document.createElement('i');
    dot.style.background = 'linear-gradient(135deg, ' + preset.colors.map(function (c) { return '#' + c; }).join(', ') + ')';
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(preset.name));
    btn.addEventListener('click', function () {
      state.colors = preset.colors.slice();
      if (state.mode !== 'gradient') {
        state.mode = 'gradient';
        syncControls();
      }
      renderStops();
      update();
    });
    el.presets.appendChild(btn);
  });

  /* ------------------------------------------------------------------ */
  /* Other controls                                                      */
  /* ------------------------------------------------------------------ */

  function radios(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]'));
  }

  function setRadio(name, value) {
    radios(name).forEach(function (r) { r.checked = r.value === value; });
  }

  function syncControls() {
    el.text.value = state.text;
    setRadio('mode', state.mode);
    setRadio('view', state.view);
    setRadio('bg', state.bg);
    radios('format').forEach(function (c) { c.checked = !!state.formats[c.value]; });
    el.protect.checked = state.protect;
    el.format.value = state.format;
    el.key.value = state.key;
    el.quote.value = state.quote;
    el.colorsField.hidden = state.mode === 'rainbow';
    el.presetsField.hidden = state.mode !== 'gradient';
    el.preview.className = 'mc-screen preview-screen mc-screen--' + state.bg;
  }

  el.text.addEventListener('input', function () {
    if (el.text.value.length > MAX_TEXT) el.text.value = el.text.value.slice(0, MAX_TEXT);
    state.text = el.text.value;
    update();
  });

  radios('mode').forEach(function (r) {
    r.addEventListener('change', function () {
      state.mode = r.value;
      if (state.mode !== 'solid' && state.colors.length < 2) {
        state.colors.push(MCText.sampleGradient([state.colors[0], 'ffffff'], 0.5));
      }
      syncControls();
      renderStops();
      update();
    });
  });

  radios('format').forEach(function (c) {
    c.addEventListener('change', function () {
      state.formats[c.value] = c.checked;
      update();
    });
  });

  radios('view').forEach(function (r) {
    r.addEventListener('change', function () {
      state.view = r.value;
      update();
    });
  });

  radios('bg').forEach(function (r) {
    r.addEventListener('change', function () {
      state.bg = r.value;
      syncControls();
    });
  });

  el.protect.addEventListener('change', function () {
    state.protect = el.protect.checked;
    update();
  });

  el.format.addEventListener('change', function () {
    state.format = el.format.value;
    update();
  });

  el.key.addEventListener('input', function () {
    state.key = el.key.value;
    update();
  });

  el.quote.addEventListener('change', function () {
    state.quote = el.quote.value;
    update();
  });

  el.reset.addEventListener('click', function () {
    state = cloneDefaults();
    syncControls();
    renderStops();
    update();
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch (e) { /* ignore */ }
  });

  /* ------------------------------------------------------------------ */
  /* Output                                                              */
  /* ------------------------------------------------------------------ */

  var lastOutput = '';

  function update() {
    var result = MCText.build(state.text, {
      mode: state.mode,
      colors: state.mode === 'solid' ? [state.colors[0]] : state.colors,
      formats: state.formats,
      protect: state.protect,
      format: state.format
    });

    var values = result.lines.map(function (l) { return l.output; });
    var hasText = state.text.trim().length > 0;

    if (!hasText) {
      lastOutput = '';
      el.output.textContent = 'Type a message to generate output.';
      el.output.style.color = 'var(--text-3)';
    } else {
      lastOutput = state.view === 'yaml'
        ? MCText.toYaml(values, state.key, state.quote)
        : values.join('\n');
      el.output.textContent = lastOutput;
      el.output.style.color = '';
    }

    el.copy.disabled = !hasText;
    el.formatHint.textContent = FORMAT_HINTS[state.format];

    var lineCount = result.lines.length;
    var longest = values.reduce(function (max, v) { return Math.max(max, v.length); }, 0);
    el.stats.textContent = hasText
      ? lineCount + (lineCount === 1 ? ' line' : ' lines') + ' · longest ' + longest + ' characters'
      : '';

    MCText.renderPreview(el.preview, result.lines, state.formats);
    if (state.formats.obfuscated) MCText.scramble(el.preview);
  }

  el.copy.addEventListener('click', function () {
    if (lastOutput) MCT.copy(lastOutput, state.view === 'yaml' ? 'YAML copied' : 'Text copied');
  });

  el.share.addEventListener('click', function () {
    var url = shareUrl();
    try {
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
    MCT.copy(url, 'Share link copied');
  });

  /* Obfuscated text flickers like in game. */
  setInterval(function () {
    if (state.formats.obfuscated && !document.hidden) MCText.scramble(el.preview);
  }, 70);

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  syncControls();
  renderStops();
  update();
})();
