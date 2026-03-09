<script setup lang="ts">
import { ref, watch, TransitionGroup, nextTick, computed } from 'vue'
import {
  NInput,
  NInputNumber,
  NRadioGroup,
  NRadioButton,
  NModal,
  NScrollbar,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { findScoreFromCriteria } from '../utils/importExport'
import type { Parameter, Criterion, Variant, Value, Comparison } from '../types'

interface CriteriaTemplateItem {
  name: string
  textValue: string
  numericValue?: number
  score: number
}

interface CriteriaTemplate {
  id: string
  name: string
  criteria: CriteriaTemplateItem[]
  usageCount: number
  unit?: string
}

const props = defineProps<{
  parameter: Parameter | null
  variants: Variant[]
  allComparisons?: Comparison[]
  getValue: (variantId: string, parameterId: string) => Value | undefined
  isNew?: boolean
}>()

const emit = defineEmits<{
  save: [data: ParameterFormData]
  cancel: []
  delete: []
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

/** Шаблоны как в iGetBest (Swift): 2 точки для числовых шкал, интерполяция между ними */
const TEMPLATES = {
  get scale10() {
    return [
      { name: t('paramForm.templateScale10Min'), textValue: '0', numericValue: 0, score: 0 },
      { name: t('paramForm.templateScale10Max'), textValue: '10', numericValue: 10, score: 10 },
    ]
  },
  get scale100() {
    return [
      { name: t('paramForm.templateScale100Min'), textValue: '0', numericValue: 0, score: 0 },
      { name: t('paramForm.templateScale100Max'), textValue: '100', numericValue: 100, score: 10 },
    ]
  },
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

const showTemplatesModal = ref(false)
const templateSearchQuery = ref('')
/** Тип параметра при просмотре шаблонов — можно переключать в модальном окне */
const templateModalType = ref<'number' | 'text'>('number')

/** Ключ для группировки шаблонов с одинаковыми критериями. Нормализация для объединения дубликатов. */
function createCriteriaKey(items: CriteriaTemplateItem[], type: 'number' | 'text'): string {
  return items
    .map((c) => {
      const score = Math.round(c.score)
      if (type === 'number') {
        const v = c.numericValue ?? 0
        return `${v}:${score}`
      }
      const tv = String(c.textValue ?? '').trim()
      return `${tv}:${score}`
    })
    .join('|')
}

function getStaticTemplates(type: 'number' | 'text'): CriteriaTemplate[] {
  if (type === 'number') {
    return [
      {
        id: 'static-scale10',
        name: t('paramForm.template10'),
        criteria: [...TEMPLATES.scale10],
        usageCount: 1,
      },
      {
        id: 'static-scale100',
        name: t('paramForm.template100'),
        criteria: [...TEMPLATES.scale100],
        usageCount: 1,
      },
    ]
  }
  return [
    {
      id: 'static-yesNo',
      name: t('paramForm.templateYesNo'),
      criteria: [...TEMPLATES.yesNo],
      usageCount: 1,
    },
  ]
}

function getMostFrequentUnit(units: string[]): string | undefined {
  const nonEmpty = units.map((u) => (u ?? '').trim()).filter(Boolean)
  if (nonEmpty.length === 0) return undefined
  const counts = new Map<string, number>()
  for (const u of nonEmpty) {
    counts.set(u, (counts.get(u) ?? 0) + 1)
  }
  let max = 0
  let result = ''
  for (const [u, c] of counts) {
    if (c > max) {
      max = c
      result = u
    }
  }
  return result || undefined
}

function getDynamicTemplates(type: 'number' | 'text'): CriteriaTemplate[] {
  const comps = props.allComparisons ?? []
  const groups = new Map<
    string,
    { criteria: CriteriaTemplateItem[]; count: number; sourceNames: string[]; units: string[] }
  >()

  for (const comparison of comps) {
    for (const param of comparison.parameters ?? []) {
      if (param.parameterType !== type) continue
      const rawCriteria = param.criteria ?? []
      if (rawCriteria.length === 0) continue
      const paramCriteria = rawCriteria.map((c) => ({
        name: c.name,
        textValue: c.textValue,
        numericValue: c.numericValue,
        score: c.score,
      }))
      const sorted = [...paramCriteria].sort((a, b) =>
        type === 'number'
          ? (a.numericValue ?? 0) - (b.numericValue ?? 0)
          : a.score - b.score
      )
      const key = createCriteriaKey(sorted, type)
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        existing.sourceNames.push(param.name)
        existing.units.push(param.unit ?? '')
      } else {
        groups.set(key, {
          criteria: sorted,
          count: 1,
          sourceNames: [param.name],
          units: [param.unit ?? ''],
        })
      }
    }
  }

  return Array.from(groups.entries()).map(([key, g]) => {
    const uniqueNames = [...new Set(g.sourceNames)].slice(0, 3)
    const name = g.count === 1 ? uniqueNames[0] ?? '' : uniqueNames.join(', ')
    const unit = getMostFrequentUnit(g.units)
    return {
      id: key,
      name,
      criteria: g.criteria,
      usageCount: g.count,
      unit,
    }
  })
}

const allTemplates = computed(() => {
  const type = templateModalType.value
  const dynamic = getDynamicTemplates(type)
  const static_ = getStaticTemplates(type)
  const seen = new Set<string>()
  const result: CriteriaTemplate[] = []
  for (const tpl of [...dynamic, ...static_]) {
    if (tpl.criteria.length === 0) continue
    const key = createCriteriaKey(tpl.criteria, type)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(tpl)
    }
  }
  return result.sort((a, b) => b.usageCount - a.usageCount)
})

const filteredTemplates = computed(() => {
  const q = templateSearchQuery.value.trim().toLowerCase()
  if (!q) return allTemplates.value
  return allTemplates.value.filter((tpl) => {
    const nameMatch = tpl.name.toLowerCase().includes(q)
    const unitMatch = (tpl.unit ?? '').toLowerCase().includes(q)
    const criteriaMatch = tpl.criteria.some(
      (cr) =>
        (cr.name ?? '').toLowerCase().includes(q) ||
        (cr.textValue ?? '').toLowerCase().includes(q) ||
        String(cr.score).includes(q) ||
        (cr.numericValue != null && String(cr.numericValue).includes(q))
    )
    return nameMatch || unitMatch || criteriaMatch
  })
})

function onTemplatesModalUpdate(show: boolean) {
  showTemplatesModal.value = show
  if (show) {
    templateModalType.value = paramType.value
  } else {
    templateSearchQuery.value = ''
  }
}

function applyTemplateFrom(template: CriteriaTemplate) {
  paramType.value = templateModalType.value
  criteria.value = template.criteria.map((c) => ({
    id: id(),
    name: c.name,
    textValue: c.textValue ?? c.name,
    numericValue: c.numericValue,
    score: c.score,
  }))
  onParamTypeChange()
  syncDisplayedCriteria()
  showTemplatesModal.value = false
}

function addCriterion() {
  const newId = id()
  const existing = criteria.value
  const minNum = existing.length
    ? Math.min(...existing.map((c) => c.numericValue ?? 0))
    : 0
  const nextVal =
    paramType.value === 'number'
      ? minNum - 1
      : `Критерий ${criteria.value.length + 1}`
  criteria.value.push({
    id: newId,
    name: String(nextVal),
    textValue: String(nextVal),
    numericValue: paramType.value === 'number' ? Number(nextVal) : undefined,
    score: 0,
  })
  sortCriteriaByType()
  syncDisplayedCriteria()
  nextTick(() => {
    const row = document.querySelector(`[data-criterion-id="${newId}"]`)
    const input = row?.querySelector('input, textarea') as HTMLInputElement | null
    input?.focus()
  })
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
    const vals = { ...variantValues.value }
    for (const v of vars) {
      if (vals[v.id] === undefined) {
        if (p) {
          const val = props.getValue(v.id, p.id)
          vals[v.id] = { textValue: val?.textValue, numericValue: val?.numericValue }
        } else {
          vals[v.id] = {}
        }
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

function doDelete() {
  emit('delete')
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

function getSmartStep(value: number, isDecrease: boolean): number {
  const abs = Math.abs(value)
  if (abs < 10) return 1
  const digits = String(Math.floor(abs))
  const firstDigit = Number(digits[0])
  const magnitude = Math.pow(10, digits.length - 1)
  if (isDecrease) {
    if (firstDigit <= 2 && digits.length > 1) return magnitude / 10
    return magnitude
  }
  if (firstDigit === 1 && digits.length > 1) return magnitude / 10
  return magnitude
}

function incCriterionNumeric(cr: Criterion, direction: number) {
  const cur = cr.numericValue ?? 0
  const isDecrease = (direction < 0 && cur >= 0) || (direction > 0 && cur < 0)
  const step = getSmartStep(cur, isDecrease)
  const newVal = cur + direction * step
  onCriterionNumberInput(cr, newVal)
}

function incVariantNumeric(variantId: string, direction: number) {
  const vv = variantValues.value[variantId] ?? {}
  const cur = vv.numericValue ?? 0
  const isDecrease = (direction < 0 && cur >= 0) || (direction > 0 && cur < 0)
  const step = getSmartStep(cur, isDecrease)
  variantValues.value[variantId] = { ...vv, numericValue: cur + direction * step }
}
</script>

<template>
  <div class="param-card">
    <!-- Заголовок карточки -->
    <div class="param-card-header">
      <div class="param-card-header-left">
        <input
          v-model="name"
          type="text"
          class="param-card-name-input"
          :placeholder="t('results.paramNamePlaceholder')"
          @keyup.enter="save"
        />
        <input
          v-model="unit"
          type="text"
          class="param-card-unit-input"
          :placeholder="t('paramForm.unitPlaceholder')"
        />
      </div>
      <div class="param-card-weight">
        <div class="param-card-weight-pm">
          <button type="button" :disabled="weight <= 1" @click="weight = Math.max(1, weight - 1)">−</button>
          <button type="button" :disabled="weight >= 10" @click="weight = Math.min(10, weight + 1)">+</button>
        </div>
        <span class="param-card-weight-badge">{{ weight }}</span>
      </div>
    </div>

    <!-- Тип параметра -->
    <div class="param-card-type-row">
      <button
        type="button"
        class="param-card-type-pill"
        :class="{ active: paramType === 'number' }"
        @click="setParamType('number')"
      >{{ t('results.paramTypeNumber') }}</button>
      <button
        type="button"
        class="param-card-type-pill"
        :class="{ active: paramType === 'text' }"
        @click="setParamType('text')"
      >{{ t('results.paramTypeText') }}</button>
    </div>

    <!-- Критерии -->
    <div class="param-card-section">
      <div class="param-card-section-header">
        <span class="param-card-section-title">{{ t('paramForm.criteria') }}</span>
        <div class="param-card-section-actions">
          <button type="button" class="param-card-btn-outline" @click="showTemplatesModal = true">{{ t('paramForm.template') }}</button>
          <button type="button" class="param-card-btn-outline" @click="addCriterion">+ {{ t('paramForm.criterionName') }}</button>
        </div>
      </div>
    <div v-if="criteria.length === 0" class="param-criteria-empty">
      <p class="param-criteria-empty-hint">{{ t('paramForm.criteriaEmptyHint') }}</p>
      <p class="param-criteria-empty-why">{{ t('paramForm.criteriaEmptyWhy') }}</p>
      <p class="param-criteria-empty-examples">{{ t('paramForm.criteriaEmptyExamples') }}</p>
    </div>
    <div v-else>
      <TransitionGroup name="criterion-move" tag="div" class="param-criteria-list">
        <div v-for="cr in displayedCriteria" :key="cr.id" class="param-criterion-row" :data-criterion-id="cr.id">
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
            :show-button="false"
            clearable
            class="param-criterion-input"
            @update:value="(v) => onCriterionNumberInput(cr, v)"
          />
          <div v-if="paramType === 'number'" class="param-criterion-pm">
            <button type="button" @click="incCriterionNumeric(cr, -1)">−</button>
            <button type="button" @click="incCriterionNumeric(cr, 1)">+</button>
          </div>
          <div class="param-criterion-scores param-criterion-scores--desktop">
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
          <div class="param-criterion-scores-mobile">
            <button
              type="button"
              class="param-criterion-score-pill param-criterion-score-pill--minus"
              :disabled="cr.score <= 0"
              @click="onScoreClick(cr, Math.max(0, Math.round(cr.score) - 1))"
            >
              ‹
            </button>
            <span
              class="param-criterion-score-value"
              :class="'score-' + Math.min(10, Math.floor(cr.score))"
            >
              {{ Math.round(cr.score) }}
            </span>
            <button
              type="button"
              class="param-criterion-score-pill param-criterion-score-pill--plus"
              :disabled="cr.score >= 10"
              @click="onScoreClick(cr, Math.min(10, Math.round(cr.score) + 1))"
            >
              ›
            </button>
          </div>
          <button type="button" class="param-criterion-remove" @click="removeCriterion(cr)">×</button>
        </div>
      </TransitionGroup>
    </div>
    </div>

    <template v-if="variants.length > 0 && criteria.length > 0">
      <div class="param-card-section">
        <span class="param-card-section-title">{{ t('paramForm.scoresVariants') }}</span>
        <div class="param-variants-grid">
        <div v-for="v in variants" :key="v.id" class="param-variant-cell">
          <span class="param-variant-label">{{ v.name }}</span>
          <template v-if="paramType === 'number'">
            <div class="param-variant-controls">
              <NInputNumber
                :value="typeof getVariantDisplayValue(variantValues[v.id]) === 'number' ? getVariantDisplayValue(variantValues[v.id]) as number : null"
                size="small"
                :placeholder="t('paramForm.value')"
                :format="formatNumber"
                :show-button="false"
                clearable
                class="param-variant-input"
                @update:value="(val: number | null) => { variantValues[v.id] = { ...(variantValues[v.id] || {}), numericValue: val ?? undefined } }"
              />
              <div class="param-variant-pm">
                <button type="button" @click="incVariantNumeric(v.id, -1)">−</button>
                <button type="button" @click="incVariantNumeric(v.id, 1)">+</button>
              </div>
              <span
                v-if="getVariantDisplayValue(variantValues[v.id]) != null"
                class="param-variant-badge"
                :class="'score-badge-' + Math.min(10, Math.floor(getScoreForValue(getVariantDisplayValue(variantValues[v.id]))))"
              >
                {{ (Math.round(getScoreForValue(getVariantDisplayValue(variantValues[v.id])) * 10) / 10).toFixed(1) }}
              </span>
            </div>
          </template>
          <template v-else>
            <div class="param-variant-controls">
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
            </div>
          </template>
        </div>
      </div>
    </div>
    </template>

    <div class="param-card-actions">
      <button v-if="!isNew" type="button" class="btn-delete" @click="doDelete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <div v-else />
      <div class="param-card-actions-right">
        <button type="button" class="btn-cancel" @click="cancel">{{ t('common.cancel') }}</button>
        <button type="button" class="btn-save" :disabled="!name.trim()" @click="save">{{ isNew ? t('comparisons.create') : t('common.save') }}</button>
      </div>
    </div>
  </div>

  <NModal :show="showTemplatesModal" @update:show="onTemplatesModalUpdate">
    <div class="param-templates-modal">
      <h4 class="param-templates-modal-title">{{ t('paramForm.selectTemplate') }}</h4>
      <div class="param-templates-type-row">
        <NRadioGroup v-model:value="templateModalType">
          <NRadioButton value="number">{{ t('results.paramTypeNumber') }}</NRadioButton>
          <NRadioButton value="text">{{ t('results.paramTypeText') }}</NRadioButton>
        </NRadioGroup>
      </div>
      <NInput
        v-model:value="templateSearchQuery"
        :placeholder="t('paramForm.searchTemplate')"
        clearable
        size="small"
        class="param-templates-search"
      />
      <NScrollbar style="max-height: 50vh">
        <div v-if="filteredTemplates.length === 0" class="param-templates-empty">
          {{ t('paramForm.searchNoResults') }}
        </div>
        <div v-else class="param-templates-list">
          <button
            v-for="tpl in filteredTemplates"
            :key="tpl.id"
            type="button"
            class="param-template-item"
            @click="applyTemplateFrom(tpl)"
          >
            <div class="param-template-header">
              <span class="param-template-name">{{ tpl.name }}</span>
              <span v-if="tpl.unit" class="param-template-unit">{{ tpl.unit }}</span>
              <span class="param-template-count">{{ tpl.usageCount }}</span>
            </div>
            <div class="param-template-criteria">
              <span
                v-for="cr in tpl.criteria"
                :key="cr.textValue + '-' + cr.score"
                class="param-template-criterion"
                :class="'score-pale-' + Math.min(10, Math.floor(cr.score))"
              >
                {{ cr.name || cr.textValue }} → {{ cr.score }}
              </span>
            </div>
          </button>
        </div>
      </NScrollbar>
      <div class="param-templates-modal-actions">
        <button type="button" class="btn-cancel" @click="showTemplatesModal = false">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.param-card {
  --card-bg: #D3D4D1;
  --card-radius: 20px;
  --text: var(--tg-theme-text-color, #1a1a1a);
  --text-muted: #8a8580;
  --divider: rgba(0,0,0,0.06);
  max-width: 100%;
  background: var(--card-bg);
  border-radius: var(--card-radius);
  overflow: visible;
  box-shadow: 0 20px 60px rgba(80,60,40,0.18), 0 2px 6px rgba(80,60,40,0.08);
  padding: 20px;
}

/* === Заголовок === */
.param-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.param-card-header-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.param-card-name-input {
  font-family: inherit;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding: 4px 0;
  border-bottom: 2px solid rgba(0,0,0,0.08);
  transition: border-color 0.2s;
}

.param-card-name-input:focus {
  border-bottom-color: rgba(0,0,0,0.25);
}

.param-card-name-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.param-card-unit-input {
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding: 2px 0;
}

.param-card-unit-input::placeholder {
  color: rgba(0,0,0,0.2);
}

/* === Важность (в заголовке) === */
.param-card-weight {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 6px;
}

.param-card-weight-pm {
  display: flex;
  gap: 4px;
}

.param-card-weight-pm button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-family: inherit;
  font-size: 18px;
  font-weight: 300;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.param-card-weight-pm button:hover:not(:disabled) {
  background: rgba(0,0,0,0.12);
}

.param-card-weight-pm button:active:not(:disabled) {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

.param-card-weight-pm button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.param-card-weight-badge {
  min-width: 44px;
  height: 32px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.08);
  color: var(--text);
}

/* === Тип параметра (pills) === */
.param-card-type-row {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
}

.param-card-type-pill {
  padding: 6px 16px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.param-card-type-pill:hover:not(.active) {
  background: rgba(0,0,0,0.1);
}

.param-card-type-pill.active {
  background: var(--text);
  color: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* === Секции === */
.param-card-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--divider);
}

.param-card-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.param-card-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.param-card-section-actions {
  display: flex;
  gap: 6px;
}

.param-card-btn-outline {
  padding: 5px 12px;
  border-radius: 16px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1.5px solid rgba(0,0,0,0.12);
  color: var(--text);
  background: transparent;
  transition: all 0.15s ease;
}

.param-card-btn-outline:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.2);
}

.param-card-btn-outline:active {
  transform: scale(0.96);
}

/* === Критерии (пустое состояние) === */
.param-criteria-empty {
  padding: 16px 0;
  color: var(--text-muted);
}
.param-criteria-empty-hint {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}
.param-criteria-empty-why {
  margin: 0 0 10px 0;
  font-size: 13px;
  line-height: 1.4;
}
.param-criteria-empty-examples {
  margin: 0;
  font-size: 12px;
  opacity: 0.9;
  line-height: 1.4;
}

/* === Список критериев === */
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
  --n-color: #D3D4D1 !important;
  --n-color-focus: #D3D4D1 !important;
  --n-color-disabled: #D3D4D1 !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-padding-left: 0 !important;
}

.param-criterion-input :deep(.n-input) {
  --n-color: #D3D4D1 !important;
  --n-color-focus: #D3D4D1 !important;
  --n-color-disabled: #D3D4D1 !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-padding-left: 0 !important;
  border-radius: 10px !important;
}

.param-criterion-input :deep(.n-input-number-button) {
  background: #D3D4D1 !important;
}

.param-criterion-input :deep(.n-input-number-button__content) {
  background: #D3D4D1 !important;
}

/* === Кнопки ± значений критериев === */
.param-criterion-pm {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.param-criterion-pm button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-family: inherit;
  font-size: 18px;
  font-weight: 300;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.param-criterion-pm button:hover {
  background: rgba(0,0,0,0.12);
}

.param-criterion-pm button:active {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

/* === Кнопки оценок (desktop) === */
.param-criterion-scores {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.param-criterion-scores-mobile {
  display: none;
  flex-shrink: 0;
  align-items: center;
  gap: 0;
}

.param-criterion-score-pill {
  width: 28px;
  height: 32px;
  border: none;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  color: rgba(0,0,0,0.45);
  background: rgba(0,0,0,0.04);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.param-criterion-score-pill--minus {
  border-radius: 8px 0 0 8px;
}

.param-criterion-score-pill--plus {
  border-radius: 0 8px 8px 0;
}

.param-criterion-score-pill:hover:not(:disabled) {
  background: rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.7);
}

.param-criterion-score-pill:active:not(:disabled) {
  background: rgba(0,0,0,0.16);
  transform: scale(0.95);
}

.param-criterion-score-pill:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.param-criterion-score-value {
  min-width: 36px;
  height: 32px;
  padding: 0 4px;
  border-radius: 0;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.95);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.param-criterion-score-value.score-0 { background: #cc0000; }
.param-criterion-score-value.score-1 { background: #e64d00; }
.param-criterion-score-value.score-2 { background: #ff7f00; }
.param-criterion-score-value.score-3 { background: #ff9900; }
.param-criterion-score-value.score-4 { background: #e6b300; }
.param-criterion-score-value.score-5 { background: #ccb300; }
.param-criterion-score-value.score-6 { background: #99a600; }
.param-criterion-score-value.score-7 { background: #66a600; }
.param-criterion-score-value.score-8 { background: #33a600; }
.param-criterion-score-value.score-9 { background: #1a8c00; }
.param-criterion-score-value.score-10 { background: #006600; }

@media (max-width: 768px) {
  .param-criterion-scores--desktop {
    display: none !important;
  }
  .param-criterion-scores-mobile {
    display: flex;
  }
}

@media (min-width: 769px) {
  .param-criterion-scores-mobile {
    display: none !important;
  }
}

.param-criterion-remove {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(192,57,43,0.1);
  color: #c0392b;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.param-criterion-remove:hover {
  background: rgba(192,57,43,0.2);
}

.param-criterion-remove:active {
  transform: scale(0.9);
}

/* === Кнопки оценок (desktop grid) === */
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
.param-score-btn:not(.active) { opacity: 0.5; }
.param-score-btn.active { opacity: 1; border-color: rgba(0, 0, 0, 0.3); color: #fff; }
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

/* === Варианты === */
.param-variants-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.param-variant-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
}
.param-variant-cell:last-child { border-bottom: none; }
.param-variant-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  flex-shrink: 1;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}
.param-variant-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.param-variant-pm {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.param-variant-pm button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-family: inherit;
  font-size: 18px;
  font-weight: 300;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.param-variant-pm button:hover {
  background: rgba(0,0,0,0.12);
}

.param-variant-pm button:active {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

.param-variant-input {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
  --n-color: #D3D4D1 !important;
  --n-color-focus: #D3D4D1 !important;
  --n-color-disabled: #D3D4D1 !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-padding-left: 0 !important;
}

.param-variant-input :deep(.n-input) {
  --n-color: #D3D4D1 !important;
  --n-color-focus: #D3D4D1 !important;
  --n-color-disabled: #D3D4D1 !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-padding-left: 0 !important;
}

.param-variant-input :deep(.n-input-number-button) {
  background: #D3D4D1 !important;
}

.param-variant-input :deep(.n-input-number-button__content) {
  background: #D3D4D1 !important;
}

.param-variant-badge {
  min-width: 44px;
  height: 32px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #333;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.param-variant-badge.score-badge-0 { background: rgba(204, 0, 0, 0.2); }
.param-variant-badge.score-badge-1 { background: rgba(230, 77, 0, 0.2); }
.param-variant-badge.score-badge-2 { background: rgba(255, 127, 0, 0.2); }
.param-variant-badge.score-badge-3 { background: rgba(255, 153, 0, 0.2); }
.param-variant-badge.score-badge-4 { background: rgba(230, 179, 0, 0.2); }
.param-variant-badge.score-badge-5 { background: rgba(204, 179, 0, 0.2); }
.param-variant-badge.score-badge-6 { background: rgba(153, 166, 0, 0.2); }
.param-variant-badge.score-badge-7 { background: rgba(102, 166, 0, 0.2); }
.param-variant-badge.score-badge-8 { background: rgba(51, 166, 0, 0.2); }
.param-variant-badge.score-badge-9 { background: rgba(26, 140, 0, 0.2); }
.param-variant-badge.score-badge-10 { background: rgba(0, 102, 0, 0.2); }

/* === Кнопки текстовых критериев (варианты) === */
.param-variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}
.param-criterion-btn {
  padding: 6px 14px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.param-criterion-btn:not(.active):hover {
  background: rgba(0,0,0,0.1);
}
.param-criterion-btn.active {
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transform: scale(1.02);
}
.param-criterion-btn.active.score-0 { background: #cc0000; }
.param-criterion-btn.active.score-1 { background: #e64d00; }
.param-criterion-btn.active.score-2 { background: #ff7f00; }
.param-criterion-btn.active.score-3 { background: #ff9900; }
.param-criterion-btn.active.score-4 { background: #e6b300; }
.param-criterion-btn.active.score-5 { background: #ccb300; }
.param-criterion-btn.active.score-6 { background: #99a600; }
.param-criterion-btn.active.score-7 { background: #66a600; }
.param-criterion-btn.active.score-8 { background: #33a600; }
.param-criterion-btn.active.score-9 { background: #1a8c00; }
.param-criterion-btn.active.score-10 { background: #006600; }

/* === Кнопки действий === */
.param-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--divider);
}

.param-card-actions-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn-delete {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(192,57,43,0.08);
  color: #c0392b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-delete:hover {
  background: rgba(192,57,43,0.16);
}

.btn-delete:active {
  transform: scale(0.92);
}

.btn-delete svg {
  width: 18px;
  height: 18px;
}

.btn-cancel {
  padding: 8px 20px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  border: 1.5px solid rgba(0,0,0,0.12);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.2);
}

.btn-cancel:active {
  transform: scale(0.96);
}

.btn-save {
  padding: 8px 24px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  border: none;
  background: var(--text);
  color: var(--card-bg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.88;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
}

.btn-save:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-save:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* === Модальное окно шаблонов === */
.param-templates-modal {
  padding: 20px;
  background: var(--card-bg, #D3D4D1);
  border-radius: 16px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(80,60,40,0.18);
}
.param-templates-modal-title {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 700;
}
.param-templates-type-row {
  margin-bottom: 12px;
}
.param-templates-search {
  margin-bottom: 12px;
}

.param-templates-search :deep(.n-input) {
  --n-color: rgba(255,255,255,0.25) !important;
  --n-color-focus: rgba(255,255,255,0.35) !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  border-radius: 12px !important;
}
.param-templates-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #666);
  font-size: 0.9rem;
}
.param-templates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.param-template-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px;
  min-width: 0;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  background: rgba(255,255,255,0.25);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}
.param-template-item:hover {
  background: rgba(255,255,255,0.45);
  transform: translateY(-1px);
}
.param-template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
.param-template-name {
  font-weight: 600;
  font-size: 0.95rem;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.param-template-unit {
  font-size: 0.525rem;
  color: #555;
  background: rgba(0,0,0,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.param-template-count {
  font-size: 0.525rem;
  color: var(--text, #333);
  background: rgba(0,0,0,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.param-template-criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  min-width: 0;
  font-size: 0.8rem;
  color: var(--text-muted, #666);
}
.param-template-criterion {
  padding: 2px 6px;
  border-radius: 4px;
}
.param-template-criterion.score-pale-0 { background: rgba(204, 0, 0, 0.25); }
.param-template-criterion.score-pale-1 { background: rgba(230, 77, 0, 0.25); }
.param-template-criterion.score-pale-2 { background: rgba(255, 127, 0, 0.25); }
.param-template-criterion.score-pale-3 { background: rgba(255, 153, 0, 0.25); }
.param-template-criterion.score-pale-4 { background: rgba(230, 179, 0, 0.25); }
.param-template-criterion.score-pale-5 { background: rgba(204, 179, 0, 0.25); }
.param-template-criterion.score-pale-6 { background: rgba(153, 166, 0, 0.25); }
.param-template-criterion.score-pale-7 { background: rgba(102, 166, 0, 0.25); }
.param-template-criterion.score-pale-8 { background: rgba(51, 166, 0, 0.25); }
.param-template-criterion.score-pale-9 { background: rgba(26, 140, 0, 0.25); }
.param-template-criterion.score-pale-10 { background: rgba(0, 102, 0, 0.25); }
.param-templates-modal-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
