<script setup lang="ts">
type GameSlot = {
  id: number
  name: string
  description: string
  status: 'open' | 'coming'
  path?: string
}

defineProps<{
  game: GameSlot
}>()
</script>

<template>
  <article class="game-machine rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-lg"
    :class="game.status === 'open' ? 'is-open' : 'is-coming'">
    <div class="screen rounded-xl border border-slate-500 bg-slate-800 p-3">
      <i class="screen-scan" />
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-base font-semibold tracking-wide text-emerald-300">{{ game.name }}</h3>
        <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :class="game.status === 'open' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'">
          {{ game.status === 'open' ? '開放中' : '準備中' }}
        </span>
      </div>
      <p class="min-h-[42px] text-xs leading-5 text-slate-300">{{ game.description }}</p>
    </div>

    <div class="mt-3 flex items-center justify-between px-1">
      <div class="flex items-center gap-1.5">
        <span class="status-led h-2.5 w-2.5 rounded-full" :class="game.status === 'open' ? 'bg-emerald-400' : 'bg-amber-300'" />
        <span class="h-2.5 w-2.5 rounded-full bg-sky-300/80" />
      </div>
      <div class="h-3 w-16 rounded-full bg-slate-700" />
    </div>

    <NuxtLink v-if="game.status === 'open' && game.path" :to="game.path"
      class="mt-3 block w-full rounded-md bg-emerald-500/90 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
      START
    </NuxtLink>
    <button v-else type="button"
      class="mt-3 w-full rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-60" :disabled="true">
      LOCKED
    </button>
  </article>
</template>

<style scoped lang="scss">
.game-machine {
  position: relative;
  overflow: hidden;
  animation: machine-float 5.2s ease-in-out infinite;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &::before,
  &::after {
    content: '';
    position: absolute;
    pointer-events: none;
  }

  &::before {
    inset: 6px;
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 12px;
    clip-path: polygon(
      0 8px,
      8px 0,
      calc(100% - 8px) 0,
      100% 8px,
      100% calc(100% - 8px),
      calc(100% - 8px) 100%,
      8px 100%,
      0 calc(100% - 8px)
    );
  }

  &::after {
    inset: 0;
    background: linear-gradient(120deg, transparent 38%, rgba(56, 189, 248, 0.18) 50%, transparent 62%);
    transform: translateX(-130%);
    animation: card-sheen 4.6s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-3px);
    border-color: rgba(16, 185, 129, 0.45);
    box-shadow: 0 14px 22px rgba(2, 6, 23, 0.45);
  }

  &.is-coming {
    animation-duration: 7s;
  }

  .screen {
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 0 24px rgba(16, 185, 129, 0.15);

    .screen-scan {
      position: absolute;
      inset: -40% -20%;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(56, 189, 248, 0.16), rgba(255, 255, 255, 0));
      transform: translateY(-120%);
      animation: screen-scan 3.8s linear infinite;
    }
  }

  .status-led {
    box-shadow: 0 0 8px currentcolor;
    animation: led-pulse 2.2s ease-in-out infinite;
  }
}

@keyframes machine-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes led-pulse {
  0%,
  100% {
    opacity: 0.65;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes screen-scan {
  0% {
    transform: translateY(-120%);
  }
  100% {
    transform: translateY(120%);
  }
}

@keyframes card-sheen {
  0%,
  75%,
  100% {
    transform: translateX(-130%);
  }
  42% {
    transform: translateX(130%);
  }
}
</style>
