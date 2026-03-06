<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NButton, NCard, NSpace } from 'naive-ui'

const { t } = useI18n()
const router = useRouter()

function goToComparisons() {
  router.push('/comparisons')
}
</script>

<template>
  <div class="welcome">
    <NCard class="welcome-card">
      <NSpace vertical :size="24" align="center">
        <h1 class="title">{{ t('welcome.title') }}</h1>
        <p class="subtitle">{{ t('welcome.subtitle') }}</p>
        <NButton type="primary" size="large" @click="goToComparisons">
          {{ t('welcome.start') }}
        </NButton>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.welcome {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.welcome-card {
  max-width: 400px;
  text-align: center;
}

.title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--tg-theme-hint-color, #999);
  font-size: 1rem;
  line-height: 1.5;
}
</style>
