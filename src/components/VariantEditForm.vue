<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NInput, NInputNumber } from 'naive-ui'
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
  nextColor?: string
}>()

const emit = defineEmits<{
  save: [data: { name: string; parameterValues: Record<string, VariantValue>; imageUrl?: string }]
  cancel: []
  delete: []
}>()

const { t } = useI18n()

const name = ref('')
const parameterValues = ref<Record<string, VariantValue>>({})
const imageUrl = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const variantColor = computed(() => props.variant?.color ?? props.nextColor ?? '')

function triggerFilePick() {
  fileInputRef.value?.click()
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  try {
    const dataUrl = await fileToDataUrl(file)
    imageUrl.value = dataUrl
  } catch {
    // ignore
  }
  input.value = ''
}

/** Сжимает изображение и возвращает Data URL (max 400px, jpeg 0.8) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 400
      let w = img.width
      let h = img.height
      if (w > max || h > max) {
        if (w > h) {
          h = Math.round((h * max) / w)
          w = max
        } else {
          w = Math.round((w * max) / h)
          h = max
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Load failed'))
    }
    img.src = url
  })
}

watch(
  () => props.variant,
  (v) => {
    if (v) {
      name.value = v.name
      imageUrl.value = v.imageUrl ?? ''
      const vals: Record<string, VariantValue> = {}
      for (const p of props.comparison.parameters) {
        const val = props.getValue(v.id, p.id)
        vals[p.id] = { textValue: val?.textValue, numericValue: val?.numericValue }
      }
      parameterValues.value = vals
    } else {
      name.value = ''
      imageUrl.value = ''
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

function getSmartStep(value: number, isDecrease: boolean): number {
  const abs = Math.abs(value)
  if (abs < 10) return 1
  const digits = String(Math.floor(abs))
  const firstDigit = Number(digits[0])
  const magnitude = Math.pow(10, digits.length - 1)
  if (isDecrease) {
    if (firstDigit <= 2 && digits.length > 1) {
      return magnitude / 10
    }
    return magnitude
  }
  if (firstDigit === 1 && digits.length > 1) {
    return magnitude / 10
  }
  return magnitude
}

function incNumeric(pId: string, direction: number) {
  const pv = parameterValues.value[pId] ?? {}
  const cur = pv.numericValue ?? 0
  const isDecrease = (direction < 0 && cur >= 0) || (direction > 0 && cur < 0)
  const step = getSmartStep(cur, isDecrease)
  parameterValues.value[pId] = { ...pv, numericValue: cur + direction * step }
}

function save() {
  emit('save', {
    name: name.value.trim(),
    parameterValues: { ...parameterValues.value },
    imageUrl: imageUrl.value.trim() || undefined,
  })
}

function cancel() {
  emit('cancel')
}

function doDelete() {
  emit('delete')
}

function hasValue(p: Parameter): boolean {
  const pv = parameterValues.value[p.id]
  const val = getDisplayValue(pv, p.parameterType)
  return val != null && val !== ''
}

const isEdit = () => props.variant != null

function onHeroClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.variant-file-input-hidden') || target.closest('.hero-name-input-overlay')) return
  triggerFilePick()
}
</script>

<template>
  <div class="variant-card">
    <!-- Hero: изображение + поле имени на скриме -->
    <div class="variant-card-hero-wrap">
      <div class="variant-card-hero" @click="onHeroClick">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          alt=""
          class="variant-card-hero-img"
          @error="($event.target as HTMLImageElement)?.style?.setProperty('display', 'none')"
        />
        <div
          v-else
          class="variant-card-hero-placeholder"
          :style="variantColor ? { background: variantColor } : {}"
        ></div>
        <div class="variant-card-hero-scrim">
          <input
            v-model="name"
            type="text"
            class="hero-name-input-overlay"
            :placeholder="t('results.variantNamePlaceholder')"
            @keyup.enter="save"
            @click.stop
          />
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="variant-file-input-hidden"
          @change="onFilePicked"
        />
      </div>
      <button type="button" class="btn-photo-fab" @click.stop="triggerFilePick">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>

    <!-- URL изображения -->
    <div class="variant-card-image-url">
      <NInput
        v-model:value="imageUrl"
        :placeholder="t('variantForm.imageUrlPlaceholder')"
        size="small"
        class="variant-image-url-input"
      />
    </div>

    <!-- Оценки -->
    <div v-if="comparison.parameters.length > 0" class="variant-card-scores">
      <div v-for="p in comparison.parameters" :key="p.id" class="variant-score-row">
        <span class="variant-score-label">{{ p.name }}<span v-if="p.unit" class="variant-score-unit">, {{ p.unit }}</span></span>
        <template v-if="p.parameterType === 'number'">
          <div class="variant-numeric-controls">
            <NInputNumber
              :value="typeof getDisplayValue(parameterValues[p.id], 'number') === 'number' ? getDisplayValue(parameterValues[p.id], 'number') as number : null"
              size="small"
              :placeholder="t('paramForm.value')"
              :format="formatNumber"
              :show-button="false"
              clearable
              class="variant-score-input"
              @update:value="(v: number | null) => { parameterValues[p.id] = { ...(parameterValues[p.id] || {}), numericValue: v ?? undefined } }"
            />
            <div class="variant-score-pm">
              <button type="button" @click="incNumeric(p.id, -1)">−</button>
              <button type="button" @click="incNumeric(p.id, 1)">+</button>
            </div>
            <span
              v-if="hasValue(p)"
              class="variant-score-badge"
              :class="'sb-' + Math.min(10, Math.floor(getScore(p, parameterValues[p.id])))"
            >
              {{ (Math.round(getScore(p, parameterValues[p.id]) * 10) / 10).toFixed(1) }}
            </span>
            <span v-else class="variant-score-badge sb-empty">—</span>
          </div>
        </template>
        <template v-else>
          <div v-if="getSortedCriteria(p).length" class="variant-criterion-pills">
            <button
              v-for="cr in getSortedCriteria(p)"
              :key="cr.id"
              type="button"
              class="variant-criterion-pill"
              :class="['pill-' + Math.min(10, Math.floor(cr.score)), { active: String(getDisplayValue(parameterValues[p.id], 'text')).toLowerCase() === String(cr.textValue).toLowerCase() }]"
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
            class="variant-score-input"
            @update:value="(v: string) => { parameterValues[p.id] = { ...(parameterValues[p.id] || {}), textValue: v || undefined } }"
          />
          <span
            v-if="hasValue(p)"
            class="variant-score-badge"
            :class="'sb-' + Math.min(10, Math.floor(getScore(p, parameterValues[p.id])))"
          >
            {{ (Math.round(getScore(p, parameterValues[p.id]) * 10) / 10).toFixed(1) }}
          </span>
          <span v-else class="variant-score-badge sb-empty">—</span>
        </template>
      </div>
    </div>

    <!-- Кнопки действий -->
    <div class="variant-card-actions">
      <button v-if="isEdit()" type="button" class="btn-delete" @click="doDelete">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
      <div class="variant-card-actions-right">
        <button type="button" class="btn-cancel" @click="cancel">{{ t('common.cancel') }}</button>
        <button type="button" class="btn-save" :disabled="!name.trim()" @click="save">
          {{ isEdit() ? t('common.save') : t('comparisons.create') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.variant-card {
  --card-bg: #FFFFFF;
  --card-radius: 20px;
  --accent: #2d9d5c;
  --text: var(--tg-theme-text-color, #1a1a1a);
  --text-muted: #8a8580;
  --divider: rgba(0,0,0,0.06);
  max-width: 100%;
  background: var(--card-bg);
  border-radius: var(--card-radius);
  overflow: visible;
  box-shadow: 0 20px 60px rgba(80,60,40,0.18), 0 2px 6px rgba(80,60,40,0.08);
}

.variant-card-hero-wrap {
  position: relative;
}

.variant-card-hero {
  position: relative;
  width: 100%;
  height: 140px;
  background: linear-gradient(160deg, #d4ccc4 0%, #b8afa5 100%);
  overflow: hidden;
  cursor: pointer;
  border-radius: var(--card-radius) var(--card-radius) 0 0;
}

.variant-card-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.variant-card-hero-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255,255,255,0.7);
  gap: 10px;
}

.variant-card-hero-placeholder svg { opacity: 0.5; }
.variant-card-hero-placeholder span { font-size: 13px; }

.variant-card-hero-scrim {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 100px;
  background: linear-gradient(transparent, rgba(0,0,0,0.55));
  display: flex;
  align-items: flex-end;
  padding: 0 16px 14px;
  pointer-events: auto;
}

.hero-name-input-overlay {
  font-family: inherit;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,0.3);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding: 4px 0;
  caret-color: #fff;
}

.hero-name-input-overlay::placeholder {
  color: rgba(255,255,255,0.5);
}

.btn-photo-fab {
  position: absolute;
  right: 20px;
  bottom: -22px;
  z-index: 10;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #3478f6;
  border: 3px solid var(--card-bg);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(52,120,246,0.35);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-photo-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(52,120,246,0.45);
}

.btn-photo-fab svg {
  width: 20px;
  height: 20px;
}

.variant-card-image-url {
  padding: 0 20px;
  margin-top: 10px;
}

.variant-image-url-input {
  width: 100%;
  --n-color: transparent !important;
  --n-color-focus: transparent !important;
  --n-color-disabled: transparent !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-padding-left: 0 !important;
  --n-padding-right: 0 !important;
  --n-text-color: var(--text-muted) !important;
}

.variant-card-scores {
  padding: 6px 20px 0;
}

.variant-card-scores-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 14px 0 8px;
}

.variant-score-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px solid var(--divider);
  gap: 8px 10px;
}

.variant-score-row:last-child { border-bottom: none; }

.variant-score-label {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.variant-numeric-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.variant-score-unit {
  font-weight: 400;
  color: var(--text-muted);
}

.variant-score-input {
  width: 125px !important;
  flex-shrink: 0;
}

.variant-score-input :deep(.n-input) {
  --n-color: #FFFFFF !important;
  --n-color-focus: #FFFFFF !important;
  --n-color-disabled: #FFFFFF !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
}

.variant-score-input :deep(.n-input-number-button) {
  background: #FFFFFF !important;
}

.variant-score-input :deep(.n-input-number-button__content) {
  background: #FFFFFF !important;
}

.variant-score-pm {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.variant-score-pm button {
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

.variant-score-pm button:hover {
  background: rgba(0,0,0,0.12);
}

.variant-score-pm button:active {
  background: rgba(0,0,0,0.18);
  transform: scale(0.92);
}

.variant-criterion-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}

.variant-criterion-pill {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  color: var(--text);
  background: rgba(0,0,0,0.06);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  letter-spacing: 0.01em;
}

.variant-criterion-pill:not(.active):hover {
  background: rgba(0,0,0,0.1);
}

.variant-criterion-pill.active {
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transform: scale(1.02);
}

.variant-criterion-pill.active.pill-0  { background: #cc0000; }
.variant-criterion-pill.active.pill-1  { background: #e64d00; }
.variant-criterion-pill.active.pill-2  { background: #ff7f00; }
.variant-criterion-pill.active.pill-3  { background: #ff9900; }
.variant-criterion-pill.active.pill-4  { background: #e6b300; }
.variant-criterion-pill.active.pill-5  { background: #ccb300; }
.variant-criterion-pill.active.pill-6  { background: #99a600; }
.variant-criterion-pill.active.pill-7  { background: #66a600; }
.variant-criterion-pill.active.pill-8  { background: #33a600; }
.variant-criterion-pill.active.pill-9  { background: #1a8c00; }
.variant-criterion-pill.active.pill-10 { background: #006600; }

.variant-score-badge {
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
  letter-spacing: -0.02em;
  padding: 0 6px;
}

.variant-score-badge.sb-empty {
  background: rgba(0,0,0,0.05);
  color: #aaa;
}
.variant-score-badge.sb-0  { background: rgba(204,0,0,0.15);   color: #a30000; }
.variant-score-badge.sb-1  { background: rgba(230,77,0,0.15);  color: #b34000; }
.variant-score-badge.sb-2  { background: rgba(255,127,0,0.15); color: #c06000; }
.variant-score-badge.sb-3  { background: rgba(255,153,0,0.15); color: #b87400; }
.variant-score-badge.sb-4  { background: rgba(230,179,0,0.15); color: #a08200; }
.variant-score-badge.sb-5  { background: rgba(204,179,0,0.15); color: #8a7a00; }
.variant-score-badge.sb-6  { background: rgba(153,166,0,0.15); color: #6b7400; }
.variant-score-badge.sb-7  { background: rgba(102,166,0,0.15); color: #4a7400; }
.variant-score-badge.sb-8  { background: rgba(51,166,0,0.15);  color: #2a7400; }
.variant-score-badge.sb-9  { background: rgba(26,140,0,0.15);  color: #146300; }
.variant-score-badge.sb-10 { background: rgba(0,102,0,0.15);   color: #005200; }

.variant-card-actions {
  display: flex;
  align-items: center;
  padding: 14px 20px 18px;
  gap: 10px;
}

.btn-delete {
  color: #c0392b;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 4px;
  display: flex;
  align-items: center;
}

.variant-card-actions-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
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

.btn-save:hover:not(:disabled) {
  background: #259b50;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(45,157,92,0.35);
}

.btn-save:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

.btn-save:disabled {
  opacity: 0.4;
  cursor: default;
}

.variant-file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
