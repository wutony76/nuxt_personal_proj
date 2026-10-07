# SCRATCH CITY — 主題提案 v0.1

> 美式街頭 × 雜誌店 × Neon × Scratch Lottery
> 狀態：提案階段，尚未修改任何程式碼。

## 0. 現況與前提

- 目前專案內**沒有連接既有程式碼**，也沒有現有四套主題（BG 中國風／柑仔店／Pixel／簡約工業風）的原始碼。
- 以下 Theme / Component 架構先以「Vue 3 + Element Plus + CSS Variables 多主題切換」為假設（文件中提到 Element Plus）。連接 repo 後會依實際架構調整第 1、3 節。

---

## 1. Theme Architecture

三層 Token，主題只換值、不換邏輯：

```
Primitive  (原色、字體、尺寸)      → theme 專屬
Semantic   (--sc-bg / --sc-accent …) → 與其他主題共用同一組名稱
Component  (--ticket-* / --btn-*)    → 主題可覆寫的元件外觀
```

- Theme ID：`scratch-city`
- 切換方式：`<html data-theme="scratch-city">`，所有變數掛在 `[data-theme="scratch-city"]` 之下，不污染其他主題。
- 共用 semantic 名稱 → 業務元件（餘額、購買、刮卡流程）不需改動。
- 主題專屬裝飾（Neon、Halftone、Barcode、Sticker）做成獨立 `theme/scratch-city/decor/*` 元件，只在本主題載入（dynamic import），不影響其他主題 bundle。
- Element Plus：只透過 CSS 變數覆寫 `--el-*`，不改元件原始碼；Button / Tag / Dialog 等關鍵元件改用本主題自有 skin component 包一層。

```
src/themes/scratch-city/
  tokens.css          # primitive + semantic + component tokens
  element-overrides.css
  fonts.css
  decor/              # NeonSign, Halftone, Barcode, Sticker, BgTypography
  components/         # Ticket, MagazineRack, JackpotZone, WinnerHeadline…
  motion.ts           # 共用動畫參數、reduced-motion 判斷
  scratch/            # ScratchCanvas 引擎
```

---

## 2. Page Structure

**Store → Browse → Pick Ticket → Scratch → Reveal → Win**

| 頁面 | 角色 | 主要區塊 |
|---|---|---|
| HOME（店門口） | 第一印象 | Nav → Hero 大票券 → Magazine Rack → Jackpot Zone → Recent Winners → Footer（店面招牌 / 營業時間感） |
| STORE（店內貨架） | 瀏覽 | 篩選列（價格 / 獎金 / 新刊 Limited）→ 雜誌牆 Grid |
| TICKET（單張詳情） | 挑選 | 封面大圖 + 獎金表 + 中獎機率 + Issue No. + BUY |
| SCRATCH（櫃檯刮卡） | 核心體驗 | 單張票置中、玻璃櫃檯桌面、刮除區、REVEAL ALL |
| RESULT（揭曉） | 情緒高點 | 中獎：粒子爆發 + 金額報紙頭條；未中：「NEXT ISSUE」推薦下一張 |
| JACKPOT | 累積獎池 | 巨型數字 + 倒數 + 歷史開獎 |
| WINNERS | 故事感 | 報紙頭版排版：頭條 + 小欄位列表 |

---

## 3. Component Structure

**Layout**
- `ScNavBar`：Logo（Neon 招牌）＋ HOME / SCRATCH / JACKPOT / WINNERS / STORE ＋ `ScBalance`（BALANCE $12,580 · [+ TOP UP] 票券形按鈕）
- `ScFooter`：店面燈箱風格

**Decor（只屬本主題）**
- `NeonText`（flicker、glow 色可傳入）
- `BgTypography`（超大 SCRATCH / WIN 背景字，低透明度）
- `GrainLayer` / `HalftoneLayer`（全頁固定一層）
- `Barcode`、`SerialNo`、`Sticker`（促銷貼紙，可旋轉角度）

**Ticket 家族（核心）**
- `TicketCover`：雜誌封面語言 — 大標、大數字、Badge、Issue No.、Price、Barcode；`accent` prop 決定配色
- `TicketCard`：`TicketCover` + 3D tilt + hover lift + 光線掃過
- `ScratchTicket`：`TicketCover` + `ScratchCanvas`
- `ScratchCanvas`：純刮除引擎，與外觀解耦

**Sections**
- `HeroTicket`、`MagazineRack`（橫向捲動）、`JackpotZone`（`JackpotCounter` + `Countdown`）、`WinnerHeadline` / `WinnerTicker`

**Feedback**
- `ScButton`（primary：SCRATCH NOW / secondary：VIEW ALL TICKETS / ticket：TOP UP）
- `WinBurst`（粒子）、`ResultHeadline`

---

## 4. Design Tokens

