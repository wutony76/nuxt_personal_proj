/**
 * 餘額變動表「類型」欄顯示文案
 * @param type balanceChanges.type
 * @returns 中文標籤
 */
export function balanceChangeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bet: '下注',
    claim: '領獎',
    tie: '和局',
    'game-reward': '遊戲獎勵',
    'admin-topup': '後台充值',
    'admin-deduct': '後台扣款'
  }
  return labels[type] ?? type
}
