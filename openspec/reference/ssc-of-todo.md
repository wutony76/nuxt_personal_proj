# 時時彩（SSC）官方盤 —— 未實作玩法清單

來源：`pcv2_0223/app/config/bg/conf_sc_og.js`（13 個玩法）與
`bglottery/src/components/room/lotteryAll/ssc/config_ssc.js`（151 個 playId 的選號區 layout）。

本輪只實作「核心幾組」，目的是把 config → 判定 → 服務 → 頁面整條路跑通，
並涵蓋 digital 選號區的各種 layout 型態（多位選號／單位定膽／組選／兩面）。
之後要擴充，多數情況只需要加 config，判定層再補對應的注碼分支即可。

## 本輪已納入（11 個 playType）

| 玩法 | 分頁 | 玩法項 |
|---|---|---|
| 定位胆 | 定位胆 | 定位胆 |
| 二星 | 后二直选 | 复式 |
| 二星 | 后二组选 | 复式 |
| 后三 | 后三直选 | 复式 |
| 后三 | 后三组选 | 组三 |
| 后三 | 后三组选 | 组六 |
| 五星 | 五星直选 | 复式 |
| 大小单双 | 大小单双 | 后二 |
| 大小单双 | 大小单双 | 后三 |
| 大小单双 | 大小单双 | 前二 |
| 大小单双 | 大小单双 | 前三 |

## 尚未實作（94 個 playType）

### 二星（playId 10111）—— 14 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 前二直选 | 复式 | digital |
| 前二直选 | 单式 | input |
| 前二直选 | 和值 | noFastSelect |
| 前二直选 | 跨度 | digital |
| 后二直选 | 单式 | input |
| 后二直选 | 和值 | noFastSelect |
| 后二直选 | 跨度 | digital |
| 前二组选 | 复式 | digital |
| 前二组选 | 单式 | input |
| 前二组选 | 和值 | noFastSelect |
| 前二组选 | 包胆 | noFastSelect |
| 后二组选 | 单式 | input |
| 后二组选 | 和值 | noFastSelect |
| 后二组选 | 包胆 | noFastSelect |

### 前三（playId 10112）—— 12 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 前三直选 | 复式 | digital |
| 前三直选 | 单式 | input |
| 前三直选 | 和值 | noFastSelect |
| 前三直选 | 跨度 | digital |
| 前三直选 | 组合 | digital |
| 前三组选 | 组三 | digital |
| 前三组选 | 组六 | digital |
| 前三组选 | 混合组选 | input |
| 前三组选 | 组选和值 | noFastSelect |
| 前三组选 | 组选包胆 | noFastSelect |
| 前三其它 | 和值尾数 | digital |
| 前三其它 | 特殊号码 | noFastSelect |

### 中三（playId 10113）—— 12 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 中三直选 | 复式 | digital |
| 中三直选 | 单式 | input |
| 中三直选 | 和值 | noFastSelect |
| 中三直选 | 跨度 | digital |
| 中三直选 | 组合 | digital |
| 中三组选 | 组三 | digital |
| 中三组选 | 组六 | digital |
| 中三组选 | 混合组选 | input |
| 中三组选 | 组选和值 | noFastSelect |
| 中三组选 | 组选包胆 | noFastSelect |
| 中三其它 | 和值尾数 | digital |
| 中三其它 | 特殊号码 | noFastSelect |

### 后三（playId 10114）—— 9 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 后三直选 | 单式 | input |
| 后三直选 | 和值 | noFastSelect |
| 后三直选 | 跨度 | digital |
| 后三直选 | 组合 | digital |
| 后三组选 | 混合组选 | input |
| 后三组选 | 组选和值 | noFastSelect |
| 后三组选 | 组选包胆 | noFastSelect |
| 后三其它 | 和值尾数 | digital |
| 后三其它 | 特殊号码 | noFastSelect |

### 四星（playId 10115）—— 4 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 前四直选 | 复式 | digital |
| 前四直选 | 单式 | input |
| 后四直选 | 复式 | digital |
| 后四直选 | 单式 | input |

### 五星（playId 10116）—— 7 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 五星直选 | 单式 | input |
| 五星组选 | 组5 | digital |
| 五星组选 | 组10 | digital |
| 五星组选 | 组20 | digital |
| 五星组选 | 组30 | digital |
| 五星组选 | 组60 | digital |
| 五星组选 | 组120 | digital |

### 不定位（playId 10117）—— 11 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 前三 | 一码不定位 | digital |
| 前三 | 二码不定位 | digital |
| 后三 | 一码不定位 | digital |
| 后三 | 二码不定位 | digital |
| 前四 | 一码不定位 | digital |
| 前四 | 二码不定位 | digital |
| 后四 | 一码不定位 | digital |
| 后四 | 二码不定位 | digital |
| 五星 | 一码不定位 | digital |
| 五星 | 二码不定位 | digital |
| 五星 | 三码不定位 | digital |

### 特殊玩法（playId 10119）—— 4 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 特殊玩法 | 一帆风顺 | digital |
| 特殊玩法 | 好事成双 | digital |
| 特殊玩法 | 三星报喜 | digital |
| 特殊玩法 | 四季发财 | digital |

### 任选二（playId 10120）—— 6 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 任二直选 | 复式 | digital |
| 任二直选 | 单式 | input |
| 任二直选 | 和值 | noFastSelect |
| 任二组选 | 复式 | digital |
| 任二组选 | 单式 | input |
| 任二组选 | 和值 | noFastSelect |

### 任选三（playId 10121）—— 9 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 任三直选 | 复式 | digital |
| 任三直选 | 单式 | input |
| 任三直选 | 和值 | noFastSelect |
| 任三组选 | 组三复式 | digital |
| 任三组选 | 组三单式 | input |
| 任三组选 | 组六复式 | digital |
| 任三组选 | 组六单式 | input |
| 任三组选 | 混合组选 | input |
| 任三组选 | 组选和值 | noFastSelect |

### 任选四（playId 10122）—— 6 項

| 分頁 | 玩法項 | 選號區型態 |
|---|---|---|
| 任四直选 | 复式 | digital |
| 任四直选 | 单式 | input |
| 任四组选 | 组选24 | digital |
| 任四组选 | 组选12 | digital |
| 任四组选 | 组选6 | digital |
| 任四组选 | 组选4 | digital |

## 備註

- `playOpt: input` 是「單式」（貼注碼字串），本專案 pk10 也未實作，需要另做輸入框與注碼解析。
- `noFastSelect` 是和值／包胆／特殊號碼那類，選號區規則與複式不同。
- bglottery 的 config_ssc.js 另有 40 個 playId 是空殼 `{}`（該版沒開），本清單不列。
