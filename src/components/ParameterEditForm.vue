<script setup lang="ts">
import { ref, watch, TransitionGroup, nextTick } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NIcon,
  NSpace,
  NRadioGroup,
  NRadioButton,
} from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { findScoreFromCriteria } from '../utils/importExport'
import type { Parameter, Criterion, Variant, Value } from '../types'

const props = defineProps<{
  parameter: Parameter | null
  variants: Variant[]
  getValue: (variantId: string, parameterId: string) => Value | undefined
  isNew?: boolean
}>()

const emit = defineEmits<{
  save: [data: ParameterFormData]
  cancel: []
}>()

const { t } = useI18n()

export interface VariantValue {
  textValue?: string
  numericValue?: number
}

export interface ParameterFormData {
  name: string
  unit: string
  parameterType: 'number' | 'text'
  weight: number
  criteria: Criterion[]
  variantValues: Record<string, VariantValue>
}

const name = ref('')
const unit = ref('')
const paramType = ref<'number' | 'text'>('number')
const weight = ref(5)
const criteria = ref<Criterion[]>([])
const variantValues = ref<Record<string, VariantValue>>({})

const TEMPLATES = {
  scale10: [
    { name: '0', textValue: '0', numericValue: 0, score: 0 },
    { name: '1', textValue: '1', numericValue: 1, score: 1 },
    { name: '2', textValue: '2', numericValue: 2, score: 2 },
    { name: '3', textValue: '3', numericValue: 3, score: 3 },
    { name: '4', textValue: '4', numericValue: 4, score: 4 },
    { name: '5', textValue: '5', numericValue: 5, score: 5 },
    { name: '6', textValue: '6', numericValue: 6, score: 6 },
    { name: '7', textValue: '7', numericValue: 7, score: 7 },
    { name: '8', textValue: '8', numericValue: 8, score: 8 },
    { name: '9', textValue: '9', numericValue: 9, score: 9 },
    { name: '10', textValue: '10', numericValue: 10, score: 10 },
  ],
  scale100: Array.from({ length: 11 }, (_, i) => {
    const v = i * 10
    return { name: String(v), textValue: String(v), numericValue: v, score: Math.round((i / 10) * 10) }
  }),
  get yesNo() {
    return [
      { name: t('paramForm.no'), textValue: t('paramForm.no'), score: 0 },
      { name: t('paramForm.yes'), textValue: t('paramForm.yes'), score: 10 },
    ]
  },
}

function id() {
  return crypto.randomUUID()
}

function applyTemplate(key: 'scale10' | 'scale100' | 'yesNo') {
  const template = key === 'yesNo' ? TEMPLATES.yesNo : TEMPLATES[key]
  criteria.value = template.map((c) => ({
    id: id(),
    name: c.name,
    textValue: c.textValue ?? c.name,
    numericValue: 'numericValue' in c ? (c.numericValue as number) : undefined,
    score: c.score,
  }))
  syncDisplayedCriteria()
}

function addCriterion() {
  const last = criteria.value[criteria.value.length - 1]
  const nextScore = last ? Math.min(10, last.score + 1) : 0
  const nextVal = paramType.value === 'number' ? (last?.numericValue ?? 0) + 1 : `Критерий ${criteria.value.length + 1}`
  criteria.value.push({
    id: id(),
    name: paramType.value === 'number' ? String(nextVal) : String(nextVal),
    textValue: String(nextVal),
    numericValue: paramType.value === 'number' ? Number(nextVal) : undefined,
    score: nextScore,
  })
  sortCriteriaByType()
  syncDisplayedCriteria()
}

function updateCriterion(cr: Criterion, updates: Partial<Criterion>) {
  Object.assign(cr, updates)
  if (updates.name !== undefined) {
    const val = String(updates.name)
    cr.textValue = val
    if (paramType.value === 'number') {
      const num = Number(val)
      cr.numericValue = Number.isFinite(num) ? num : undefined
    }
    // В текстовом режиме numericValue не трогаем — сохраняем для переключения обратно
  }
}

function onCriterionInput(cr: Criterion, val: string) {
  updateCriterion(cr, { name: val })
}

