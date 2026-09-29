<script setup lang="ts">
import { happyfatyoyoPlatform as detail } from '~/config/projects/happyfatyoyoPlatform'
import KnowHowFull from '~/components/project/section/KnowHowFull.vue'

definePageMeta({ layout: 'portfolio' })
</script>

<template>
  <main class="pf-main">
    <section style="padding: clamp(40px,6vw,80px) 0 clamp(32px,4vw,48px)">
      <div class="pf-detail-breadcrumb">
        <NuxtLink to="/project/happyfatyoyo-platform" class="pf-detail-back">← 返回 HAPPYFATYOYO WORLD</NuxtLink>
        <span class="pf-detail-counter">Engineering Notes</span>
      </div>
      <h1 class="pf-detail-title">
        Know-<span class="pf-detail-title-accent">how</span>
      </h1>
      <p class="np-proj-section-body" style="margin-top: 16px; max-width: 640px">
        HAPPYFATYOYO WORLD 完整的技術研究、架構思考與決策紀錄。
      </p>
    </section>

    <div style="padding-bottom: clamp(56px,8vw,112px)">
      <KnowHowFull :groups="detail.knowHow" />
    </div>
  </main>
</template>
