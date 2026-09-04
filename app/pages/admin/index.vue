<script setup lang="ts">
/**
 * 後台總覽（/admin）：後台入口頁，不是登入後自動導向的頁面（見 login.vue 的登入導向已簡化為
 * 一律回首頁）。管理員從 AppTopbar.vue 的「後台」連結進來就是這一頁。
 * 權限判斷、頂部導覽、40003 拒絕畫面統一交給 Shell（admin/）處理。
 */
import { ref } from 'vue'

const CARDS = [
  {
    no: '02',
    to: '/admin/roles',
    en: 'Roles',
    label: '角色權限',
    desc: '管理員白名單與權限判斷流程，含登入導向修正。',
    tag: 'Live'
  },
  {
    no: '03',
    to: '/admin/bg-lottery',
    en: 'Game Management',
    label: '遊戲管理',
    desc: 'BG彩票、彩運來、經典遊戲、遊戲試算四個子頁。',
    tag: '4 sub-pages'
  },
  {
    no: '04',
    to: '/admin/reports',
    en: 'Reports',
    label: '報表分析',
    desc: '本次僅佔位。',
    tag: 'Coming soon'
  }
]

const SITE_LINKS = [
  { no: '01', to: '/', en: 'Home', label: '首頁', desc: '回到網站首頁。', tag: 'Public' },
  { no: '02', to: '/lottery-hall', en: 'BG Lottery', label: 'BG彩票', desc: '六合彩、快3、PK10 等信用盤／官方盤大廳。', tag: 'Public' },
  { no: '03', to: '/lottery-hall-taiwan', en: 'Cai Yun Lai', label: '彩運來', desc: '彩運來開獎與中獎明細查詢大廳。', tag: 'Public' },
  { no: '04', to: '/game-hall', en: 'Games', label: '遊戲中心', desc: '復古小遊戲大廳。', tag: 'Public' }
]

/** 新增會員成功後遞增，讓權限列表重抓 */
const memberReloadToken = ref(0)

const click = {
  onMemberCreated: () => {
    memberReloadToken.value += 1
  }
}
</script>

<template>
  <AdminShell active="overview" kicker="Overview" title="總覽" desc="後台的入口，從這裡前往各項管理功能。">
    <template #page-aside>
      <AdminOverviewPageNav />
    </template>

    <section id="ao-chat" class="ao-chat">
      <div class="admin-sechead">
        <div class="admin-sechead-left">
          <span class="admin-en">Live chat</span>
          <h2>聊天室</h2>
        </div>
        <span class="admin-meta">此處發言與排程到點皆顯示為「管理者: XXX」</span>
      </div>
      <div class="ao-chat-grid">
        <AdminChatPanel />
        <AdminChatSchedule />
      </div>
    </section>

    <section id="ao-members" class="ao-members">
      <div class="admin-sechead">
        <div class="admin-sechead-left">
          <span class="admin-en">Members</span>
          <h2>會員管理</h2>
        </div>
        <span class="admin-meta">會員功能</span>
      </div>
      <AdminCreateMember :reload-token="memberReloadToken" @created="click.onMemberCreated" />
    </section>

    <section id="ao-perms" class="ao-perms">
      <div class="admin-sechead">
        <div class="admin-sechead-left">
          <span class="admin-en">Access</span>
          <h2>權限設定</h2>
        </div>
        <div class="ao-perms-actions">
          <span class="admin-meta">Admin / User — in-memory</span>
          <NuxtLink to="/admin/roles" class="admin-btn admin-btn-secondary">設定權限</NuxtLink>
        </div>
      </div>
      <AdminAccessPanel :reload-token="memberReloadToken" />
    </section>

    <section id="ao-cards" class="ao-cards admin-grid1">
      <NuxtLink v-for="c in CARDS" :key="c.to" :to="c.to" class="ao-card admin-panel">
        <div class="ao-card-top">
          <span class="admin-num ao-card-no">{{ c.no }}</span>
          <span class="admin-tag" :class="{ 'is-soon': c.tag === 'Coming soon' }">{{ c.tag }}</span>
        </div>
        <div class="admin-en" style="margin-top:6px">{{ c.en }}</div>
        <div class="ao-card-label">{{ c.label }}</div>
        <p class="ao-card-desc">{{ c.desc }}</p>
        <div class="admin-num ao-card-path">{{ c.to }}</div>
      </NuxtLink>
    </section>

    <section id="ao-site" class="ao-site">
      <div class="admin-sechead">
        <div class="admin-sechead-left">
          <span class="admin-en">Site</span>
          <h2>GO 前台</h2>
        </div>
        <span class="admin-meta">快速跳轉前台頁面</span>
      </div>
      <div class="ao-site-grid">
        <NuxtLink v-for="c in SITE_LINKS" :key="c.to" :to="c.to" class="ao-card ao-site-card admin-panel">
          <div class="ao-card-top">
            <span class="admin-num ao-card-no">{{ c.no }}</span>
            <span class="admin-tag">{{ c.tag }}</span>
          </div>
          <div class="admin-en" style="margin-top:6px">{{ c.en }}</div>
          <div class="ao-card-label">{{ c.label }}</div>
          <p class="ao-card-desc">{{ c.desc }}</p>
          <div class="admin-num ao-card-path">{{ c.to }}</div>
        </NuxtLink>
      </div>
    </section>
  </AdminShell>