function onCriterionNumberInput(cr: Criterion, val: number | null) {
  if (val == null || !Number.isFinite(val)) {
    cr.numericValue = undefined
  } else {
    cr.numericValue = val
  }
  sortCriteriaByType()
  scheduleCriteriaReorder()
}

function sortCriteriaByType() {
  const arr = [...criteria.value]
  if (paramType.value === 'number') {
    arr.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
  } else {
    arr.sort((a, b) => a.score - b.score)
  }
  criteria.value = arr
}

/** Правила переключения типа: число↔текст сохраняют оба значения, при переключении берём подходящее */
function onParamTypeChange() {
  for (const cr of criteria.value) {
    if (paramType.value === 'text') {
      if (!cr.textValue || cr.textValue.trim() === '') {
        cr.textValue = cr.numericValue != null ? String(cr.numericValue) : ''
        cr.name = cr.textValue
      }
    } else {
      const num = Number(cr.textValue)
      if (cr.textValue !== '' && Number.isFinite(num)) {
        cr.numericValue = num
      }
    }
  }
  for (const v of props.variants) {
    const vv = variantValues.value[v.id]
    if (!vv) continue
    if (paramType.value === 'text') {
      if (!vv.textValue || vv.textValue.trim() === '') {
        vv.textValue = vv.numericValue != null ? String(vv.numericValue) : ''
      }
    } else {
      const num = Number(vv.textValue)
      if (vv.textValue !== '' && Number.isFinite(num)) {
        vv.numericValue = num
      }
    }
  }
  sortCriteriaByType()
  syncDisplayedCriteria()
}

function removeCriterion(cr: Criterion) {
  criteria.value = criteria.value.filter((c) => c.id !== cr.id)
  syncDisplayedCriteria()
}

function getVariantDisplayValue(vv: VariantValue | undefined): string | number | undefined {
  if (!vv) return undefined
  if (paramType.value === 'number') {
    if (vv.numericValue != null) return vv.numericValue
    if (vv.textValue && Number.isFinite(Number(vv.textValue))) return Number(vv.textValue)
    return undefined
  }
  if (vv.textValue) return vv.textValue
  if (vv.numericValue != null) return String(vv.numericValue)
  return undefined
}

function getScoreForValue(val: string | number | undefined): number {
  if (val === undefined || val === '') return 0
  return findScoreFromCriteria(criteria.value, val, paramType.value)
}

function getSortedCriteria(): Criterion[] {
  const arr = [...criteria.value]
  if (paramType.value === 'number') {
    return arr.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
  }
  return arr.sort((a, b) => a.score - b.score)
}

const displayedCriteria = ref<Criterion[]>([])
let criteriaReorderTimeout: ReturnType<typeof setTimeout> | null = null

function syncDisplayedCriteria() {
  displayedCriteria.value = getSortedCriteria()
}

function scheduleCriteriaReorder() {
  if (criteriaReorderTimeout) clearTimeout(criteriaReorderTimeout)
  criteriaReorderTimeout = setTimeout(() => {
    syncDisplayedCriteria()
    criteriaReorderTimeout = null
  }, 1000)
}

function onScoreClick(cr: Criterion, score: number) {
  updateCriterion(cr, { score })
  sortCriteriaByType()
  scheduleCriteriaReorder()
}

function normalizeParamType(v: string | undefined): 'number' | 'text' {
  return v === 'number' ? 'number' : 'text'
}

watch(
  () => props.parameter,
  (p) => {
    if (p) {
      name.value = p.name
      unit.value = p.unit ?? ''
      paramType.value = normalizeParamType(p.parameterType)
      weight.value = p.weight
      criteria.value = (p.criteria ?? []).map((c) => {
        const cr = { ...c, id: c.id || id() }
        if (!cr.name && cr.textValue) cr.name = cr.textValue
        if (!cr.name && !cr.textValue && cr.numericValue != null) {
          cr.name = String(cr.numericValue)
          cr.textValue = String(cr.numericValue)
        }
        return cr
      })
      nextTick(() => syncDisplayedCriteria())
      const vals: Record<string, VariantValue> = {}
      for (const v of props.variants) {
        const val = props.getValue(v.id, p.id)
        vals[v.id] = { textValue: val?.textValue, numericValue: val?.numericValue }
      }
      variantValues.value = vals
    } else {
      name.value = ''
      unit.value = ''
      paramType.value = 'number'
      weight.value = 5
      criteria.value = []
      displayedCriteria.value = []
      variantValues.value = {}
    }
  },
  { immediate: true }
)

