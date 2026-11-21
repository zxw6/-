import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { applyTheme, readCachedTheme } from './theme.js';

applyTheme(readCachedTheme() || 'dark');

createApp(App).mount('#app');