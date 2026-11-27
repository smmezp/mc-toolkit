/*!
 * MC Toolkit — mc-text.js
 * Minecraft text engine: colors, gradients, formatting codes and serializers.
 * Shared by the Message Generator and (later) the MOTD Generator.
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */

  var LEGACY_COLORS = [
    { code: '0', name: 'black', hex: '000000' },
    { code: '1', name: 'dark_blue', hex: '0000aa' },
    { code: '2', name: 'dark_green', hex: '00aa00' },
    { code: '3', name: 'dark_aqua', hex: '00aaaa' },
    { code: '4', name: 'dark_red', hex: 'aa0000' },
    { code: '5', name: 'dark_purple', hex: 'aa00aa' },
    { code: '6', name: 'gold', hex: 'ffaa00' },
    { code: '7', name: 'gray', hex: 'aaaaaa' },
    { code: '8', name: 'dark_gray', hex: '555555' },
    { code: '9', name: 'blue', hex: '5555ff' },
    { code: 'a', name: 'green', hex: '55ff55' },
    { code: 'b', name: 'aqua', hex: '55ffff' },
    { code: 'c', name: 'red', hex: 'ff5555' },
    { code: 'd', name: 'light_purple', hex: 'ff55ff' },
    { code: 'e', name: 'yellow', hex: 'ffff55' },
    { code: 'f', name: 'white', hex: 'ffffff' }
  ];

  /** Order in which formatting codes are emitted. */
  var FORMAT_KEYS = ['bold', 'italic', 'underline', 'strikethrough', 'obfuscated'];

  var FORMAT_CODES = {
    bold: 'l',
    italic: 'o',
    underline: 'n',
    strikethrough: 'm',
    obfuscated: 'k'
  };

  var MINIMESSAGE_TAGS = {
    bold: 'bold',
    italic: 'italic',
    underline: 'underlined',
    strikethrough: 'strikethrough',
    obfuscated: 'obfuscated'
  };

  /**
   * Placeholders that must never be split by color codes:
   * %player_name% (PlaceholderAPI), {player} and <player> style tokens.
   */
  var PLACEHOLDER_RE = /%[A-Za-z0-9_\-.:]+%|\{[A-Za-z0-9_\-.:]+\}|<[A-Za-z0-9_\-.:]+>/g;

  /* ------------------------------------------------------------------ */
  /* Color helpers                                                       */
  /* ------------------------------------------------------------------ */

  /** Returns a lowercase 6-digit hex string without '#', or null if invalid. */
  function normalizeHex(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) {
      v = v.charAt(0) + v.charAt(0) + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2);
    }
    return /^[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
  }

  function hexToRgb(hex) {
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return rgb.map(function (c) {
      var v = Math.max(0, Math.min(255, Math.round(c)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  /** Samples a multi-stop gradient at position t (0..1), stops evenly spaced. */
  function sampleGradient(stops, t) {
    if (stops.length === 1) return stops[0];
    var scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    var i = Math.min(Math.floor(scaled), stops.length - 2);
    var local = scaled - i;
    var a = hexToRgb(stops[i]);
    var b = hexToRgb(stops[i + 1]);
    return rgbToHex([
      a[0] + (b[0] - a[0]) * local,
      a[1] + (b[1] - a[1]) * local,
      a[2] + (b[2] - a[2]) * local
    ]);
  }

  /** HSV (h in 0..1) to hex. Same model MiniMessage's <rainbow> uses. */
  function hsvToHex(h, s, v) {
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    var rgb;
    switch (((i % 6) + 6) % 6) {
      case 0: rgb = [v, t, p]; break;
      case 1: rgb = [q, v, p]; break;
      case 2: rgb = [p, v, t]; break;
      case 3: rgb = [p, q, v]; break;
      case 4: rgb = [t, p, v]; break;
      default: rgb = [v, p, q];
    }
    return rgbToHex(rgb.map(function (c) { return c * 255; }));
  }

  /** Closest of the 16 legacy colors, using the "redmean" perceptual distance. */
  function nearestLegacy(hex) {
    var c = hexToRgb(hex);
    var best = LEGACY_COLORS[0];
    var bestDist = Infinity;
    for (var i = 0; i < LEGACY_COLORS.length; i++) {
      var l = hexToRgb(LEGACY_COLORS[i].hex);
      var rMean = (c[0] + l[0]) / 2;
      var dr = c[0] - l[0];
      var dg = c[1] - l[1];
      var db = c[2] - l[2];
      var dist = (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = LEGACY_COLORS[i];
      }
    }
    return best;
  }

  /** Minecraft draws text shadow at 1/4 of the text color. */
  function shadowHex(hex) {
    return rgbToHex(hexToRgb(hex).map(function (c) { return Math.floor(c / 4); }));
  }

  /* ------------------------------------------------------------------ */
  /* Tokenizing & coloring                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Splits a line into units. A unit is one character (code point) or one
   * whole placeholder when `protect` is true.
   */
  function tokenize(line, protect) {
    var units = [];
    function pushChars(str) {
      Array.from(str).forEach(function (ch) {
        units.push({ text: ch, visible: !/\s/.test(ch), placeholder: false });
      });
    }
    if (!protect) {
      pushChars(line);
      return units;
    }
    var last = 0;
    var match;
    PLACEHOLDER_RE.lastIndex = 0;
    while ((match = PLACEHOLDER_RE.exec(line)) !== null) {
      pushChars(line.slice(last, match.index));
      units.push({ text: match[0], visible: true, placeholder: true });
      last = match.index + match[0].length;
    }
    pushChars(line.slice(last));
    return units;
  }

  /**
   * Assigns a hex color to every unit.
   * Whitespace inherits the previous color so no codes are wasted on it.
   */
  function colorize(units, mode, colors) {
    var visible = units.filter(function (u) { return u.visible; });
    var n = visible.length;
    visible.forEach(function (u, i) {
      if (mode === 'rainbow') {
        u.color = hsvToHex(n ? i / n : 0, 1, 1);
      } else if (mode === 'gradient' && colors.length > 1) {
        u.color = sampleGradient(colors, n > 1 ? i / (n - 1) : 0);
      } else {
        u.color = colors[0];
      }
    });
    var current = visible.length ? visible[0].color : colors[0];
    units.forEach(function (u) {
      if (u.visible) current = u.color;
      else u.color = current;
    });
    return units;
  }

  /** Merges consecutive units sharing the same output color into runs. */
  function toRuns(units, legacy) {
    var runs = [];
    units.forEach(function (u) {
      var display = u.color;
      var code = null;
      if (legacy) {
        var l = nearestLegacy(u.color);
        display = l.hex;
        code = l.code;
      }
      var prev = runs[runs.length - 1];
      if (prev && prev.hex === display) {
        prev.text += u.text;
      } else {
        runs.push({ text: u.text, hex: display, code: code });
      }
    });
    return runs;
  }

  /* ------------------------------------------------------------------ */
  /* Serializers                                                         */
  /* ------------------------------------------------------------------ */

  function activeFormats(formats) {
    return FORMAT_KEYS.filter(function (k) { return formats && formats[k]; });
  }

  function formatCodes(formats, prefix) {
    return activeFormats(formats).map(function (k) { return prefix + FORMAT_CODES[k]; }).join('');
  }

  function expandHex(hex, prefix) {
    return prefix + 'x' + hex.split('').map(function (c) { return prefix + c; }).join('');
  }

  /**
   * Code-based formats. Formatting codes are repeated after every color code,
   * because in Minecraft a color code resets bold/italic/etc.
   */
  var CODE_FORMATS = {
    hex: function (run, f) { return '&#' + run.hex + formatCodes(f, '&'); },
    spigot: function (run, f) { return expandHex(run.hex, '&') + formatCodes(f, '&'); },
    section: function (run, f) { return expandHex(run.hex, '§') + formatCodes(f, '§'); },
    legacy: function (run, f) { return '&' + run.code + formatCodes(f, '&'); },
    cmi: function (run, f) { return '{#' + run.hex + '}' + formatCodes(f, '&'); }
  };

  function escapeMiniMessage(units) {
    return units.map(function (u) {
      if (u.placeholder) return u.text;
      return u.text.replace(/\\/g, '\\\\').replace(/</g, '\\<');
    }).join('');
  }

  function toMiniMessage(units, opts) {
    var text = escapeMiniMessage(units);
    if (!text) return '';
    var fmts = activeFormats(opts.formats);
    var open = fmts.map(function (k) { return '<' + MINIMESSAGE_TAGS[k] + '>'; }).join('');
    var close = fmts.slice().reverse().map(function (k) { return '</' + MINIMESSAGE_TAGS[k] + '>'; }).join('');
    var inner = open + text + close;
    if (opts.mode === 'rainbow') return '<rainbow>' + inner + '</rainbow>';
    if (opts.mode === 'gradient' && opts.colors.length > 1) {
      return '<gradient:' + opts.colors.map(function (c) { return '#' + c; }).join(':') + '>' + inner + '</gradient>';
    }
    return '<#' + opts.colors[0] + '>' + inner;
  }

  /**
   * Builds the colored output for every line of `text`.
   * @param {string} text
   * @param {{mode:string, colors:string[], formats:Object, protect:boolean, format:string}} opts
   * @returns {{lines: Array<{runs: Array, output: string}>}}
   */
  function build(text, opts) {
    var colors = (opts.colors || []).map(normalizeHex).filter(Boolean);
    if (!colors.length) colors = ['ffffff'];
    var o = {
      mode: opts.mode || 'solid',
      colors: colors,
      formats: opts.formats || {},
      protect: opts.protect !== false,
      format: opts.format || 'hex'
    };
    var legacy = o.format === 'legacy';

    var lines = String(text).split(/\r?\n/).map(function (line) {
      var units = colorize(tokenize(line, o.protect), o.mode, o.colors);
      var runs = toRuns(units, legacy);
      var output;
      if (o.format === 'minimessage') {
        output = toMiniMessage(units, o);
      } else {
        var serialize = CODE_FORMATS[o.format] || CODE_FORMATS.hex;
        output = runs.map(function (run) { return serialize(run, o.formats) + run.text; }).join('');
      }
      return { runs: runs, output: output };
    });

    return { lines: lines };
  }

  /* ------------------------------------------------------------------ */
  /* YAML                                                                */
  /* ------------------------------------------------------------------ */

  function quoteYaml(value, style) {
    if (style === 'double') {
      return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return "'" + value.replace(/'/g, "''") + "'";
  }

  function yamlKey(key) {
    return /^[A-Za-z0-9_-]+$/.test(key) ? key : quoteYaml(key, 'single');
  }

  /**
   * Wraps values in YAML. "messages.welcome" becomes a nested block.
   * Several values become a YAML list.
   */
  function toYaml(values, keyPath, quoteStyle) {
    var keys = String(keyPath || '').split('.').map(function (k) { return k.trim(); }).filter(Boolean);
    var quoted = values.map(function (v) { return quoteYaml(v, quoteStyle); });

    if (!keys.length) {
      return quoted.length === 1 ? quoted[0] : quoted.map(function (q) { return '- ' + q; }).join('\n');
    }

    var out = [];
    keys.forEach(function (key, depth) {
      var indent = new Array(depth + 1).join('  ');
      var isLast = depth === keys.length - 1;
      if (!isLast) {
        out.push(indent + yamlKey(key) + ':');
      } else if (quoted.length === 1) {
        out.push(indent + yamlKey(key) + ': ' + quoted[0]);
      } else {
        out.push(indent + yamlKey(key) + ':');
        quoted.forEach(function (q) { out.push(indent + '  - ' + q); });
      }
    });
    return out.join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* Preview rendering                                                   */
  /* ------------------------------------------------------------------ */

  var OBFUSCATE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?';

  /**
   * Renders lines of runs into a container as Minecraft-styled spans.
   * @param {HTMLElement} container
   * @param {Array<{runs: Array}>} lines
   * @param {Object} formats
   */
  function renderPreview(container, lines, formats) {
    var f = formats || {};
    var frag = document.createDocumentFragment();
    lines.forEach(function (line) {
      var row = document.createElement('div');
      row.className = 'mc-line';
      if (!line.runs.length || !line.runs.some(function (r) { return r.text.length; })) {
        row.innerHTML = '&nbsp;';
      }
      line.runs.forEach(function (run) {
        var span = document.createElement('span');
        span.textContent = run.text;
        span.style.color = '#' + run.hex;
        span.style.setProperty('--mc-shadow', '#' + shadowHex(run.hex));
        var deco = [];
        if (run.underline || f.underline) deco.push('underline');
        if (run.strikethrough || f.strikethrough) deco.push('line-through');
        if (deco.length) span.style.textDecorationLine = deco.join(' ');
        if (run.bold || f.bold) span.classList.add('mc-bold');
        if (run.italic || f.italic) span.classList.add('mc-italic');
        if (run.obfuscated || f.obfuscated) {
          span.classList.add('mc-obfuscated');
          span.dataset.text = run.text;
        }
        row.appendChild(span);
      });
      frag.appendChild(row);
    });
    container.textContent = '';
    container.appendChild(frag);
  }

  /** Scrambles every .mc-obfuscated span inside `scope` (call on an interval). */
  function scramble(scope) {
    var spans = scope.querySelectorAll('.mc-obfuscated');
    for (var i = 0; i < spans.length; i++) {
      var original = spans[i].dataset.text || '';
      var out = '';
      for (var j = 0; j < original.length; j++) {
        var ch = original.charAt(j);
        out += /\s/.test(ch) ? ch : OBFUSCATE_CHARS.charAt(Math.floor(Math.random() * OBFUSCATE_CHARS.length));
      }
      spans[i].textContent = out;
    }
  }

  root.MCText = {
    LEGACY_COLORS: LEGACY_COLORS,
    normalizeHex: normalizeHex,
    sampleGradient: sampleGradient,
    nearestLegacy: nearestLegacy,
    shadowHex: shadowHex,
    tokenize: tokenize,
    build: build,
    toYaml: toYaml,
    renderPreview: renderPreview,
    scramble: scramble
  };
})(typeof window !== 'undefined' ? window : globalThis);
