<!-- 效果参考 Uiverse.io by amir_6539；星点坐标运行时生成，避免超大 box-shadow 样式表 -->
<script setup>
import { onMounted, ref } from 'vue';

const root = ref(null);

function starShadows(count, spreadX, spreadY) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(Math.random() * spreadX);
    const y = Math.floor(Math.random() * spreadY);
    parts.push(`${x}px ${y}px #fff`);
  }
  return parts.join(', ');
}

function mountLayer(parent, { size, count, duration, spread }) {
  const makeStar = () => {
    const el = document.createElement('div');
    el.className = 'starfield__star';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    const shadow = starShadows(count, spread, spread);
    el.style.boxShadow = shadow;
    return el;
  };
  const a = makeStar();
  const b = makeStar();
  b.classList.add('starfield__star--tail');
  b.style.boxShadow = a.style.boxShadow;
  parent.appendChild(a);
  parent.appendChild(b);
  parent.style.setProperty('--star-dur', `${duration}s`);
}

onMounted(() => {
  const host = root.value;
  if (!host) return;
  mountLayer(host.querySelector('[data-layer="1"]'), { size: 1, count: 700, duration: 50, spread: 2000 });
  mountLayer(host.querySelector('[data-layer="2"]'), { size: 2, count: 200, duration: 100, spread: 2000 });
  mountLayer(host.querySelector('[data-layer="3"]'), { size: 3, count: 100, duration: 150, spread: 2000 });
});
</script>

<template>
  <div ref="root" class="starfield" aria-hidden="true">
    <div class="starfield__layer" data-layer="1" />
    <div class="starfield__layer" data-layer="2" />
    <div class="starfield__layer" data-layer="3" />
  </div>
</template>

<style scoped>
.starfield {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
  overflow: hidden;
}

.starfield__layer {
  position: absolute;
  inset: 0;
  animation: starfield-drift var(--star-dur, 50s) linear infinite;
}

.starfield :deep(.starfield__star) {
  position: absolute;
  left: 0;
  top: 0;
  background: transparent;
  border-radius: 50%;
}

.starfield :deep(.starfield__star--tail) {
  top: 2000px;
}

@keyframes starfield-drift {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2000px);
  }
}
</style>