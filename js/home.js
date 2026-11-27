/*!
 * MC Toolkit — home.js
 * Renders the live in-game example on the homepage.
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function () {
  'use strict';

  var target = document.getElementById('hero-preview');
  if (!target || !window.MCText) return;

  var welcome = window.MCText.build('Welcome, Alex!', {
    mode: 'gradient',
    colors: ['8ccfff', 'a78bfa'],
    format: 'hex'
  }).lines[0];
  welcome.runs.forEach(function (run) { run.bold = true; });

  var hint = {
    runs: [
      { text: 'Type ', hex: 'aaaaaa' },
      { text: '/help', hex: 'ffffff' },
      { text: ' to get started.', hex: 'aaaaaa' }
    ]
  };

  window.MCText.renderPreview(target, [welcome, hint], {});
})();