watch(
  paramType,
  (v) => {
    if (v !== 'number' && v !== 'text') {
      paramType.value = 'text'
    }
  },
  { immediate: true }
)

watch(
  () => props.variants,
  (vars) => {
    const p = props.parameter
    if (!p) return
    const vals = { ...variantValues.value }
    for (const v of vars) {
      if (vals[v.id] === undefined) {
        const val = props.getValue(v.id, p.id)
        vals[v.id] = { textValue: val?.textValue, numericValue: val?.numericValue }
      }
    }
    variantValues.value = vals
  },
  { immediate: true }
)

function save() {
  const type = normalizeParamType(paramType.value)
  const normalizedCriteria = criteria.value.map((cr) => {
    const c = { ...cr }
    if (type === 'number') {
      if (c.numericValue == null && (c.name || c.textValue)) {
        const num = Number(c.name || c.textValue)
        c.numericValue = Number.isFinite(num) ? num : undefined
      }
      // name и textValue не перезаписываем — сохраняем текстовую подпись («Низкий»)
    } else {
      c.numericValue = undefined
    }
    return c
  })
  emit('save', {
    name: name.value.trim(),
    unit: unit.value.trim(),
    parameterType: type,
    weight: weight.value,
    criteria: normalizedCriteria,
    variantValues: { ...variantValues.value },
  })
}

function cancel() {
  emit('cancel')
}

function setParamType(v: string | number) {
  paramType.value = normalizeParamType(String(v))
  onParamTypeChange()
}

/** Формат числа: целые без .0, дробные — как введено */
function formatNumber(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return ''
  return Number.isInteger(v) ? String(v) : String(v)
}
</script>

