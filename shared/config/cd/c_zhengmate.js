export default [
  {
    name: '正碼特',
    key: 'zhengmate',
    // 正碼特（正一特～正六特）：以「指定名次那一顆正碼」結算，
    // 每個名次的號碼分布都是 1~49 均勻，機率結構與特碼（49 選 1）相同，
    // 因此各分頁賠率一致，也直接對齊 shared/config/6hc-cd.ts 的 CREDIT_TEMA_ODDS，
    // 避免 config 顯示賠率與 creditOddsOf 的退回值不一致。
    list: [
      {
        tabId: 4000,
        tabName: '正一特',
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
            groupName: '正一特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 單號：指定名次開出該號（理論值 49）
            groupList: [
              { playId: '4000-001', name: '01', odds: 48 },
              { playId: '4000-002', name: '02', odds: 48 },
              { playId: '4000-003', name: '03', odds: 48 },
              { playId: '4000-004', name: '04', odds: 48 },
              { playId: '4000-005', name: '05', odds: 48 },
              { playId: '4000-006', name: '06', odds: 48 },
              { playId: '4000-007', name: '07', odds: 48 },
              { playId: '4000-008', name: '08', odds: 48 },
              { playId: '4000-009', name: '09', odds: 48 },
              { playId: '4000-010', name: '10', odds: 48 },
              { playId: '4000-011', name: '11', odds: 48 },
              { playId: '4000-012', name: '12', odds: 48 },
              { playId: '4000-013', name: '13', odds: 48 },
              { playId: '4000-014', name: '14', odds: 48 },
              { playId: '4000-015', name: '15', odds: 48 },
              { playId: '4000-016', name: '16', odds: 48 },
              { playId: '4000-017', name: '17', odds: 48 },
              { playId: '4000-018', name: '18', odds: 48 },
              { playId: '4000-019', name: '19', odds: 48 },
              { playId: '4000-020', name: '20', odds: 48 },
              { playId: '4000-021', name: '21', odds: 48 },
              { playId: '4000-022', name: '22', odds: 48 },
              { playId: '4000-023', name: '23', odds: 48 },
              { playId: '4000-024', name: '24', odds: 48 },
              { playId: '4000-025', name: '25', odds: 48 },
              { playId: '4000-026', name: '26', odds: 48 },
              { playId: '4000-027', name: '27', odds: 48 },
              { playId: '4000-028', name: '28', odds: 48 },
              { playId: '4000-029', name: '29', odds: 48 },
              { playId: '4000-030', name: '30', odds: 48 },
              { playId: '4000-031', name: '31', odds: 48 },
              { playId: '4000-032', name: '32', odds: 48 },
              { playId: '4000-033', name: '33', odds: 48 },
              { playId: '4000-034', name: '34', odds: 48 },
              { playId: '4000-035', name: '35', odds: 48 },
              { playId: '4000-036', name: '36', odds: 48 },
              { playId: '4000-037', name: '37', odds: 48 },
              { playId: '4000-038', name: '38', odds: 48 },
              { playId: '4000-039', name: '39', odds: 48 },
              { playId: '4000-040', name: '40', odds: 48 },
              { playId: '4000-041', name: '41', odds: 48 },
              { playId: '4000-042', name: '42', odds: 48 },
              { playId: '4000-043', name: '43', odds: 48 },
              { playId: '4000-044', name: '44', odds: 48 },
              { playId: '4000-045', name: '45', odds: 48 },
              { playId: '4000-046', name: '46', odds: 48 },
              { playId: '4000-047', name: '47', odds: 48 },
              { playId: '4000-048', name: '48', odds: 48 },
              { playId: '4000-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            // 兩面：大小／單雙／合單雙／尾大小；開 49 號為和局，扣掉後大小各 24 個號（理論值 2）
            groupList: [
              { playId: '4000-101', name: '大', odds: 1.98 },
              { playId: '4000-102', name: '小', odds: 1.98 },
              { playId: '4000-103', name: '單', odds: 1.98 },
              { playId: '4000-104', name: '雙', odds: 1.98 },
              { playId: '4000-105', name: '合單', odds: 1.98 },
              { playId: '4000-106', name: '合雙', odds: 1.98 },
              { playId: '4000-107', name: '尾大', odds: 1.98 },
              { playId: '4000-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            // 色波：紅 17 個號（理論值 2.88）、藍／綠各 16 個號（理論值 3.06），不設和局
            groupList: [
              { playId: '4000-201', name: '紅波', odds: 2.7 },
              { playId: '4000-202', name: '藍波', odds: 2.9 },
              { playId: '4000-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },

      {
        tabId: 4001,
        tabName: '正二特',
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
            groupName: '正二特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 賠率與正一特相同：換名次不改變命中機率，僅結算取的球位不同
            groupList: [
              { playId: '4001-001', name: '01', odds: 48 },
              { playId: '4001-002', name: '02', odds: 48 },
              { playId: '4001-003', name: '03', odds: 48 },
              { playId: '4001-004', name: '04', odds: 48 },
              { playId: '4001-005', name: '05', odds: 48 },
              { playId: '4001-006', name: '06', odds: 48 },
              { playId: '4001-007', name: '07', odds: 48 },
              { playId: '4001-008', name: '08', odds: 48 },
              { playId: '4001-009', name: '09', odds: 48 },
              { playId: '4001-010', name: '10', odds: 48 },
              { playId: '4001-011', name: '11', odds: 48 },
              { playId: '4001-012', name: '12', odds: 48 },
              { playId: '4001-013', name: '13', odds: 48 },
              { playId: '4001-014', name: '14', odds: 48 },
              { playId: '4001-015', name: '15', odds: 48 },
              { playId: '4001-016', name: '16', odds: 48 },
              { playId: '4001-017', name: '17', odds: 48 },
              { playId: '4001-018', name: '18', odds: 48 },
              { playId: '4001-019', name: '19', odds: 48 },
              { playId: '4001-020', name: '20', odds: 48 },
              { playId: '4001-021', name: '21', odds: 48 },
              { playId: '4001-022', name: '22', odds: 48 },
              { playId: '4001-023', name: '23', odds: 48 },
              { playId: '4001-024', name: '24', odds: 48 },
              { playId: '4001-025', name: '25', odds: 48 },
              { playId: '4001-026', name: '26', odds: 48 },
              { playId: '4001-027', name: '27', odds: 48 },
              { playId: '4001-028', name: '28', odds: 48 },
              { playId: '4001-029', name: '29', odds: 48 },
              { playId: '4001-030', name: '30', odds: 48 },
              { playId: '4001-031', name: '31', odds: 48 },
              { playId: '4001-032', name: '32', odds: 48 },
              { playId: '4001-033', name: '33', odds: 48 },
              { playId: '4001-034', name: '34', odds: 48 },
              { playId: '4001-035', name: '35', odds: 48 },
              { playId: '4001-036', name: '36', odds: 48 },
              { playId: '4001-037', name: '37', odds: 48 },
              { playId: '4001-038', name: '38', odds: 48 },
              { playId: '4001-039', name: '39', odds: 48 },
              { playId: '4001-040', name: '40', odds: 48 },
              { playId: '4001-041', name: '41', odds: 48 },
              { playId: '4001-042', name: '42', odds: 48 },
              { playId: '4001-043', name: '43', odds: 48 },
              { playId: '4001-044', name: '44', odds: 48 },
              { playId: '4001-045', name: '45', odds: 48 },
              { playId: '4001-046', name: '46', odds: 48 },
              { playId: '4001-047', name: '47', odds: 48 },
              { playId: '4001-048', name: '48', odds: 48 },
              { playId: '4001-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '4001-101', name: '大', odds: 1.98 },
              { playId: '4001-102', name: '小', odds: 1.98 },
              { playId: '4001-103', name: '單', odds: 1.98 },
              { playId: '4001-104', name: '雙', odds: 1.98 },
              { playId: '4001-105', name: '合單', odds: 1.98 },
              { playId: '4001-106', name: '合雙', odds: 1.98 },
              { playId: '4001-107', name: '尾大', odds: 1.98 },
              { playId: '4001-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '4001-201', name: '紅波', odds: 2.7 },
              { playId: '4001-202', name: '藍波', odds: 2.9 },
              { playId: '4001-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },

      {
        tabId: 4002,
        tabName: '正三特',
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
            groupName: '正三特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 賠率與正一特相同：換名次不改變命中機率，僅結算取的球位不同
            groupList: [
              { playId: '4002-001', name: '01', odds: 48 },
              { playId: '4002-002', name: '02', odds: 48 },
              { playId: '4002-003', name: '03', odds: 48 },
              { playId: '4002-004', name: '04', odds: 48 },
              { playId: '4002-005', name: '05', odds: 48 },
              { playId: '4002-006', name: '06', odds: 48 },
              { playId: '4002-007', name: '07', odds: 48 },
              { playId: '4002-008', name: '08', odds: 48 },
              { playId: '4002-009', name: '09', odds: 48 },
              { playId: '4002-010', name: '10', odds: 48 },
              { playId: '4002-011', name: '11', odds: 48 },
              { playId: '4002-012', name: '12', odds: 48 },
              { playId: '4002-013', name: '13', odds: 48 },
              { playId: '4002-014', name: '14', odds: 48 },
              { playId: '4002-015', name: '15', odds: 48 },
              { playId: '4002-016', name: '16', odds: 48 },
              { playId: '4002-017', name: '17', odds: 48 },
              { playId: '4002-018', name: '18', odds: 48 },
              { playId: '4002-019', name: '19', odds: 48 },
              { playId: '4002-020', name: '20', odds: 48 },
              { playId: '4002-021', name: '21', odds: 48 },
              { playId: '4002-022', name: '22', odds: 48 },
              { playId: '4002-023', name: '23', odds: 48 },
              { playId: '4002-024', name: '24', odds: 48 },
              { playId: '4002-025', name: '25', odds: 48 },
              { playId: '4002-026', name: '26', odds: 48 },
              { playId: '4002-027', name: '27', odds: 48 },
              { playId: '4002-028', name: '28', odds: 48 },
              { playId: '4002-029', name: '29', odds: 48 },
              { playId: '4002-030', name: '30', odds: 48 },
              { playId: '4002-031', name: '31', odds: 48 },
              { playId: '4002-032', name: '32', odds: 48 },
              { playId: '4002-033', name: '33', odds: 48 },
              { playId: '4002-034', name: '34', odds: 48 },
              { playId: '4002-035', name: '35', odds: 48 },
              { playId: '4002-036', name: '36', odds: 48 },
              { playId: '4002-037', name: '37', odds: 48 },
              { playId: '4002-038', name: '38', odds: 48 },
              { playId: '4002-039', name: '39', odds: 48 },
              { playId: '4002-040', name: '40', odds: 48 },
              { playId: '4002-041', name: '41', odds: 48 },
              { playId: '4002-042', name: '42', odds: 48 },
              { playId: '4002-043', name: '43', odds: 48 },
              { playId: '4002-044', name: '44', odds: 48 },
              { playId: '4002-045', name: '45', odds: 48 },
              { playId: '4002-046', name: '46', odds: 48 },
              { playId: '4002-047', name: '47', odds: 48 },
              { playId: '4002-048', name: '48', odds: 48 },
              { playId: '4002-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '4002-101', name: '大', odds: 1.98 },
              { playId: '4002-102', name: '小', odds: 1.98 },
              { playId: '4002-103', name: '單', odds: 1.98 },
              { playId: '4002-104', name: '雙', odds: 1.98 },
              { playId: '4002-105', name: '合單', odds: 1.98 },
              { playId: '4002-106', name: '合雙', odds: 1.98 },
              { playId: '4002-107', name: '尾大', odds: 1.98 },
              { playId: '4002-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '4002-201', name: '紅波', odds: 2.7 },
              { playId: '4002-202', name: '藍波', odds: 2.9 },
              { playId: '4002-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },

      {
        tabId: 4003,
        tabName: '正四特',
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
            groupName: '正四特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 賠率與正一特相同：換名次不改變命中機率，僅結算取的球位不同
            groupList: [
              { playId: '4003-001', name: '01', odds: 48 },
              { playId: '4003-002', name: '02', odds: 48 },
              { playId: '4003-003', name: '03', odds: 48 },
              { playId: '4003-004', name: '04', odds: 48 },
              { playId: '4003-005', name: '05', odds: 48 },
              { playId: '4003-006', name: '06', odds: 48 },
              { playId: '4003-007', name: '07', odds: 48 },
              { playId: '4003-008', name: '08', odds: 48 },
              { playId: '4003-009', name: '09', odds: 48 },
              { playId: '4003-010', name: '10', odds: 48 },
              { playId: '4003-011', name: '11', odds: 48 },
              { playId: '4003-012', name: '12', odds: 48 },
              { playId: '4003-013', name: '13', odds: 48 },
              { playId: '4003-014', name: '14', odds: 48 },
              { playId: '4003-015', name: '15', odds: 48 },
              { playId: '4003-016', name: '16', odds: 48 },
              { playId: '4003-017', name: '17', odds: 48 },
              { playId: '4003-018', name: '18', odds: 48 },
              { playId: '4003-019', name: '19', odds: 48 },
              { playId: '4003-020', name: '20', odds: 48 },
              { playId: '4003-021', name: '21', odds: 48 },
              { playId: '4003-022', name: '22', odds: 48 },
              { playId: '4003-023', name: '23', odds: 48 },
              { playId: '4003-024', name: '24', odds: 48 },
              { playId: '4003-025', name: '25', odds: 48 },
              { playId: '4003-026', name: '26', odds: 48 },
              { playId: '4003-027', name: '27', odds: 48 },
              { playId: '4003-028', name: '28', odds: 48 },
              { playId: '4003-029', name: '29', odds: 48 },
              { playId: '4003-030', name: '30', odds: 48 },
              { playId: '4003-031', name: '31', odds: 48 },
              { playId: '4003-032', name: '32', odds: 48 },
              { playId: '4003-033', name: '33', odds: 48 },
              { playId: '4003-034', name: '34', odds: 48 },
              { playId: '4003-035', name: '35', odds: 48 },
              { playId: '4003-036', name: '36', odds: 48 },
              { playId: '4003-037', name: '37', odds: 48 },
              { playId: '4003-038', name: '38', odds: 48 },
              { playId: '4003-039', name: '39', odds: 48 },
              { playId: '4003-040', name: '40', odds: 48 },
              { playId: '4003-041', name: '41', odds: 48 },
              { playId: '4003-042', name: '42', odds: 48 },
              { playId: '4003-043', name: '43', odds: 48 },
              { playId: '4003-044', name: '44', odds: 48 },
              { playId: '4003-045', name: '45', odds: 48 },
              { playId: '4003-046', name: '46', odds: 48 },
              { playId: '4003-047', name: '47', odds: 48 },
              { playId: '4003-048', name: '48', odds: 48 },
              { playId: '4003-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '4003-101', name: '大', odds: 1.98 },
              { playId: '4003-102', name: '小', odds: 1.98 },
              { playId: '4003-103', name: '單', odds: 1.98 },
              { playId: '4003-104', name: '雙', odds: 1.98 },
              { playId: '4003-105', name: '合單', odds: 1.98 },
              { playId: '4003-106', name: '合雙', odds: 1.98 },
              { playId: '4003-107', name: '尾大', odds: 1.98 },
              { playId: '4003-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '4003-201', name: '紅波', odds: 2.7 },
              { playId: '4003-202', name: '藍波', odds: 2.9 },
              { playId: '4003-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },

      {
        tabId: 4004,
        tabName: '正五特',
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
            groupName: '正五特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 賠率與正一特相同：換名次不改變命中機率，僅結算取的球位不同
            groupList: [
              { playId: '4004-001', name: '01', odds: 48 },
              { playId: '4004-002', name: '02', odds: 48 },
              { playId: '4004-003', name: '03', odds: 48 },
              { playId: '4004-004', name: '04', odds: 48 },
              { playId: '4004-005', name: '05', odds: 48 },
              { playId: '4004-006', name: '06', odds: 48 },
              { playId: '4004-007', name: '07', odds: 48 },
              { playId: '4004-008', name: '08', odds: 48 },
              { playId: '4004-009', name: '09', odds: 48 },
              { playId: '4004-010', name: '10', odds: 48 },
              { playId: '4004-011', name: '11', odds: 48 },
              { playId: '4004-012', name: '12', odds: 48 },
              { playId: '4004-013', name: '13', odds: 48 },
              { playId: '4004-014', name: '14', odds: 48 },
              { playId: '4004-015', name: '15', odds: 48 },
              { playId: '4004-016', name: '16', odds: 48 },
              { playId: '4004-017', name: '17', odds: 48 },
              { playId: '4004-018', name: '18', odds: 48 },
              { playId: '4004-019', name: '19', odds: 48 },
              { playId: '4004-020', name: '20', odds: 48 },
              { playId: '4004-021', name: '21', odds: 48 },
              { playId: '4004-022', name: '22', odds: 48 },
              { playId: '4004-023', name: '23', odds: 48 },
              { playId: '4004-024', name: '24', odds: 48 },
              { playId: '4004-025', name: '25', odds: 48 },
              { playId: '4004-026', name: '26', odds: 48 },
              { playId: '4004-027', name: '27', odds: 48 },
              { playId: '4004-028', name: '28', odds: 48 },
              { playId: '4004-029', name: '29', odds: 48 },
              { playId: '4004-030', name: '30', odds: 48 },
              { playId: '4004-031', name: '31', odds: 48 },
              { playId: '4004-032', name: '32', odds: 48 },
              { playId: '4004-033', name: '33', odds: 48 },
              { playId: '4004-034', name: '34', odds: 48 },
              { playId: '4004-035', name: '35', odds: 48 },
              { playId: '4004-036', name: '36', odds: 48 },
              { playId: '4004-037', name: '37', odds: 48 },
              { playId: '4004-038', name: '38', odds: 48 },
              { playId: '4004-039', name: '39', odds: 48 },
              { playId: '4004-040', name: '40', odds: 48 },
              { playId: '4004-041', name: '41', odds: 48 },
              { playId: '4004-042', name: '42', odds: 48 },
              { playId: '4004-043', name: '43', odds: 48 },
              { playId: '4004-044', name: '44', odds: 48 },
              { playId: '4004-045', name: '45', odds: 48 },
              { playId: '4004-046', name: '46', odds: 48 },
              { playId: '4004-047', name: '47', odds: 48 },
              { playId: '4004-048', name: '48', odds: 48 },
              { playId: '4004-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '4004-101', name: '大', odds: 1.98 },
              { playId: '4004-102', name: '小', odds: 1.98 },
              { playId: '4004-103', name: '單', odds: 1.98 },
              { playId: '4004-104', name: '雙', odds: 1.98 },
              { playId: '4004-105', name: '合單', odds: 1.98 },
              { playId: '4004-106', name: '合雙', odds: 1.98 },
              { playId: '4004-107', name: '尾大', odds: 1.98 },
              { playId: '4004-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '4004-201', name: '紅波', odds: 2.7 },
              { playId: '4004-202', name: '藍波', odds: 2.9 },
              { playId: '4004-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },

      {
        tabId: 4005,
        tabName: '正六特',
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
            groupName: '正六特',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 賠率與正一特相同：換名次不改變命中機率，僅結算取的球位不同
            groupList: [
              { playId: '4005-001', name: '01', odds: 48 },
              { playId: '4005-002', name: '02', odds: 48 },
              { playId: '4005-003', name: '03', odds: 48 },
              { playId: '4005-004', name: '04', odds: 48 },
              { playId: '4005-005', name: '05', odds: 48 },
              { playId: '4005-006', name: '06', odds: 48 },
              { playId: '4005-007', name: '07', odds: 48 },
              { playId: '4005-008', name: '08', odds: 48 },
              { playId: '4005-009', name: '09', odds: 48 },
              { playId: '4005-010', name: '10', odds: 48 },
              { playId: '4005-011', name: '11', odds: 48 },
              { playId: '4005-012', name: '12', odds: 48 },
              { playId: '4005-013', name: '13', odds: 48 },
              { playId: '4005-014', name: '14', odds: 48 },
              { playId: '4005-015', name: '15', odds: 48 },
              { playId: '4005-016', name: '16', odds: 48 },
              { playId: '4005-017', name: '17', odds: 48 },
              { playId: '4005-018', name: '18', odds: 48 },
              { playId: '4005-019', name: '19', odds: 48 },
              { playId: '4005-020', name: '20', odds: 48 },
              { playId: '4005-021', name: '21', odds: 48 },
              { playId: '4005-022', name: '22', odds: 48 },
              { playId: '4005-023', name: '23', odds: 48 },
              { playId: '4005-024', name: '24', odds: 48 },
              { playId: '4005-025', name: '25', odds: 48 },
              { playId: '4005-026', name: '26', odds: 48 },
              { playId: '4005-027', name: '27', odds: 48 },
              { playId: '4005-028', name: '28', odds: 48 },
              { playId: '4005-029', name: '29', odds: 48 },
              { playId: '4005-030', name: '30', odds: 48 },
              { playId: '4005-031', name: '31', odds: 48 },
              { playId: '4005-032', name: '32', odds: 48 },
              { playId: '4005-033', name: '33', odds: 48 },
              { playId: '4005-034', name: '34', odds: 48 },
              { playId: '4005-035', name: '35', odds: 48 },
              { playId: '4005-036', name: '36', odds: 48 },
              { playId: '4005-037', name: '37', odds: 48 },
              { playId: '4005-038', name: '38', odds: 48 },
              { playId: '4005-039', name: '39', odds: 48 },
              { playId: '4005-040', name: '40', odds: 48 },
              { playId: '4005-041', name: '41', odds: 48 },
              { playId: '4005-042', name: '42', odds: 48 },
              { playId: '4005-043', name: '43', odds: 48 },
              { playId: '4005-044', name: '44', odds: 48 },
              { playId: '4005-045', name: '45', odds: 48 },
              { playId: '4005-046', name: '46', odds: 48 },
              { playId: '4005-047', name: '47', odds: 48 },
              { playId: '4005-048', name: '48', odds: 48 },
              { playId: '4005-049', name: '49', odds: 48 },
            ],
          },

          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '4005-101', name: '大', odds: 1.98 },
              { playId: '4005-102', name: '小', odds: 1.98 },
              { playId: '4005-103', name: '單', odds: 1.98 },
              { playId: '4005-104', name: '雙', odds: 1.98 },
              { playId: '4005-105', name: '合單', odds: 1.98 },
              { playId: '4005-106', name: '合雙', odds: 1.98 },
              { playId: '4005-107', name: '尾大', odds: 1.98 },
              { playId: '4005-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '4005-201', name: '紅波', odds: 2.7 },
              { playId: '4005-202', name: '藍波', odds: 2.9 },
              { playId: '4005-203', name: '綠波', odds: 2.9 },
            ],
          },

        ],
      },
      
    ],

  }
]