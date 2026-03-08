<script setup lang="ts">
import { ref, watch } from 'vue'
import { NForm, NFormItem, NInput, NInputNumber, NButton, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
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
  <div class="value-edit-form">
    <div class="value-edit-header">
      <h4 class="value-edit-param-name">{{ parameter.name }}</h4>
      <span v-if="parameter.unit" class="value-edit-unit">{{ parameter.unit }}</span>
    </div>

    <template v-if="parameter.parameterType === 'number'">
      <div class="value-edit-input-wrap">
        <NInputNumber
          v-model:value="numericValue"
          size="large"
          :placeholder="t('paramForm.valueNumber')"
          :format="formatNumber"
          clearable
          class="value-edit-input-number"
          @keyup.enter="save"
        />
      </div>
    </template>
    <template v-else>
      <div v-if="criteria().length" class="value-edit-criteria">
        <button
          v-for="cr in criteria()"
          :key="cr.id"
          type="button"
          class="value-edit-criterion-btn"
          :class="['score-' + Math.min(10, Math.floor(cr.score)), { active: String(textValue).toLowerCase() === String(cr.textValue).toLowerCase() }]"
          @click="onCriterionClick(cr)"
        >
          {{ cr.name || cr.textValue }}
        </button>
      </div>
      <NInput
        v-else
        v-model:value="textValue"
        size="large"
        :placeholder="t('paramForm.value')"
        class="value-edit-input-text"
        @keyup.enter="save"
      />
    </template>

    <NSpace justify="end" class="value-edit-actions">
      <NButton @click="cancel">{{ t('common.cancel') }}</NButton>
      <NButton
        v-if="parameter.parameterType === 'number' || !criteria().length"
        type="primary"
        @click="save"
      >
        {{ t('common.save') }}
      </NButton>
    </NSpace>
  </div>
</template>

<style scoped>
.value-edit-form {
  padding: 8px 0;
}
.value-edit-header {
  text-align: center;
  margin-bottom: 20px;
}
.value-edit-param-name {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}
.value-edit-unit {
  font-size: 0.85rem;
  color: var(--tg-theme-hint-color, #666);
}
.value-edit-input-wrap {
  margin-bottom: 20px;
}
.value-edit-input-number {
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
  display: block;
}
.value-edit-input-text {
  width: 100%;
  margin-bottom: 20px;
}
.value-edit-criteria {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.value-edit-criterion-btn {
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.95);
}
.value-edit-criterion-btn:not(.active) {
  opacity: 0.6;
}
.value-edit-criterion-btn.active {
  opacity: 1;
  border-color: rgba(0, 0, 0, 0.3);
  border-width: 2px;
}
.value-edit-criterion-btn.score-0 { background: #cc0000; }
.value-edit-criterion-btn.score-1 { background: #e64d00; }
.value-edit-criterion-btn.score-2 { background: #ff7f00; }
.value-edit-criterion-btn.score-3 { background: #ff9900; }
.value-edit-criterion-btn.score-4 { background: #e6b300; }
.value-edit-criterion-btn.score-5 { background: #ccb300; }
.value-edit-criterion-btn.score-6 { background: #99a600; }
.value-edit-criterion-btn.score-7 { background: #66a600; }
.value-edit-criterion-btn.score-8 { background: #33a600; }
.value-edit-criterion-btn.score-9 { background: #1a8c00; }
.value-edit-criterion-btn.score-10 { background: #006600; }
.value-edit-actions {
  margin-top: 16px;
}
</style>
