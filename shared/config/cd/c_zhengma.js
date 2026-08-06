export default [
  {
    name: '正碼',
    key: 'zhengma',
    list: [
      {
        tabId: 3000,
        tabName: '正碼A',
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          }
        },
        tabGroup: [
          {
            groupName: '正碼',
            // 正碼單號（命中 6 顆正碼之一）：賠率對齊 shared/config/6hc-cd.ts 的 CREDIT_ZHENGMA_ODDS.number
            groupList: [
              { playId: '3000-001', name: '01', odds: 8 },
              { playId: '3000-002', name: '02', odds: 8 },
              { playId: '3000-003', name: '03', odds: 8 },
              { playId: '3000-004', name: '04', odds: 8 },
              { playId: '3000-005', name: '05', odds: 8 },
              { playId: '3000-006', name: '06', odds: 8 },
              { playId: '3000-007', name: '07', odds: 8 },
              { playId: '3000-008', name: '08', odds: 8 },
              { playId: '3000-009', name: '09', odds: 8 },
              { playId: '3000-010', name: '10', odds: 8 },
              { playId: '3000-011', name: '11', odds: 8 },
              { playId: '3000-012', name: '12', odds: 8 },
              { playId: '3000-013', name: '13', odds: 8 },
              { playId: '3000-014', name: '14', odds: 8 },
              { playId: '3000-015', name: '15', odds: 8 },
              { playId: '3000-016', name: '16', odds: 8 },
              { playId: '3000-017', name: '17', odds: 8 },
              { playId: '3000-018', name: '18', odds: 8 },
              { playId: '3000-019', name: '19', odds: 8 },
              { playId: '3000-020', name: '20', odds: 8 },
              { playId: '3000-021', name: '21', odds: 8 },
              { playId: '3000-022', name: '22', odds: 8 },
              { playId: '3000-023', name: '23', odds: 8 },
              { playId: '3000-024', name: '24', odds: 8 },
              { playId: '3000-025', name: '25', odds: 8 },
              { playId: '3000-026', name: '26', odds: 8 },
              { playId: '3000-027', name: '27', odds: 8 },
              { playId: '3000-028', name: '28', odds: 8 },
              { playId: '3000-029', name: '29', odds: 8 },
              { playId: '3000-030', name: '30', odds: 8 },
              { playId: '3000-031', name: '31', odds: 8 },
              { playId: '3000-032', name: '32', odds: 8 },
              { playId: '3000-033', name: '33', odds: 8 },
              { playId: '3000-034', name: '34', odds: 8 },
              { playId: '3000-035', name: '35', odds: 8 },
              { playId: '3000-036', name: '36', odds: 8 },
              { playId: '3000-037', name: '37', odds: 8 },
              { playId: '3000-038', name: '38', odds: 8 },
              { playId: '3000-039', name: '39', odds: 8 },
              { playId: '3000-040', name: '40', odds: 8 },
              { playId: '3000-041', name: '41', odds: 8 },
              { playId: '3000-042', name: '42', odds: 8 },
              { playId: '3000-043', name: '43', odds: 8 },
              { playId: '3000-044', name: '44', odds: 8 },
              { playId: '3000-045', name: '45', odds: 8 },
              { playId: '3000-046', name: '46', odds: 8 },
              { playId: '3000-047', name: '47', odds: 8 },
              { playId: '3000-048', name: '48', odds: 8 },
              { playId: '3000-049', name: '49', odds: 8 },
            ],
          },
          {
            groupName: '兩面',
            // 總和兩面（總和大／小／單／雙）：賠率對齊 CREDIT_ZHENGMA_ODDS.side
            groupList: [
              { playId: '3000-101', name: '總和大', odds: 1.98 },
              { playId: '3000-102', name: '總和小', odds: 1.98 },
              { playId: '3000-103', name: '總和單', odds: 1.98 },
              { playId: '3000-104', name: '總和雙', odds: 1.98 },
            ],
          },
        ],
      },
      {
        tabId: 3001,
        tabName: '正碼B',
        // 正碼B 定位為「大額投注」：投注額度上限明顯高於正碼A，
        // 賠率也刻意調低（對應風控／利潤空間），與正碼A（見上方 CREDIT_ZHENGMA_ODDS 對齊值）做出區分
        // ⚠️ 注意：此處僅為前端顯示賠率，實際派彩仍由 shared/config/6hc-cd.ts 的
        // CREDIT_ZHENGMA_ODDS／creditZhengmaOddsOf 統一計算（目前不分 tabId）。
        // 若要讓正碼B 真正以較低賠率派彩，需同步調整後端結算邏輯，否則會出現「顯示賠率」與
        // 「實際派彩」不一致的問題。
        settings: {
          quota: {
            item: { // 單注投注額
              min: 300, // 單注投注額最低 100 元
              max: 100000,
            },
            issue: { // 單期投注額
              max: 5000000,
            },
          }
        },
        tabGroup: [
          {
            groupName: '正碼',
            groupList: [
              { playId: '3001-001', name: '01', odds: 7.5 },
              { playId: '3001-002', name: '02', odds: 7.5 },
              { playId: '3001-003', name: '03', odds: 7.5 },
              { playId: '3001-004', name: '04', odds: 7.5 },
              { playId: '3001-005', name: '05', odds: 7.5 },
              { playId: '3001-006', name: '06', odds: 7.5 },
              { playId: '3001-007', name: '07', odds: 7.5 },
              { playId: '3001-008', name: '08', odds: 7.5 },
              { playId: '3001-009', name: '09', odds: 7.5 },
              { playId: '3001-010', name: '10', odds: 7.5 },
              { playId: '3001-011', name: '11', odds: 7.5 },
              { playId: '3001-012', name: '12', odds: 7.5 },
              { playId: '3001-013', name: '13', odds: 7.5 },
              { playId: '3001-014', name: '14', odds: 7.5 },
              { playId: '3001-015', name: '15', odds: 7.5 },
              { playId: '3001-016', name: '16', odds: 7.5 },
              { playId: '3001-017', name: '17', odds: 7.5 },
              { playId: '3001-018', name: '18', odds: 7.5 },
              { playId: '3001-019', name: '19', odds: 7.5 },
              { playId: '3001-020', name: '20', odds: 7.5 },
              { playId: '3001-021', name: '21', odds: 7.5 },
              { playId: '3001-022', name: '22', odds: 7.5 },
              { playId: '3001-023', name: '23', odds: 7.5 },
              { playId: '3001-024', name: '24', odds: 7.5 },
              { playId: '3001-025', name: '25', odds: 7.5 },
              { playId: '3001-026', name: '26', odds: 7.5 },
              { playId: '3001-027', name: '27', odds: 7.5 },
              { playId: '3001-028', name: '28', odds: 7.5 },
              { playId: '3001-029', name: '29', odds: 7.5 },
              { playId: '3001-030', name: '30', odds: 7.5 },
              { playId: '3001-031', name: '31', odds: 7.5 },
              { playId: '3001-032', name: '32', odds: 7.5 },
              { playId: '3001-033', name: '33', odds: 7.5 },
              { playId: '3001-034', name: '34', odds: 7.5 },
              { playId: '3001-035', name: '35', odds: 7.5 },
              { playId: '3001-036', name: '36', odds: 7.5 },
              { playId: '3001-037', name: '37', odds: 7.5 },
              { playId: '3001-038', name: '38', odds: 7.5 },
              { playId: '3001-039', name: '39', odds: 7.5 },
              { playId: '3001-040', name: '40', odds: 7.5 },
              { playId: '3001-041', name: '41', odds: 7.5 },
              { playId: '3001-042', name: '42', odds: 7.5 },
              { playId: '3001-043', name: '43', odds: 7.5 },
              { playId: '3001-044', name: '44', odds: 7.5 },
              { playId: '3001-045', name: '45', odds: 7.5 },
              { playId: '3001-046', name: '46', odds: 7.5 },
              { playId: '3001-047', name: '47', odds: 7.5 },
              { playId: '3001-048', name: '48', odds: 7.5 },
              { playId: '3001-049', name: '49', odds: 7.5 },
            ],
          },
          {
            groupName: '兩面',
            groupList: [
              { playId: '3001-101', name: '總和大', odds: 1.92 },
              { playId: '3001-102', name: '總和小', odds: 1.92 },
              { playId: '3001-103', name: '總和單', odds: 1.92 },
              { playId: '3001-104', name: '總和雙', odds: 1.92 },
            ],
          },
        ],
      },

    ],
  },
]
