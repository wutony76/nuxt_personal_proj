/**
 * PC蛋蛋（EGGS）信用盤看板設定總表
 *
 * 玩法分類、playId、名稱皆取自 bglottery
 * `src/components/room/lotteryAll/pceggs/config_play.js`（5 大分類、33 個注項）。
 * 极大/极小門檻與豹子/对子/顺子判定邏輯不在此檔（設定檔只放「有哪些注項」），
 * 實際判定在 shared/config/eggs-cd.ts。
 *
 * ── 爆池分配權重（weight） ──────────────────────────────
 *   開出豹子那期，該期「非未中」的注單依「注金 × weight」瓜分爆池
 *   （見 shared/config/jackpot.ts 與 server/services/game/lottery/bg/eggs.ts）。
 *   分級沿用 6hc-cd 的理論賠率法（公平賠率 = 母數 ÷ 命中數）：
 *     ≥ 20 → 3（極難，如特碼 0／豹子）
 *     2.5 ~ 20 → 2（中，如色波、極大極小）
 *     < 2.5 → 1（易，如大／小、單／雙）
 *   ⚠️ 群組的 weight 只是預設值，注項上的 weight 會覆寫它 ——
 *      特碼 28 項的機率從 1/1000 到 75/1000 差 75 倍，group 一次帶過會失準，故逐項標。
 *   ⚠️ 明確寫  代表「該注項不參與爆池分配」，與「沒寫」（退回 weightFallback）
 *      是兩件不同的事 —— 判斷用  而不是 falsy，見 jackpot.ts 的 buildJackpotShares()。
 *
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名，
 *    只要設定檔內出現 `#shared/...` 的 import，伺端一載入就會炸
 *    「Package import specifier "#shared/..." is not defined」。
 */

const QUOTA_DEFAULT = {
  item: { min: 1, max: 99999 },
  issue: { max: 0 }
}

const PAYOUT_DEFAULT = { rtp: 0.97 }

