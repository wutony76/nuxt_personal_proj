<script setup lang="ts">
useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap'
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppTopbar />
    <main class="mx-auto max-w-3xl px-5 py-10">
      <NuxtLink to="/project" class="np-proj-back">← 返回專案列表</NuxtLink>

      <div class="np-proj-detail-head">
        <span class="np-proj-status is-building">BUILDING</span>
        <span class="np-proj-year">2026</span>
      </div>
      <h1 class="np-proj-detail-title">3D歡樂捕魚</h1>
      <div class="np-proj-tags">
        <span class="np-proj-tag">3D 遊戲</span>
        <span class="np-proj-tag">捕魚機</span>
        <span class="np-proj-tag">WebGL</span>
      </div>

      <section class="np-proj-section">
        <h2 class="np-proj-section-title">簡介</h2>
        <p class="np-proj-section-body">
          以經典街機「捕魚機」玩法為核心的 3D 休閒遊戲：玩家操作砲台瞄準畫面中悠遊的魚群，發射砲彈擊殺
          不同分數與特殊技能的魚種來換取獎勵，命中大型 Boss 魚或彩蛋角色時可觸發連鎖爆分。整體場景與魚群
          動畫以 3D 呈現，取代傳統 2D 捕魚遊戲的平面視角，強調視覺沉浸感與臨場感。
        </p>
      </section>

      <section class="np-proj-section">
        <h2 class="np-proj-section-title">核心玩法</h2>
        <ul class="np-proj-list">
          <li>3D 場景砲台瞄準射擊，支援不同威力／彈幕型態的武器切換</li>
          <li>多種魚種各自對應不同分數權重與死亡機率，含大型 Boss 魚的連鎖爆分機制</li>
          <li>多人連線房間，同場玩家共享魚群資源、各自結算命中獎勵</li>
        </ul>
      </section>

      <section class="np-proj-section">
        <h2 class="np-proj-section-title">技術棧</h2>
        <p class="np-proj-section-body">3D 渲染引擎（Three.js / WebGL）、Canvas 特效與粒子系統、前後端即時連線同步</p>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.np-proj-back {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #6366f1;

  &:hover {
    text-decoration: underline;
  }
}

.np-proj-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.np-proj-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 999px;
  color: #64748b;
  background: #f1f5f9;

  &.is-live {
    color: #15803d;
    background: #f0fdf4;
  }

  &.is-building {
    color: #b45309;
    background: #fffbeb;
  }
}

.np-proj-year {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #94a3b8;
}

.np-proj-detail-title {
  margin-top: 8px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 30px;
  color: #0f172a;
}

.np-proj-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.np-proj-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #4338ca;
  background: #eef2ff;
}

.np-proj-section {
  margin-top: 32px;
}

.np-proj-section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: #0f172a;
}

.np-proj-section-body {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}

.np-proj-list {
  margin-top: 10px;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
  list-style: disc;
}
</style>
