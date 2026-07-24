# icompanion · 相片怪獸工房

Photo → 64×64 pixel companion. Players own every pixel; photos are only a material source (no AI recognition).

Current build: **MVP v9** (photo draft + local background removal + drag face overlays).

## Quick start

```bash
npm start
```

Open http://localhost:5173

Or open `index.html` directly in a browser (upload works either way).

## Project layout

```
index.html      UI shell (3-column workshop)
css/game.css    Styles
js/game.js      All game logic (client-side only)
docs/MVP.md     What the MVP is / isn't / next
```

## Core loop

1. **Upload a photo** (or use random palette / skeleton templates)
2. Get a **64×64 pixel draft** (+ optional local bg remove)
3. **Bake** into editable pixels and draw freely
4. Place **face overlays** (eyes/mouth…) by drag
5. **Care** for the monster (feed / play / train…)
6. After 6 actions, pick an **evolution pixel suggestion** (still fully editable)

See [docs/MVP.md](docs/MVP.md) for the full feature inventory and intentional non-goals.