export default [
  {
    key: 'daxiao',
    name: '大小',
    list: [
      {
        tabId: 50000,
        tabName: '大小',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '大小',
            // 爆池分配的群組層預設；下方注項各自覆寫（特碼 28 項機率差距大，必須逐項標）
            weight: 1,
            columns: 4,
            groupList: [
              { playId: 152111010, name: '大', weight: 1 }, // 500/1000 = 50.0000%（公平 2.000）
              { playId: 152111011, name: '小', weight: 1 }, // 500/1000 = 50.0000%（公平 2.000）
              { playId: 152111014, name: '極大', weight: 2 }, // 56/1000 = 5.6000%（公平 17.857）
              { playId: 152111015, name: '極小', weight: 2 } // 56/1000 = 5.6000%（公平 17.857）
            ]
          }
        ]
      }
    ]
  },
  {
    key: 'danshuang',
    name: '單雙',
    list: [
      {
        tabId: 50001,
        tabName: '單雙',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '單雙',
            // 爆池分配的群組層預設；下方注項各自覆寫（特碼 28 項機率差距大，必須逐項標）
            weight: 2,
            columns: 3,
            groupList: [
              { playId: 152111012, name: '單', weight: 1 }, // 500/1000 = 50.0000%（公平 2.000）
              { playId: 152111013, name: '雙', weight: 1 }, // 500/1000 = 50.0000%（公平 2.000）
              { playId: 152111018, name: '大單', weight: 2 }, // 231/1000 = 23.1000%（公平 4.329）
              { playId: 152111019, name: '小單', weight: 2 }, // 269/1000 = 26.9000%（公平 3.717）
              { playId: 152111016, name: '大雙', weight: 2 }, // 269/1000 = 26.9000%（公平 3.717）
              { playId: 152111017, name: '小雙', weight: 2 } // 231/1000 = 23.1000%（公平 4.329）
            ]
          }
        ]
      }
    ]
  },
  {
    key: 'tese',
    name: '特殊玩法',
    list: [
      {
        tabId: 50002,
        tabName: '特殊玩法',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '特殊玩法',
            // 爆池分配的群組層預設；下方注項各自覆寫（特碼 28 項機率差距大，必須逐項標）
            weight: 2,
            columns: 3,
            groupList: [
              { playId: 152121010, name: '豹子', weight: 3 }, // 10/1000 = 1.0000%（公平 100.000）
              { playId: 152121011, name: '對子', weight: 2 }, // 270/1000 = 27.0000%（公平 3.704）
              { playId: 152121012, name: '順子', weight: 3 } // 48/1000 = 4.8000%（公平 20.833）
            ]
          }
        ]
      }
    ]
  },
  {
    key: 'sebo',
    name: '色波',
    list: [
      {
        tabId: 50003,
        tabName: '色波',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '色波',
            // 爆池分配的群組層預設；下方注項各自覆寫（特碼 28 項機率差距大，必須逐項標）
            weight: 2,
            columns: 3,
            groupList: [
              { playId: 152131010, name: '紅波', weight: 2 }, // 332/1000 = 33.2000%（公平 3.012）
              { playId: 152131011, name: '藍波', weight: 2 }, // 258/1000 = 25.8000%（公平 3.876）
              { playId: 152131012, name: '綠波', weight: 2 } // 258/1000 = 25.8000%（公平 3.876）
            ]
          }
        ]
      }
    ]
  },
  {
    key: 'tema',
    name: '特碼',
    list: [
      {
        tabId: 50004,
        tabName: '特碼',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '特碼（和值 0~27）',
            // 爆池分配的群組層預設；下方注項各自覆寫（特碼 28 項機率差距大，必須逐項標）
            weight: 3,
            columns: 7,
            groupList: [
              { playId: 152101010, name: '0', weight: 3 }, // 1/1000 = 0.1000%（公平 1000.000）
              { playId: 152101011, name: '1', weight: 3 }, // 3/1000 = 0.3000%（公平 333.333）
              { playId: 152101012, name: '2', weight: 3 }, // 6/1000 = 0.6000%（公平 166.667）
              { playId: 152101013, name: '3', weight: 3 }, // 10/1000 = 1.0000%（公平 100.000）
              { playId: 152101014, name: '4', weight: 3 }, // 15/1000 = 1.5000%（公平 66.667）
              { playId: 152101015, name: '5', weight: 3 }, // 21/1000 = 2.1000%（公平 47.619）
              { playId: 152101016, name: '6', weight: 3 }, // 28/1000 = 2.8000%（公平 35.714）
              { playId: 152101017, name: '7', weight: 3 }, // 36/1000 = 3.6000%（公平 27.778）
              { playId: 152101018, name: '8', weight: 3 }, // 45/1000 = 4.5000%（公平 22.222）
              { playId: 152101019, name: '9', weight: 2 }, // 55/1000 = 5.5000%（公平 18.182）
              { playId: 152101020, name: '10', weight: 2 }, // 63/1000 = 6.3000%（公平 15.873）
              { playId: 152101021, name: '11', weight: 2 }, // 69/1000 = 6.9000%（公平 14.493）
              { playId: 152101022, name: '12', weight: 2 }, // 73/1000 = 7.3000%（公平 13.699）
              { playId: 152101023, name: '13', weight: 2 }, // 75/1000 = 7.5000%（公平 13.333）
              { playId: 152101024, name: '14', weight: 2 }, // 75/1000 = 7.5000%（公平 13.333）
              { playId: 152101025, name: '15', weight: 2 }, // 73/1000 = 7.3000%（公平 13.699）
              { playId: 152101026, name: '16', weight: 2 }, // 69/1000 = 6.9000%（公平 14.493）
              { playId: 152101027, name: '17', weight: 2 }, // 63/1000 = 6.3000%（公平 15.873）
              { playId: 152101028, name: '18', weight: 2 }, // 55/1000 = 5.5000%（公平 18.182）
              { playId: 152101029, name: '19', weight: 3 }, // 45/1000 = 4.5000%（公平 22.222）
              { playId: 152101030, name: '20', weight: 3 }, // 36/1000 = 3.6000%（公平 27.778）
              { playId: 152101031, name: '21', weight: 3 }, // 28/1000 = 2.8000%（公平 35.714）
              { playId: 152101032, name: '22', weight: 3 }, // 21/1000 = 2.1000%（公平 47.619）
              { playId: 152101033, name: '23', weight: 3 }, // 15/1000 = 1.5000%（公平 66.667）
              { playId: 152101034, name: '24', weight: 3 }, // 10/1000 = 1.0000%（公平 100.000）
              { playId: 152101035, name: '25', weight: 3 }, // 6/1000 = 0.6000%（公平 166.667）
              { playId: 152101036, name: '26', weight: 3 }, // 3/1000 = 0.3000%（公平 333.333）
              { playId: 152101037, name: '27', weight: 3 } // 1/1000 = 0.1000%（公平 1000.000）
            ]
          }
        ]
      }
    ]
  }
]