<template>
  <NForm label-placement="top" class="param-form">
    <div class="param-form-block param-form-block-basic">
      <div class="param-form-row param-form-row-name-unit">
        <NFormItem :label="t('comparisons.name')" class="param-form-item-name">
          <NInput v-model:value="name" :placeholder="t('results.paramNamePlaceholder')" />
        </NFormItem>
        <NFormItem :label="t('paramForm.unitShort')" class="param-form-item-unit">
          <NInput v-model:value="unit" :placeholder="t('paramForm.unitPlaceholder')" />
        </NFormItem>
      </div>
      <div class="param-form-row">
        <NFormItem :label="t('paramForm.type')">
          <NRadioGroup :value="paramType || 'text'" @update:value="setParamType">
            <NRadioButton value="number">{{ t('results.paramTypeNumber') }}</NRadioButton>
            <NRadioButton value="text">{{ t('results.paramTypeText') }}</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="t('results.weight')">
          <NSpace align="center">
            <NButton size="small" :disabled="weight <= 1" @click="weight = Math.max(1, weight - 1)">−</NButton>
            <span class="param-weight-value">{{ weight }}</span>
            <NButton size="small" :disabled="weight >= 10" @click="weight = Math.min(10, weight + 1)">+</NButton>
          </NSpace>
        </NFormItem>
      </div>
    </div>

    <div class="param-form-block">
      <div class="param-form-section-header">
        <h4 class="param-form-section-title">{{ t('paramForm.criteria') }}</h4>
        <NButton @click="addCriterion">
          <template #icon>
            <NIcon><AddOutline /></NIcon>
          </template>
          {{ t('paramForm.criterionName') }}
        </NButton>
      </div>
    <div v-if="criteria.length === 0" class="param-templates">
      <span class="param-templates-label">{{ t('paramForm.template') }}:</span>
      <NButton size="small" @click="applyTemplate('scale10')">{{ t('paramForm.template10') }}</NButton>
      <NButton size="small" @click="applyTemplate('scale100')">{{ t('paramForm.template100') }}</NButton>
      <NButton size="small" @click="applyTemplate('yesNo')">{{ t('paramForm.templateYesNo') }}</NButton>
    </div>
    <div v-else>
      <TransitionGroup name="criterion-move" tag="div" class="param-criteria-list">
        <div v-for="cr in displayedCriteria" :key="cr.id" class="param-criterion-row">
          <NInput
            v-if="paramType === 'text'"
            :value="cr.name || cr.textValue"
            size="small"
            :placeholder="t('paramForm.criterionName')"
            :input-props="{ inputmode: 'text' }"
            class="param-criterion-input"
            @update:value="(v) => onCriterionInput(cr, v ?? '')"
          />
          <NInputNumber
            v-else
            :value="cr.numericValue ?? null"
            size="small"
            :placeholder="t('paramForm.valueNumber')"
            :format="formatNumber"
            clearable
            class="param-criterion-input"
            @update:value="(v) => onCriterionNumberInput(cr, v)"
          />
          <div class="param-criterion-scores">
            <button
              v-for="s in 11"
              :key="s - 1"
              type="button"
              class="param-score-btn"
              :class="['score-' + (s - 1), { active: cr.score === s - 1 }]"
              @click="onScoreClick(cr, s - 1)"
            >
              {{ s - 1 }}
            </button>
          </div>
          <NButton size="small" quaternary type="error" class="param-criterion-remove" @click="removeCriterion(cr)">×</NButton>
        </div>
      </TransitionGroup>
    </div>
    </div>

    <template v-if="parameter && variants.length > 0">
      <div class="param-form-block">
        <h4 class="param-form-section-title">{{ t('paramForm.scoresVariants') }}</h4>
        <div class="param-variants-grid">
        <div v-for="v in variants" :key="v.id" class="param-variant-cell">
          <span class="param-variant-label">{{ v.name }}</span>
          <template v-if="paramType === 'number'">
            <NInputNumber
              :value="typeof getVariantDisplayValue(variantValues[v.id]) === 'number' ? getVariantDisplayValue(variantValues[v.id]) as number : null"
              size="small"
              :placeholder="t('paramForm.value')"
              :format="formatNumber"
              clearable
              class="param-variant-input"
              @update:value="(val: number | null) => { variantValues[v.id] = { ...(variantValues[v.id] || {}), numericValue: val ?? undefined } }"
            />
            <span
              v-if="getVariantDisplayValue(variantValues[v.id]) != null"
              class="param-variant-badge"
              :class="'score-badge-' + Math.min(10, Math.floor(getScoreForValue(getVariantDisplayValue(variantValues[v.id]))))"
            >
              {{ (Math.round(getScoreForValue(getVariantDisplayValue(variantValues[v.id])) * 10) / 10).toFixed(1) }}
            </span>
          </template>
          <template v-else>
            <div v-if="displayedCriteria.length" class="param-variant-buttons">
              <button
                v-for="cr in displayedCriteria"
                :key="cr.id"
                type="button"
                class="param-criterion-btn"
                :class="['score-' + Math.min(10, Math.floor(cr.score)), { active: String(getVariantDisplayValue(variantValues[v.id])).toLowerCase() === String(cr.textValue).toLowerCase() }]"
                @click="variantValues[v.id] = { ...(variantValues[v.id] || {}), textValue: cr.textValue }"
              >
                {{ cr.name || cr.textValue }}
              </button>
            </div>
            <NInput
              v-else
              :value="String(getVariantDisplayValue(variantValues[v.id]) ?? '')"
              size="small"
              :placeholder="t('paramForm.value')"
              class="param-variant-input"
              @update:value="(val: string) => { variantValues[v.id] = { ...(variantValues[v.id] || {}), textValue: val || undefined } }"
            />
            <span
              v-if="getVariantDisplayValue(variantValues[v.id]) != null && getVariantDisplayValue(variantValues[v.id]) !== ''"
              class="param-variant-badge"
              :class="'score-badge-' + Math.min(10, Math.floor(getScoreForValue(getVariantDisplayValue(variantValues[v.id]))))"
            >
              {{ (Math.round(getScoreForValue(getVariantDisplayValue(variantValues[v.id])) * 10) / 10).toFixed(1) }}
            </span>
          </template>
        </div>
      </div>
    </div>
    </template>

    <NSpace justify="end" class="param-form-actions">
      <NButton @click="cancel">{{ t('common.cancel') }}</NButton>
      <NButton type="primary" :disabled="!name.trim()" @click="save">{{ isNew ? t('comparisons.create') : t('common.save') }}</NButton>
    </NSpace>
  </NForm>
