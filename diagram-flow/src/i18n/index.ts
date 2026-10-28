import { createI18n } from 'vue-i18n';
import { en, zh_CHT } from './lang';
const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('i18n') || navigator.language,
  silentTranslationWarn: true,
  missingWarn: false,
  silentFallbackWarn: true,
  fallbackWarn: false,
  fallbackLocale: 'zh',
  globalInjection: true,
  messages: {
    en,
    zh_CHT,
  },
  missing(locale, key) {
    return key;
  },
});

export default i18n;
