# MVP definition — 相片怪獸工房 v9

> **Note (v10):** 產品主線已轉為手機優先「育成 + 創作 + 對戰」。見 [PRODUCT.md](./PRODUCT.md)。  
> 下文保留 v9 工房原型定義，作為像素引擎與創作原則的技術起點。

## One-liner

A local, single-page workshop where a photo (or template) becomes a **hand-editable 64×64 pixel companion** that lives in a room, reacts to care actions, and can take reversible “evolution” pixel suggestions.

## Product principles (locked for MVP)

1. **Player owns every pixel.** Photo / template is a draft, never the final authority.
2. **No AI vision.** Palette + color-rule background removal only — no face/object detection.
3. **Expression is an overlay.** Eyes/mouth/nose are not baked into the sprite unless the player paints them.
4. **Everything runs in the browser.** No backend, no accounts, no cloud storage in v9.

## What ships in v9

| Area | Capabilities |
|------|----------------|
| Photo ingest | Upload → 64×64 draft; crop or fit; palette extract; seed from colors |
| Background remove | Local rules: none / edge / light / dark / green / blue + threshold |
| Templates | humanoid, quad, round, winged, mech, plant, ghost, blank |
| Bake | Merge draft → fully editable `ImageData` sprite |
| Pixel editor | Pen, erase, pick, fill, line, rect, ellipse; Shift = thick pen |
| Edit transforms | Undo/redo, mirror, flip, nudge, outline, center |
| Expression layer | Toggle eyes/mouth/nose/brows/effects; styles; drag or click-anchor |
| Care loop | Feed, play, train, clean, sleep, explore → stats + mood |
| Room preview | Live movement styles: walk / hop / float / fly / roll / glitch |
| Evolution | After 6 actions: preview 3 pixel suggestions; apply + keep editing |
| Share card | Local 128×128 preview card (no export pipeline yet) |

## Intentional non-goals (out of MVP)

- Save / load / localStorage persistence
- PNG / GIF export or share URLs
- Server, auth, multiplayer
- Real AI segmentation / face mesh
- Time-based stat decay or day/night simulation
- Sound, music, particle systems beyond simple emoji thoughts
- Separate “game screens” / onboarding flow
- Mobile-first redesign (layout collapses, but workshop UI is desktop-biased)

## Architecture snapshot

```
Photo / Template ──► draft ImageData (hasDraft)
                         │
                         ▼ bake / first paint
                    img ImageData  ◄── editor tools
                         │
                         ▼ composite()
                    canvas sprite + drawExpression() overlay
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         roomCanvas              cardCanvas
       (care + move)           (share preview)
```

Key files:

- `index.html` — workshop chrome + controls
- `css/game.css` — pixel-lab UI
- `js/game.js` — state, drawing, photo draft, care, evolution, room loop

## Suggested next increments (post-setup)

Ordered by leverage for continued development:

1. **Persistence** — save sprite + expression + stats to `localStorage` / download JSON
2. **Export** — download PNG sprite + share card
3. **Module split** — carve `js/game.js` into `photo`, `editor`, `expr`, `care`, `evo`, `room`
4. **Care depth** — idle decay, action cooldowns, simple event log stories
5. **Onboarding** — one short “first monster” path without the full control panel

## How to verify the MVP

1. `npm start` → open the app
2. Upload a photo with a plain background → try **邊緣估背景** / light / dark
3. Bake, paint a few pixels, drag eyes
4. Run care actions until evolution unlocks → apply one suggestion
5. Confirm room preview still animates with the updated sprite
