<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComparisonsStore } from '../stores/comparisons'
import { NButton, NEmpty, NSpace, NModal, NInput, NForm, NFormItem, NInputNumber } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { recalculateTotalScores } from '../utils/importExport'
import type { Comparison, Variant, Parameter, Value } from '../types'

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

const sortedVariants = computed(() => {
  const c = comparison.value
  if (!c) return []
  return [...c.variants].sort((a, b) => b.totalScore - a.totalScore)
})

const sortedParameters = computed(() => {
  const c = comparison.value
  if (!c) return []
  return [...c.parameters].sort((a, b) => b.weight - a.weight)
})

function getValue(variantId: string, parameterId: string): Value | undefined {
  const c = comparison.value
  return c?.values.find((v) => v.variantId === variantId && v.parameterId === parameterId)
}

onMounted(async () => {
  await store.load()
})

watch(
  comparison,
  (c) => {
    if (c && c.values.length) recalculateTotalScores(c)
  },
  { immediate: true }
)

function goBack() {
  router.push('/')
}

function hasTableData() {
  const c = comparison.value
  return c && c.variants.length > 0 && c.parameters.length > 0
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
    <header class="results-header">
      <NButton quaternary size="small" @click="goBack">← {{ t('common.back') }}</NButton>
      <h1 class="results-title">{{ comparison?.name ?? '' }}</h1>
      <NSpace>
        <NButton size="small" @click="openAddVariant">{{ t('results.addVariant') }}</NButton>
        <NButton size="small" @click="openAddParam">{{ t('results.addParam') }}</NButton>
      </NSpace>
    </header>

    <template v-if="comparison">
      <NEmpty v-if="!hasTableData()" :description="t('results.empty')" class="empty">
        <template #extra>
          <NSpace vertical align="center">
            <p class="hint">{{ t('results.hint') }}</p>
            <NSpace>
              <NButton size="small" @click="openAddVariant">{{ t('results.addVariant') }}</NButton>
              <NButton size="small" @click="openAddParam">{{ t('results.addParam') }}</NButton>
            </NSpace>
          </NSpace>
        </template>
      </NEmpty>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="results-table">
            <thead>
              <tr>
                <th class="param-col"></th>
                <th v-for="v in sortedVariants" :key="v.id" class="variant-col">
                  <div class="variant-header">
                    <span class="variant-name">{{ v.name }}</span>
                    <span class="variant-score">{{ Math.round(v.totalScore) }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in sortedParameters" :key="p.id">
                <td class="param-col">
                  <div class="param-header">
                    <span class="param-name">{{ p.name }}</span>
                    <span class="param-weight">{{ p.weight }}</span>
                  </div>
                </td>
                <td v-for="v in sortedVariants" :key="v.id" class="cell">
                  <div class="cell-value">
                    {{ getValue(v.id, p.id)?.textValue ?? getValue(v.id, p.id)?.numericValue ?? '—' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <NEmpty v-else :description="t('results.notFound')" class="empty" />

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
  padding: 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.results-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.results-title {
  flex: 1;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}

.results-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.results-table th,
.results-table td {
  padding: 10px 12px;
  border: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  vertical-align: middle;
}

.param-col {
  position: sticky;
  left: 0;
  background: var(--tg-theme-bg-color, #fff);
  min-width: 100px;
  max-width: 140px;
}

.variant-col {
  min-width: 90px;
  text-align: center;
}

.variant-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.variant-name {
  font-weight: 600;
  line-height: 1.2;
}

.variant-score {
  font-size: 0.85em;
  color: var(--tg-theme-hint-color, #999);
}

.param-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-name {
  font-weight: 600;
  line-height: 1.2;
}

.param-weight {
  font-size: 0.8em;
  color: var(--tg-theme-hint-color, #999);
}

.cell {
  text-align: center;
}

.cell-value {
  min-height: 1.2em;
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
</style>
