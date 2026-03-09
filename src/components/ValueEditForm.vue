<script setup lang="ts">
import { ref, watch } from 'vue'
import { NInput, NInputNumber } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { findScoreFromCriteria } from '../utils/importExport'
import type { Variant, Parameter, Value } from '../types'

const props = defineProps<{
  variant: Variant
  parameter: Parameter
  existingValue: Value | undefined
}>()

const emit = defineEmits<{
  save: [data: { textValue?: string; numericValue?: number }]
  cancel: []
}>()

const { t } = useI18n()

const numericValue = ref<number | null>(null)
const textValue = ref('')

watch(
  () => props.existingValue,
  (val) => {
    if (val) {
      if (val.numericValue != null) {
        numericValue.value = val.numericValue
      } else {
        numericValue.value = null
      }
      textValue.value = val.textValue ?? ''
    } else {
      numericValue.value = null
      textValue.value = ''
    }
  },
  { immediate: true }
)

function getSortedCriteria() {
  const arr = [...(props.parameter.criteria ?? [])]
  return props.parameter.parameterType === 'number'
    ? arr.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
    : arr.sort((a, b) => a.score - b.score)
}

function formatNumber(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return ''
  return Number.isInteger(v) ? String(v) : String(v)
}

function getScore(): number {
  if (props.parameter.parameterType === 'number') {
    return findScoreFromCriteria(props.parameter.criteria ?? [], numericValue.value ?? 0, 'number')
  }
  return findScoreFromCriteria(props.parameter.criteria ?? [], textValue.value, 'text')
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

function incNumeric(direction: number) {
  const cur = numericValue.value ?? 0
  const isDecrease = (direction < 0 && cur >= 0) || (direction > 0 && cur < 0)
  const step = getSmartStep(cur, isDecrease)
  numericValue.value = cur + direction * step
}

function save() {
  if (props.parameter.parameterType === 'number') {
    emit('save', {
      numericValue: numericValue.value != null && Number.isFinite(numericValue.value) ? numericValue.value : undefined,
    })
  } else {
    emit('save', { textValue: textValue.value.trim() || undefined })
  }
}

function cancel() {
  emit('cancel')
}

function onCriterionClick(cr: { textValue: string }) {
  textValue.value = cr.textValue
  emit('save', { textValue: cr.textValue })
}

const criteria = () => getSortedCriteria()
</script>

<template>
  <div class="value-edit-card">
    <div class="value-edit-header">
      <span class="value-edit-variant-name">{{ variant.name }}</span>
      <h4 class="value-edit-param-name">{{ parameter.name }}</h4>
      <span v-if="parameter.unit" class="value-edit-unit">{{ parameter.unit }}</span>
    </div>

    <div class="value-edit-body">
      <template v-if="parameter.parameterType === 'number'">
        <div class="value-edit-row">
          <div class="value-edit-controls">
            <NInputNumber
              v-model:value="numericValue"
              size="small"
              :placeholder="t('paramForm.valueNumber')"
              :format="formatNumber"
              :show-button="false"
              clearable
              class="value-edit-input"
              @keyup.enter="save"
            />
            <div class="value-edit-pm">
              <button type="button" @click="incNumeric(-1)">−</button>
              <button type="button" @click="incNumeric(1)">+</button>
            </div>
            <span
              v-if="numericValue != null && Number.isFinite(numericValue)"
              class="value-edit-badge"
              :class="'sb-' + Math.min(10, Math.floor(getScore()))"
            >
              {{ (Math.round(getScore() * 10) / 10).toFixed(1) }}
            </span>
            <span v-else class="value-edit-badge sb-empty">—</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-if="criteria().length" class="value-edit-criteria">
          <div class="value-edit-pills">
            <button
              v-for="cr in criteria()"
              :key="cr.id"
              type="button"
              class="value-edit-pill"
              :class="['pill-' + Math.min(10, Math.floor(cr.score)), { active: String(textValue).toLowerCase() === String(cr.textValue).toLowerCase() }]"
              @click="onCriterionClick(cr)"
            >
              {{ cr.name || cr.textValue }}
            </button>
          </div>
        </div>
        <div v-else class="value-edit-row">
          <NInput
            v-model:value="textValue"
            size="small"
            :placeholder="t('paramForm.value')"
            class="value-edit-input"
            @keyup.enter="save"
          />
        </div>
      </template>
    </div>

    <div class="value-edit-actions">
      <button type="button" class="btn-cancel" @click="cancel">{{ t('common.cancel') }}</button>
      <button
        v-if="parameter.parameterType === 'number' || !criteria().length"
        type="button"
        class="btn-save"
        @click="save"
      >
        {{ t('common.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.value-edit-card {
  --card-bg: #FFFFFF;
  --card-radius: 20px;
  --accent: #2d9d5c;
  --text: var(--tg-theme-text-color, #1a1a1a);
  --text-muted: #8a8580;
  --divider: rgba(0,0,0,0.06);
  background: var(--card-bg);
  border-radius: var(--card-radius);
  box-shadow: 0 20px 60px rgba(80,60,40,0.18), 0 2px 6px rgba(80,60,40,0.08);
  padding: 20px;
}

.value-edit-header {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--divider);
}

.value-edit-variant-name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.value-edit-param-name {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.value-edit-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
}

.value-edit-body {
  margin-bottom: 18px;
}

.value-edit-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.value-edit-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.value-edit-input {
  width: 120px;
  flex-shrink: 0;
  --n-color: #FFFFFF !important;
  --n-color-focus: #FFFFFF !important;
  --n-color-disabled: #FFFFFF !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
}

.value-edit-input :deep(.n-input) {
  --n-color: #FFFFFF !important;
  --n-color-focus: #FFFFFF !important;
  --n-color-disabled: #FFFFFF !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
}

.value-edit-input :deep(.n-input-number-button) {
  background: #FFFFFF !important;
}

.value-edit-input :deep(.n-input-number-button__content) {
  background: #FFFFFF !important;
}

.value-edit-pm {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.value-edit-pm button {
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

.value-edit-pm button:hover {
  background: rgba(0,0,0,0.12);
}

.value-edit-pm button:active {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

.value-edit-badge {
  min-width: 44px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  padding: 0 6px;
}

.value-edit-badge.sb-empty {
  background: rgba(0,0,0,0.05);
  color: #aaa;
}
.value-edit-badge.sb-0  { background: rgba(204,0,0,0.2);   color: #333; }
.value-edit-badge.sb-1  { background: rgba(230,77,0,0.2);  color: #333; }
.value-edit-badge.sb-2  { background: rgba(255,127,0,0.2); color: #333; }
.value-edit-badge.sb-3  { background: rgba(255,153,0,0.2); color: #333; }
.value-edit-badge.sb-4  { background: rgba(230,179,0,0.2); color: #333; }
.value-edit-badge.sb-5  { background: rgba(204,179,0,0.2); color: #333; }
.value-edit-badge.sb-6  { background: rgba(153,166,0,0.2); color: #333; }
.value-edit-badge.sb-7  { background: rgba(102,166,0,0.2); color: #333; }
.value-edit-badge.sb-8  { background: rgba(51,166,0,0.2);  color: #333; }
.value-edit-badge.sb-9  { background: rgba(26,140,0,0.2);  color: #333; }
.value-edit-badge.sb-10 { background: rgba(0,102,0,0.2);   color: #333; }

.value-edit-criteria {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.value-edit-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.value-edit-pill {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
}

.value-edit-pill:not(.active):hover {
  background: rgba(0,0,0,0.1);
}

.value-edit-pill.active {
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transform: scale(1.02);
}

.value-edit-pill.active.pill-0  { background: #cc0000; }
.value-edit-pill.active.pill-1  { background: #e64d00; }
.value-edit-pill.active.pill-2  { background: #ff7f00; }
.value-edit-pill.active.pill-3  { background: #ff9900; }
.value-edit-pill.active.pill-4  { background: #e6b300; }
.value-edit-pill.active.pill-5  { background: #ccb300; }
.value-edit-pill.active.pill-6  { background: #99a600; }
.value-edit-pill.active.pill-7  { background: #66a600; }
.value-edit-pill.active.pill-8  { background: #33a600; }
.value-edit-pill.active.pill-9  { background: #1a8c00; }
.value-edit-pill.active.pill-10 { background: #006600; }

.value-edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--divider);
}

.btn-cancel {
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  background: transparent;
  border: none;
  border-radius: 24px;
  padding: 12px 28px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  letter-spacing: 0.01em;
}

.btn-cancel:hover {
  background: rgba(0,0,0,0.06);
}

.btn-cancel:active {
  background: rgba(0,0,0,0.1);
}

.btn-save {
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 24px;
  padding: 12px 32px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
  letter-spacing: 0.01em;
}

.btn-save:hover {
  background: #259b50;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(45,157,92,0.35);
}

.btn-save:active {
  transform: translateY(0);
  box-shadow: none;
}
</style>
