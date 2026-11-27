/*!
 * MC Toolkit — site.js
 * Shared behavior for every page: header state, clipboard, toast.
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function (root) {
  'use strict';

  /* Header gets a border once the page scrolls. */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Current year in the footer. */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Toast ------------------------------------------------------------- */
  var toastEl = null;
  var toastTimer = null;
  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = CHECK_ICON + '<span></span>';
    toastEl.lastChild.textContent = message;
    // Force reflow so repeated toasts animate again.
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 1800);
  }

  /* Clipboard (with a fallback for older mobile browsers) ------------- */
  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copy(text, label) {
    var done = function () { toast(label || 'Copied to clipboard'); };
    var fail = function () { toast('Copy failed — select the text manually'); };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done, function () {
        if (fallbackCopy(text)) done();
        else fail();
      });
    }
    if (fallbackCopy(text)) done();
    else fail();
    return Promise.resolve();
  }

  root.MCT = { toast: toast, copy: copy };
})(window);