| 類別 | Token | 值 | 說明 |
|---|---|---|---|
| Radius | `--sc-radius-0` | 0 | 主要卡片、按鈕：直角，報刊感 |
| | `--sc-radius-sm` | 2px | 輸入框 |
| | `--sc-ticket-notch` | 10px | 票券兩側半圓缺口 |
| Border | `--sc-border` | 2px solid | 粗框、貼紙感 |
| Spacing | `--sc-space-1…8` | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 80 | 4px 基準 |
| Shadow | `--sc-glow-sm` | `0 0 8px accent/60%` | Neon 用 glow 取代灰陰影 |
| | `--sc-glow-lg` | `0 0 24px accent/50%, 0 0 64px accent/25%` | Hero / Jackpot |
| | `--sc-lift` | `0 18px 40px #000/60%` | 票券浮起 |
| Texture | `--sc-grain-opacity` | 0.05 | 背景雜訊 |
| | `--sc-halftone-opacity` | 0.06 | 網點 |
| Z | `--sc-z-bg / content / nav / overlay / burst` | 0 / 10 / 100 / 1000 / 1100 | |

---

## 5. Color Tokens

原則：**Dark Base + 1~2 Neon Accent**。全站固定 Pink + Cyan，Yellow 只給「金額」，其他色只出現在個別彩票。

**Base**
| Token | 值 | 用途 |
|---|---|---|
| `--sc-black` | `#0A0A0C` | 頁面底 |
| `--sc-charcoal` | `#16161B` | 區塊底、卡片 |
| `--sc-steel` | `#2A2A31` | 金屬貨架、分隔線 |
| `--sc-offwhite` | `#F1EDE4` | 主文字、報紙底 |
| `--sc-muted` | `#9A97A0` | 次要文字（深底上對比 ≥ 4.5:1） |

**Brand Accent（全站）**
| Token | 值 | 用途 |
|---|---|---|
| `--sc-neon-pink` | `#FF2E88` | 主 Accent：Logo、Primary CTA、Nav active |
| `--sc-neon-cyan` | `#2DE2FF` | 次 Accent：連結、倒數、資訊 |
| `--sc-jackpot` | `#FFD400` | **只用於金額數字** |

**Ticket Accent（每張票一色）**
| 票券 | Accent |
|---|---|
| LUCKY 7 | Neon Pink `#FF2E88` |
| GOLD RUSH | Jackpot Yellow `#FFD400` |
| JACKPOT | Electric Purple `#9D5CFF` |
| MONEY MANIA | Acid Green `#B8FF3C` |
| STREET CASH | Neon Cyan `#2DE2FF` |
| SUPER WIN | Orange `#FF7A1A` |
| BIG DEAL | Off White + 黑（報紙版） |

**Semantic**
`--sc-bg` `--sc-surface` `--sc-text` `--sc-text-muted` `--sc-accent` `--sc-accent-2` `--sc-amount` `--sc-success`(= Acid Green) `--sc-danger`(`#FF3B3B`)

---

## 6. Typography

| 角色 | 字體 | 用途 |
|---|---|---|
| Display | **Anton**（Condensed、海報感） | SCRATCH CITY、BIG WIN、Jackpot 數字、背景字 |
| Editorial | **Archivo**（含 Condensed / Black 寬度） | 報紙頭條、Nav、按鈕、內文 |
| Mono | **Space Mono** | Serial No.、Issue No.、Barcode 數字、倒數 |
| 中文 Fallback | Noto Sans TC (700/900) | 中文介面 |

全部 Google Fonts，可商用。

**Scale（Desktop / Mobile）**
| Token | Desktop | Mobile |
|---|---|---|
| `--sc-fs-mega` | clamp(120px, 16vw, 280px) | 背景字 / Hero 標 |
| `--sc-fs-jackpot` | clamp(64px, 10vw, 180px) | Jackpot 金額 |
| `--sc-fs-h1` | 72px | 44px |
| `--sc-fs-h2` | 48px | 32px |
| `--sc-fs-h3` | 28px | 22px |
| `--sc-fs-body` | 16px | 15px |
| `--sc-fs-label` | 12px / letter-spacing 0.16em / uppercase | |

數字一律 `font-variant-numeric: tabular-nums`，避免跳動。

---

## 7. Animation Strategy

原則：只動 `transform` / `opacity` / `filter`；每個畫面同時只有 1 個主要動畫；全部尊重 `prefers-reduced-motion`。

