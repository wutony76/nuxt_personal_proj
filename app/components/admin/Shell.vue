<script setup lang="ts">
/**
 * 所有 /admin/** 頁面共用的殼：權限判斷（未登入顯示登入按鈕、非管理員顯示 40003 拒絕畫面）、
 * 頂部導覽（總覽／角色權限／遊戲管理／報表分析）、in-memory 提示、頁首（kicker/title/desc）。
 * 各頁面把自己的內容放進預設 slot，只有 status 為 ok（已確認是管理員）才會渲染 slot。
 * 視覺風格見 app/assets/style/admin.scss，比照 SAMPLE/admin.design/main.dc.html。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { useAdminAuth } from '~/composables/useAdminAuth'

const props = defineProps<{
  active: 'overview' | 'roles' | 'gamemgmt' | 'reports'
  kicker: string
  title: string
  desc: string
}>()

const router = useRouter()
const route = useRoute()
const { isLoggedIn, refresh: refreshAuth } = useAuth()
const { checked, isAdmin, user, check, reset: resetAdminAuth } = useAdminAuth()

/** guard 跑完 session 確認後才切換 expired／denied／ok */
const sessionReady = ref(false)

type Status = 'checking' | 'expired' | 'denied' | 'ok'
const status = computed<Status>(() => {
  if (!sessionReady.value) return 'checking'
  if (!isLoggedIn.value) return 'expired'
  if (!checked.value) return 'checking'
  return isAdmin.value ? 'ok' : 'denied'
})

const NAV = [
  { key: 'overview' as const, label: '總覽', en: 'Overview', path: '/admin' },
  { key: 'roles' as const, label: '角色權限', en: 'Roles', path: '/admin/roles' },
  { key: 'gamemgmt' as const, label: '遊戲管理', en: 'Game Management', path: '/admin/bg-lottery' },
  { key: 'reports' as const, label: '報表分析', en: 'Reports', path: '/admin/reports' }
]

const adminInitial = computed(() => (user.value?.name ?? '').slice(0, 1))

const _actions = {
  guard: async () => {
    sessionReady.value = false
    resetAdminAuth()
    await refreshAuth()
    sessionReady.value = true
    if (!isLoggedIn.value) return
    await check()
  }
}

const click = {
  backHome: () => router.replace('/'),
  goLogin: () => {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
  }
}

onMounted(() => {
  _actions.guard()
})
</script>

<template>
  <div class="admin-scope">
    <header class="ash-header">
      <div class="ash-header-inner">
        <div class="ash-brand-row">
          <div class="ash-brand">
            <div class="admin-en" style="color:color-mix(in srgb, #ffffff 55%, #1c1c22)">Administration</div>
            <div class="ash-brand-title">HFYY後台</div>
          </div>
          <div v-if="status === 'ok'" class="ash-user">
            <div class="ash-user-text">
              <div class="ash-user-name">{{ user?.name }}</div>
              <div class="admin-en" style="color:color-mix(in srgb, #ffffff 55%, #1c1c22)">Admin whitelist</div>
            </div>
            <div class="ash-user-avatar">{{ adminInitial }}</div>
          </div>
          <div v-else-if="sessionReady && status === 'expired'" class="ash-user">
            <button type="button" class="ash-login-btn" @click="click.goLogin">登入</button>
          </div>
        </div>
        <nav v-if="status === 'ok'" class="ash-nav">
          <NuxtLink v-for="item in NAV" :key="item.key" :to="item.path" class="ash-nav-item"
            :class="{ active: item.key === props.active }">
            <span class="ash-nav-label">{{ item.label }}</span>
            <span class="ash-nav-en">{{ item.en }}</span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <div v-if="status === 'ok'" class="ash-notice">
      <div class="ash-notice-inner">In-memory only — 後台改的所有值僅在伺服器運行期間有效，重啟後回復程式碼預設值。</div>
    </div>

    <main class="ash-main">
      <div v-if="status === 'checking'" class="admin-empty">正在確認管理員權限...</div>

      <template v-else-if="status === 'expired'">
        <header class="ash-page-header">
          <div class="admin-en">Session expired</div>
          <h1 class="ash-page-title">登入已過期</h1>
        </header>
        <div class="ash-expired">
          <p class="ash-expired-desc">請重新登入以繼續使用後台；登入成功後將返回此頁。</p>
          <button type="button" class="admin-btn admin-btn-primary" @click="click.goLogin">登入</button>
        </div>
      </template>

      <template v-else-if="status === 'denied'">
        <header class="ash-page-header">
          <div class="admin-en">Access denied</div>
          <h1 class="ash-page-title">/admin</h1>
        </header>
        <div class="ash-denied">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75"
            stroke-linecap="round">
            <rect x="4" y="10.5" width="16" height="10" rx="2"></rect>
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path>
          </svg>
          <div>
            <div class="ash-denied-title">40003 Forbidden｜無管理員權限</div>
            <p class="ash-denied-desc">此帳號不在管理員白名單內。白名單異動需修改 <code>server/config/admin.ts</code> 並重新部署。</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary" @click="click.backHome">回到首頁</button>
        </div>
      </template>

      <template v-else>
        <header class="ash-page-header">
          <div class="ash-page-header-main">
            <div class="admin-en">{{ props.kicker }}</div>
            <h1 class="ash-page-title">{{ props.title }}</h1>
            <p class="ash-page-desc">{{ props.desc }}</p>
          </div>
          <aside v-if="$slots['page-aside']" class="ash-page-header-aside">
            <slot name="page-aside" />
          </aside>
        </header>
        <slot />
      </template>
    </main>
  </div>
