/*!
 * MC Toolkit — home.js
 * The live demo in the homepage hero.
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function () {
  'use strict';

  var MCText = window.MCText;
  var MCT = window.MCT;
  var input = document.getElementById('demo-text');
  var preview = document.getElementById('demo-preview');
  var code = document.getElementById('demo-code');
  var copyBtn = document.getElementById('demo-copy');
  var openLink = document.getElementById('demo-open');
  var swatches = Array.prototype.slice.call(document.querySelectorAll('.demo .swatch'));
  if (!MCText || !MCT || !input || !preview) return;

  var colors = ['8ccfff', 'a78bfa'];
  var output = '';
  var KEY = 'join-message';
  var SAMPLE_NAME = 'Alex';

  function render() {
    var text = input.value;
    var line = MCText.build(text, { mode: 'gradient', colors: colors, format: 'hex' }).lines[0];
    output = text.trim() ? MCText.toYaml([line.output], KEY, 'single') : '';

    // In game, the placeholder resolves to a player name.
    var shown = {
      runs: line.runs.map(function (r) {
        return { text: r.text.replace(/%player(_name)?%/g, SAMPLE_NAME), hex: r.hex };
      })
    };
    MCText.renderPreview(preview, [shown], {});
    preview.setAttribute('aria-label', 'In-game preview: ' + shown.runs.map(function (r) { return r.text; }).join(''));

    code.firstChild.textContent = output || 'Type a message to see the YAML.';
    copyBtn.disabled = !output;

    var params = new URLSearchParams({ t: text, m: 'gradient', c: colors.join(','), o: 'hex', k: KEY });
    openLink.href = 'tools/message-generator/?' + params.toString();
  }

  input.addEventListener('input', render);

  swatches.forEach(function (btn) {
    btn.addEventListener('click', function () {
      colors = btn.dataset.colors.split(',');
      swatches.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      render();
    });
  });

  copyBtn.addEventListener('click', function () {
    if (output) MCT.copy(output, 'Copied', copyBtn);
  });

  render();
})();

/* MOTD Generator specimen: same engine and centering as the tool. */
(function () {
  'use strict';

  var MCText = window.MCText;
  var target = document.getElementById('motd-specimen');
  if (!MCText || !target) return;

  var LINE_WIDTH = 270;

  function line(text, colors, bold) {
    var built = MCText.build(text, { mode: colors.length > 1 ? 'gradient' : 'solid', colors: colors, format: 'hex' }).lines[0];
    var pad = Math.floor((LINE_WIDTH - MCText.pixelWidth(text, bold)) / 2 / MCText.SPACE_WIDTH);
    built.runs.forEach(function (r) { r.bold = bold; });
    built.runs.unshift({ text: new Array(pad + 1).join(' '), hex: 'ffffff' });
    return built;
  }

  MCText.renderPreview(target, [
    line('Skyreach Network', ['55ffff', '5555ff'], true),
    line('Survival | Skyblock | Events', ['aaaaaa'], false)
  ], {});
})();
