<!-- 样式参考 Uiverse.io by Nawsome -->
<template>
  <section class="loader" role="img" :aria-label="ariaLabel">
    <div v-for="i in 5" :key="i" class="slider" :style="{ '--i': i - 1 }" />
  </section>
</template>

<script setup>
defineProps({
  ariaLabel: { type: String, default: 'Loading animation' },
});
</script>

<style scoped>
.loader {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
}

.slider {
  overflow: hidden;
  background-color: var(--loader-track, #ffffff);
  margin: 0 8px;
  height: 64px;
  width: 16px;
  border-radius: 30px;
  box-shadow:
    8px 8px 14px rgba(0, 0, 0, 0.08),
    -8px -8px 14px rgba(255, 255, 255, 0.6),
    inset -4px -4px 8px rgba(0, 0, 255, 0.08),
    inset 4px 4px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  flex-shrink: 0;
}

:global([data-theme='dark']) .slider {
  --loader-track: var(--surface-subtle);
  box-shadow:
    8px 8px 14px rgba(0, 0, 0, 0.35),
    -4px -4px 10px rgba(255, 255, 255, 0.04),
    inset -4px -4px 8px rgba(0, 0, 255, 0.12),
    inset 4px 4px 8px rgba(0, 0, 0, 0.25);
}

.slider::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 16px;
  width: 16px;
  border-radius: 100%;
  box-shadow:
    inset 0 0 0 rgba(0, 0, 0, 0.3),
    0 336px 0 320px #2697f3,
    inset 0 0 0 rgba(0, 0, 0, 0.1);
  animation: slider-bounce 2.5s ease-in-out infinite;
  animation-delay: calc(-0.5s * var(--i));
}

@keyframes slider-bounce {
  0% {
    transform: translateY(200px);
    filter: hue-rotate(0deg);
  }
  50% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(200px);
    filter: hue-rotate(180deg);
  }
}
</style>