</template>

<style scoped lang="scss">
.ash-header {
  background: #1c1c22;
  color: var(--line);
  padding: 0 40px;
}

.ash-header-inner {
  max-width: 1500px;
  margin: 0 auto;
}

.ash-brand-row {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 60px;
}

.ash-brand-title {
  font-size: 18px;
  line-height: 1;
  color: var(--paper);
  margin-top: 3px;
}

.ash-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 11px;
  white-space: nowrap;
}

.ash-user-text {
  text-align: right;
}

.ash-user-name {
  font-size: 12.5px;
  color: var(--wash);
}

.ash-user-avatar {
  width: 28px;
  height: 28px;
  flex: none;
  background: color-mix(in srgb, #ffffff 22%, #1c1c22);
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--paper);
}

.ash-login-btn {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.08);
  color: var(--paper);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.12s;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }
}

.ash-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.ash-nav-item {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 0 16px;
  height: 50px;
  white-space: nowrap;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  background: transparent;
  color: color-mix(in srgb, #ffffff 66%, #1c1c22);

  &:hover {
    color: var(--paper);
    text-decoration: none;
  }

  &.active {
    border-bottom-color: color-mix(in srgb, #ffffff 55%, #1c1c22);
    background: rgba(255, 255, 255, 0.08);
    color: var(--paper);
  }
}

.ash-nav-label {
  font-size: 13px;
}

.ash-nav-en {
  font-size: 8px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.5;
}

.ash-notice {
  background: var(--wash);
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  padding: 8px 40px;
  font-size: 11.5px;
}

.ash-notice-inner {
  max-width: 1500px;
  margin: 0 auto;
}

.ash-main {
  max-width: 1500px;
  margin: 0 auto;
  padding: 46px 40px 88px;
}

.ash-page-header {
  margin-bottom: 44px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ash-page-header-main {
  flex: 1;
  min-width: 0;
}

.ash-page-header-aside {
  flex-shrink: 0;
  align-self: flex-start;
}

.ash-page-title {
  font-size: 40px;
  margin: 13px 0;
  font-weight: 700;
}

.ash-page-desc {
  max-width: 66ch;
  font-size: 13.5px;
  line-height: 1.75;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin: 0;
}

.ash-denied {
  border-top: 1px solid var(--ink);
  padding-top: 44px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}

.ash-denied-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 8px;
}

.ash-denied-desc {
  max-width: 54ch;
  font-size: 13.5px;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin: 0;
}

.ash-expired {
  border-top: 1px solid var(--ink);
  padding-top: 44px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.ash-expired-desc {
  max-width: 54ch;
  font-size: 13.5px;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin: 0;
}
</style>
