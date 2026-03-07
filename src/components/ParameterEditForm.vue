<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NSpace,
  NRadioGroup,
  NRadioButton,
} from 'naive-ui'
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

export interface ParameterFormData {
  name: string
  unit: string
  parameterType: 'number' | 'text'
  weight: number
  criteria: Criterion[]
  variantValues: Record<string, string | number | undefined>
}

const name = ref('')
const unit = ref('')
const paramType = ref<'number' | 'text'>('number')
const weight = ref(5)
const criteria = ref<Criterion[]>([])
const variantValues = ref<Record<string, string | number | undefined>>({})

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
}

function updateCriterion(cr: Criterion, updates: Partial<Criterion>) {
  Object.assign(cr, updates)
  if (updates.name !== undefined) {
    cr.textValue = String(updates.name)
    if (paramType.value === 'number') cr.numericValue = Number(updates.name)
  }
}

function removeCriterion(cr: Criterion) {
  criteria.value = criteria.value.filter((c) => c.id !== cr.id)
}

function moveCriterion(from: number, to: number) {
  const arr = [...sortedCriteria.value]
  const [removed] = arr.splice(from, 1)
  arr.splice(to, 0, removed!)
  criteria.value = arr
}

function getScoreForValue(val: string | number | undefined): number {
  if (val === undefined || val === '') return 0
  return findScoreFromCriteria(criteria.value, val, paramType.value)
}

const sortedCriteria = computed(() => {
  const arr = [...criteria.value]
  if (paramType.value === 'number') {
    return arr.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
  }
  return arr.sort((a, b) => a.score - b.score)
})

watch(
  () => props.parameter,
  (p) => {
    if (p) {
      name.value = p.name
      unit.value = p.unit ?? ''
      paramType.value = p.parameterType
      weight.value = p.weight
      criteria.value = (p.criteria ?? []).map((c) => ({ ...c, id: c.id || id() }))
      const vals: Record<string, string | number | undefined> = {}
      for (const v of props.variants) {
        const val = props.getValue(v.id, p.id)
        vals[v.id] = val?.numericValue ?? val?.textValue
      }
      variantValues.value = vals
    } else {
      name.value = ''
      unit.value = ''
      paramType.value = 'number'
      weight.value = 5
      criteria.value = []
      variantValues.value = {}
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
        vals[v.id] = val?.numericValue ?? val?.textValue
      }
    }
    variantValues.value = vals
  },
  { immediate: true }
)

function save() {
  emit('save', {
    name: name.value.trim(),
    unit: unit.value.trim(),
    parameterType: paramType.value,
    weight: weight.value,
    criteria: criteria.value,
    variantValues: { ...variantValues.value },
  })
}

function cancel() {
  emit('cancel')
}
</script>

