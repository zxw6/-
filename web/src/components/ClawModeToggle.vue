<!-- 样式参考 Uiverse.io by chase2k25 -->
<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n/index.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

/** false = 代码工作台，true = 自动化部署 */
const isDeploy = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <label class="claw-toggle-wrapper" :title="isDeploy ? t('navDeploy') : t('navWorkbench')">
    <input v-model="isDeploy" type="checkbox" class="claw-toggle-input" />
    <div class="claw-toggle-track">
      <div class="claw-toggle-slot">
        <div class="claw-toggle-slot-fill" />
      </div>
      <div class="claw-toggle-core">
        <div class="claw-toggle-core-gear" />
        <div class="claw-toggle-core-inner" />
      </div>
      <div class="claw-machine-wrapper">
        <div class="claw-machine-arm">
          <div class="claw-machine-arm-detail" />
        </div>
        <div class="claw-pincer claw-pincer-top" />
        <div class="claw-pincer claw-pincer-bottom" />
        <div class="claw-machine-joint">
          <div class="claw-machine-joint-pin" />
        </div>
      </div>
    </div>
  </label>
</template>

<style scoped>
.claw-toggle-wrapper {
  position: relative;
  display: inline-flex;
  font-size: 4px;
  width: 24em;
  height: 10em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.claw-toggle-input {
  display: none;
}

.claw-toggle-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #141622, #1e2130);
  border-radius: 5em;
  box-shadow:
    inset 0 0.4em 1em rgba(0, 0, 0, 0.9),
    inset 0 -0.1em 0.3em rgba(255, 255, 255, 0.08),
    0 0.8em 2em rgba(0, 0, 0, 0.6);
  border: 0.2em solid #2c3042;
  box-sizing: border-box;
  overflow: hidden;
  z-index: 1;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.claw-toggle-wrapper:active .claw-toggle-track {
  transform: scale(0.97);
}

.claw-toggle-slot {
  position: absolute;
  top: 4.5em;
  left: 2em;
  right: 2em;
  height: 0.6em;
  background-color: #06070a;
  border-radius: 0.3em;
  box-shadow: inset 0 0.2em 0.4em rgba(0, 0, 0, 0.9);
  overflow: hidden;
}

.claw-toggle-slot-fill {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, #ff0055, #ff4081);
  box-shadow: 0 0 1em 0.2em #ff0055;
  transition:
    width 1.5s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.5s ease,
    box-shadow 0.5s ease;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-toggle-slot .claw-toggle-slot-fill {
  width: 100%;
  background: linear-gradient(90deg, #0088ff, #00e5ff);
  box-shadow: 0 0 1em 0.2em #00e5ff;
}

.claw-toggle-core {
  position: absolute;
  top: 1.1em;
  left: 1.1em;
  width: 7.4em;
  height: 7.4em;
  border-radius: 50%;
  background: linear-gradient(135deg, #2b2f42, #181a25);
  box-shadow:
    0 0.4em 1em rgba(0, 0, 0, 0.7),
    inset 0 0.2em 0.4em rgba(255, 255, 255, 0.15);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3;
  animation: core-move-off 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-toggle-core {
  animation: core-move-on 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-toggle-core-gear {
  position: absolute;
  width: 5.6em;
  height: 5.6em;
  border-radius: 50%;
  border: 0.25em dashed #4b516b;
  animation: core-spin 4s linear infinite;
  transition: border-color 0.5s ease;
  box-sizing: border-box;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-toggle-core .claw-toggle-core-gear {
  border-color: #00e5ff;
}

.claw-toggle-core-inner {
  width: 3.4em;
  height: 3.4em;
  border-radius: 50%;
  background-color: #ff0055;
  box-shadow:
    0 0 1.5em 0.2em #ff0055,
    inset 0 0.2em 0.5em rgba(255, 255, 255, 0.8);
  border: 0.2em solid #1a1c28;
  transition:
    background-color 0.5s ease,
    box-shadow 0.5s ease;
  z-index: 2;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-toggle-core .claw-toggle-core-inner {
  background-color: #00e5ff;
  box-shadow:
    0 0 1.5em 0.2em #00e5ff,
    inset 0 0.2em 0.5em rgba(255, 255, 255, 0.8);
}

.claw-machine-wrapper {
  position: absolute;
  top: 0;
  left: 100%;
  width: 20em;
  height: 100%;
  z-index: 2;
  animation: claw-move-off 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-machine-wrapper {
  animation: claw-move-on 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-machine-arm {
  position: absolute;
  top: 4.2em;
  left: 1.5em;
  width: 18.5em;
  height: 1.2em;
  background: linear-gradient(180deg, #5e647c, #333747);
  border-radius: 0.6em;
  box-shadow: inset 0 0.1em 0.2em rgba(255, 255, 255, 0.2);
}

.claw-machine-arm-detail {
  position: absolute;
  top: 0.3em;
  left: 2em;
  right: 1em;
  height: 0.6em;
  background: repeating-linear-gradient(
    90deg,
    #222533,
    #222533 0.2em,
    transparent 0.2em,
    transparent 0.4em
  );
  opacity: 0.5;
}

.claw-machine-joint {
  position: absolute;
  top: 3.2em;
  left: 0.5em;
  width: 3.2em;
  height: 3.2em;
  border-radius: 50%;
  background: linear-gradient(135deg, #4d536b, #262938);
  border: 0.2em solid #151720;
  box-shadow: 0 0.2em 0.6em rgba(0, 0, 0, 0.7);
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
}

.claw-machine-joint-pin {
  width: 1.2em;
  height: 1.2em;
  border-radius: 50%;
  background-color: #1a1c26;
  box-shadow: inset 0 0.1em 0.2em rgba(0, 0, 0, 0.8);
}

.claw-pincer {
  position: absolute;
  left: -3.5em;
  width: 5em;
  height: 2.6em;
  background-color: transparent;
  border: 0.6em solid #717893;
  box-sizing: border-box;
  z-index: 1;
  box-shadow: inset 0 0 0.5em rgba(0, 0, 0, 0.5);
}

.claw-pincer-top {
  top: 2.2em;
  border-radius: 2.6em 0 0 0;
  border-bottom: none;
  border-right: none;
  transform-origin: 100% 100%;
  animation: pincer-top-off 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-pincer-bottom {
  bottom: 2.2em;
  border-radius: 0 0 0 2.6em;
  border-top: none;
  border-right: none;
  transform-origin: 100% 0;
  animation: pincer-bottom-off 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-machine-wrapper .claw-pincer-top {
  animation: pincer-top-on 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.claw-toggle-input:checked ~ .claw-toggle-track .claw-machine-wrapper .claw-pincer-bottom {
  animation: pincer-bottom-on 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes core-move-on {
  0%,
  35% {
    transform: translateX(0);
  }
  65%,
  100% {
    transform: translateX(14em);
  }
}

@keyframes core-move-off {
  0%,
  35% {
    transform: translateX(14em);
  }
  65%,
  100% {
    transform: translateX(0);
  }
}

@keyframes claw-move-on {
  0% {
    transform: translateX(0);
  }
  25%,
  35% {
    transform: translateX(-16.5em);
  }
  65% {
    transform: translateX(-2.5em);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes claw-move-off {
  0% {
    transform: translateX(0);
  }
  25%,
  35% {
    transform: translateX(-2.5em);
  }
  65% {
    transform: translateX(-16.5em);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes pincer-top-on {
  0%,
  20% {
    transform: rotate(40deg);
  }
  30%,
  70% {
    transform: rotate(0deg);
  }
  80%,
  100% {
    transform: rotate(40deg);
  }
}

@keyframes pincer-top-off {
  0%,
  20% {
    transform: rotate(40deg);
  }
  30%,
  70% {
    transform: rotate(0deg);
  }
  80%,
  100% {
    transform: rotate(40deg);
  }
}

@keyframes pincer-bottom-on {
  0%,
  20% {
    transform: rotate(-40deg);
  }
  30%,
  70% {
    transform: rotate(0deg);
  }
  80%,
  100% {
    transform: rotate(-40deg);
  }
}

@keyframes pincer-bottom-off {
  0%,
  20% {
    transform: rotate(-40deg);
  }
  30%,
  70% {
    transform: rotate(0deg);
  }
  80%,
  100% {
    transform: rotate(-40deg);
  }
}

@keyframes core-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>