<script setup lang="ts">
import { ref, watch } from 'vue'
import { NForm, NFormItem, NInput, NInputNumber, NButton, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { findScoreFromCriteria } from '../utils/importExport'
import type { Variant, Parameter, Value } from '../types'

interface VariantValue {
  textValue?: string
  numericValue?: number
}

const props = defineProps<{
  variant: Variant | null
  comparison: { parameters: Parameter[]; values: Value[] }
  getValue: (variantId: string, parameterId: string) => Value | undefined
}>()

const emit = defineEmits<{
  save: [data: { name: string; parameterValues: Record<string, VariantValue> }]
  cancel: []
  delete: []
}>()

const { t } = useI18n()

const name = ref('')
const parameterValues = ref<Record<string, VariantValue>>({})

watch(
  () => props.variant,
  (v) => {
    if (v) {
      name.value = v.name
      const vals: Record<string, VariantValue> = {}
      for (const p of props.comparison.parameters) {
        const val = props.getValue(v.id, p.id)
        vals[p.id] = { textValue: val?.textValue, numericValue: val?.numericValue }
      }
      parameterValues.value = vals
    } else {
      name.value = ''
      const vals: Record<string, VariantValue> = {}
      for (const p of props.comparison.parameters) {
        vals[p.id] = {}
      }
      parameterValues.value = vals
    }
  },
  { immediate: true }
)

watch(
  () => props.comparison.parameters,
  (params) => {
    const vals = { ...parameterValues.value }
    for (const p of params) {
      if (vals[p.id] === undefined) {
        const v = props.variant
        vals[p.id] = v ? { ...(props.getValue(v.id, p.id) ?? {}) } : {}
      }
    }
    parameterValues.value = vals
  },
  { immediate: true }
)


function getDisplayValue(pv: VariantValue | undefined, type: 'number' | 'text'): string | number | undefined {
  if (!pv) return undefined
  if (type === 'number') {
    if (pv.numericValue != null) return pv.numericValue
    if (pv.textValue && Number.isFinite(Number(pv.textValue))) return Number(pv.textValue)
    return undefined
  }
  return pv.textValue ?? (pv.numericValue != null ? String(pv.numericValue) : undefined)
}

function getScore(p: Parameter, pv: VariantValue | undefined): number {
  const val = getDisplayValue(pv, p.parameterType)
  return findScoreFromCriteria(p.criteria ?? [], val ?? '', p.parameterType)
}

function getSortedCriteria(p: Parameter) {
  const arr = [...(p.criteria ?? [])]
  return p.parameterType === 'number'
    ? arr.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
    : arr.sort((a, b) => a.score - b.score)
}

function formatNumber(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return ''
  return Number.isInteger(v) ? String(v) : String(v)
}

function save() {
  emit('save', { name: name.value.trim(), parameterValues: { ...parameterValues.value } })
}

function cancel() {
  emit('cancel')
}

function doDelete() {
  emit('delete')
}

const isEdit = () => props.variant != null
</script>

<template>
  <NForm label-placement="top" class="variant-form">
    <NFormItem :label="t('comparisons.name')">
      <NInput
        v-model:value="name"
        :placeholder="t('results.variantNamePlaceholder')"
        :input-props="{ autofocus: true }"
        @keyup.enter="save"
      />
    </NFormItem>

    <template v-if="comparison.parameters.length > 0">
      <div class="variant-form-block">
        <h4 class="variant-form-section-title">{{ t('paramForm.scoresVariants') }}</h4>
        <div v-for="p in comparison.parameters" :key="p.id" class="variant-param-row">
          <span class="variant-param-label">{{ p.name }}{{ p.unit ? ` (${p.unit})` : '' }}</span>
          <template v-if="p.parameterType === 'number'">
            <NInputNumber
              :value="typeof getDisplayValue(parameterValues[p.id], 'number') === 'number' ? getDisplayValue(parameterValues[p.id], 'number') as number : null"
              size="small"
              :placeholder="t('paramForm.value')"
              :format="formatNumber"
              clearable
              class="variant-param-input"
              @update:value="(v: number | null) => { parameterValues[p.id] = { ...(parameterValues[p.id] || {}), numericValue: v ?? undefined } }"
            />
            <span
              v-if="getDisplayValue(parameterValues[p.id], 'number') != null"
              class="variant-score-badge"
              :class="'score-badge-' + Math.min(10, Math.floor(getScore(p, parameterValues[p.id])))"
            >
              {{ (Math.round(getScore(p, parameterValues[p.id]) * 10) / 10).toFixed(1) }}
            </span>
          </template>
          <template v-else>
            <div v-if="getSortedCriteria(p).length" class="variant-criterion-buttons">
              <button
                v-for="cr in getSortedCriteria(p)"
                :key="cr.id"
                type="button"
                class="variant-criterion-btn"
                :class="['score-' + Math.min(10, Math.floor(cr.score)), { active: String(getDisplayValue(parameterValues[p.id], 'text')).toLowerCase() === String(cr.textValue).toLowerCase() }]"
                @click="parameterValues[p.id] = { ...(parameterValues[p.id] || {}), textValue: cr.textValue }"
              >
                {{ cr.name || cr.textValue }}
              </button>
            </div>
            <NInput
              v-else
              :value="String(getDisplayValue(parameterValues[p.id], 'text') ?? '')"
              size="small"
              :placeholder="t('paramForm.value')"
              class="variant-param-input"
              @update:value="(v: string) => { parameterValues[p.id] = { ...(parameterValues[p.id] || {}), textValue: v || undefined } }"
            />
            <span
              v-if="getDisplayValue(parameterValues[p.id], 'text') != null && getDisplayValue(parameterValues[p.id], 'text') !== ''"
              class="variant-score-badge"
              :class="'score-badge-' + Math.min(10, Math.floor(getScore(p, parameterValues[p.id])))"
            >
              {{ (Math.round(getScore(p, parameterValues[p.id]) * 10) / 10).toFixed(1) }}
            </span>
          </template>
        </div>
      </div>
    </template>

    <NSpace justify="space-between" class="variant-form-actions">
      <NButton v-if="isEdit()" type="error" quaternary @click="doDelete">{{ t('common.delete') }}</NButton>
      <div v-else />
      <NSpace>
        <NButton @click="cancel">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!name.trim()" @click="save">
          {{ isEdit() ? t('common.save') : t('comparisons.create') }}
        </NButton>
      </NSpace>
    </NSpace>
  </NForm>
</template>

<style scoped>
.variant-form {
  max-width: 100%;
}
.variant-form-block {
  margin-top: 20px;
}
.variant-form-section-title {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--tg-theme-text-color, #333);
}
.variant-param-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.variant-param-label {
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 100px;
  flex-shrink: 0;
}
.variant-param-input {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
}
.variant-score-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.variant-score-badge.score-badge-0 { background: rgba(204, 0, 0, 0.35); }
.variant-score-badge.score-badge-1 { background: rgba(230, 77, 0, 0.35); }
.variant-score-badge.score-badge-2 { background: rgba(255, 127, 0, 0.35); }
.variant-score-badge.score-badge-3 { background: rgba(255, 153, 0, 0.35); }
.variant-score-badge.score-badge-4 { background: rgba(230, 179, 0, 0.35); }
.variant-score-badge.score-badge-5 { background: rgba(204, 179, 0, 0.35); }
.variant-score-badge.score-badge-6 { background: rgba(153, 166, 0, 0.35); }
.variant-score-badge.score-badge-7 { background: rgba(102, 166, 0, 0.35); }
.variant-score-badge.score-badge-8 { background: rgba(51, 166, 0, 0.35); }
.variant-score-badge.score-badge-9 { background: rgba(26, 140, 0, 0.35); }
.variant-score-badge.score-badge-10 { background: rgba(0, 102, 0, 0.35); }
.variant-criterion-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.variant-criterion-btn {
  padding: 3px 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font-size: 0.42rem;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
}
.variant-criterion-btn:not(.active) { opacity: 0.5; }
.variant-criterion-btn.active {
  opacity: 1;
  border-color: rgba(0, 0, 0, 0.3);
  color: #fff;
}
.variant-criterion-btn.score-0 { background: #cc0000; }
.variant-criterion-btn.score-1 { background: #e64d00; }
.variant-criterion-btn.score-2 { background: #ff7f00; }
.variant-criterion-btn.score-3 { background: #ff9900; }
.variant-criterion-btn.score-4 { background: #e6b300; }
.variant-criterion-btn.score-5 { background: #ccb300; }
.variant-criterion-btn.score-6 { background: #99a600; }
.variant-criterion-btn.score-7 { background: #66a600; }
.variant-criterion-btn.score-8 { background: #33a600; }
.variant-criterion-btn.score-9 { background: #1a8c00; }
.variant-criterion-btn.score-10 { background: #006600; }
.variant-form-actions {
  margin-top: 20px;
  width: 100%;
}
</style>
