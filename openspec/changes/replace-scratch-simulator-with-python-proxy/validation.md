# Validation

## 功能驗證

### API 層（`test/test-scratch-sim.mjs`，15 項全過，本機 Python 服務在線時）

```
── 偵測本機 Python 試算服務 ──
  ✔ scratch-info 回 200
  ✔ 回傳 9 個 model（01~09）
  ✔ 每個 model 都有 valid_coins 清單

── 拒絕不合法的 model ──
  ✔ 不合法 model（99）→ 400

── 拒絕不合法的金額（model02） ──
  ✔ 不合法金額 → 400

── 試算張數上限/下限夾擠（model02，由 Python 服務本身夾擠） ──
  ✔ count=0 夾擠成至少 1 張
  ✔ count=999 夾擠成上限 50 張

── 正常試算（model02，跑 5 張） ──
  ✔ API 回 200
  ✔ 回傳 5 張卡
  ✔ 每張卡都有 win_coin
  ✔ 每張卡的 win_coin 都等於輸入的目標金額
  ✔ 每張卡都有卡片圖（b64card，data URL 格式）

── model07 已知無卡片素材 ──
  ✔ model07 API 回 200
  ✔ model07 結果沒有 b64card
```

（這支測試偵測不到本機 Python 服務時會直接略過並 exit 0，不計入失敗——
見 `design.md`「已知限制」。）

### UI 層（Playwright）

開 `/admin/game-simulator`：

- 9 個 model tab 正確渲染（`Model01 · 十二生肖`〜`Model09 · Model 09`）
- 預設選中 model01，點擊「隨機試算」：10 張卡正確渲染，每張卡的
  `b64card` 正確顯示（確認是正式系統渲染出來的卡片圖，非破圖），
  「原始資料」`<details>` 展開後顯示格式化 JSON，console/網路請求皆無
  錯誤
- 切換到 model07（已知無卡片素材），點擊「隨機試算」：10 張卡正確顯示
  「此 model 無卡片圖素材（原始系統本來就沒有）」提示文字，不報錯，
  console 無錯誤

## 回歸驗證

`npm test`（38 支測試腳本：移除 `test:scratch-model02`／
`test:scratch-model03`，新增 `test:scratch-sim`）：全數通過。

## 成功標準檢查

- [x] `/admin/game-simulator` 可以切換全部 9 個 model 並實際試算
- [x] 有卡片素材的 model 正確顯示 Python 服務渲染好的卡片圖
- [x] 無卡片素材的 model（07）正確顯示提示文字，不報錯
- [x] 無新增重大 console / runtime error
- [x] 舊的 model02/model03 專屬程式碼與素材已清除，相關測試改用通用
      版本
