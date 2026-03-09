<script setup lang="ts">
import { computed, onMounted, ref, watch, TransitionGroup } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComparisonsStore, VARIANT_PALETTE } from '../stores/comparisons'
import { NEmpty, NModal, NIcon, NSlider } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { recalculateTotalScores, findScoreFromCriteria } from '../utils/importExport'
import ParameterEditForm from '../components/ParameterEditForm.vue'
import VariantEditForm from '../components/VariantEditForm.vue'
import ValueEditForm from '../components/ValueEditForm.vue'
import type { Variant, Parameter, Value } from '../types'
import type { ParameterFormData, VariantValue } from '../components/ParameterEditForm.vue'

const route = useRoute()
const router = useRouter()
const store = useComparisonsStore()
const { t } = useI18n()

const comparison = computed(() => store.getComparison(route.params.id as string))
const showVariantModal = ref(false)
const showParamModal = ref(false)
const showValueEditModal = ref(false)
const editingVariant = ref<Variant | null>(null)
const editingParam = ref<Parameter | null>(null)
const valueEditData = ref<{ variant: Variant; parameter: Parameter } | null>(null)
const sortedVariants = computed(() => {
  const c = comparison.value
  if (!c) return []
  return [...c.variants].sort((a, b) => b.totalScore - a.totalScore)
})

const nextVariantColor = computed(() => {
  const c = comparison.value
  if (!c) return VARIANT_PALETTE[0]
  const usedColors = new Set(c.variants.map((v) => v.color))
  return VARIANT_PALETTE.find((cl) => !usedColors.has(cl))
    ?? VARIANT_PALETTE[c.variants.length % VARIANT_PALETTE.length]
})

const sortedParameters = computed(() => {
  const c = comparison.value
  if (!c) return []
  return [...c.parameters].sort((a, b) => b.weight - a.weight)
})

const displayedParameters = ref<Parameter[]>([])
const displayedVariants = ref<Variant[]>([])
let reorderTimeout: ReturnType<typeof setTimeout> | null = null
const reorderScheduled = ref(false)

watch(
  [comparison, sortedParameters],
  ([c, sorted]) => {
    const list = (sorted as Parameter[]) ?? []
    if (!c || list.length === 0) {
      displayedParameters.value = []
      reorderScheduled.value = false
      return
    }
    if (reorderScheduled.value) return
    const idsMatch =
      displayedParameters.value.length === list.length &&
      displayedParameters.value.every((p, i) => p.id === list[i]?.id)
    if (!idsMatch) {
      displayedParameters.value = [...list]
    }
  },
  { immediate: true }
)

watch(
  [comparison, sortedVariants],
  ([c, sorted]) => {
    const list = (sorted as Variant[]) ?? []
    if (!c || list.length === 0) {
      displayedVariants.value = []
      reorderScheduled.value = false
      return
    }
    if (reorderScheduled.value) return
    const idsMatch =
      displayedVariants.value.length === list.length &&
      displayedVariants.value.every((v, i) => v.id === list[i]?.id)
    if (!idsMatch) {
      displayedVariants.value = [...list]
    }
  },
  { immediate: true }
)

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
  showVariantModal.value = true
}

function openEditVariant(v: Variant) {
  if (!v.color) {
    const c = comparison.value
    if (c) {
      const usedColors = new Set(c.variants.filter((x) => x.color).map((x) => x.color))
      const color = VARIANT_PALETTE.find((cl) => !usedColors.has(cl))
        ?? VARIANT_PALETTE[c.variants.indexOf(v) % VARIANT_PALETTE.length]
      store.updateVariant(c.id, v.id, { color })
    }
  }
  editingVariant.value = v
  showVariantModal.value = true
}

