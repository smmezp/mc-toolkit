/*!
 * MC Toolkit — site.js
 * Shared behavior for every page: header state, tools menu, clipboard, feedback.
 * MIT License — https://github.com/smmezp/mc-toolkit
 */
(function (root) {
  'use strict';

  /* Header gets a hairline once the page scrolls. ---------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Current year in the footer. --------------------------------------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Tools menu (disclosure pattern) ------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll('[data-menu]'), function (menu) {
    var button = menu.querySelector('button[aria-controls]');
    var panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!button || !panel) return;

    function setOpen(open, returnFocus) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      if (!open && returnFocus) button.focus();
    }

    button.addEventListener('click', function () {
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) setOpen(false);
    });

    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });

    menu.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !menu.contains(e.relatedTarget)) setOpen(false);
    });

    // Same-page anchors inside the menu close it.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  });

  /* Screen-reader announcements ---------------------------------------- */
  var live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  function announce(message) {
    live.textContent = '';
    setTimeout(function () { live.textContent = message; }, 30);
  }

  /* Toast (used when there is no button to give feedback on) ----------- */
  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    announce(message);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 1800);
  }

  /* Button feedback: the label changes to the past tense, then reverts. */
  function flashButton(button, doneLabel) {
    var label = button.querySelector('[data-label]') || button;
    if (!button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
    clearTimeout(button._flashTimer);
    label.textContent = doneLabel;
    button.classList.add('is-done');
    announce(doneLabel);
    button._flashTimer = setTimeout(function () {
      label.textContent = button.dataset.idleLabel;
      delete button.dataset.idleLabel;
      button.classList.remove('is-done');
    }, 1600);
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

  /**
   * Copies text. With a button, the button itself confirms ("Copied");
   * otherwise a toast does.
   */
  function copy(text, doneLabel, button) {
    var label = doneLabel || 'Copied';
    var done = function () {
      if (button) flashButton(button, label);
      else toast(label);
    };
    var fail = function () { toast('Copy failed. Select the text and copy it manually.'); };
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

  root.MCT = { toast: toast, copy: copy, announce: announce };
})(window);
