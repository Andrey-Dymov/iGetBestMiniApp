<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useComparisonsStore } from '../stores/comparisons'
import {
  NButton,
  NList,
  NListItem,
  NThing,
  NEmpty,
  NModal,
  NInput,
  NForm,
  NFormItem,
  NSpace,
  NIcon,
  NDropdown,
} from 'naive-ui'
import {
  EllipsisHorizontalOutline,
  DocumentTextOutline,
  DocumentOutline,
  CopyOutline,
  ShareSocialOutline,
  TrashOutline,
  AddCircleOutline,
  AddOutline,
} from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import type { Comparison } from '../types'
import { i18n, LOCALES } from '../i18n'
import { getSampleComparisons } from '../data/samples'
import type { DropdownOption } from 'naive-ui'

const router = useRouter()
const store = useComparisonsStore()
const { t, locale } = useI18n()
const message = useMessage()

const dateLocale = computed(() => {
  if (locale.value === 'ru') return 'ru-RU'
  if (locale.value === 'zh') return 'zh-CN'
  return 'en-GB'
})

const localeOptions = computed<DropdownOption[]>(() =>
  LOCALES.map((l) => ({ label: l.label, key: l.code }))
)

function setLocale(code: string) {
  locale.value = code as 'en' | 'ru' | 'zh'
  i18n.global.locale.value = code as 'en' | 'ru' | 'zh'
  try {
    localStorage.setItem('igetbest-locale', code)
  } catch {}
}
const showAddModal = ref(false)
const showImportCompactModal = ref(false)
const newName = ref('')
const importCompactText = ref('')

onMounted(async () => {
  await store.load()
})

function openAdd() {
  newName.value = ''
  showAddModal.value = true
}

function closeAdd() {
  showAddModal.value = false
}

function createAndOpen() {
  const name = newName.value.trim()
  if (!name) return
  const c = store.createComparison(name)
  closeAdd()
  router.push(`/comparisons/${c.id}`)
}

function openComparison(id: string) {
  router.push(`/comparisons/${id}`)
}

function deleteComparison(id: string, e?: Event) {
  e?.stopPropagation()
  if (confirm(t('comparisons.deleteConfirm'))) {
    store.deleteComparison(id)
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat(dateLocale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short'
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const month = get('month').replace(/\.$/, '')
  return `${get('day')} ${month} ${get('year')} ${get('weekday')}`.trim()
}

function sortedVariants(c: { variants: { id: string; name: string; totalScore: number; imageUrl?: string }[] }) {
  return [...c.variants].sort((a, b) => b.totalScore - a.totalScore)
}

function parameterNames(c: { parameters: { name: string; weight: number }[] }) {
  return [...c.parameters]
    .sort((a, b) => b.weight - a.weight)
    .map((p) => p.name)
    .join(' · ')
}

function hasAnyImages(c: Comparison): boolean {
  return c.variants.some((v) => v.imageUrl)
}

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as never) })
}

function getMenuOptions(): DropdownOption[] {
  return [
    { label: t('list.duplicate'), key: 'duplicate', icon: renderIcon(CopyOutline) },
    { label: t('list.exportJson'), key: 'exportJson', icon: renderIcon(DocumentTextOutline) },
    { label: t('list.exportCompact'), key: 'exportCompact', icon: renderIcon(DocumentOutline) },
    { label: t('list.share'), key: 'share', icon: renderIcon(ShareSocialOutline) },
    { type: 'divider' },
    { label: t('list.delete'), key: 'delete', icon: renderIcon(TrashOutline) },
  ]
}

const addMenuOptions = computed<DropdownOption[]>(() => {
  const samples = getSampleComparisons()
  const existingNames = new Set(store.comparisons.map((c) => c.name))
  return [
    { label: t('list.importJson'), key: 'importJson', icon: renderIcon(DocumentTextOutline) },
    { label: t('list.importCompact'), key: 'importCompact', icon: renderIcon(DocumentOutline) },
    {
      label: t('comparisons.addSamples'),
      key: 'addSamples',
      icon: renderIcon(AddCircleOutline),
      children: [
        { label: t('comparisons.addAllSamples'), key: 'addAllSamples' },
        { type: 'divider' as const },
        ...samples.map((s) => ({
          label: s.name,
          key: `sample:${s.name}`,
          disabled: existingNames.has(s.name),
        })),
      ],
    },
  ]
})