function onVariantFormSave(data: { name: string; parameterValues: Record<string, VariantValue>; imageUrl?: string }) {
  const c = comparison.value
  if (!c || !data.name.trim()) return
  if (editingVariant.value) {
    store.updateVariant(c.id, editingVariant.value.id, { name: data.name.trim(), imageUrl: data.imageUrl })
    for (const p of c.parameters) {
      const pv = data.parameterValues[p.id]
      if (!pv) continue
      const displayVal = p.parameterType === 'number'
        ? (pv.numericValue ?? (pv.textValue && Number.isFinite(Number(pv.textValue)) ? Number(pv.textValue) : undefined))
        : (pv.textValue ?? (pv.numericValue != null ? String(pv.numericValue) : undefined))
      if (displayVal !== undefined && displayVal !== '') {
        const score = findScoreFromCriteria(p.criteria ?? [], displayVal, p.parameterType)
        store.setOrUpdateValue(c.id, editingVariant.value!.id, p.id, pv.textValue, pv.numericValue, score)
      }
    }
  } else {
    const v = store.addVariant(c.id, data.name.trim())
    if (data.imageUrl) {
      store.updateVariant(c.id, v.id, { imageUrl: data.imageUrl })
    }
    for (const p of c.parameters) {
      const pv = data.parameterValues[p.id]
      if (!pv) continue
      const displayVal = p.parameterType === 'number'
        ? (pv.numericValue ?? (pv.textValue && Number.isFinite(Number(pv.textValue)) ? Number(pv.textValue) : undefined))
        : (pv.textValue ?? (pv.numericValue != null ? String(pv.numericValue) : undefined))
      if (displayVal !== undefined && displayVal !== '') {
        const score = findScoreFromCriteria(p.criteria ?? [], displayVal, p.parameterType)
        store.setOrUpdateValue(c.id, v.id, p.id, pv.textValue, pv.numericValue, score)
      }
    }
  }
  recalculateTotalScores(c)
  showVariantModal.value = false
  editingVariant.value = null
}

function onVariantFormDelete() {
  const c = comparison.value
  const v = editingVariant.value
  if (!c || !v) return
  if (!confirm(t('results.deleteVariantConfirm'))) return
  store.deleteVariant(c.id, v.id)
  recalculateTotalScores(c)
  showVariantModal.value = false
  editingVariant.value = null
}

function onVariantModalShow(visible: boolean) {
  showVariantModal.value = visible
  if (!visible) editingVariant.value = null
}

function onParamModalShow(visible: boolean) {
  showParamModal.value = visible
  if (!visible) editingParam.value = null
}

function openAddParam() {
  editingParam.value = null
  showParamModal.value = true
}

function openEditParam(p: Parameter) {
  editingParam.value = p
  showParamModal.value = true
}

function openValueEdit(v: Variant, p: Parameter) {
  valueEditData.value = { variant: v, parameter: p }
  showValueEditModal.value = true
}

function onValueEditModalShow(visible: boolean) {
  showValueEditModal.value = visible
  if (!visible) valueEditData.value = null
}

function onValueEditSave(data: { textValue?: string; numericValue?: number }) {
  const c = comparison.value
  const ed = valueEditData.value
  if (!c || !ed) return
  const p = ed.parameter
  const score =
    p.parameterType === 'number'
      ? findScoreFromCriteria(p.criteria ?? [], data.numericValue ?? 0, 'number')
      : findScoreFromCriteria(p.criteria ?? [], data.textValue ?? '', 'text')
  store.setOrUpdateValue(c.id, ed.variant.id, p.id, data.textValue, data.numericValue, score)
  recalculateTotalScores(c)
  showValueEditModal.value = false
  valueEditData.value = null
}

function setParamWeight(p: Parameter, weight: number) {
  const c = comparison.value
  if (!c) return
  reorderScheduled.value = true
  store.updateParameter(c.id, p.id, { weight })
  recalculateTotalScores(c)
  if (reorderTimeout) clearTimeout(reorderTimeout)
  reorderTimeout = setTimeout(() => {
    displayedParameters.value = [...sortedParameters.value]
    displayedVariants.value = [...sortedVariants.value]
    reorderScheduled.value = false
    reorderTimeout = null
  }, 1000)
}

