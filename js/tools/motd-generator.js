/*!
 * MC Toolkit — MOTD Generator
 * Two-line server list MOTD with a live preview, width check and centering.
 * Depends on: js/site.js (MCT), js/lib/mc-text.js (MCText), js/lib/controls.js (MCControls)
 * MIT License — https://github.com/smmezp/mc-toolkit
 *
 * Share-link parameters (keep stable): t1 m1 c1 f1 / t2 m2 c2 f2 per line,
 * ce center, o target, n name, on players online, mx player limit. All optional.
 */
(function () {
  'use strict';

  var MCText = window.MCText;
  var MCT = window.MCT;
  var MCControls = window.MCControls;
  if (!MCText || !MCT || !MCControls) return;

  /** Pixels of MOTD text the server list shows per line before wrapping. */
  var LINE_WIDTH = 270;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX_TEXT = 200;

  var DEFAULTS = {
    lines: [
      { text: 'Skyreach Network', mode: 'gradient', colors: ['55ffff', '5555ff'], formats: { bold: true } },
      { text: 'Survival | Skyblock | Events', mode: 'solid', colors: ['aaaaaa', 'ffffff'], formats: {} }
    ],
    center: true,
    target: 'properties',
    name: 'Skyreach',
    online: 128,
    max: 500
  };

  var TARGETS = {
    properties: {
      name: 'server.properties',
      file: 'Replace the motd= line in server.properties',
      hint: 'Works on vanilla, Spigot and Paper. It reads the 16 classic colors, so gradients use the closest of them. The preview shows exactly those colors.'
    },
    minimotd: {
      name: 'MiniMOTD',
      file: 'Replace the motds block in plugins/MiniMOTD/main.conf',
      hint: 'A free MOTD plugin for Paper, Spigot and proxies. Full hex gradients through MiniMessage.'
    },
    velocity: {
      name: 'Velocity',
      file: 'Replace the motd line in velocity.toml',
      hint: 'For Velocity proxies. Velocity reads MiniMessage, so hex gradients work.'
    },
    hexlines: {
      name: 'Hex lines',
      file: 'Paste each line where your MOTD plugin expects it',
      hint: 'One line per row in &#RRGGBB format, for other MOTD plugins that read hex codes.'
    }
  };

  var FORMAT_LETTERS = { bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', obfuscated: 'k' };

  /* ------------------------------------------------------------------ */
  /* State & URL                                                         */
  /* ------------------------------------------------------------------ */

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function clampInt(value, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.max(0, Math.min(999999, n));
  }

  function stateFromUrl() {
    var s = clone(DEFAULTS);
    var p;
    try {
      p = new URLSearchParams(window.location.search);
    } catch (e) {
      return s;
    }
    if (!p.toString()) return s;

    s.lines.forEach(function (line, i) {
      var n = i + 1;
      if (p.has('t' + n)) line.text = p.get('t' + n).replace(/[\r\n]+/g, ' ').slice(0, MAX_TEXT);
      if (['solid', 'gradient', 'rainbow'].indexOf(p.get('m' + n)) !== -1) line.mode = p.get('m' + n);
      if (p.has('c' + n)) {
        var colors = p.get('c' + n).split(/[,\s]+/).map(MCText.normalizeHex).filter(Boolean).slice(0, MCControls.MAX_STOPS);
        if (colors.length) line.colors = colors;
      }
      if (line.colors.length < 2) line.colors.push('ffffff');
      if (p.has('f' + n)) {
        line.formats = {};
        Object.keys(FORMAT_LETTERS).forEach(function (k) {
          if (p.get('f' + n).indexOf(FORMAT_LETTERS[k]) !== -1) line.formats[k] = true;
        });
      }
    });
    if (p.has('ce')) s.center = p.get('ce') !== '0';
    if (TARGETS[p.get('o')]) s.target = p.get('o');
    if (p.has('n')) s.name = p.get('n').slice(0, 40);
    if (p.has('on')) s.online = clampInt(p.get('on'), s.online);
    if (p.has('mx')) s.max = clampInt(p.get('mx'), s.max);
    return s;
  }

  function shareUrl() {
    var p = new URLSearchParams();
    state.lines.forEach(function (line, i) {
      var n = i + 1;
      p.set('t' + n, line.text);
      p.set('m' + n, line.mode);
      p.set('c' + n, line.colors.join(','));
      p.set('f' + n, Object.keys(FORMAT_LETTERS).filter(function (k) { return line.formats[k]; })
        .map(function (k) { return FORMAT_LETTERS[k]; }).join(''));
    });
    p.set('ce', state.center ? '1' : '0');
    p.set('o', state.target);
    p.set('n', state.name);
    p.set('on', String(state.online));
    p.set('mx', String(state.max));
    return window.location.origin + window.location.pathname + '?' + p.toString();
  }

  function isDefault() {
    return JSON.stringify(state) === JSON.stringify(DEFAULTS);
  }

  var syncTimer = null;
  function syncUrl() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      try {
        window.history.replaceState(null, '', isDefault() ? window.location.pathname : shareUrl());
      } catch (e) { /* some embedded browsers block history */ }
    }, 300);
  }

  var state = stateFromUrl();
  var active = 0;

  function line() {
    return state.lines[active];
  }

  /* ------------------------------------------------------------------ */
  /* Elements                                                            */
  /* ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }

  var el = {
    tabs: Array.prototype.slice.call(document.querySelectorAll('[role="tab"][data-line]')),
    panel: $('line-panel'),
    text: $('motd-text'),
    textLabel: $('motd-text-label'),
    toolbar: document.querySelector('#line-panel .toolbar'),
    meter: $('motd-meter'),
    meterText: $('motd-meter-text'),
    copyStyle: $('motd-copy-style'),
    center: $('motd-center'),
    name: $('motd-name'),
    online: $('motd-online'),
    max: $('motd-max'),
    iconFile: $('motd-icon-file'),
    iconImg: $('motd-icon'),
    iconStatus: $('motd-icon-status'),
    iconDownload: $('motd-icon-download'),
    iconClear: $('motd-icon-clear'),
    preview: $('motd-preview'),
    lines: $('motd-lines'),
    nameOut: $('motd-name-out'),
    playersOut: $('motd-players-out'),
    targetHint: $('motd-target-hint'),
    file: $('motd-file'),
    output: $('motd-output'),
    copy: $('motd-copy'),
    copyMobile: $('motd-copy-mobile'),
    copybar: $('motd-copybar'),
    copybarTarget: $('motd-copybar-target'),
    share: $('motd-share'),
    stats: $('motd-stats'),
    reset: $('motd-reset')
  };

  var radios = MCControls.radios;
  var setRadio = MCControls.setRadio;

  /* ------------------------------------------------------------------ */
  /* Shared controls                                                     */
  /* ------------------------------------------------------------------ */

  var gradient = MCControls.gradientEditor({
    grad: $('motd-grad'),
    bar: $('motd-gradient-bar'),
    stops: $('motd-stops'),
    stopEditor: $('motd-stop-editor'),
    color: $('motd-color'),
    hex: $('motd-hex'),
    hexError: $('motd-hex-error'),
    remove: $('motd-remove'),
    reverse: $('motd-reverse'),
    addStop: $('motd-add-stop'),
    presetsField: $('motd-presets-field'),
    presets: $('motd-presets')
  }, {
    get: line,
    onChange: function () { update(); }
  });

  var toolbar = MCControls.formatToolbar(el.toolbar, el.text, {
    get: function () { return line().formats; },
    onChange: function () { update(); }
  });

  /* ------------------------------------------------------------------ */
  /* Measuring & building                                                */
  /* ------------------------------------------------------------------ */

  function widthOf(l) {
    return MCText.pixelWidth(l.text, !!l.formats.bold);
  }

  /** Leading spaces that center a line in the server list (a space is 4px). */
  function padFor(l) {
    if (!state.center || !l.text.trim()) return 0;
    var w = widthOf(l);
    if (w >= LINE_WIDTH) return 0;
    return Math.floor((LINE_WIDTH - w) / 2 / MCText.SPACE_WIDTH);
  }

  function buildLine(l, format) {
    return MCText.build(l.text, {
      mode: l.mode,
      colors: l.mode === 'solid' ? [l.colors[0]] : l.colors,
      formats: l.formats,
      protect: true,
      format: format
    }).lines[0];
  }

  function spaces(n) {
    return new Array(n + 1).join(' ');
  }

  /* Escaping for each config format ----------------------------------- */

  /** Java .properties: backslashes and non-ASCII (\u00A7 for the section sign) escaped. */
  function escapeProperties(value) {
    return value.replace(/\\/g, '\\\\').replace(/[^\x20-\x7e]/g, function (ch) {
      return '\\u' + ('0000' + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
    });
  }

  /** HOCON and TOML basic strings share these escapes. */
  function escapeQuoted(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function buildOutput() {
    var t = state.target;
    var values;

    if (t === 'properties') {
      values = state.lines.map(function (l) { return spaces(padFor(l)) + buildLine(l, 'legacysection').output; });
      if (!state.lines[1].text) values = values.slice(0, 1);
      // The loader strips leading spaces from a value, so the first one is escaped.
      return 'motd=' + values.map(escapeProperties).join('\\n').replace(/^ /, '\\u0020');
    }

    if (t === 'hexlines') {
      return state.lines.map(function (l) { return spaces(padFor(l)) + buildLine(l, 'hex').output; }).join('\n');
    }

    values = state.lines.map(function (l) { return spaces(padFor(l)) + buildLine(l, 'minimessage').output; });

    if (t === 'minimotd') {
      return [
        'motds=[',
        '    {',
        '        line1="' + escapeQuoted(values[0]) + '"',
        '        line2="' + escapeQuoted(values[1]) + '"',
        '    }',
        ']'
      ].join('\n');
    }

    // velocity: one TOML string, lines joined with an escaped newline
    var body = escapeQuoted(values[0]);
    if (state.lines[1].text) body += '\\n' + escapeQuoted(values[1]);
    return 'motd = "' + body + '"';
  }

  /* Preview: wraps like the client does, then shows the first two rows -- */

  function toChars(l, displayFormat) {
    var chars = [];
    var flags = l.formats;
    var pad = padFor(l);
    for (var i = 0; i < pad; i++) chars.push({ ch: ' ', hex: 'ffffff', pad: true });
    buildLine(l, displayFormat).runs.forEach(function (run) {
      Array.from(run.text).forEach(function (ch) { chars.push({ ch: ch, hex: run.hex, pad: false }); });
    });
    return chars.map(function (c) {
      c.width = MCText.pixelWidth(c.ch, !c.pad && !!flags.bold);
      c.flags = c.pad ? {} : flags;
      return c;
    });
  }

  function wrap(chars) {
    var rows = [];
    var cur = [];
    var width = 0;
    var lastSpace = -1;
    chars.forEach(function (c) {
      if (width + c.width > LINE_WIDTH && cur.length) {
        var row = lastSpace >= 0 ? cur.slice(0, lastSpace) : cur;
        var rest = lastSpace >= 0 ? cur.slice(lastSpace + 1) : [];
        rows.push(row);
        cur = rest;
        width = rest.reduce(function (sum, r) { return sum + r.width; }, 0);
        lastSpace = -1;
        rest.forEach(function (r, i) { if (r.ch === ' ') lastSpace = i; });
      }
      cur.push(c);
      width += c.width;
      if (c.ch === ' ' && !c.pad) lastSpace = cur.length - 1;
    });
    rows.push(cur);
    return rows;
  }

  function toRuns(row) {
    var runs = [];
    row.forEach(function (c) {
      var prev = runs[runs.length - 1];
      if (prev && prev.hex === c.hex && prev.pad === c.pad) {
        prev.text += c.ch;
      } else {
        runs.push({
          text: c.ch,
          hex: c.hex,
          pad: c.pad,
          bold: c.flags.bold,
          italic: c.flags.italic,
          underline: c.flags.underline,
          strikethrough: c.flags.strikethrough,
          obfuscated: c.flags.obfuscated
        });
      }
    });
    return { runs: runs };
  }

  function renderPreview() {
    var displayFormat = state.target === 'properties' ? 'legacy' : 'hex';
    var rows = [];
    state.lines.forEach(function (l) {
      rows = rows.concat(wrap(toChars(l, displayFormat)));
    });
    MCText.renderPreview(el.lines, rows.slice(0, 2).map(toRuns), {});
    MCText.scramble(el.lines);

    el.nameOut.textContent = state.name || ' ';
    el.playersOut.textContent = '';
    el.playersOut.appendChild(document.createTextNode(String(state.online)));
    var slash = document.createElement('span');
    slash.className = 'slash';
    slash.textContent = '/';
    el.playersOut.appendChild(slash);
    el.playersOut.appendChild(document.createTextNode(String(state.max)));

    el.preview.setAttribute('aria-label',
      'Server list preview. ' + (state.name || 'Unnamed server') + ', ' + state.online + ' of ' + state.max +
      ' players online. Line 1: ' + (state.lines[0].text || 'empty') + '. Line 2: ' + (state.lines[1].text || 'empty') + '.');
  }

  /* Width meter --------------------------------------------------------- */

  var lastOver = [false, false];

  function renderMeters() {
    el.tabs.forEach(function (tab, i) {
      var w = widthOf(state.lines[i]);
      var meta = tab.querySelector('[data-meta]');
      var over = w > LINE_WIDTH;
      meta.textContent = over ? w + ' px, too wide' : w + ' px';
      meta.classList.toggle('is-over', over);
    });

    var w = widthOf(line());
    var over = w > LINE_WIDTH;
    // Tell screen-reader users when a line starts or stops fitting (not on every keystroke).
    if (over !== lastOver[active] && document.activeElement === el.text) {
      MCT.announce(over ? 'Line ' + (active + 1) + ' is now too wide for the server list' : 'Line ' + (active + 1) + ' fits again');
    }
    lastOver[active] = over;
    el.meter.classList.toggle('is-over', over);
    el.meter.style.setProperty('--fill', String(Math.min(1, w / LINE_WIDTH)));
    if (!line().text) {
      el.meterText.textContent = 'Empty line. The server list fits about ' + LINE_WIDTH + ' pixels.';
    } else if (over) {
      el.meterText.textContent = 'Too wide by ' + (w - LINE_WIDTH) + ' px. ' +
        (active === 0 ? 'It wraps and pushes line 2 out of view.' : 'The end of this line will be hidden.');
    } else {
      el.meterText.textContent = w + ' of about ' + LINE_WIDTH + ' px used. It fits.';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  var lastOutput = '';

  function update() {
    var hasText = state.lines.some(function (l) { return l.text.trim(); });
    lastOutput = hasText ? buildOutput() : '';

    if (hasText) {
      el.output.textContent = lastOutput;
      el.output.classList.remove('is-empty');
    } else {
      el.output.textContent = 'Type a MOTD on the left to generate the config.';
      el.output.classList.add('is-empty');
    }

    el.copy.disabled = !hasText;
    el.copyMobile.disabled = !hasText;
    var copyText = state.target === 'hexlines' ? 'Copy lines' : 'Copy config';
    MCControls.setLabel(el.copy, copyText);
    MCControls.setLabel(el.copyMobile, copyText);
    el.targetHint.textContent = TARGETS[state.target].hint;
    el.file.textContent = TARGETS[state.target].file;
    el.copybarTarget.textContent = TARGETS[state.target].name;
    el.stats.textContent = hasText ? new Intl.NumberFormat().format(lastOutput.length) + ' characters' : '';

    renderMeters();
    renderPreview();
    syncUrl();
  }

  /* ------------------------------------------------------------------ */
  /* Line tabs                                                           */
  /* ------------------------------------------------------------------ */

  function selectLine(index, focus) {
    active = index;
    el.tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    el.panel.setAttribute('aria-labelledby', el.tabs[index].id);
    el.textLabel.textContent = 'Text for line ' + (index + 1);
    MCControls.setLabel(el.copyStyle, 'Use this style on line ' + (index === 0 ? 2 : 1));
    syncLineControls();
    gradient.render(true);
    renderMeters();
    if (focus) el.tabs[index].focus();
  }

  el.tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectLine(i); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') next = (i + 1) % el.tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = el.tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      selectLine(next, true);
    });
  });

  function syncLineControls() {
    el.text.value = line().text;
    setRadio('mode', line().mode);
    toolbar.sync();
  }

  el.copyStyle.addEventListener('click', function () {
    var other = state.lines[active === 0 ? 1 : 0];
    other.mode = line().mode;
    other.colors = line().colors.slice();
    other.formats = clone(line().formats);
    update();
    var label = el.copyStyle.querySelector('[data-label]');
    var idle = label.textContent;
    label.textContent = 'Applied to line ' + (active === 0 ? 2 : 1);
    el.copyStyle.classList.add('is-done');
    MCT.announce(label.textContent);
    setTimeout(function () {
      el.copyStyle.classList.remove('is-done');
      label.textContent = idle;
    }, 1600);
  });

  /* ------------------------------------------------------------------ */
  /* Inputs                                                              */
  /* ------------------------------------------------------------------ */

  el.text.addEventListener('input', function () {
    line().text = el.text.value.slice(0, MAX_TEXT);
    update();
  });

  radios('mode').forEach(function (r) {
    r.addEventListener('change', function () {
      line().mode = r.value;
      gradient.render(r.value === 'solid');
      update();
    });
  });

  radios('target').forEach(function (r) {
    r.addEventListener('change', function () {
      state.target = r.value;
      update();
    });
  });

  el.center.addEventListener('change', function () {
    state.center = el.center.checked;
    update();
  });

  el.name.addEventListener('input', function () {
    state.name = el.name.value.slice(0, 40);
    update();
  });

  el.online.addEventListener('input', function () {
    state.online = clampInt(el.online.value, 0);
    update();
  });

  el.max.addEventListener('input', function () {
    state.max = clampInt(el.max.value, 0);
    update();
  });

  function syncControls() {
    setRadio('target', state.target);
    el.center.checked = state.center;
    el.name.value = state.name;
    el.online.value = String(state.online);
    el.max.value = String(state.max);
  }

  /* ------------------------------------------------------------------ */
  /* Server icon check (stays on the device)                             */
  /* ------------------------------------------------------------------ */

  var DEFAULT_ICON = el.iconImg.getAttribute('src');
  var iconBlob = null;
  var objectUrls = [];

  function revokeUrls() {
    objectUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    objectUrls = [];
  }

  function iconStatus(message, isError) {
    el.iconStatus.textContent = message;
    el.iconStatus.classList.toggle('is-error', !!isError);
  }

  el.iconFile.addEventListener('change', function () {
    var file = el.iconFile.files && el.iconFile.files[0];
    if (!file) return;
    revokeUrls();
    iconBlob = null;
    el.iconDownload.hidden = true;

    if (!/^image\//.test(file.type)) {
      iconStatus('This file isn’t an image. Choose a PNG or JPG.', true);
      return;
    }

    var url = URL.createObjectURL(file);
    objectUrls.push(url);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var isPng = file.type === 'image/png';
      el.iconClear.hidden = false;

      if (isPng && w === 64 && h === 64) {
        el.iconImg.src = url;
        iconStatus('Ready to use: 64 × 64 PNG. Save it as server-icon.png in your server folder, next to server.properties.');
        return;
      }

      // Convert: center-crop to a square, scale to 64 × 64, export PNG.
      var size = Math.min(w, h);
      var canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = size > 64;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (w - size) / 2, (h - size) / 2, size, size, 0, 0, 64, 64);
      el.iconImg.src = canvas.toDataURL('image/png');
      canvas.toBlob(function (blob) {
        iconBlob = blob;
        el.iconDownload.hidden = !blob;
      }, 'image/png');

      var problems = [];
      if (w !== 64 || h !== 64) problems.push(w + ' × ' + h + ' pixels');
      if (!isPng) problems.push('not a PNG');
      iconStatus('This image is ' + problems.join(' and ') + '. Minecraft needs a 64 × 64 PNG, so the preview shows a converted copy you can download.', true);
    };
    img.onerror = function () {
      iconStatus('This file couldn’t be read as an image. Try a PNG or JPG.', true);
    };
    img.src = url;
  });

  el.iconDownload.addEventListener('click', function () {
    if (!iconBlob) return;
    var url = URL.createObjectURL(iconBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'server-icon.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    MCT.announce('Downloaded server-icon.png');
  });

  el.iconClear.addEventListener('click', function () {
    revokeUrls();
    iconBlob = null;
    el.iconFile.value = '';
    el.iconImg.src = DEFAULT_ICON;
    el.iconDownload.hidden = true;
    el.iconClear.hidden = true;
    iconStatus('Minecraft shows server-icon.png, a 64 × 64 PNG in your server folder. Your image stays on your device.');
    el.iconFile.focus();
  });

  /* ------------------------------------------------------------------ */
  /* Reset with undo                                                     */
  /* ------------------------------------------------------------------ */

  var undoState = null;
  var undoTimer = null;
  var resetLabel = el.reset.querySelector('[data-label]');

  function applyState(next) {
    state = next;
    syncControls();
    selectLine(0);
    update();
  }

  el.reset.addEventListener('click', function () {
    clearTimeout(undoTimer);
    if (undoState) {
      applyState(undoState);
      undoState = null;
      resetLabel.textContent = 'Reset to example';
      MCT.announce('Your MOTD is back');
      return;
    }
    if (isDefault()) return;
    undoState = clone(state);
    applyState(clone(DEFAULTS));
    resetLabel.textContent = 'Undo reset';
    MCT.announce('Reset to the example MOTD. Press Undo reset to restore yours.');
    undoTimer = setTimeout(function () {
      undoState = null;
      resetLabel.textContent = 'Reset to example';
    }, 8000);
  });

  /* ------------------------------------------------------------------ */
  /* Copy & share                                                        */
  /* ------------------------------------------------------------------ */

  function copyOutput(button) {
    if (lastOutput) MCT.copy(lastOutput, 'Copied', button);
  }

  el.copy.addEventListener('click', function () { copyOutput(el.copy); });
  el.copyMobile.addEventListener('click', function () { copyOutput(el.copyMobile); });
  el.share.addEventListener('click', function () {
    MCT.copy(shareUrl(), 'Link copied', el.share);
  });

  MCControls.copybar(el.copybar, el.output.closest('.code-box'));

  /* Obfuscated text flickers like in game (not when motion is reduced). */
  if (!reduceMotion) {
    setInterval(function () {
      if (!document.hidden && el.lines.querySelector('.mc-obfuscated')) MCText.scramble(el.lines);
    }, 70);
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  syncControls();
  selectLine(0);
  update();
})();