function handleAddMenuSelect(key: string) {
  if (key === 'importJson') importFromClipboardJson()
  else if (key === 'importCompact') showImportCompactModal.value = true
  else if (key === 'addAllSamples') addSamples()
  else if (key.startsWith('sample:')) addSingleSample(key.slice(7))
}

const emptyExamplesOptions = computed<DropdownOption[]>(() => {
  const addSamplesOpt = addMenuOptions.value.find((o) => o.key === 'addSamples')
  return (addSamplesOpt && 'children' in addSamplesOpt ? addSamplesOpt.children : []) ?? []
})

function handleMenuSelect(key: string, c: Comparison) {
  if (key === 'duplicate') {
    const created = store.duplicateComparison(c.id)
    if (created) {
      message.success(t('list.importSuccess', { name: created.name }))
      router.push(`/comparisons/${created.id}`)
    }
  } else if (key === 'exportJson') {
    const json = store.exportToJSON(c)
    navigator.clipboard.writeText(json).then(() => {
      message.success(t('list.exportSuccess', { name: c.name }))
    })
  } else if (key === 'exportCompact') {
    const text = store.exportToCompact(c)
    navigator.clipboard.writeText(text).then(() => {
      message.success(t('list.exportSuccess', { name: c.name }))
    })
  } else if (key === 'share') {
    const json = store.exportToJSON(c)
    if (navigator.share) {
      navigator.share({
        title: c.name,
        text: `Сравнение: ${c.name}`,
      }).catch(() => copyAndNotify(json, c))
    } else {
      copyAndNotify(json, c)
    }
  } else if (key === 'delete') {
    deleteComparison(c.id)
  }
}

function copyAndNotify(json: string, c: Comparison) {
  navigator.clipboard.writeText(json).then(() => {
    message.success(t('list.exportSuccess', { name: c.name }))
  })
}

async function importFromClipboardJson() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text?.trim()) {
      message.error(t('list.clipboardEmpty'))
      return
    }
    const c = store.importComparisonFromJSON(text)
    if (c) {
      message.success(t('list.importSuccess', { name: c.name }))
      router.push(`/comparisons/${c.id}`)
    } else {
      message.error(t('list.importError', { msg: 'Неверный JSON' }))
    }
  } catch {
    message.error(t('list.importError', { msg: 'Нет доступа к буферу' }))
  }
}

function importFromCompact() {
  const text = importCompactText.value.trim()
  if (!text) return
  const c = store.importComparisonFromCompact(text)
  if (c) {
    message.success(t('list.importSuccess', { name: c.name }))
    showImportCompactModal.value = false
    importCompactText.value = ''
    router.push(`/comparisons/${c.id}`)
  } else {
    message.error(t('list.importError', { msg: 'Формат не распознан' }))
  }
}

function addSamples() {
  const added = store.addSampleData()
  if (added > 0) {
    message.success(t('comparisons.samplesAdded', { count: added }))
  } else {
    message.info(t('comparisons.samplesAlreadyExist'))
  }
}

function addSingleSample(name: string) {
  const c = store.addSingleSample(name)
  if (c) {
    message.success(t('list.importSuccess', { name }))
    router.push(`/comparisons/${c.id}`)
  } else {
    message.info(t('comparisons.samplesAlreadyExist'))
  }
}
</script>

