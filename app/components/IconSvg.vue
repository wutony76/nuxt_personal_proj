<template>
  <span :class="['cdt-icon', 'icon-' + props.iconClass]"
    :style="{ ...(props.size && { '--base-svg-wh': iconSize }), ...(props.color && { '--icon-color': props.color }) }">
    <span v-if="iconRaw" class="cdt-icon-node cdt-icon-raw" role="img" :aria-label="props.iconClass"
      v-html="renderedIcon"></span>
    <img v-else-if="iconUrl" class="cdt-icon-node cdt-icon-img" :src="iconUrl" :alt="props.iconClass"
      :class="[props.rotate ? props.rotate : '', props.animation ? props.animation : '']" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  iconClass: string
  rotate?: string
  animation?: string
  color?: string
  size?: number | string
}>()
const defaultRootSize = 16
const parsedRootSize = import.meta.client
  ? Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('font-size'))
  : defaultRootSize
const rootSize = Number.isFinite(parsedRootSize) && parsedRootSize > 0 ? parsedRootSize : defaultRootSize

const svgRawModules = import.meta.glob('../../assets/svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const svgUrlModules = import.meta.glob('../../assets/svg/*.svg', { import: 'default', eager: true }) as Record<string, string>
const isTargetIcon = (filePath: string, iconClass: string) => {
  const normalizedPath = filePath.split('?')[0] ?? ''

  return normalizedPath.endsWith(`/${iconClass}.svg`)
}
const iconRaw = computed(() => {
  const matched = Object.entries(svgRawModules).find(([filePath]) => isTargetIcon(filePath, props.iconClass))

  return matched?.[1] || ''
})
const iconUrl = computed(() => {
  const matched = Object.entries(svgUrlModules).find(([filePath]) => isTargetIcon(filePath, props.iconClass))

  return matched?.[1] || ''
})
const renderedIcon = computed(() => {
  if (!iconRaw.value) return ''

  // Keep white details and map original accent colors to currentColor.
  return iconRaw.value.replaceAll(/fill:\s*#(?:ff5151|2bcb2b)\s*;/gi, 'fill:currentColor;')
})
const iconSize = computed(() => {
  const parsedSize = typeof props.size === 'number' ? props.size : Number.parseFloat(props.size ?? '')
  const targetSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : rootSize

  return targetSize / rootSize + 'rem'
})
</script>

<style lang="scss">
:root {
  --base-svg-wh: 1.75rem;
}

.cdt-icon {
  color: var(--icon-color, currentColor);
  width: var(--base-svg-wh);
  height: var(--base-svg-wh);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 0.2s all;

  .cdt-icon-node {
    width: 100%;
    height: 100%;
    display: block;
    fill: var(--icon-color, currentColor);
    overflow: hidden;
  }

  .cdt-icon-img {
    object-fit: contain;
  }

  .cdt-icon-raw {
    :deep(svg) {
      width: 100%;
      height: 100%;
      display: block;
    }
  }

  .animation {
    animation: rotate 0.8s linear infinite;
  }

  .animation-90 {
    transition: 0.8s all;
    transform: rotate(90deg);
  }

  .animation-180 {
    transition: 0.8s all;
    transform: rotate(180deg);
  }
}
</style>
