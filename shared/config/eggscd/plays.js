/**
 * PC蛋蛋（EGGS）信用盤看板設定總表
 *
 * 玩法分類、playId、名稱皆取自 bglottery
 * `src/components/room/lotteryAll/pceggs/config_play.js`（5 大分類、33 個注項）。
 * 极大/极小門檻與豹子/对子/顺子判定邏輯不在此檔（設定檔只放「有哪些注項」），
 * 實際判定在 shared/config/eggs-cd.ts。
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
            columns: 4,
            groupList: [
              { playId: 152111010, name: '大' },
              { playId: 152111011, name: '小' },
              { playId: 152111014, name: '極大' },
              { playId: 152111015, name: '極小' }
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
            columns: 3,
            groupList: [
              { playId: 152111012, name: '單' },
              { playId: 152111013, name: '雙' },
              { playId: 152111018, name: '大單' },
              { playId: 152111019, name: '小單' },
              { playId: 152111016, name: '大雙' },
              { playId: 152111017, name: '小雙' }
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
            columns: 3,
            groupList: [
              { playId: 152121010, name: '豹子' },
              { playId: 152121011, name: '對子' },
              { playId: 152121012, name: '順子' }
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
            columns: 3,
            groupList: [
              { playId: 152131010, name: '紅波' },
              { playId: 152131011, name: '藍波' },
              { playId: 152131012, name: '綠波' }
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
            columns: 7,
            groupList: [
              { playId: 152101010, name: '0' },
              { playId: 152101011, name: '1' },
              { playId: 152101012, name: '2' },
              { playId: 152101013, name: '3' },
              { playId: 152101014, name: '4' },
              { playId: 152101015, name: '5' },
              { playId: 152101016, name: '6' },
              { playId: 152101017, name: '7' },
              { playId: 152101018, name: '8' },
              { playId: 152101019, name: '9' },
              { playId: 152101020, name: '10' },
              { playId: 152101021, name: '11' },
              { playId: 152101022, name: '12' },
              { playId: 152101023, name: '13' },
              { playId: 152101024, name: '14' },
              { playId: 152101025, name: '15' },
              { playId: 152101026, name: '16' },
              { playId: 152101027, name: '17' },
              { playId: 152101028, name: '18' },
              { playId: 152101029, name: '19' },
              { playId: 152101030, name: '20' },
              { playId: 152101031, name: '21' },
              { playId: 152101032, name: '22' },
              { playId: 152101033, name: '23' },
              { playId: 152101034, name: '24' },
              { playId: 152101035, name: '25' },
              { playId: 152101036, name: '26' },
              { playId: 152101037, name: '27' }
            ]
          }
        ]
      }
    ]
  }
]
