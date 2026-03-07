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
const editingVariant = ref<Variant | null>(null)
const editingParam = ref<Parameter | null>(null)
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
  editingVariant.value = null
  newVariantName.value = ''
  showVariantModal.value = true
}

function openEditVariant(v: Variant) {
  editingVariant.value = v
  newVariantName.value = v.name
  showVariantModal.value = true
}

function saveVariant() {
  const c = comparison.value
  if (!c || !newVariantName.value.trim()) return
  if (editingVariant.value) {
    store.updateVariant(c.id, editingVariant.value.id, { name: newVariantName.value.trim() })
  } else {
    store.addVariant(c.id, newVariantName.value.trim())
  }
  showVariantModal.value = false
  editingVariant.value = null
}

function openAddParam() {
  editingParam.value = null
  newParamName.value = ''
  newParamWeight.value = 5
  showParamModal.value = true
}

function openEditParam(p: Parameter) {
  editingParam.value = p
  newParamName.value = p.name
  newParamWeight.value = p.weight
  showParamModal.value = true
}

function saveParam() {
  const c = comparison.value
  if (!c || !newParamName.value.trim()) return
  if (editingParam.value) {
    store.updateParameter(c.id, editingParam.value.id, {
      name: newParamName.value.trim(),
      weight: newParamWeight.value,
    })
  } else {
    store.addParameter(c.id, newParamName.value.trim(), newParamWeight.value)
  }
  showParamModal.value = false
  editingParam.value = null
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
      <div v-if="!hasTableData()" class="empty-state">
        <div class="empty-icon">📊</div>
        <h2 class="empty-title">{{ t('results.empty') }}</h2>
        <p class="empty-hint">{{ t('results.emptyHint') }}</p>
        <p class="empty-general">{{ t('results.emptyGeneral') }}</p>
        <div class="empty-actions">
          <!-- Варианты: карточки добавленных + кнопка добавления -->
          <div class="empty-section">
            <span v-if="comparison.variants.length" class="empty-label">{{ t('results.variants') }}</span>
            <button
              v-for="v in comparison.variants"
              :key="v.id"
              type="button"
              class="empty-card"
              @click="openEditVariant(v)"
            >
              <span class="empty-card-name">{{ v.name }}</span>
              <span class="empty-card-chevron">›</span>
            </button>
            <NButton type="primary" block size="large" @click="openAddVariant" class="empty-btn">
              {{ t('results.addVariantBtn') }}
            </NButton>
            <p class="empty-desc">{{ t('results.emptyVariants') }}</p>
          </div>
          <!-- Параметры: карточки добавленных + кнопка добавления -->
          <div class="empty-section">
            <span v-if="comparison.parameters.length" class="empty-label">{{ t('results.parameters') }}</span>
            <button
              v-for="p in comparison.parameters"
              :key="p.id"
              type="button"
              class="empty-card"
              @click="openEditParam(p)"
            >
              <span class="empty-card-name">{{ p.name }}</span>
              <span class="empty-card-badge">{{ p.parameterType === 'number' ? t('results.paramTypeNumber') : t('results.paramTypeText') }}</span>
              <span class="empty-card-badge empty-card-weight">{{ p.weight }}</span>
              <span class="empty-card-chevron">›</span>
            </button>
            <NButton type="success" block size="large" @click="openAddParam" class="empty-btn">
              {{ t('results.addParamBtn') }}
            </NButton>
            <p class="empty-desc">{{ t('results.emptyParams') }}</p>
          </div>
        </div>
      </div>

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

    <NModal :show="showVariantModal" @update:show="(v) => { showVariantModal = v; if (!v) editingVariant.value = null }">
      <div class="modal-content">
        <h3>{{ editingVariant ? t('results.editVariant') : t('results.addVariant') }}</h3>
        <NForm>
          <NFormItem :label="t('comparisons.name')">
            <NInput v-model:value="newVariantName" :placeholder="t('results.variantNamePlaceholder')" @keyup.enter="saveVariant" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showVariantModal = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!newVariantName.trim()" @click="saveVariant">{{ t('comparisons.create') }}</NButton>
          </NSpace>
        </NForm>
      </div>
    </NModal>

    <NModal :show="showParamModal" @update:show="(v) => { showParamModal = v; if (!v) editingParam.value = null }">
      <div class="modal-content">
        <h3>{{ editingParam ? t('results.editParam') : t('results.addParam') }}</h3>
        <NForm>
          <NFormItem :label="t('comparisons.name')">
            <NInput v-model:value="newParamName" :placeholder="t('results.paramNamePlaceholder')" @keyup.enter="saveParam" />
          </NFormItem>
          <NFormItem :label="t('results.weight')">
            <NInputNumber v-model:value="newParamWeight" :min="1" :max="10" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showParamModal = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!newParamName.trim()" @click="saveParam">{{ t('comparisons.create') }}</NButton>
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
  border-bottom: 1px solid #999 !important;
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
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  line-height: 1.2;
}

.param-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.param-weight {
  flex-shrink: 0;
  font-weight: 500;
  color: var(--tg-theme-hint-color, #999);
}

.cell {
  text-align: center;
}

.cell-value {
  min-height: 1.2em;
  line-height: 32px;
  font-weight: 600;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.7;
}

.empty-title {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.empty-hint {
  margin: 0 0 12px 0;
  color: var(--tg-theme-hint-color, #999);
  font-size: 0.95rem;
  font-weight: 600;
  width: 100%;
}

.empty-general {
  margin: 0 0 24px 0;
  color: var(--tg-theme-hint-color, #888);
  font-size: 0.9rem;
  width: 100%;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.empty-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.empty-btn {
  min-height: 56px;
  font-size: 1rem;
}

/* Вариант — синий (primary), Параметр — зелёный (success) */

.empty-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--tg-theme-hint-color, #999);
  width: 100%;
}

.empty-label {
  font-size: 0.75rem;
  color: var(--tg-theme-hint-color, #999);
  align-self: flex-start;
}

.empty-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.empty-card-name {
  flex: 1;
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.empty-card-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 193, 7, 0.3);
  color: var(--tg-theme-text-color, #333);
}

.empty-card-weight {
  background: var(--tg-theme-hint-color, #e0e0e0);
  opacity: 0.8;
}

.empty-card-chevron {
  color: var(--tg-theme-hint-color, #999);
  font-size: 1.2rem;
}

/* NEmpty для «сравнение не найдено» */
.empty {
  margin-top: 48px;
}
</style>
