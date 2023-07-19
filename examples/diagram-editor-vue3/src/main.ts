import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

import router from './router.ts';
import TDesign from 'tdesign-vue-next';

const app = createApp(App);

// 加载基础服务
app.use(router).use(TDesign);
// end

app.mount('#app');
