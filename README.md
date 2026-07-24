# icompanion · 相片怪獸

對標「UI 難用、育成薄、對戰弱」的新數碼暴龍體驗：  
**拇指友善造怪 → 有重量的育成 → 連線對戰驗證成果。**

Current build: **v10 mobile raise / battle slice**

## Quick start

```bash
npm start
```

Open http://localhost:5173 （請用手機寬度或 DevTools 手機模式）

## 三個主畫面

| Tab | 做什麼 |
|-----|--------|
| **育成** | 房間裡照顧怪獸；衰減、便便、生病、失誤、進化條件 |
| **創作** | 3 步：材料 → 拇指微調 → 命名出巢 |
| **對戰** | 練習戰 (CPU) 或 P2P 房碼連線戰 |

詳見：

- [docs/PRODUCT.md](docs/PRODUCT.md) — 產品定位與畫面地圖
- [docs/MVP.md](docs/MVP.md) — 舊 v9 工房 MVP（技術起點）

## Project layout

```
index.html          手機優先 App 殼
css/app.css         thumb-friendly UI
js/main.js          畫面／流程串接
js/engine.js        像素編輯 + 房間動畫
js/pixel.js         繪製／相片草稿工具
js/raise.js         育成／進化規則
js/battle.js        回合對戰 + PeerJS 連線
js/state.js         存檔（localStorage）
```

## Notes

- 連線對戰用 PeerJS 公網 broker（無需自架伺服器）；防火牆／對稱 NAT 下可能連唔到，可用練習戰。
- 存檔鍵：`icompanion.save.v10`
- 創作進階工具收在「進階」抽屉，主流程只留筆／擦／填／Undo／拖五官。
