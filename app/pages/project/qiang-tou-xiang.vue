<script setup lang="ts">
definePageMeta({ layout: 'portfolio' })
</script>

<template>
  <main class="pf-main">
    <section style="padding: clamp(40px,6vw,80px) 0 clamp(40px,5vw,64px)">
      <div class="pf-detail-breadcrumb">
        <NuxtLink to="/project" class="pf-detail-back">← 專案</NuxtLink>
        <span class="pf-detail-counter">Project 03 / 11</span>
      </div>
      <h1 class="pf-detail-title">
        搶頭香<br><span class="pf-detail-title-accent">宮廟</span>
      </h1>
      <p class="pf-detail-tagline">宮廟文化主題的搶頭香互動活動企劃（內容待補）</p>
    </section>

    <dl class="pf-detail-meta">
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">狀態</dt>
        <dd class="pf-detail-meta-value">BUILDING</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">期間</dt>
        <dd class="pf-detail-meta-value is-text">待補</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">類型</dt>
        <dd class="pf-detail-meta-value is-text">互動活動</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">技術</dt>
        <dd class="pf-detail-meta-tags"><span>待補</span></dd>
      </div>
    </dl>

    <div class="pf-detail-hero-img">主視覺截圖</div>

    <section class="pf-detail-sections">
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">01</span>角色
        </h2>
        <p class="pf-detail-section-body">負責範圍與分工說明（待補）</p>
      </div>
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">02</span>挑戰
        </h2>
        <p class="pf-detail-section-body">技術難點與解法（待補）</p>
      </div>
      <div class="pf-detail-section">
        <h2 class="pf-detail-section-head">
          <span class="pf-detail-section-num">03</span>成果
        </h2>
        <p class="pf-detail-section-body">上線狀態與成效（待補）</p>
      </div>
    </section>

    <div class="pf-detail-gallery">
      <div class="pf-detail-gallery-img">畫面截圖</div>
      <div class="pf-detail-gallery-img">畫面截圖</div>
    </div>

    <NuxtLink to="/project/hot-virtual-studio" class="pf-detail-next">
      <span class="pf-detail-next-label">Next — 04</span>
      <span class="pf-detail-next-title">HOT虛擬攝影棚 <span class="pf-detail-next-arrow">→</span></span>
    </NuxtLink>
  </main>
</template>