function formatCompactNumber(num: number): string {
  const absNum = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (absNum < 1000) return `${sign}${absNum % 1 === 0 ? Math.round(absNum) : absNum.toFixed(1)}`
  if (absNum < 1_000_000) {
    const k = absNum / 1000
    return `${sign}${k % 1 === 0 ? Math.round(k) : k.toFixed(1)}K`
  }
  if (absNum < 1_000_000_000) {
    const m = absNum / 1_000_000
    return `${sign}${m % 1 === 0 ? Math.round(m) : m.toFixed(1)}M`
  }
  const b = absNum / 1_000_000_000
  return `${sign}${b % 1 === 0 ? Math.round(b) : b.toFixed(1)}B`
}

function formatCellValue(val: Value | undefined): string {
  if (!val) return '—'
  if (val.numericValue != null) return formatCompactNumber(val.numericValue)
  return val.textValue ?? '—'
}

function onParamFormSave(data: ParameterFormData) {
  const c = comparison.value
  if (!c || !data.name.trim()) return
  if (editingParam.value) {
    store.updateParameter(c.id, editingParam.value.id, {
      name: data.name.trim(),
      weight: data.weight,
      unit: data.unit || undefined,
      parameterType: data.parameterType,
      criteria: data.criteria,
    })
    for (const v of c.variants) {
      const vv = data.variantValues[v.id] as VariantValue | undefined
      if (!vv) continue
      const displayVal = data.parameterType === 'number'
        ? (vv.numericValue ?? (vv.textValue && Number.isFinite(Number(vv.textValue)) ? Number(vv.textValue) : undefined))
        : (vv.textValue ?? (vv.numericValue != null ? String(vv.numericValue) : undefined))
      if (displayVal !== undefined && displayVal !== '') {
        const score = findScoreFromCriteria(data.criteria, displayVal, data.parameterType)
        store.setOrUpdateValue(c.id, v.id, editingParam.value!.id, vv.textValue, vv.numericValue, score)
      }
    }
  } else {
    const p = store.addParameter(c.id, data.name.trim(), data.weight, data.parameterType, data.unit || undefined, data.criteria)
    for (const v of c.variants) {
      const vv = data.variantValues[v.id] as VariantValue | undefined
      if (!vv) continue
      const displayVal = data.parameterType === 'number'
        ? (vv.numericValue ?? (vv.textValue && Number.isFinite(Number(vv.textValue)) ? Number(vv.textValue) : undefined))
        : (vv.textValue ?? (vv.numericValue != null ? String(vv.numericValue) : undefined))
      if (displayVal !== undefined && displayVal !== '') {
        const score = findScoreFromCriteria(data.criteria, displayVal, data.parameterType)
        store.setOrUpdateValue(c.id, v.id, p.id, vv.textValue, vv.numericValue, score)
      }
    }
  }
  recalculateTotalScores(c!)
  showParamModal.value = false
  editingParam.value = null
}

function onParamFormDelete() {
  const c = comparison.value
  const p = editingParam.value
  if (!c || !p) return
  if (!confirm(t('results.deleteParamConfirm'))) return
  store.deleteParameter(c.id, p.id)
  recalculateTotalScores(c)
  showParamModal.value = false
  editingParam.value = null
}
</script>

