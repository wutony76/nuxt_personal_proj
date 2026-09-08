import { findBgByPageSlug, findRetroByPageSlug } from '#shared/config/gameSlugs'
import { useGameAccess } from '~/composables/useGameAccess'

/**
 * 全域路由攔截：自訂角色被關閉的遊戲／盤口，前台導覽一律擋下（見
 * openspec/changes/add-role-game-perms/design.md Decision 4）。
 * 真正的安全邊界在後端（server/middleware/auth.ts、bet.post.ts），這裡只是使用者體驗，
 * 避免點進去才被彈回；未登入訪客與內建角色 useGameAccess() 一律回空清單，不受影響。
 *
 * ⚠️ 只在 client 端跑（比照全站其餘登入檢查的慣例，見各 lottery/bg 頁面「先 await
 * useAuth().init() 確認登入狀態」只寫在 onMounted 的註解）——SSR 這裡用的是裸 $fetch，
 * 不會帶到瀏覽器目前的 session cookie，SSR 側一律會被判定成訪客而放行，等於白攔；
 * 交給 client 端跑，才能真的用到目前登入者的 cookie。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  let category: 'bg' | 'retro' | null = null
  let key: string | null = null

  if (to.path.startsWith('/game/')) {
    const slug = to.path.slice('/game/'.length).split('/')[0] ?? ''
    const game = findRetroByPageSlug(slug)
    if (game) {
      category = 'retro'
      key = game.key
    }
  } else if (to.path.startsWith('/lottery/bg/')) {
    const slug = to.path.slice('/lottery/bg/'.length).split('/')[0] ?? ''
    const game = findBgByPageSlug(slug)
    if (game) {
      category = 'bg'
      key = game.key
    }
  }

  if (!category || !key) return

  const { fetch, isDisabled } = useGameAccess()
  await fetch()
  if (isDisabled(category, key)) {
    return navigateTo(category === 'retro' ? '/game-hall' : '/lottery-hall')
  }
})
