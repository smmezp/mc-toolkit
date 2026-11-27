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

  var FORMATS = {
    hex: { name: 'Hex', hint: 'The most widely supported hex format: EssentialsX, TAB, DeluxeMenus and many more. Needs 1.16+.' },
    minimessage: { name: 'MiniMessage', hint: 'Paper and Adventure format. The plugin computes the gradient, so the output stays short.' },
    spigot: { name: 'Spigot hex', hint: 'For plugins that translate & codes with Bukkit’s standard method. Needs 1.16+.' },
    legacy: { name: 'Legacy', hint: 'Works on every version and plugin. Gradients use the closest of the 16 classic colors.' },
    section: { name: 'Section sign', hint: 'Pre-translated § codes for places that read raw formatting codes.' },
    cmi: { name: 'CMI', hint: 'For CMI and plugins built on CMILib.' }
  };

  var FORMAT_LETTERS = { bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', obfuscated: 'k' };
  var SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };

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
  var selected = 0;

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

  function radios(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]'));
  }

  function setRadio(name, value) {
    radios(name).forEach(function (r) { r.checked = r.value === value; });
  }

  /* ------------------------------------------------------------------ */
  /* Gradient editor                                                     */
  /* ------------------------------------------------------------------ */

  function activeColors() {
    return state.mode === 'solid' ? [state.colors[0]] : state.colors;
  }

  function renderBar() {
    var bg;
    if (state.mode === 'rainbow') {
      bg = 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
    } else if (state.mode === 'solid') {
      bg = '#' + state.colors[0];
    } else {
      bg = 'linear-gradient(90deg, ' + state.colors.map(function (c) { return '#' + c; }).join(', ') + ')';
    }
    el.bar.style.background = bg;
  }

  /** Stop markers sit on the bar at their real (evenly spaced) positions. */
  function renderStops() {
    var colors = activeColors();
    if (selected >= colors.length) selected = colors.length - 1;
    el.stops.textContent = '';

    if (state.mode !== 'rainbow') {
      colors.forEach(function (c, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'grad-stop';
        b.dataset.index = String(i);
        b.style.setProperty('--stop', '#' + c);
        b.style.left = colors.length > 1 ? (i / (colors.length - 1)) * 100 + '%' : '0%';
        b.setAttribute('aria-pressed', i === selected ? 'true' : 'false');
        b.setAttribute('aria-label', 'Color ' + (i + 1) + ' of ' + colors.length + ', #' + c);
        el.stops.appendChild(b);
      });
    }

    var showEditor = state.mode !== 'rainbow';
    el.stopEditor.hidden = !showEditor;
    el.grad.classList.toggle('is-rainbow', !showEditor);
    el.remove.hidden = state.mode === 'solid';
    el.reverse.hidden = state.mode === 'solid';
    el.addStop.hidden = state.mode === 'solid';
    el.remove.disabled = state.colors.length <= 2;
    el.addStop.disabled = state.colors.length >= MAX_STOPS;
    el.presetsField.hidden = state.mode !== 'gradient';
    renderBar();
    syncStopEditor();
  }

  function syncStopEditor() {
    var c = state.colors[selected];
    el.color.value = '#' + c;
    if (document.activeElement !== el.hex) el.hex.value = '#' + c;
    el.hex.setAttribute('aria-invalid', 'false');
    el.hexError.hidden = true;
  }

  function setSelectedColor(hex, fromHexInput) {
    state.colors[selected] = hex;
    var marker = el.stops.querySelector('[data-index="' + selected + '"]');
    if (marker) {
      marker.style.setProperty('--stop', '#' + hex);
      marker.setAttribute('aria-label', 'Color ' + (selected + 1) + ' of ' + activeColors().length + ', #' + hex);
    }
    el.color.value = '#' + hex;
    if (!fromHexInput) el.hex.value = '#' + hex;
    renderBar();
    update();
  }

  el.stops.addEventListener('click', function (e) {
    var b = e.target.closest('.grad-stop');
    if (!b) return;
    selected = Number(b.dataset.index);
    renderStops();
    var again = el.stops.querySelector('[data-index="' + selected + '"]');
    if (again) again.focus();
  });

  // Arrow keys move between stops.
  el.stops.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var count = activeColors().length;
    selected = (selected + (e.key === 'ArrowRight' ? 1 : count - 1)) % count;
    renderStops();
    el.stops.querySelector('[data-index="' + selected + '"]').focus();
    e.preventDefault();
  });

  el.color.addEventListener('input', function () {
    var hex = MCText.normalizeHex(el.color.value);
    if (hex) setSelectedColor(hex, false);
  });

  el.hex.addEventListener('input', function () {
    var raw = el.hex.value.trim();
    var hex = MCText.normalizeHex(raw);
    var complete = raw.replace('#', '').length === 6;
    if (hex && complete) {
      el.hex.setAttribute('aria-invalid', 'false');
      el.hexError.hidden = true;
      setSelectedColor(hex, true);
    }
  });

  el.hex.addEventListener('change', function () {
    var hex = MCText.normalizeHex(el.hex.value);
    if (hex) {
      setSelectedColor(hex, false);
      el.hex.setAttribute('aria-invalid', 'false');
      el.hexError.hidden = true;
    } else {
      el.hex.setAttribute('aria-invalid', 'true');
      el.hexError.hidden = false;
    }
  });

  el.hex.addEventListener('blur', function () {
    if (el.hex.getAttribute('aria-invalid') === 'true') return;
    el.hex.value = '#' + state.colors[selected];
  });

  el.remove.addEventListener('click', function () {
    if (state.colors.length <= 2) return;
    state.colors.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    renderStops();
    update();
  });

  el.addStop.addEventListener('click', function () {
    if (state.colors.length >= MAX_STOPS) return;
    // The new stop starts as a lighter shade of the current last color.
    var last = state.colors[state.colors.length - 1];
    state.colors.push(MCText.sampleGradient([last, 'ffffff'], 0.35));
    selected = state.colors.length - 1;
    renderStops();
    update();
    el.color.focus();
  });

  el.reverse.addEventListener('click', function () {
    state.colors.reverse();
    selected = state.colors.length - 1 - selected;
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
    var chip = document.createElement('i');
    chip.style.background = 'linear-gradient(90deg, ' + preset.colors.map(function (c) { return '#' + c; }).join(', ') + ')';
    chip.setAttribute('aria-hidden', 'true');
    btn.appendChild(chip);
    btn.appendChild(document.createTextNode(preset.name));
    btn.addEventListener('click', function () {
      state.colors = preset.colors.slice();
      selected = 0;
      renderStops();
      update();
      MCT.announce(preset.name + ' preset applied');
    });
    el.presets.appendChild(btn);
  });

  /* ------------------------------------------------------------------ */
  /* Formatting toolbar                                                  */
  /* ------------------------------------------------------------------ */

  var formatButtons = Array.prototype.slice.call(el.toolbar.querySelectorAll('[data-format]'));

  var toolbarIndex = 0;

  function syncToolbar() {
    formatButtons.forEach(function (b, i) {
      b.setAttribute('aria-pressed', state.formats[b.dataset.format] ? 'true' : 'false');
      // Roving tabindex: the toolbar is a single tab stop.
      b.tabIndex = i === toolbarIndex ? 0 : -1;
    });
  }

  function toggleFormat(name) {
    state.formats[name] = !state.formats[name];
    syncToolbar();
    update();
  }

  formatButtons.forEach(function (b, i) {
    b.addEventListener('click', function () {
      toolbarIndex = i;
      toggleFormat(b.dataset.format);
    });
  });

  // Roving arrow-key navigation inside the toolbar.
  el.toolbar.addEventListener('keydown', function (e) {
    if (e.key === 'Home' || e.key === 'End') {
      toolbarIndex = e.key === 'Home' ? 0 : formatButtons.length - 1;
      syncToolbar();
      formatButtons[toolbarIndex].focus();
      e.preventDefault();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var i = formatButtons.indexOf(document.activeElement);
    if (i === -1) return;
    toolbarIndex = (i + (e.key === 'ArrowRight' ? 1 : formatButtons.length - 1)) % formatButtons.length;
    syncToolbar();
    formatButtons[toolbarIndex].focus();
    e.preventDefault();
  });

  el.text.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    var name = SHORTCUTS[e.key.toLowerCase()];
    if (!name) return;
    e.preventDefault();
    toggleFormat(name);
    MCT.announce(name + (state.formats[name] ? ' on' : ' off'));
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
    syncToolbar();
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
      if (state.mode === 'solid') selected = 0;
      renderStops();
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
    selected = 0;
    syncControls();
    renderStops();
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

  function setLabel(button, text) {
    var label = button.querySelector('[data-label]');
    if (label && !button.classList.contains('is-done')) label.textContent = text;
  }

  function update() {
    var result = MCText.build(state.text, {
      mode: state.mode,
      colors: activeColors(),
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
  if ('IntersectionObserver' in window) {
    var outputBox = el.output.closest('.code-box');
    new IntersectionObserver(function (entries) {
      el.copybar.classList.toggle('is-hidden', entries[0].isIntersecting);
    }).observe(outputBox);
  } else {
    el.copybar.classList.remove('is-hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  syncControls();
  renderStops();
  update();
})();
