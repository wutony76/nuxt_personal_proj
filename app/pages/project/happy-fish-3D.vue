<script setup lang="ts">
definePageMeta({ layout: 'portfolio' })
</script>

<template>
  <main class="pf-main">
    <section style="padding: clamp(40px,6vw,80px) 0 clamp(40px,5vw,64px)">
      <div class="pf-detail-breadcrumb">
        <NuxtLink to="/project" class="pf-detail-back">← 專案</NuxtLink>
        <span class="pf-detail-counter">Project 02 / 11</span>
      </div>
      <h1 class="pf-detail-title">
        3D歡樂<br><span class="pf-detail-title-accent">捕魚</span>
      </h1>
      <p class="pf-detail-tagline">3D 場景捕魚機玩法，砲台瞄準射擊 + 連線多人房間</p>
    </section>

    <dl class="pf-detail-meta">
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">狀態</dt>
        <dd class="pf-detail-meta-value">BUILDING</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">期間</dt>
        <dd class="pf-detail-meta-value is-text">2026</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">類型</dt>
        <dd class="pf-detail-meta-value is-text">3D 遊戲 / 捕魚機</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">技術</dt>
        <dd class="pf-detail-meta-tags">
          <span>Three.js</span>
          <span>WebGL</span>
          <span>Canvas</span>
        </dd>
      </div>
    </dl>

    <div class="pf-detail-hero-img">主視覺截圖</div>

    <section class="pf-detail-sections">
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">01</span>簡介
        </h2>
        <p class="pf-detail-section-body">
          以經典街機「捕魚機」玩法為核心的 3D 休閒遊戲：玩家操作砲台瞄準畫面中悠遊的魚群，
          發射砲彈擊殺不同分數與特殊技能的魚種來換取獎勵，命中大型 Boss 魚或彩蛋角色時可觸發連鎖爆分。
          整體場景與魚群動畫以 3D 呈現，取代傳統 2D 捕魚遊戲的平面視角，強調視覺沉浸感與臨場感。
        </p>
      </div>
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">02</span>核心玩法
        </h2>
        <ul class="pf-detail-section-list">
          <li>3D 場景砲台瞄準射擊，支援不同威力／彈幕型態的武器切換</li>
          <li>多種魚種各自對應不同分數權重與死亡機率，含大型 Boss 魚的連鎖爆分機制</li>
          <li>多人連線房間，同場玩家共享魚群資源、各自結算命中獎勵</li>
        </ul>
      </div>
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">03</span>技術棧
        </h2>
        <p class="pf-detail-section-body">
          3D 渲染引擎（Three.js / WebGL）、Canvas 特效與粒子系統、前後端即時連線同步
        </p>
      </div>
    </section>

    <div class="pf-detail-gallery">
      <div class="pf-detail-gallery-img">遊戲截圖</div>
      <div class="pf-detail-gallery-img">遊戲截圖</div>
    </div>

    <NuxtLink to="/project/qiang-tou-xiang" class="pf-detail-next">
      <span class="pf-detail-next-label">Next — 03</span>
      <span class="pf-detail-next-title">搶頭香（宮廟） <span class="pf-detail-next-arrow">→</span></span>
    </NuxtLink>
  </main>
</template>