| # | 互動 | 做法 | 參數 |
|---|---|---|---|
| 1 | Ticket hover lift | translateY(-8px) + `--sc-lift` | 220ms, `cubic-bezier(.2,.8,.2,1)` |
| 2 | Neon flicker | keyframes 不規則 opacity 0.85↔1，只套 Logo 招牌 | 6s 週期，偶發 2 次閃 |
| 3 | Jackpot pulse | text-shadow glow 呼吸 + 數字滾動計數 | 2.4s ease-in-out loop |
| 4 | Scratch | Canvas（見第 8 節） | — |
| 5 | Win burst | Canvas 粒子：彩紙 + 金額色星點，約 120 顆 | 1.2s，重力 + 衰減 |
| 6 | CTA glow | hover：glow 擴散 + scale 1.04 + 微傾 -1° | 160ms |
| 7 | Magazine rack | CSS scroll-snap + 拖曳 + 左右箭頭 | 原生捲動 |
| 8 | 3D tilt | pointermove → rotateX/Y ≤ 8°，rAF 節流，觸控裝置關閉 | 回彈 400ms |
| + | 光線掃過 | 斜向漸層 pseudo-element 由左至右 | 900ms，hover 觸發 |

工具：CSS + Web Animations API 為主；不引入大型動畫庫。粒子自寫（約 2KB），或用 `canvas-confetti`。

---

## 8. Scratch Card 技術方案

**結構**
```
<ScratchTicket>
  ├─ 結果層（DOM）：獎項圖文
  └─ 覆蓋層（<canvas>）：銀漆 + "SCRATCH HERE" + 雜訊紋理
```

**刮除**
- Canvas 2D，`globalCompositeOperation = 'destination-out'`
- Pointer Events（滑鼠 / 觸控 / 筆統一），`touch-action: none` 防止捲動
- 線段插值（上一點→目前點畫 `lineCap: round` 線），快速滑動不斷線
- 處理 `devicePixelRatio` 與 resize

**完成判定**
- 每 N 次 move（或 150ms 節流）取樣：在縮小的離屏 canvas 上 `getImageData`，計算透明像素比例
- ≥ 55%：自動淡出剩餘塗層 → 觸發 Reveal
- 提供 **REVEAL ALL** 按鈕（無障礙 + 不想刮的使用者）

**安全 / 公平**
- 結果由後端在「購買」時決定，前端只負責呈現
- 結果層在 canvas 初始化完成後才渲染，避免從 DOM 先看到答案（實務上需後端在 reveal 時才回傳結果資料）
- 刮除進度可存本地，重新整理後恢復

**體驗**
- 刮時微弱刮擦音效（預設靜音，可開）、行動裝置 `navigator.vibrate` 輕震
- 中獎：Reveal → 0.3s 停頓 → `WinBurst` → `ResultHeadline` 報紙頭條滑入

---

## 9. Responsive Strategy

| 斷點 | 寬度 | 調整 |
|---|---|---|
| XS | < 480 | Nav 收成頂部 Logo + 餘額，底部固定 5 格「票券列」導覽；Hero 票券滿版寬 88%；背景字縮小 |
| SM | 480–767 | Rack 一次露出 1.3 張提示可滑 |
| MD | 768–1023 | Rack 2.5 張；Jackpot 數字換行規則固定 |
| LG | 1024–1439 | 完整 Nav；Hero 票券 + 側邊雜誌堆 |
| XL | ≥ 1440 | 內容 max-width 1440，背景裝飾延伸至兩側 |

- 字級全用 `clamp()`
- 觸控裝置：關閉 3D tilt / hover 掃光，改為 tap 回饋
- 刮除區最小 280×140，手指筆刷較粗（滑鼠 28px / 觸控 40px）

---

## 建議修改項目

| # | 項目 | 類型 | 影響範圍 |
|---|---|---|---|
| 1 | 新增 `themes/scratch-city/` 目錄與 tokens | 新增 | 無，獨立 |
| 2 | 主題切換器註冊 `scratch-city` | 小改 | 主題設定檔 1 處 |
| 3 | Element Plus 變數覆寫（只在本主題 scope） | 新增 | 無 |
| 4 | 新增 Decor 元件（Neon / Grain / Barcode / Sticker） | 新增 | 無 |
| 5 | 新增 Ticket 家族元件 | 新增 | 無 |
| 6 | 抽離／新增 `ScratchCanvas` 引擎（若已有，改為可吃主題外觀） | 視現況 | 刮卡頁 |
| 7 | 首頁 sections 以主題 slot 方式替換 | 中改 | 首頁 layout |
| 8 | 字體載入（只在本主題 lazy load） | 新增 | 無 |
| 9 | 彩票資料加 `accent` / `issueNo` / `badge` 欄位（可前端 mapping，不動 API） | 小改 | 票券資料層 |

**與既有主題的差異**
- BG 中國風：紅金、對稱、吉祥紋樣 → 本主題：黑底霓虹、不對稱、報刊排版
- 柑仔店：暖色、手寫、木質懷舊 → 本主題：冷夜色、Condensed 海報字、金屬玻璃
- Pixel：點陣、8-bit → 本主題：平滑高對比、Editorial
- 簡約工業風：中性、資訊密度高 → 本主題：情緒優先、超大字、單一焦點