<template>
  <NForm label-placement="top" class="param-form">
    <h4 class="param-form-section">{{ t('paramForm.basicInfo') }}</h4>
    <NFormItem :label="t('comparisons.name')">
      <NInput v-model:value="name" :placeholder="t('results.paramNamePlaceholder')" />
    </NFormItem>
    <NFormItem :label="t('paramForm.unit')">
      <NInput v-model:value="unit" :placeholder="t('paramForm.unitPlaceholder')" />
    </NFormItem>
    <NFormItem :label="t('results.weight')">
      <NSpace align="center">
        <NButton size="small" :disabled="weight <= 1" @click="weight = Math.max(1, weight - 1)">−</NButton>
        <span class="param-weight-value">{{ weight }}</span>
        <NButton size="small" :disabled="weight >= 10" @click="weight = Math.min(10, weight + 1)">+</NButton>
      </NSpace>
    </NFormItem>
    <NFormItem>
      <NRadioGroup v-model:value="paramType">
        <NRadioButton value="number">{{ t('results.paramTypeNumber') }}</NRadioButton>
        <NRadioButton value="text">{{ t('results.paramTypeText') }}</NRadioButton>
      </NRadioGroup>
    </NFormItem>

    <h4 class="param-form-section">{{ t('paramForm.criteria') }}</h4>
    <div v-if="criteria.length === 0" class="param-templates">
      <span class="param-templates-label">{{ t('paramForm.template') }}:</span>
      <NButton size="small" @click="applyTemplate('scale10')">{{ t('paramForm.template10') }}</NButton>
      <NButton size="small" @click="applyTemplate('scale100')">{{ t('paramForm.template100') }}</NButton>
      <NButton size="small" @click="applyTemplate('yesNo')">{{ t('paramForm.templateYesNo') }}</NButton>
      <NButton size="small" type="primary" @click="addCriterion">{{ t('paramForm.addCriterion') }}</NButton>
    </div>
    <div v-else class="param-criteria-list">
      <div v-for="cr in sortedCriteria" :key="cr.id" class="param-criterion-row">
        <NInput
          v-model:value="cr.name"
          size="small"
          :placeholder="t('paramForm.criterionName')"
          class="param-criterion-input"
          @update:value="(v) => updateCriterion(cr, { name: v })"
        />
        <div class="param-criterion-scores">
          <button
            v-for="s in 11"
            :key="s - 1"
            type="button"
            class="param-score-btn"
            :class="{ active: cr.score === s - 1 }"
            @click="updateCriterion(cr, { score: s - 1 })"
          >
            {{ s - 1 }}
          </button>
        </div>
        <NButton size="small" quaternary type="error" @click="removeCriterion(cr)">×</NButton>
      </div>
      <NSpace>
        <NButton size="small" @click="addCriterion">{{ t('paramForm.addCriterion') }}</NButton>
        <NButton
          v-if="sortedCriteria.length > 1"
          size="small"
          quaternary
          @click="moveCriterion(0, sortedCriteria.length - 1)"
        >
          ↑↓
        </NButton>
      </NSpace>
    </div>

    <template v-if="parameter && variants.length > 0">
      <h4 class="param-form-section">{{ t('paramForm.variants') }}</h4>
      <div class="param-variants-grid">
        <div v-for="v in variants" :key="v.id" class="param-variant-cell">
          <span class="param-variant-label">{{ v.name }}</span>
          <template v-if="paramType === 'number'">
            <NInputNumber
              :model-value="typeof variantValues[v.id] === 'number' ? variantValues[v.id] : undefined"
              size="small"
              :placeholder="t('paramForm.value')"
              clearable
              class="param-variant-input"
              @update:model-value="(val: number | null) => { variantValues[v.id] = val ?? undefined }"
            />
            <span v-if="variantValues[v.id] != null" class="param-variant-badge">
              {{ getScoreForValue(variantValues[v.id]) }}
            </span>
          </template>
          <template v-else>
            <div v-if="sortedCriteria.length" class="param-variant-buttons">
              <button
                v-for="cr in sortedCriteria"
                :key="cr.id"
                type="button"
                class="param-criterion-btn"
                :class="{ active: String(variantValues[v.id]).toLowerCase() === String(cr.textValue).toLowerCase() }"
                @click="variantValues[v.id] = cr.textValue"
              >
                {{ cr.name }}
              </button>
            </div>
            <NInput
              v-else
              :model-value="typeof variantValues[v.id] === 'string' ? variantValues[v.id] : ''"
              size="small"
              :placeholder="t('paramForm.value')"
              class="param-variant-input"
              @update:model-value="(val: string) => { variantValues[v.id] = val || undefined }"
            />
          </template>
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
.param-form-section {
  margin: 16px 0 8px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #666);
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
.param-criterion-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.param-criterion-input {
  flex: 1;
  min-width: 80px;
}
.param-criterion-scores {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
.param-score-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--tg-theme-hint-color, #ccc);
  border-radius: 6px;
  background: var(--tg-theme-bg-color, #fff);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
}
.param-score-btn.active {
  background: var(--tg-theme-button-color, #18a058);
  color: var(--tg-theme-button-text-color, #fff);
  border-color: transparent;
}
.param-variants-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.param-variant-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.param-variant-label {
  font-size: 0.85rem;
  font-weight: 600;
}
.param-variant-input {
  max-width: 140px;
}
.param-variant-badge {
  font-size: 0.8rem;
  color: var(--tg-theme-hint-color, #666);
}
.param-variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.param-criterion-btn {
  padding: 6px 12px;
  border: 1px solid var(--tg-theme-hint-color, #ccc);
  border-radius: 8px;
  background: var(--tg-theme-bg-color, #fff);
  font-size: 0.85rem;
  cursor: pointer;
}
.param-criterion-btn.active {
  background: var(--tg-theme-button-color, #18a058);
  color: var(--tg-theme-button-text-color, #fff);
  border-color: transparent;
}
.param-form-actions {
  margin-top: 20px;
}
</style>
