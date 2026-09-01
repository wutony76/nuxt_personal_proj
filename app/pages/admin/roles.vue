<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { api } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const state = reactive({
  status: 'idle' as AsyncStatus,
  admins: [] as Array<{ id: string; name: string; email: string }>
})

const _actions = {
  load: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    try {
      const result = await api.admin.roles()
      state.admins = result.admins
      state.status = 'success'
    } catch {
      state.status = 'error'
    }
  }
}

const AUTH_STEPS = [
  { no: '01', title: 'sessionController.require', desc: '先驗證有沒有登入，未登入拋 40001。' },
  { no: '02', title: 'ADMIN_USER_IDS', desc: '檢查登入身份的 id 是否在白名單常數內。' },
  { no: '03', title: 'throw 40003', desc: '不在白名單則比照既有 error code 慣例回 403。' },
  { no: '04', title: 'GET /api/admin/me', desc: '各子頁自行二次確認，不倚賴前端路由守衛。' }
]

onMounted(() => {
  _actions.load()
})
</script>

<template>
  <AdminShell active="roles" kicker="Roles" title="角色權限"
    desc="目前只有「是不是 admin」的二元判斷。白名單寫在程式碼常數裡，每個後台頁面各自呼叫 GET /api/admin/me 做二次確認。">
    <div class="ar-sections">
      <section>
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Whitelist</span><h2>管理員白名單</h2></div>
          <span class="admin-meta">ADMIN_USER_IDS — read only</span>
        </div>
        <div v-if="state.status === 'loading'" class="admin-empty">載入中...</div>
        <div v-else-if="state.status === 'error'" class="admin-empty">載入失敗，請重新整理再試一次</div>
        <table v-else class="admin-table">
          <thead>
            <tr>
              <th style="width:20%">User ID</th>
              <th style="width:16%">名稱</th>
              <th>Email</th>
              <th style="text-align:right">狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in state.admins" :key="a.id">
              <td class="admin-num">{{ a.id }}</td>
              <td>{{ a.name }}</td>
              <td style="color:color-mix(in srgb, #1c1c22 72%, #ffffff)">{{ a.email }}</td>
              <td style="text-align:right"><span class="admin-tag">Admin</span></td>
            </tr>
          </tbody>
        </table>
        <p class="ar-note">新增或移除管理員需修改程式碼常數並重新部署，後台不提供異動介面（避免雞生蛋問題）。</p>
      </section>

      <section>
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Guard flow</span><h2>權限判斷流程</h2></div>
          <span class="admin-meta">requireAdmin(event)</span>
        </div>
        <div class="admin-grid1 ar-steps">
          <div v-for="s in AUTH_STEPS" :key="s.no" class="admin-panel ar-step">
            <div class="admin-num ar-step-no">{{ s.no }}</div>
            <div class="admin-num ar-step-title">{{ s.title }}</div>
            <div class="ar-step-desc">{{ s.desc }}</div>
          </div>
        </div>
      </section>

      <section>
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Login redirect</span><h2>登入導向修正</h2></div>
          <span class="admin-meta">app/pages/login.vue</span>
        </div>
        <div class="admin-grid1 ar-redirect">
          <div class="admin-panel ar-redirect-cell">
            <div class="admin-en">Before</div>
            <div class="admin-num ar-redirect-code">router.replace('/admin')</div>
            <div class="ar-redirect-desc">任何登入成功的帳號都導向後台，一般玩家會被立刻踢出，體驗上卡一下。</div>
          </div>
          <div class="ar-redirect-cell is-after">
            <div class="admin-en" style="color:var(--ink)">After</div>
            <div class="admin-num ar-redirect-code">router.replace('/')</div>
            <div class="ar-redirect-desc" style="color:#1c1c22">登入一律回首頁；管理員再從 AppTopbar 的「後台」連結進來，把關仍由各頁的 GET /api/admin/me 負責。</div>
          </div>
        </div>
      </section>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.ar-sections {
  display: flex;
  flex-direction: column;
  gap: 46px;
}

.ar-note {
  font-size: 12px;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin-top: 13px;
}

.ar-steps {
  grid-template-columns: repeat(4, 1fr);

  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ar-step {
  padding: 20px;
}

.ar-step-no {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted);
  margin-bottom: 12px;
}

.ar-step-title {
  font-size: 12.5px;
  margin-bottom: 8px;
}

.ar-step-desc {
  font-size: 12px;
  line-height: 1.65;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
}

.ar-redirect {
  grid-template-columns: 1fr 1fr;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
}

.ar-redirect-cell {
  padding: 22px 24px;
  background: var(--paper);

  &.is-after {
    background: var(--wash);
  }
}

.ar-redirect-code {
  font-size: 13px;
  margin: 10px 0;
}

.ar-redirect-desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
}
</style>
