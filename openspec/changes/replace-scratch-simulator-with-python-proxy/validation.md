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

## 追加驗證：commit 後使用者實測回報的兩個問題

### 問題 1：預設金額固定挑 0，看起來跟 avscratch_all 不一樣

逐一比對同 model/同金額的 `b64card`（例如 model02、coin=1500）：尺寸
（600×384）、版面、字型完全一致，唯一差異是隨機抽到的號碼/紅包位置不同
——確認是同一個 `analyze_card()` 產出，不是代理邏輯錯誤。

進一步比對 coin=0 與 coin=1500 的卡：coin=0 的卡沒有任何中獎紅圈（`$0`
徽章、黑字號碼無高亮），視覺上確實比 `avscratch_all` 預設隨機抽非 0
金額的卡「黯淡」很多——找到根因：頁面預設挑 `valid_coins[0]`（每個
model 清單第一個都是 0）。

修正後（`_pickDefaultCoin`）：Playwright 實測進頁與切換 model 皆正確
挑到非 0 金額（例如 model01 預設挑到 300）。

### 問題 2：model05/06/08/09「有錯誤」

```
model 05 errors: ["TypeError: Cannot read properties of undefined (reading 'toLocaleString')"]
model 06 errors: ["TypeError: Cannot read properties of undefined (reading 'toLocaleString')"]
model 07 errors: []
model 08 errors: ["TypeError: Cannot read properties of undefined (reading 'toLocaleString')"]
model 09 errors: ["TypeError: Cannot read properties of undefined (reading 'toLocaleString')"]
```

追查確認：`image=0` 時這 4 個 model 的 `results[0]` 是空物件 `{}`，
`analyze_card()` 完全不回傳 `win_coin` 欄位（牌面依指定金額產生，
原始系統 `avscratch_test_views.py` 本來就用 `data.get('win_coin', coin)`
退回成呼叫時的金額）。修正為 `result.win_coin ?? state.coin` 後，
Playwright 逐一切換全部 9 個 model 試算：

```
model 01: target="得獎金額：300" errors=[]
model 02: target="得獎金額：1,000" errors=[]
model 03: target="得獎金額：300" errors=[]
model 04: target="得獎金額：300" errors=[]
model 05: target="得獎金額：100,000" errors=[]
model 06: target="得獎金額：100" errors=[]
model 07: target="得獎金額：1,000" errors=[]
model 08: target="得獎金額：100" errors=[]
model 09: target="得獎金額：100,000" errors=[]
ALL_OK: true
```

`test-scratch-sim.mjs`（17 項，新增 model05 的 `win_coin` 缺欄位回歸
測試）：全數通過。

## 追加驗證：Demo 角色存取權限

兩支代理 API 原本誤用 `requireAdmin`（僅白名單 admin 可過），改成
`requireAdminView` 後，用內建 demo 展示帳號 `test04@test.cc`／`222222`
實測：

```
scratch-info status: 200
scratch status: 200
```

`test/test-roles.mjs`（新增 1 項，共 34 項）：demo 角色打
`scratch-info` 不應被 403 擋下，全數通過。

## 成功標準檢查

- [x] `/admin/game-simulator` 可以切換全部 9 個 model 並實際試算
- [x] 有卡片素材的 model 正確顯示 Python 服務渲染好的卡片圖
- [x] 無卡片素材的 model（07）正確顯示提示文字，不報錯
- [x] 無新增重大 console / runtime error（含追加驗證的 9 個 model 全
      數無錯誤）
- [x] 舊的 model02/model03 專屬程式碼與素材已清除，相關測試改用通用
      版本
- [x] 預設金額改為隨機非 0，視覺呈現與 `avscratch_all` 一致
- [x] model05/06/08/09 缺少 `win_coin` 欄位時正確退回顯示，不報錯
- [x] model tab 顯示正式中文名稱，不是 Python API 的佔位字串
- [x] Demo 角色可以正常使用遊戲試算（唯讀端點不被 403 擋下）