<template>
  <div class="list">
    <div class="header">
      <div class="header-left">
        <NDropdown :options="localeOptions" trigger="click" @select="setLocale" placement="bottom-start">
          <NButton quaternary size="small" class="lang-btn">
            {{ LOCALES.find((l) => l.code === locale)?.label ?? 'EN' }}
          </NButton>
        </NDropdown>
      </div>
      <h1 class="list-title">{{ t('list.title') }}</h1>
      <div class="header-right">
        <NDropdown
          :options="addMenuOptions"
          trigger="click"
          placement="bottom-end"
          @select="handleAddMenuSelect"
        >
          <NButton quaternary circle size="small" :title="t('list.more')">
            <template #icon>
              <NIcon><EllipsisHorizontalOutline /></NIcon>
            </template>
          </NButton>
        </NDropdown>
        <button type="button" class="btn-add" @click="openAdd">
          <NIcon><AddOutline /></NIcon>
          {{ t('comparisons.add') }}
        </button>
      </div>
    </div>

    <NList v-if="store.sortedComparisons.length" :bordered="false" hoverable class="list-content">
      <NListItem
        v-for="c in store.sortedComparisons"
        :key="c.id"
        class="list-item"
        clickable
        @click="openComparison(c.id)"
      >
        <NThing>
          <template #header>
            <span class="title">{{ c.name }}</span>
          </template>
          <template #header-extra>
            <div class="header-extra">
              <span class="date">{{ formatDate(c.modifiedDate) }}</span>
              <NDropdown
                :options="getMenuOptions()"
                trigger="click"
                @select="(key: string) => handleMenuSelect(key, c)"
              >
                <NButton quaternary circle size="small" class="menu-btn" @click.stop>
                  <template #icon>
                    <NIcon><EllipsisHorizontalOutline /></NIcon>
                  </template>
                </NButton>
              </NDropdown>
            </div>
          </template>
          <template #description>
            <div v-if="c.variants.length || c.parameters.length" class="meta">
              <div v-if="c.parameters.length" class="meta-line">
                {{ parameterNames(c) }}
              </div>
              <div v-if="c.variants.length" class="meta-line variants-names">
                <span v-for="(v, i) in sortedVariants(c)" :key="v.id" class="variant-block">
                  <span class="variant-rank" :style="v.color ? { background: v.color, color: '#fff' } : {}">{{ i + 1 }}</span>
                  {{ v.name }}<span class="variant-score">{{ '\u00A0' }}–{{ '\u00A0' }}{{ Math.round(v.totalScore) }}</span>
                  <span v-if="i < sortedVariants(c).length - 1" class="variant-sep">|</span>
                </span>
              </div>
              <div v-if="hasAnyImages(c)" class="meta-line variant-images-row">
                <template v-for="v in sortedVariants(c)" :key="v.id">
                  <img
                    v-if="v.imageUrl"
                    :src="v.imageUrl"
                    :alt="v.name"
                    class="variant-thumb"
                    @error="($event.target as HTMLImageElement)?.style?.setProperty('display', 'none')"
                  />
                </template>
              </div>
            </div>
          </template>
        </NThing>
      </NListItem>
    </NList>

    <div v-else class="list-empty-wrap">
      <div class="list-empty-card">
        <div class="list-empty-icon">📊</div>
        <h2 class="list-empty-title">{{ t('comparisons.empty') }}</h2>
        <p class="list-empty-description">{{ t('list.emptyDescription') }}</p>
        <p class="list-empty-invite">{{ t('list.emptyInvite') }}</p>
        <div class="list-empty-actions">
          <div class="list-empty-section">
            <span class="list-empty-label">{{ t('list.emptyCreate') }}</span>
            <button type="button" class="list-empty-btn list-empty-btn-primary" @click="openAdd">
              {{ t('comparisons.add') }}
            </button>
          </div>
          <div class="list-empty-section">
            <span class="list-empty-label">{{ t('list.emptyImport') }}</span>
            <button type="button" class="list-empty-btn list-empty-btn-outline" @click="importFromClipboardJson">
              {{ t('list.importJson') }}
            </button>
            <button type="button" class="list-empty-btn list-empty-btn-outline" @click="showImportCompactModal = true">
              {{ t('list.importCompact') }}
            </button>
          </div>
          <div class="list-empty-section">
            <span class="list-empty-label">{{ t('list.emptyExamples') }}</span>
            <button type="button" class="list-empty-btn list-empty-btn-outline" @click="addSamples">
              {{ t('comparisons.addAllSamples') }}
            </button>
            <NDropdown
              :options="emptyExamplesOptions"
              trigger="click"
              placement="bottom-start"
              @select="handleAddMenuSelect"
            >
              <button type="button" class="list-empty-btn list-empty-btn-outline">
                {{ t('comparisons.addSamples') }} ›
              </button>
            </NDropdown>
          </div>
        </div>
      </div>
    </div>

    <p class="list-disclaimer">{{ t('list.disclaimer') }}</p>

    <NModal :show="showAddModal" @update:show="showAddModal = $event" @mask-click="closeAdd">
      <div class="modal-content">
        <h3>{{ t('comparisons.new') }}</h3>
        <NForm>
          <NFormItem :label="t('comparisons.name')">
            <NInput v-model:value="newName" :placeholder="t('comparisons.namePlaceholder')" @keyup.enter="createAndOpen" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="closeAdd">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!newName.trim()" @click="createAndOpen">
              {{ t('comparisons.create') }}
            </NButton>
          </NSpace>
        </NForm>
      </div>
    </NModal>

    <NModal :show="showImportCompactModal" @update:show="showImportCompactModal = $event">
      <div class="modal-content modal-import">
        <h3>{{ t('list.importCompact') }}</h3>
        <NForm>
          <NFormItem>
            <NInput
              v-model:value="importCompactText"
              type="textarea"
              :placeholder="t('list.compactPlaceholder')"
              :rows="8"
              class="import-textarea"
            />
          </NFormItem>
          <p class="compact-hint">{{ t('list.compactExample') }}</p>
          <NSpace justify="end">
            <NButton @click="showImportCompactModal = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :disabled="!importCompactText.trim()" @click="importFromCompact">
              {{ t('comparisons.create') }}
            </NButton>
          </NSpace>
        </NForm>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.list {
  padding: 24px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 12px;
}