</template>

<style scoped lang="scss">
.ao-chat {
  margin-bottom: 44px;
  scroll-margin-top: 24px;
}

.ao-chat-grid {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 340px);
  gap: 16px;
  align-items: stretch;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.ao-members,
.ao-perms {
  margin-bottom: 44px;
  scroll-margin-top: 24px;
}

.ao-perms-actions {
  display: flex;
  align-items: center;
  gap: 12px;

  .admin-btn {
    display: inline-flex;
    align-items: center;
    text-decoration: none;

    &:hover {
      text-decoration: none;
    }
  }
}

.ao-cards {
  grid-template-columns: repeat(3, 1fr);
  scroll-margin-top: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.ao-site {
  margin-bottom: 44px;
  scroll-margin-top: 24px;
}

.ao-site-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.ao-card {
  text-align: left;
  border: 0;
  cursor: pointer;
  padding: 24px 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-height: 172px;
  color: inherit;

  &:hover {
    background: var(--wash);
    text-decoration: none;
  }
}

.ao-card.ao-site-card {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 2px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, #1c1c22 3%, transparent),
    0 3px 0 color-mix(in srgb, #1c1c22 7%, transparent);
  transition:
    border-color 0.12s,
    background 0.12s,
    box-shadow 0.12s,
    transform 0.12s;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--ink);
    opacity: 0;
    transition: opacity 0.12s;
  }

  &:hover {
    border-color: color-mix(in srgb, #1c1c22 24%, #ffffff);
    box-shadow:
      0 0 0 1px color-mix(in srgb, #1c1c22 8%, transparent),
      0 5px 0 color-mix(in srgb, #1c1c22 11%, transparent);
    transform: translateY(-1px);

    &::before {
      opacity: 1;
    }
  }

  .ao-card-path {
    padding-top: 10px;
    border-top: 1px solid var(--line-soft);
    color: var(--muted);
  }
}

.ao-card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.ao-card-no {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted);
}

.ao-card-label {
  font-size: 19px;
  line-height: 1.15;
  font-weight: 700;
}

.ao-card-desc {
  font-size: 12px;
  line-height: 1.65;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin: 0;
}

.ao-card-path {
  margin-top: auto;
  font-size: 11px;
  color: var(--ink);
}

.admin-tag.is-soon {
  background: color-mix(in srgb, #1c1c22 6%, var(--paper));
  color: var(--muted);
}
</style>
