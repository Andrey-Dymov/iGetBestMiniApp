import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Comparison, Variant, Parameter, Value } from '../types'
import { loadData, saveData } from '../composables/useStorage'
import { getSampleComparisons, SAMPLE_NAMES } from '../data/samples'

function generateId(): string {
  return crypto.randomUUID()
}

export const useComparisonsStore = defineStore('comparisons', () => {
  const comparisons = ref<Comparison[]>([])

  const sortedComparisons = computed(() =>
    [...comparisons.value].sort(
      (a, b) => new Date(b.modifiedDate).getTime() - new Date(a.modifiedDate).getTime()
    )
  )

  async function load() {
    const data = await loadData()
    comparisons.value = (data.comparisons as Comparison[]) ?? []
  }

  async function save() {
    await saveData({
      schemaVersion: 1,
      comparisons: comparisons.value,
    })
  }

  function createComparison(name: string, description?: string): Comparison {
    const c: Comparison = {
      id: generateId(),
      name,
      description,
      modifiedDate: new Date().toISOString(),
      variants: [],
      parameters: [],
      values: [],
    }
    comparisons.value.push(c)
    save()
    return c
  }

  function getComparison(id: string): Comparison | undefined {
    return comparisons.value.find((c) => c.id === id)
  }

  function updateComparison(id: string, updates: Partial<Pick<Comparison, 'name' | 'description'>>) {
    const c = getComparison(id)
    if (!c) return
    Object.assign(c, updates, { modifiedDate: new Date().toISOString() })
    save()
  }

  function deleteComparison(id: string) {
    comparisons.value = comparisons.value.filter((c) => c.id !== id)
    save()
  }

  function addVariant(comparisonId: string, name: string): Variant {
    const c = getComparison(comparisonId)
    if (!c) throw new Error('Comparison not found')
    const num = c.variants.length + 1
    const v: Variant = {
      id: generateId(),
      name,
      number: num,
      totalScore: 0,
      position: 0,
    }
    c.variants.push(v)
    c.modifiedDate = new Date().toISOString()
    save()
    return v
  }

  function addParameter(comparisonId: string, name: string, weight: number, parameterType: 'number' | 'text' = 'number'): Parameter {
    const c = getComparison(comparisonId)
    if (!c) throw new Error('Comparison not found')
    const num = c.parameters.length + 1
    const p: Parameter = {
      id: generateId(),
      name,
      number: num,
      weight,
      parameterType,
      criteria: [],
    }
    c.parameters.push(p)
    c.modifiedDate = new Date().toISOString()
    save()
    return p
  }

  function addValue(comparisonId: string, variantId: string, parameterId: string, textValue?: string, numericValue?: number, score?: number): Value {
    const c = getComparison(comparisonId)
    if (!c) throw new Error('Comparison not found')
    const val: Value = {
      id: generateId(),
      variantId,
      parameterId,
      textValue,
      numericValue,
      score: score ?? 0,
    }
    c.values.push(val)
    c.modifiedDate = new Date().toISOString()
    save()
    return val
  }

  function setOrUpdateValue(comparisonId: string, variantId: string, parameterId: string, textValue?: string, numericValue?: number, score?: number) {
    const c = getComparison(comparisonId)
    if (!c) return
    const existing = c.values.find((v) => v.variantId === variantId && v.parameterId === parameterId)
    if (existing) {
      existing.textValue = textValue
      existing.numericValue = numericValue
      if (score !== undefined) existing.score = score
    } else {
      addValue(comparisonId, variantId, parameterId, textValue, numericValue, score)
    }
    c.modifiedDate = new Date().toISOString()
    save()
  }

  function addSampleData(): number {
    const samples = getSampleComparisons()
    const existingNames = new Set(comparisons.value.map((c) => c.name))
    let added = 0
    for (const sample of samples) {
      if (!existingNames.has(sample.name)) {
        comparisons.value.push(sample)
        existingNames.add(sample.name)
        added++
      }
    }
    if (added > 0) save()
    return added
  }

  function hasAllSamples(): boolean {
    const existingNames = new Set(comparisons.value.map((c) => c.name))
    return SAMPLE_NAMES.every((name) => existingNames.has(name))
  }

  return {
    comparisons,
    sortedComparisons,
    load,
    save,
    createComparison,
    getComparison,
    updateComparison,
    deleteComparison,
    addVariant,
    addParameter,
    addValue,
    setOrUpdateValue,
    addSampleData,
    hasAllSamples,
  }
})
