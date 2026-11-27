# Contributing to MC Toolkit

Thanks for helping! MC Toolkit is a static site: plain HTML, CSS and JavaScript, no build step.

## Ground rules

- **No frameworks or build tools.** Vanilla JS only, loaded with classic `<script defer>` tags.
- **No external services.** No backend, analytics, trackers or paid APIs. Everything runs in the browser.
- **Relative paths only** (`../../css/main.css`, never `/css/main.css`) so the site works on GitHub Pages project URLs.
- **Output must be correct.** If you add a plugin format, link to the plugin's documentation in your pull request.

## Code style

- 2-space indentation, single quotes in JS, semicolons.
- Each JS file is wrapped in an IIFE with `'use strict'`. Shared code is exposed on one global (`MCText`, `MCControls`, `MCT`).
- Use the CSS custom properties in `css/main.css` (`--cyan`, `--lapis`, `--deep`…) instead of new hard-coded colors. See [docs/DESIGN.md](docs/DESIGN.md).
- Keep text inputs at `font-size: 16px` or more to avoid zoom on iOS.

## Before opening a pull request

- Test on a phone-sized screen (about 390px wide) and on desktop.
- Check the browser console for errors.
- Make sure there is no horizontal scroll on mobile.

## Reporting bugs

Use the [issue templates](https://github.com/smmezp/mc-toolkit/issues/new/choose). For format bugs, include the plugin name, its version and the server version.