<template>
  <div class="results">
    <header class="results-header">
      <button type="button" class="btn-back" @click="goBack">← {{ t('common.back') }}</button>
      <h1 class="results-title">{{ comparison?.name ?? '' }}</h1>
    </header>

    <template v-if="comparison">
      <div class="results-card">
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
            <button type="button" class="empty-btn empty-btn-primary" @click="openAddVariant">
              {{ t('results.addVariantBtn') }}
            </button>
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
            <button type="button" class="empty-btn empty-btn-success" @click="openAddParam">
              {{ t('results.addParamBtn') }}
            </button>
            <p class="empty-desc">{{ t('results.emptyParams') }}</p>
          </div>
        </div>
      </div>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="results-table">
            <thead>
              <TransitionGroup name="variant-move" tag="tr">
                <th key="param-col" class="param-col">
                  <div v-if="hasTableData()" class="table-actions">
                    <button type="button" class="table-action-btn" @click="openAddParam">
                      <NIcon><AddOutline /></NIcon>
                      {{ t('results.addParam') }}
                    </button>
                    <button type="button" class="table-action-btn" @click="openAddVariant">
                      <NIcon><AddOutline /></NIcon>
                      {{ t('results.addVariant') }}
                    </button>
                  </div>
                </th>
                <th v-for="(v, i) in displayedVariants" :key="v.id" class="variant-col variant-col-clickable" @click="openEditVariant(v)">
                  <div class="variant-header">
                    <div class="variant-name-wrap">
                      <span class="variant-name">{{ v.name }}</span>
                    </div>
                    <div class="variant-score-row">
                      <span class="variant-rank">{{ i + 1 }}</span>
                      <span class="variant-score">{{ Math.round(v.totalScore) }}</span>
                    </div>
                    <img
                      v-if="v.imageUrl"
                      :src="v.imageUrl"
                      :alt="v.name"
                      class="variant-header-thumb"
                      @error="($event.target as HTMLImageElement)?.style?.setProperty('display', 'none')"
                    />
                    <div
                      v-else
                      class="variant-thumb-placeholder"
                      :style="v.color ? { background: v.color } : {}"
                    ></div>
                  </div>
                </th>
              </TransitionGroup>
            </thead>
            <TransitionGroup name="param-move" tag="tbody" class="param-tbody">
              <tr v-for="p in displayedParameters" :key="p.id" class="param-row">
                <td class="param-col" @click="openEditParam(p)">
                  <div class="param-header">
                    <div class="param-head-row">
                      <span class="param-name">{{ p.name }}<span v-if="p.unit" class="param-unit">, {{ p.unit }}</span></span>
                    </div>
                    <div class="param-weight-row" @click.stop>
                      <NSlider
                        :value="p.weight"
                        :min="0"
                        :max="10"
                        :step="1"
                        :tooltip="false"
                        class="param-weight-slider param-weight-slider--desktop"
                        @update:value="(v: number) => setParamWeight(p, v)"
                      />
                      <div class="param-weight-buttons">
                        <button
                          type="button"
                          class="param-weight-btn param-weight-btn--minus"
                          :disabled="p.weight <= 0"
                          @click.stop="setParamWeight(p, Math.max(0, p.weight - 1))"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          class="param-weight-btn param-weight-btn--plus"
                          :disabled="p.weight >= 10"
                          @click.stop="setParamWeight(p, Math.min(10, p.weight + 1))"
                        >
                          +
                        </button>
                      </div>
                      <span class="param-weight-badge">{{ p.weight }}</span>
                    </div>
                  </div>
                </td>
                <td v-for="v in displayedVariants" :key="v.id" class="cell" @click="openValueEdit(v, p)">
                  <div class="cell-value">
                    <span>{{ formatCellValue(getValue(v.id, p.id)) }}</span>
                    <span
                      v-if="getValue(v.id, p.id)?.score != null"
                      class="cell-score-badge"
                      :class="'score-' + Math.min(10, Math.floor(getValue(v.id, p.id)!.score))"
                    >
                      {{ Math.round(getValue(v.id, p.id)!.score) }}
                    </span>
                  </div>
                </td>
              </tr>
            </TransitionGroup>
          </table>
        </div>
      </div>
      </div>
    </template>

    <NEmpty v-else :description="t('results.notFound')" class="empty" />

    <NModal :show="showVariantModal" @update:show="onVariantModalShow">
      <div class="modal-content modal-content-scroll modal-content-variant">
        <VariantEditForm
          v-if="comparison"
          :variant="editingVariant"
          :comparison="comparison"
          :get-value="getValue"
          :next-color="nextVariantColor"
          @save="onVariantFormSave"
          @cancel="showVariantModal = false"
          @delete="onVariantFormDelete"
        />
      </div>
    </NModal>

    <NModal :show="showParamModal" @update:show="onParamModalShow">
      <div class="modal-content modal-content-scroll modal-content-variant">
        <ParameterEditForm
          v-if="comparison"
          :parameter="editingParam"
          :variants="comparison.variants"
          :all-comparisons="store.sortedComparisons"
          :get-value="getValue"
          :is-new="!editingParam"
          @save="onParamFormSave"
          @cancel="showParamModal = false"
          @delete="onParamFormDelete"
        />
      </div>
    </NModal>

    <NModal :show="showValueEditModal" @update:show="onValueEditModalShow">
      <div class="modal-content modal-content-scroll modal-content-variant">
        <ValueEditForm
          v-if="valueEditData && comparison"
          :variant="valueEditData.variant"
          :parameter="valueEditData.parameter"
          :existing-value="getValue(valueEditData.variant.id, valueEditData.parameter.id)"
          @save="onValueEditSave"
          @cancel="showValueEditModal = false"
        />
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
  --card-bg: #FFFFFF;
  --card-radius: 20px;
  --text: var(--tg-theme-text-color, #1a1a1a);
  --text-muted: #8a8580;
  --divider: rgba(0,0,0,0.06);
}

