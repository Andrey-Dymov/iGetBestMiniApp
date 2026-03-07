<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComparisonsStore } from '../stores/comparisons'
import { NButton, NEmpty, NCard, NSpace, NModal, NInput, NForm, NFormItem, NInputNumber } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const store = useComparisonsStore()
const { t } = useI18n()

const comparison = computed(() => store.getComparison(route.params.id as string))
const showVariantModal = ref(false)
const showParamModal = ref(false)
const newVariantName = ref('')
const newParamName = ref('')
const newParamWeight = ref(5)

onMounted(async () => {
  await store.load()
})

function goBack() {
  router.push('/')
}

function hasData() {
  const c = comparison.value
  return c && (c.variants.length > 0 || c.parameters.length > 0)
}

function openAddVariant() {
  newVariantName.value = ''
  showVariantModal.value = true
}

function addVariant() {
  const c = comparison.value
  if (!c || !newVariantName.value.trim()) return
  store.addVariant(c.id, newVariantName.value.trim())
  showVariantModal.value = false
}

function openAddParam() {
  newParamName.value = ''
  newParamWeight.value = 5
  showParamModal.value = true
}

function addParam() {
  const c = comparison.value
  if (!c || !newParamName.value.trim()) return
  store.addParameter(c.id, newParamName.value.trim(), newParamWeight.value)
  showParamModal.value = false
}
</script>

<template>
  <div class="results">
    <div class="header">
      <NButton quaternary @click="goBack">← {{ t('common.back') }}</NButton>
    </div>

    <template v-if="comparison">
      <div class="title-row">
        <h2 class="title">{{ comparison.name }}</h2>
        <NSpace>
          <NButton size="small" @click="openAddVariant">{{ t('results.addVariant') }}</NButton>
          <NButton size="small" @click="openAddParam">{{ t('results.addParam') }}</NButton>
        </NSpace>
      </div>

      <NEmpty v-if="!hasData()" :description="t('results.empty')" class="empty">
        <template #extra>
          <NSpace vertical align="center">
            <p class="hint">{{ t('results.hint') }}</p>
          </NSpace>
        </template>
      </NEmpty>

      <div v-else class="content">
        <NCard v-if="comparison.variants.length" :title="t('results.variants')" size="small">
          <ul>
            <li v-for="v in comparison.variants" :key="v.id">{{ v.name }}</li>
          </ul>
        </NCard>
        <NCard v-if="comparison.parameters.length" :title="t('results.parameters')" size="small">
          <ul>
            <li v-for="p in comparison.parameters" :key="p.id">{{ p.name }} ({{ p.weight }})</li>
          </ul>
        </NCard>
      </div>
    </template>

    <NEmpty v-else description="Сравнение не найдено" />

    <NModal :show="showVariantModal" @update:show="showVariantModal = $event">
      <div class="modal-content">
        <h3>{{ t('results.addVariant') }}</h3>
        <NForm>
          <NFormItem :label="t('comparisons.name')">
            <NInput v-model:value="newVariantName" :placeholder="t('results.variantNamePlaceholder')" @keyup.enter="addVariant" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showVariantModal = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!newVariantName.trim()" @click="addVariant">{{ t('comparisons.create') }}</NButton>
          </NSpace>
        </NForm>
      </div>
    </NModal>

    <NModal :show="showParamModal" @update:show="showParamModal = $event">
      <div class="modal-content">
        <h3>{{ t('results.addParam') }}</h3>
        <NForm>
          <NFormItem :label="t('comparisons.name')">
            <NInput v-model:value="newParamName" :placeholder="t('results.paramNamePlaceholder')" />
          </NFormItem>
          <NFormItem :label="t('results.weight')">
            <NInputNumber v-model:value="newParamWeight" :min="0" :max="10" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showParamModal = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!newParamName.trim()" @click="addParam">{{ t('comparisons.create') }}</NButton>
          </NSpace>
        </NForm>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.results {
  padding: 24px;
  min-height: 100vh;
}

.header {
  margin-bottom: 16px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.title {
  margin: 0;
  font-size: 1.5rem;
}

.modal-content {
  padding: 24px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  max-width: 400px;
}

.modal-content h3 {
  margin: 0 0 16px 0;
}

.empty {
  margin-top: 48px;
}

.hint {
  color: var(--tg-theme-hint-color, #999);
  font-size: 0.9em;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

ul {
  margin: 0;
  padding-left: 20px;
}
</style>