.header-left,
.header-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.header-left {
  justify-content: flex-start;
}

.header-right {
  justify-content: flex-end;
  gap: 8px;
}

.btn-add {
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
  color: var(--tg-theme-text-color, #1a1a1a);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-add:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.2);
}

.btn-add .n-icon {
  font-size: 14px;
}

.list-title {
  margin: 0;
  padding: 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--tg-theme-text-color, #000);
  flex: 1;
  min-width: 0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-btn {
  min-width: 44px;
}

.list-item {
  cursor: pointer;
}


.date {
  font-size: 0.85em;
  color: var(--tg-theme-hint-color, #999);
}

.title {
  flex: 1;
  min-width: 0;
  font-weight: bold;
}

.header-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  flex-shrink: 0;
  margin-left: auto;
}

.meta {
  font-size: 0.9em;
  color: var(--tg-theme-hint-color, #999);
  line-height: 1.35;
  margin-top: -8px;
}

.meta-line {
  margin-top: 2px;
}

.meta-line:first-child {
  margin-top: 0;
}

.variants-names {
  font-weight: 600;
  color: var(--tg-theme-text-color, #000);
}

.variant-block {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.variant-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35em;
  height: 1.35em;
  margin-right: 6px;
  flex-shrink: 0;
  color: var(--tg-theme-hint-color, #666);
  background: #e0e0e0;
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: 600;
}

.variant-sep {
  margin: 0 6px;
  color: #ddd;
  font-weight: normal;
}

.variant-score {
  color: var(--tg-theme-hint-color, #999);
  font-weight: 600;
}

.list-disclaimer {
  margin: 24px 0 0 0;
  padding: 12px 0;
  font-size: 0.75rem;
  color: var(--tg-theme-hint-color, #888);
  text-align: center;
  line-height: 1.4;
}

.list-empty-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-empty-card {
  --card-bg: #FFFFFF;
  --text: var(--tg-theme-text-color, #1a1a1a);
  --text-muted: #8a8580;
  --divider: rgba(0,0,0,0.06);
  background: var(--card-bg);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(80,60,40,0.18), 0 2px 6px rgba(80,60,40,0.08);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.list-empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.7;
}

.list-empty-title {
  margin: 0 0 12px 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.list-empty-description {
  margin: 0 0 12px 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
  width: 100%;
  text-align: left;
}

.list-empty-invite {
  margin: 0 0 24px 0;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 600;
  width: 100%;
}

.list-empty-actions {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.list-empty-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.list-empty-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  align-self: flex-start;
}

.list-empty-btn {
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

.list-empty-btn-primary {
  background: #2d9d5c;
  color: #fff;
}

.list-empty-btn-primary:hover {
  background: #259b50;
  box-shadow: 0 4px 14px rgba(45,157,92,0.35);
}

.list-empty-btn-outline {
  background: transparent;
  color: var(--text);
  border: 1.5px solid rgba(0,0,0,0.12);
}

.list-empty-btn-outline:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.2);
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

.menu-btn {
  flex-shrink: 0;
}

.variant-images-row {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  overflow-x: auto;
}

.variant-thumb {
  height: 40px;
  width: auto;
  max-width: 80px;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
}

.modal-import {
  max-width: 480px;
}

.import-textarea {
  font-family: monospace;
  font-size: 0.9em;
}

.compact-hint {
  font-size: 0.85em;
  color: var(--tg-theme-hint-color, #999);
  white-space: pre-line;
  margin: 0 0 16px 0;
}
</style>
