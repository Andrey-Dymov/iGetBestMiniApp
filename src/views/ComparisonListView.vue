<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useComparisonsStore } from '../stores/comparisons'
import { NButton, NList, NListItem, NThing, NEmpty, NModal, NInput, NForm, NFormItem, NSpace, NIcon } from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'

const router = useRouter()
const store = useComparisonsStore()
const { t, locale } = useI18n()
const message = useMessage()

const dateLocale = computed(() => (locale.value === 'ru' ? 'ru-RU' : 'en-GB'))
const showAddModal = ref(false)
const newName = ref('')

onMounted(async () => {
  await store.load()
})

function goBack() {
  router.push('/')
}

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

function deleteComparison(id: string, e: Event) {
  e.stopPropagation()
  if (confirm(t('comparisons.deleteConfirm'))) {
    store.deleteComparison(id)
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const isToday = dateStart === todayStart

  if (isToday) {
    return d.toLocaleTimeString(dateLocale.value, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(dateLocale.value, { day: 'numeric', month: 'short', year: '2-digit' })
}

function sortedVariants(c: { variants: { id: string; name: string; totalScore: number }[] }) {
  return [...c.variants].sort((a, b) => b.totalScore - a.totalScore)
}

function parameterNames(c: { parameters: { name: string }[] }) {
  return c.parameters.map((p) => p.name).join(', ')
}

function addSamples() {
  const added = store.addSampleData()
  if (added > 0) {
    message.success(t('comparisons.samplesAdded', { count: added }))
  } else {
    message.info(t('comparisons.samplesAlreadyExist'))
  }
}
</script>

<template>
  <div class="list">
    <div class="header">
      <NButton quaternary @click="goBack" class="back-btn">← {{ t('common.back') }}</NButton>
      <NSpace>
        <NButton secondary @click="addSamples" :disabled="store.hasAllSamples()">
          {{ t('comparisons.addSamples') }}
        </NButton>
        <NButton type="primary" @click="openAdd">{{ t('comparisons.add') }}</NButton>
      </NSpace>
    </div>

    <NList v-if="store.sortedComparisons.length" :bordered="false" hoverable>
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
              <NButton
                quaternary
                circle
                size="small"
                type="error"
                class="delete-btn"
                @click="deleteComparison(c.id, $event)"
              >
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
              </NButton>
            </div>
          </template>
          <template #description>
            <div v-if="c.variants.length || c.parameters.length" class="meta">
              <div v-if="c.variants.length" class="meta-line variants-names">
                <span v-for="(v, i) in sortedVariants(c)" :key="v.id" class="variant-item">
                  <span v-if="i > 0" class="variant-sep">|</span>
                  <span class="variant-rank">{{ i + 1 }}</span>
                  {{ v.name }}<span class="variant-score">{{ '\u00A0' }}–{{ '\u00A0' }}{{ Math.round(v.totalScore) }}</span>
                </span>
              </div>
              <div v-if="c.parameters.length" class="meta-line">
                {{ parameterNames(c) }}
              </div>
            </div>
          </template>
        </NThing>
      </NListItem>
    </NList>

    <NEmpty v-else :description="t('comparisons.empty')" class="empty" />

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
  </div>
</template>

<style scoped>
.list {
  padding: 24px;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.back-btn {
  margin-right: auto;
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
}

.meta-line {
  margin-top: 4px;
}

.meta-line:first-child {
  margin-top: 0;
}

.variants-names {
  font-weight: 600;
  color: var(--tg-theme-text-color, #000);
}

.variant-item {
  display: inline-flex;
  align-items: center;
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
  color: var(--tg-theme-hint-color, #999);
  font-weight: normal;
}

.variant-score {
  color: var(--tg-theme-hint-color, #999);
  font-weight: 600;
}

.empty {
  margin-top: 48px;
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
</style>
