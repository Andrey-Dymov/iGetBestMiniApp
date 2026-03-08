<script setup lang="ts">
import { ref, watch, TransitionGroup, nextTick, computed } from 'vue'
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
  NModal,
  NScrollbar,
} from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
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

function getStaticTemplates(): CriteriaTemplate[] {
  if (paramType.value === 'number') {
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

function getDynamicTemplates(): CriteriaTemplate[] {
  const comps = props.allComparisons ?? []
  const type = paramType.value
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
  const dynamic = getDynamicTemplates()
  const static_ = getStaticTemplates()
  const seen = new Set<string>()
  const result: CriteriaTemplate[] = []
  for (const tpl of [...dynamic, ...static_]) {
    if (tpl.criteria.length === 0) continue
    const key = createCriteriaKey(tpl.criteria, paramType.value)
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
  if (!show) templateSearchQuery.value = ''
}

function applyTemplateFrom(template: CriteriaTemplate) {
  criteria.value = template.criteria.map((c) => ({
    id: id(),
    name: c.name,
    textValue: c.textValue ?? c.name,
    numericValue: c.numericValue,
    score: c.score,
  }))
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
        <NSpace>
          <NButton @click="showTemplatesModal = true">{{ t('paramForm.template') }}</NButton>
          <NButton @click="addCriterion">
            <template #icon>
              <NIcon><AddOutline /></NIcon>
            </template>
            {{ t('paramForm.criterionName') }}
          </NButton>
        </NSpace>
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

    <template v-if="variants.length > 0 && criteria.length > 0">
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

    <NSpace justify="space-between" class="param-form-actions">
      <NButton v-if="!isNew" type="error" quaternary @click="doDelete">{{ t('common.delete') }}</NButton>
      <div v-else />
      <NSpace>
        <NButton @click="cancel">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!name.trim()" @click="save">{{ isNew ? t('comparisons.create') : t('common.save') }}</NButton>
      </NSpace>
    </NSpace>
  </NForm>

  <NModal :show="showTemplatesModal" @update:show="onTemplatesModalUpdate">
    <div class="param-templates-modal">
      <h4 class="param-templates-modal-title">{{ t('paramForm.selectTemplate') }}</h4>
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
      <NSpace justify="end" class="param-templates-modal-actions">
        <NButton @click="showTemplatesModal = false">{{ t('common.cancel') }}</NButton>
      </NSpace>
    </div>
  </NModal>
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
.param-criteria-empty {
  padding: 20px 0;
  color: var(--tg-theme-hint-color, #666);
}
.param-criteria-empty-hint {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #666);
}
.param-criteria-empty-why {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  line-height: 1.4;
}
.param-criteria-empty-examples {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
  line-height: 1.4;
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
  width: 120px;
  min-width: 120px;
}
.param-variant-input {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
}
.param-variant-badge {
  font-size: 0.56rem;
  font-weight: 600;
  color: #333;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.param-variant-badge.score-badge-0 { background: rgba(204, 0, 0, 0.35); }
.param-variant-badge.score-badge-1 { background: rgba(230, 77, 0, 0.35); }
.param-variant-badge.score-badge-2 { background: rgba(255, 127, 0, 0.35); }
.param-variant-badge.score-badge-3 { background: rgba(255, 153, 0, 0.35); }
.param-variant-badge.score-badge-4 { background: rgba(230, 179, 0, 0.35); }
.param-variant-badge.score-badge-5 { background: rgba(204, 179, 0, 0.35); }
.param-variant-badge.score-badge-6 { background: rgba(153, 166, 0, 0.35); }
.param-variant-badge.score-badge-7 { background: rgba(102, 166, 0, 0.35); }
.param-variant-badge.score-badge-8 { background: rgba(51, 166, 0, 0.35); }
.param-variant-badge.score-badge-9 { background: rgba(26, 140, 0, 0.35); }
.param-variant-badge.score-badge-10 { background: rgba(0, 102, 0, 0.35); }
.param-variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: flex-start;
  flex: 1;
  min-width: 0;
}
.param-criterion-btn {
  padding: 4px 7px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 5px;
  font-size: 0.5rem;
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
.param-templates-modal {
  padding: 20px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  max-width: 90vw;
}
.param-templates-modal-title {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 700;
}
.param-templates-search {
  margin-bottom: 12px;
}
.param-templates-empty {
  padding: 24px;
  text-align: center;
  color: var(--tg-theme-hint-color, #666);
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
  border: 1px solid var(--tg-theme-hint-color, #ccc);
  border-radius: 8px;
  background: var(--tg-theme-bg-color, #fff);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}
.param-template-item:hover {
  background: rgba(128, 128, 128, 0.08);
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
  background: #bbb;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.param-template-count {
  font-size: 0.525rem;
  color: #fff;
  background: #999;
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
  color: var(--tg-theme-hint-color, #666);
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
}
</style>