.results-card {
  flex: 1;
  min-height: 0;
  background: var(--card-bg);
  border-radius: var(--card-radius);
  box-shadow: 0 20px 60px rgba(80,60,40,0.18), 0 2px 6px rgba(80,60,40,0.08);
  overflow: hidden;
}

.results-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.btn-back {
  padding: 8px 12px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-back:hover {
  background: rgba(0,0,0,0.06);
}

.results-title {
  flex: 1;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
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
  background: var(--card-bg);
}

.results-table th,
.results-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider) !important;
  vertical-align: middle;
  background: var(--card-bg);
}

.param-tbody {
  display: table-row-group;
}

.param-row {
  cursor: pointer;
}

.param-move-move {
  transition: transform 0.5s ease;
}

.variant-move-move {
  transition: transform 0.5s ease;
}

.param-col {
  position: sticky;
  left: 0;
  background: var(--card-bg);
  min-width: 120px;
  max-width: 160px;
}

.table-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  justify-content: flex-start;
}

.variant-col {
  min-width: 68px;
  max-width: 88px;
  width: 80px;
  text-align: center;
  padding: 8px 6px !important;
}
.variant-col-clickable {
  cursor: pointer;
}

.variant-header {
  display: grid;
  grid-template-rows: 2.4em 1.6em 32px;
  align-items: center;
  justify-items: center;
  gap: 0;
}

.variant-name-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  min-height: 0;
  align-self: start;
}

.variant-name {
  font-weight: 600;
  font-size: 0.85em;
  color: var(--text);
  line-height: 1.2;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  text-align: center;
  max-width: 100%;
}

.variant-header-thumb {
  height: 32px;
  width: auto;
  max-width: 48px;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}

.variant-thumb-placeholder {
  height: 32px;
  min-width: 40px;
  flex-shrink: 0;
  border-radius: 6px;
}

.variant-score-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.variant-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35em;
  height: 1.35em;
  flex-shrink: 0;
  color: var(--text-muted);
  background: rgba(0,0,0,0.08);
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: 600;
}

.variant-score {
  font-size: 0.85em;
  color: var(--text-muted);
}

.param-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  line-height: 1.2;
}

.param-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.param-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-size: 0.9rem;
  color: var(--text);
}

.param-unit {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-muted);
}

.param-weight-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.param-weight-slider {
  flex: 1;
  min-width: 0;
}

.param-weight-slider :deep(.n-slider-rail) {
  height: 6px;
}

.param-weight-slider :deep(.n-slider-handle) {
  width: 14px;
  height: 14px;
}

.param-weight-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text);
  background: rgba(0,0,0,0.08);
  padding: 2px 6px;
  border-radius: 6px;
  min-width: 22px;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

/* Кнопки −/+ на маленьких экранах вместо слайдера */
.param-weight-buttons {
  display: none;
  flex-shrink: 0;
  gap: 4px;
}

