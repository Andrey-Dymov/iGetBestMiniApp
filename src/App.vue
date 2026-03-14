<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { useTelegramTheme } from './composables/useTelegramTheme'
import { initTelegram } from './telegram'
import { onMounted, watch } from 'vue'
import { i18n } from './i18n'

const themeOverrides = useTelegramTheme()

function applyRtl(locale: string) {
  const html = document.documentElement
  if (locale === 'ar') {
    html.dir = 'rtl'
    html.lang = 'ar'
  } else {
    html.dir = 'ltr'
    html.lang = locale
  }
}

watch(() => i18n.global.locale.value, applyRtl, { immediate: true })

onMounted(async () => {
  await initTelegram()
})
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <router-view />
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
/* Telegram theme variables fallback for local dev */
:root {
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-hint-color: #999999;
  --tg-theme-button-color: #2481cc;
  --tg-theme-button-text-color: #ffffff;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}
</style>
