# MC Toolkit design notes

Reference for anyone building a new tool page. Created with the `frontend-design` skill;
reviewed with `web-design-guidelines` and `accessibility`.

## Subject

People who run Paper and Spigot servers. Their world is config files, the chat box,
the server list and Minecraft's 16 chat colors. Visual choices come from there.

## Tokens (css/main.css)

| Token | Value | Role |
| --- | --- | --- |
| `--night` | `#050912` | Page background (deep navy, not neutral black) |
| `--deep` | `#0b1324` | Surfaces |
| `--rule` | `#1c2842` | Hairline dividers |
| `--control` | `#53668e` | Form-control edges, 3:1 contrast (WCAG 1.4.11) |
| `--text` | `#e7edf8` | Primary text |
| `--cyan` | `#7dd8f0` | Primary action |
| `--lapis` | `#4c7dff` | Focus and selection |

Each tool has an identity color from the Minecraft legacy palette (`--id-aqua`, `--id-blue`,
`--id-gold`, `--id-pink`, `--id-green`, `--id-gray`, `--id-purple`). Use it only inside that
tool's own specimen or marker, never for page chrome.

## Type

- **Schibsted Grotesk**: all UI. Headlines 800, tight tracking.
- **JetBrains Mono**: real code only (output, config snippets). Never for decorative labels.
- **Pixelify Sans**: in-game rendering only.

## Rules we follow

- One bold element per page. On the homepage it's the live demo; everything else stays quiet.
- No uppercase eyebrows, no middle-dot meta strings, no arrows appended to buttons,
  no single highlighted word in headlines.
- Numbers only for real sequences (setup steps, build order).
- Radius follows hierarchy: frame 16px, control 8px, chip 6px.
- Motion: one load sequence in the hero. Everything else only responds to user actions.
  Respect `prefers-reduced-motion`.
- Celestial detail: square pixel stars, hero only.
- Copy in sentence case, active voice. Actions keep their name through the flow
  ("Copy YAML" becomes "Copied").
- Links inside running text are underlined.

## Tool page anatomy (css/tool.css)

```
breadcrumb, h1, one-sentence description
.workspace
  .stage            preview, pinned on mobile
  .ws-body
    .ws-editor      inputs
    .ws-output      format choice, code box with copy, share link
.copybar            mobile-only bottom copy action
#guide              steps, reference table, FAQ
```

## Checks before shipping a page

1. Phone width (390px) and desktop: no horizontal scroll.
2. Keyboard: tab through everything, check focus is visible and not covered.
3. axe-core (WCAG 2.2 AA): zero violations.
4. Run `/web-design-guidelines` and `/accessibility` on the changed files.