.param-weight-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: rgba(0,0,0,0.06);
  color: var(--text);
  font-family: inherit;
  font-size: 18px;
  font-weight: 300;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s ease;
}

.param-weight-btn:hover:not(:disabled) {
  background: rgba(0,0,0,0.12);
}

.param-weight-btn:active:not(:disabled) {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

.param-weight-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .param-weight-slider--desktop {
    display: none !important;
  }
  .param-weight-buttons {
    display: flex;
  }
}

@media (min-width: 769px) {
  .param-weight-buttons {
    display: none !important;
  }
}

.cell {
  text-align: center;
  cursor: pointer;
  padding: 6px 8px !important;
  min-width: 68px;
  max-width: 88px;
  width: 80px;
}

.cell-value {
  height: fit-content;
  min-height: 0;
  line-height: 1.2;
  font-weight: 600;
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.cell-score-badge {
  font-size: 0.49rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: #333;
  padding: 2px 6px;
  border-radius: 6px;
}

.cell-score-badge.score-0 { background: rgba(204, 0, 0, 0.2); }
.cell-score-badge.score-1 { background: rgba(230, 77, 0, 0.2); }
.cell-score-badge.score-2 { background: rgba(255, 127, 0, 0.2); }
.cell-score-badge.score-3 { background: rgba(255, 153, 0, 0.2); }
.cell-score-badge.score-4 { background: rgba(230, 179, 0, 0.2); }
.cell-score-badge.score-5 { background: rgba(204, 179, 0, 0.2); }
.cell-score-badge.score-6 { background: rgba(153, 166, 0, 0.2); }
.cell-score-badge.score-7 { background: rgba(102, 166, 0, 0.2); }
.cell-score-badge.score-8 { background: rgba(51, 166, 0, 0.2); }
.cell-score-badge.score-9 { background: rgba(26, 140, 0, 0.2); }
.cell-score-badge.score-10 { background: rgba(0, 102, 0, 0.2); }

.modal-content {
  padding: 24px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  max-width: 400px;
}
.modal-content-scroll {
  max-height: 85vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 16px 0;
}

.modal-content-variant {
  padding: 16px;
  background: transparent;
  max-width: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px;
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
  color: var(--text);
}

.empty-hint {
  margin: 0 0 12px 0;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 600;
  width: 100%;
}

.empty-general {
  margin: 0 0 24px 0;
  color: var(--text-muted);
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
  width: 100%;
  min-height: 48px;
  padding: 12px 24px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.empty-btn-primary {
  background: #3478f6;
  color: #fff;
}

.empty-btn-primary:hover {
  background: #2d6ad9;
  box-shadow: 0 4px 14px rgba(52,120,246,0.35);
}

.empty-btn-success {
  background: #2d9d5c;
  color: #fff;
}

.empty-btn-success:hover {
  background: #259b50;
  box-shadow: 0 4px 14px rgba(45,157,92,0.35);
}

.table-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  border: 1.5px solid rgba(0,0,0,0.12);
  border-radius: 16px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.table-action-btn:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.2);
}

.table-action-btn .n-icon {
  font-size: 14px;
}

/* Вариант — синий (primary), Параметр — зелёный (success) */

.empty-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  width: 100%;
}

.empty-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  align-self: flex-start;
}

.empty-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: rgba(0,0,0,0.04);
  border: 1px solid var(--divider);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: all 0.15s ease;
}

.empty-card:hover {
  background: rgba(0,0,0,0.08);
  border-color: rgba(0,0,0,0.12);
}

.empty-card-name {
  flex: 1;
  font-weight: 600;
  color: var(--text);
}

.empty-card-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(0,0,0,0.06);
  color: var(--text);
}

.empty-card-weight {
  background: rgba(0,0,0,0.08);
}

.empty-card-chevron {
  color: var(--text-muted);
  font-size: 1.2rem;
}

/* NEmpty для «сравнение не найдено» */
.empty {
  margin-top: 48px;
}
</style>