</template>

<style scoped>
.param-form {
  max-width: 100%;
}

.param-form-block {
  margin-top: 20px;
}

.param-form-block:first-child {
  margin-top: 0;
}

.param-form-block-basic {
  padding: 0;
  border: none;
  background: transparent;
}

.param-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

.param-form-row-name-unit {
  gap: 16px;
}

.param-form-item-name {
  flex: 1;
  min-width: 120px;
}

.param-form-item-unit {
  flex: 0 0 auto;
  width: 80px;
}

.param-form-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.param-form-section-header .param-form-section-title {
  margin: 0;
}
.param-form-section-title {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--tg-theme-text-color, #333);
}
.param-weight-value {
  min-width: 2ch;
  text-align: center;
  font-weight: 600;
}
.param-templates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.param-templates-label {
  font-size: 0.9rem;
  color: var(--tg-theme-hint-color, #666);
}
.param-criteria-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.criterion-move-move {
  transition: transform 0.5s ease;
}
.param-criterion-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
}
.param-criterion-input {
  flex: 1;
  min-width: 100px;
  max-width: 200px;
}
.param-criterion-scores {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.param-criterion-remove {
  flex-shrink: 0;
}
.param-score-btn {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  font-size: 0.55rem;
  line-height: 12px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
}
.param-score-btn:not(.active) {
  opacity: 0.5;
}
.param-score-btn.active {
  opacity: 1;
  border-color: rgba(0, 0, 0, 0.3);
  color: #fff;
}
.param-score-btn.score-0 { background: #cc0000; }
.param-score-btn.score-1 { background: #e64d00; }
.param-score-btn.score-2 { background: #ff7f00; }
.param-score-btn.score-3 { background: #ff9900; }
.param-score-btn.score-4 { background: #e6b300; }
.param-score-btn.score-5 { background: #ccb300; }
.param-score-btn.score-6 { background: #99a600; }
.param-score-btn.score-7 { background: #66a600; }
.param-score-btn.score-8 { background: #33a600; }
.param-score-btn.score-9 { background: #1a8c00; }
.param-score-btn.score-10 { background: #006600; }
.param-variants-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.param-variant-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.param-variant-label {
  font-size: 0.85rem;
  font-weight: 600;
  flex-shrink: 0;
  min-width: 80px;
}
.param-variant-input {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
}
.param-variant-badge {
  font-size: 0.56rem;
  font-weight: 600;
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}
.param-variant-badge.score-badge-0 { background: #cc0000; }
.param-variant-badge.score-badge-1 { background: #e64d00; }
.param-variant-badge.score-badge-2 { background: #ff7f00; }
.param-variant-badge.score-badge-3 { background: #ff9900; }
.param-variant-badge.score-badge-4 { background: #e6b300; }
.param-variant-badge.score-badge-5 { background: #ccb300; }
.param-variant-badge.score-badge-6 { background: #99a600; }
.param-variant-badge.score-badge-7 { background: #66a600; }
.param-variant-badge.score-badge-8 { background: #33a600; }
.param-variant-badge.score-badge-9 { background: #1a8c00; }
.param-variant-badge.score-badge-10 { background: #006600; }
.param-variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.param-criterion-btn {
  padding: 3px 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font-size: 0.42rem;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
}
.param-criterion-btn:not(.active) {
  opacity: 0.5;
}
.param-criterion-btn.active {
  opacity: 1;
  border-color: rgba(0, 0, 0, 0.3);
  color: #fff;
}
.param-criterion-btn.score-0 { background: #cc0000; }
.param-criterion-btn.score-1 { background: #e64d00; }
.param-criterion-btn.score-2 { background: #ff7f00; }
.param-criterion-btn.score-3 { background: #ff9900; }
.param-criterion-btn.score-4 { background: #e6b300; }
.param-criterion-btn.score-5 { background: #ccb300; }
.param-criterion-btn.score-6 { background: #99a600; }
.param-criterion-btn.score-7 { background: #66a600; }
.param-criterion-btn.score-8 { background: #33a600; }
.param-criterion-btn.score-9 { background: #1a8c00; }
.param-criterion-btn.score-10 { background: #006600; }
.param-form-actions {
  margin-top: 20px;
}
</style>
