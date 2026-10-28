import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';
import router from './router';
import i18n from './i18n';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import zh from 'dayjs/locale/zh-cn';

import { deepClone } from '@meta2d/core/src/utils';

import './styles/index.css';

dayjs.extend(relativeTime);
dayjs.locale(zh.name);

if (typeof structuredClone === 'undefined') {
  globalThis.structuredClone = deepClone;
}

const app = createApp(App).use(router).use(TDesign).use(i18n);
app.mount('#app');
