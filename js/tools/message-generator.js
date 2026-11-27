/*!
 * MC Toolkit — Message Generator
 * UI for building colored Minecraft messages and exporting them as YAML.
 * Depends on: js/site.js (MCT), js/lib/mc-text.js (MCText)
 * MIT License — https://github.com/smmezp/mc-toolkit
 *
 * Share-link parameters (keep stable, links in the wild depend on them):
 *   t text, m mode, c colors, f format letters, p protect, o output, k key, q quotes,
 *   v view (yaml/raw), b preview background. All optional.
 */
(function () {
  'use strict';

  var MCText = window.MCText;
  var MCT = window.MCT;
  var MCControls = window.MCControls;
  if (!MCText || !MCT || !MCControls) return;

  var MAX_STOPS = MCControls.MAX_STOPS;
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

  var FORMATS = {
    hex: { name: 'Hex', hint: 'The most widely supported hex format: EssentialsX, TAB, DeluxeMenus and many more. Needs 1.16+.' },
    minimessage: { name: 'MiniMessage', hint: 'Paper and Adventure format. The plugin computes the gradient, so the output stays short.' },
    spigot: { name: 'Spigot hex', hint: 'For plugins that translate & codes with Bukkit’s standard method. Needs 1.16+.' },
    legacy: { name: 'Legacy', hint: 'Works on every version and plugin. Gradients use the closest of the 16 classic colors.' },
    section: { name: 'Section sign', hint: 'Pre-translated § codes for places that read raw formatting codes.' },
    cmi: { name: 'CMI', hint: 'For CMI and plugins built on CMILib.' }
  };

  var FORMAT_LETTERS = { bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', obfuscated: 'k' };

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  /** Reads state from the URL so shared links restore the full setup. */
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
    if (FORMATS[p.get('o')]) s.format = p.get('o');
    if (p.has('k')) s.key = p.get('k').slice(0, 200);
    if (p.get('q') === 'double') s.quote = 'double';
    if (p.get('v') === 'raw') s.view = 'raw';
    if (['chat', 'tooltip', 'plain'].indexOf(p.get('b')) !== -1) s.bg = p.get('b');
    if (s.mode !== 'solid' && s.colors.length < 2) s.colors.push('ffffff');
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
    if (state.view !== 'yaml') p.set('v', state.view);
    if (state.bg !== 'chat') p.set('b', state.bg);
    return window.location.origin + window.location.pathname + '?' + p.toString();
  }

  function isDefault() {
    return JSON.stringify(state) === JSON.stringify(cloneDefaults());
  }

  /** The address bar always reflects the current setup (debounced). */
  var syncTimer = null;
  function syncUrl() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      try {
        window.history.replaceState(null, '', isDefault() ? window.location.pathname : shareUrl());
      } catch (e) { /* ignore: some embedded browsers block history */ }
    }, 300);
  }

  var state = stateFromUrl();

  /* ------------------------------------------------------------------ */
  /* Elements                                                            */
  /* ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }

  var el = {
    text: $('mg-text'),
    toolbar: document.querySelector('.toolbar'),
    grad: $('mg-grad'),
    bar: $('mg-gradient-bar'),
    stops: $('mg-stops'),
    stopEditor: $('mg-stop-editor'),
    color: $('mg-color'),
    hex: $('mg-hex'),
    hexError: $('mg-hex-error'),
    remove: $('mg-remove'),
    reverse: $('mg-reverse'),
    addStop: $('mg-add-stop'),
    presetsField: $('mg-presets-field'),
    presets: $('mg-presets'),
    protect: $('mg-protect'),
    formatHint: $('mg-format-hint'),
    key: $('mg-key'),
    quote: $('mg-quote'),
    output: $('mg-output'),
    copy: $('mg-copy'),
    copyMobile: $('mg-copy-mobile'),
    copybar: $('mg-copybar'),
    copybarFormat: $('mg-copybar-format'),
    share: $('mg-share'),
    stats: $('mg-stats'),
    preview: $('mg-preview'),
    reset: $('mg-reset')
  };

  var radios = MCControls.radios;
  var setRadio = MCControls.setRadio;

  /* ------------------------------------------------------------------ */
  /* Shared controls (js/lib/controls.js)                                */
  /* ------------------------------------------------------------------ */

  var gradient = MCControls.gradientEditor({
    grad: el.grad,
    bar: el.bar,
    stops: el.stops,
    stopEditor: el.stopEditor,
    color: el.color,
    hex: el.hex,
    hexError: el.hexError,
    remove: el.remove,
    reverse: el.reverse,
    addStop: el.addStop,
    presetsField: el.presetsField,
    presets: el.presets
  }, {
    get: function () { return state; },
    onChange: function () { update(); }
  });

  var toolbar = MCControls.formatToolbar(el.toolbar, el.text, {
    get: function () { return state.formats; },
    onChange: function () { update(); }
  });

  /* ------------------------------------------------------------------ */
  /* Other controls                                                      */
  /* ------------------------------------------------------------------ */

  function syncControls() {
    el.text.value = state.text;
    setRadio('mode', state.mode);
    setRadio('view', state.view);
    setRadio('bg', state.bg);
    setRadio('outfmt', state.format);
    el.protect.checked = state.protect;
    el.key.value = state.key;
    el.quote.value = state.quote;
    el.preview.className = 'mc-screen mc-screen--' + state.bg;
    toolbar.sync();
  }

  el.text.addEventListener('input', function () {
    if (el.text.value.length > MAX_TEXT) el.text.value = el.text.value.slice(0, MAX_TEXT);
    state.text = el.text.value;
    update();
  });

  radios('mode').forEach(function (r) {
    r.addEventListener('change', function () {
      state.mode = r.value;
      gradient.render(state.mode === 'solid');
      update();
    });
  });

  radios('outfmt').forEach(function (r) {
    r.addEventListener('change', function () {
      state.format = r.value;
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
      el.preview.className = 'mc-screen mc-screen--' + state.bg;
      syncUrl();
    });
  });

  el.protect.addEventListener('change', function () {
    state.protect = el.protect.checked;
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

  /* Reset is destructive, so it offers an undo for a few seconds. */
  var undoState = null;
  var undoTimer = null;
  var resetLabel = el.reset.querySelector('[data-label]');

  function applyState(next) {
    state = next;
    syncControls();
    gradient.render(true);
    update();
  }

  el.reset.addEventListener('click', function () {
    clearTimeout(undoTimer);
    if (undoState) {
      applyState(undoState);
      undoState = null;
      resetLabel.textContent = 'Reset to example';
      MCT.announce('Your message is back');
      return;
    }
    if (isDefault()) return;
    undoState = JSON.parse(JSON.stringify(state));
    applyState(cloneDefaults());
    resetLabel.textContent = 'Undo reset';
    MCT.announce('Reset to the example message. Press Undo reset to restore yours.');
    undoTimer = setTimeout(function () {
      undoState = null;
      resetLabel.textContent = 'Reset to example';
    }, 8000);
  });

  /* ------------------------------------------------------------------ */
  /* Output                                                              */
  /* ------------------------------------------------------------------ */

  var lastOutput = '';

  function copyLabel() {
    return state.view === 'yaml' ? 'Copy YAML' : 'Copy text';
  }

  var setLabel = MCControls.setLabel;

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
      el.output.textContent = 'Type a message on the left to generate output.';
      el.output.classList.add('is-empty');
    } else {
      lastOutput = state.view === 'yaml'
        ? MCText.toYaml(values, state.key, state.quote)
        : values.join('\n');
      el.output.textContent = lastOutput;
      el.output.classList.remove('is-empty');
    }

    el.copy.disabled = !hasText;
    el.copyMobile.disabled = !hasText;
    setLabel(el.copy, copyLabel());
    setLabel(el.copyMobile, copyLabel());
    el.formatHint.textContent = FORMATS[state.format].hint;
    el.copybarFormat.textContent = FORMATS[state.format].name;

    var lineCount = result.lines.length;
    var longest = values.reduce(function (max, v) { return Math.max(max, v.length); }, 0);
    var nf = new Intl.NumberFormat();
    el.stats.textContent = hasText
      ? nf.format(lineCount) + (lineCount === 1 ? ' line, ' : ' lines, ') + nf.format(longest) + ' characters' + (lineCount > 1 ? ' in the longest' : '')
      : '';

    if (hasText) {
      MCText.renderPreview(el.preview, result.lines, state.formats);
      if (state.formats.obfuscated) MCText.scramble(el.preview);
    } else {
      el.preview.innerHTML = '<div class="mc-line" style="color:#aaaaaa">Your message will appear here.</div>';
    }
    el.preview.setAttribute('aria-label', hasText ? 'In-game preview: ' + state.text : 'In-game preview, empty');
    syncUrl();
  }

  function copyOutput(button) {
    if (!lastOutput) return;
    MCT.copy(lastOutput, 'Copied', button);
  }

  el.copy.addEventListener('click', function () { copyOutput(el.copy); });
  el.copyMobile.addEventListener('click', function () { copyOutput(el.copyMobile); });

  el.share.addEventListener('click', function () {
    MCT.copy(shareUrl(), 'Link copied', el.share);
  });

  /* Obfuscated text flickers like in game (not when motion is reduced). */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    setInterval(function () {
      if (state.formats.obfuscated && !document.hidden) MCText.scramble(el.preview);
    }, 70);
  }

  /* Mobile copy bar: hidden while the output panel is on screen. */
  MCControls.copybar(el.copybar, el.output.closest('.code-box'));

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  syncControls();
  gradient.render(true);
  update();
})();
