/*!
 * MC Toolkit — controls.js
 * Shared editor controls used by the tool pages:
 *   gradientEditor  gradient bar with color stops, stop editor and presets
 *   formatToolbar   B / I / U / S / obfuscated toggles with shortcuts
 *   copybar         mobile bottom copy bar that hides when the output is visible
 * Depends on: js/lib/mc-text.js (MCText), js/site.js (MCT)
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function (root) {
  'use strict';

  var MCText = root.MCText;
  var MAX_STOPS = 8;

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

  function announce(message) {
    if (root.MCT && root.MCT.announce) root.MCT.announce(message);
  }

  /* ================================================================== */
  /* Gradient editor                                                     */
  /* ================================================================== */

  /**
   * @param {Object} el  grad, bar, stops, stopEditor, color, hex, hexError,
   *                     remove, reverse, addStop, presetsField, presets
   * @param {Object} model
   *   get()      returns the object being edited: { mode, colors } (mutated in place)
   *   onChange() called after every change
   */
  function gradientEditor(el, model) {
    var selected = 0;

    function target() { return model.get(); }

    function activeColors() {
      var t = target();
      return t.mode === 'solid' ? [t.colors[0]] : t.colors;
    }

    function renderBar() {
      var t = target();
      var bg;
      if (t.mode === 'rainbow') {
        bg = 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
      } else if (t.mode === 'solid') {
        bg = '#' + t.colors[0];
      } else {
        bg = 'linear-gradient(90deg, ' + t.colors.map(function (c) { return '#' + c; }).join(', ') + ')';
      }
      el.bar.style.background = bg;
    }

    function syncStopEditor() {
      var c = target().colors[selected];
      el.color.value = '#' + c;
      if (document.activeElement !== el.hex) el.hex.value = '#' + c;
      el.hex.setAttribute('aria-invalid', 'false');
      el.hexError.hidden = true;
    }

    /** Stop markers sit on the bar at their real (evenly spaced) positions. */
    function render(resetSelection) {
      var t = target();
      if (resetSelection) selected = 0;
      if (t.mode !== 'solid' && t.colors.length < 2) {
        t.colors.push(MCText.sampleGradient([t.colors[0], 'ffffff'], 0.5));
      }
      var colors = activeColors();
      if (selected >= colors.length) selected = colors.length - 1;
      el.stops.textContent = '';

      if (t.mode !== 'rainbow') {
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

      el.stopEditor.hidden = t.mode === 'rainbow';
      el.remove.hidden = t.mode === 'solid';
      el.reverse.hidden = t.mode === 'solid';
      el.addStop.hidden = t.mode === 'solid';
      el.remove.disabled = t.colors.length <= 2;
      el.addStop.disabled = t.colors.length >= MAX_STOPS;
      el.presetsField.hidden = t.mode !== 'gradient';
      renderBar();
      syncStopEditor();
    }

    function setSelectedColor(hex, fromHexInput) {
      target().colors[selected] = hex;
      var marker = el.stops.querySelector('[data-index="' + selected + '"]');
      if (marker) {
        marker.style.setProperty('--stop', '#' + hex);
        marker.setAttribute('aria-label', 'Color ' + (selected + 1) + ' of ' + activeColors().length + ', #' + hex);
      }
      el.color.value = '#' + hex;
      if (!fromHexInput) el.hex.value = '#' + hex;
      renderBar();
      model.onChange();
    }

    el.stops.addEventListener('click', function (e) {
      var b = e.target.closest('.grad-stop');
      if (!b) return;
      selected = Number(b.dataset.index);
      render();
      var again = el.stops.querySelector('[data-index="' + selected + '"]');
      if (again) again.focus();
    });

    // Arrow keys move between stops.
    el.stops.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var count = activeColors().length;
      selected = (selected + (e.key === 'ArrowRight' ? 1 : count - 1)) % count;
      render();
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
      if (hex && raw.replace('#', '').length === 6) {
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
      el.hex.value = '#' + target().colors[selected];
    });

    el.remove.addEventListener('click', function () {
      var t = target();
      if (t.colors.length <= 2) return;
      t.colors.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      render();
      model.onChange();
    });

    el.addStop.addEventListener('click', function () {
      var t = target();
      if (t.colors.length >= MAX_STOPS) return;
      // The new stop starts as a lighter shade of the current last color.
      t.colors.push(MCText.sampleGradient([t.colors[t.colors.length - 1], 'ffffff'], 0.35));
      selected = t.colors.length - 1;
      render();
      model.onChange();
      el.color.focus();
    });

    el.reverse.addEventListener('click', function () {
      var t = target();
      t.colors.reverse();
      selected = t.colors.length - 1 - selected;
      render();
      model.onChange();
    });

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
        target().colors = preset.colors.slice();
        selected = 0;
        render();
        model.onChange();
        announce(preset.name + ' preset applied');
      });
      el.presets.appendChild(btn);
    });

    return { render: render };
  }

  /* ================================================================== */
  /* Formatting toolbar                                                  */
  /* ================================================================== */

  var SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };

  /**
   * @param {HTMLElement} toolbar  element with [data-format] buttons
   * @param {HTMLElement} input    text field that receives Ctrl+B / I / U
   * @param {Object} model
   *   get()      returns the formats object being edited (mutated in place)
   *   onChange() called after every change
   */
  function formatToolbar(toolbar, input, model) {
    var buttons = Array.prototype.slice.call(toolbar.querySelectorAll('[data-format]'));
    var index = 0;

    function sync() {
      var formats = model.get();
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-pressed', formats[b.dataset.format] ? 'true' : 'false');
        // Roving tabindex: the toolbar is a single tab stop.
        b.tabIndex = i === index ? 0 : -1;
      });
    }

    function toggle(name) {
      var formats = model.get();
      formats[name] = !formats[name];
      sync();
      model.onChange();
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () {
        index = i;
        toggle(b.dataset.format);
      });
    });

    toolbar.addEventListener('keydown', function (e) {
      var next = null;
      var i = buttons.indexOf(document.activeElement);
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      else if (i !== -1 && e.key === 'ArrowRight') next = (i + 1) % buttons.length;
      else if (i !== -1 && e.key === 'ArrowLeft') next = (i + buttons.length - 1) % buttons.length;
      if (next === null) return;
      index = next;
      sync();
      buttons[index].focus();
      e.preventDefault();
    });

    input.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      var name = SHORTCUTS[e.key.toLowerCase()];
      if (!name) return;
      e.preventDefault();
      toggle(name);
      announce(name + (model.get()[name] ? ' on' : ' off'));
    });

    return { sync: sync };
  }

  /* ================================================================== */
  /* Mobile copy bar                                                     */
  /* ================================================================== */

  /** Shows the bar only while `target` (the output box) is off screen. */
  function copybar(bar, target) {
    if ('IntersectionObserver' in root) {
      new IntersectionObserver(function (entries) {
        bar.classList.toggle('is-hidden', entries[0].isIntersecting);
      }).observe(target);
    } else {
      bar.classList.remove('is-hidden');
    }
  }

  /* ================================================================== */
  /* Small helpers                                                       */
  /* ================================================================== */

  function radios(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]'));
  }

  function setRadio(name, value) {
    radios(name).forEach(function (r) { r.checked = r.value === value; });
  }

  /** Sets a button's [data-label] text unless it is showing "Copied". */
  function setLabel(button, text) {
    var label = button.querySelector('[data-label]');
    if (label && !button.classList.contains('is-done')) label.textContent = text;
  }

  root.MCControls = {
    PRESETS: PRESETS,
    MAX_STOPS: MAX_STOPS,
    gradientEditor: gradientEditor,
    formatToolbar: formatToolbar,
    copybar: copybar,
    radios: radios,
    setRadio: setRadio,
    setLabel: setLabel
  };
})(window);
