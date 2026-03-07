import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Comparison, Variant, Parameter, Value, Criterion } from '../types'
import { loadData, saveData } from '../composables/useStorage'
import { getSampleComparisons, SAMPLE_NAMES } from '../data/samples'
import {
  recalculateTotalScores,
  exportToJSON,
  exportToCompact,
  parseCompactFormat,
  parsedToComparison,
  importFromJSON,
} from '../utils/importExport'

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

  function addParameter(
    comparisonId: string,
    name: string,
    weight: number,
    parameterType: 'number' | 'text' = 'number',
    unit?: string,
    criteria?: Criterion[]
  ): Parameter {
    const c = getComparison(comparisonId)
    if (!c) throw new Error('Comparison not found')
    const num = c.parameters.length + 1
    const criteriaWithIds = (criteria ?? []).map((cr) => ({ ...cr, id: cr.id || generateId() }))
    const p: Parameter = {
      id: generateId(),
      name,
      number: num,
      weight,
      parameterType,
      criteria: criteriaWithIds,
    }
    if (unit) p.unit = unit
    c.parameters.push(p)
    c.modifiedDate = new Date().toISOString()
    save()
    return p
  }

  function updateVariant(comparisonId: string, variantId: string, updates: Partial<Pick<Variant, 'name'>>) {
    const c = getComparison(comparisonId)
    const v = c?.variants.find((x) => x.id === variantId)
    if (!v) return
    Object.assign(v, updates)
    c!.modifiedDate = new Date().toISOString()
    save()
  }

  function deleteVariant(comparisonId: string, variantId: string) {
    const c = getComparison(comparisonId)
    if (!c) return
    c.variants = c.variants.filter((x) => x.id !== variantId)
    c.values = c.values.filter((x) => x.variantId !== variantId)
    c.modifiedDate = new Date().toISOString()
    save()
  }

  function updateParameter(
    comparisonId: string,
    parameterId: string,
    updates: Partial<Pick<Parameter, 'name' | 'weight' | 'unit' | 'parameterType' | 'criteria'>>
  ) {
    const c = getComparison(comparisonId)
    const p = c?.parameters.find((x) => x.id === parameterId)
    if (!p) return
    Object.assign(p, updates)
    c!.modifiedDate = new Date().toISOString()
    save()
  }

  function addCriterion(comparisonId: string, parameterId: string, criterion: Omit<Criterion, 'id'>) {
    const c = getComparison(comparisonId)
    const p = c?.parameters.find((x) => x.id === parameterId)
    if (!p) return null
    const cr = { ...criterion, id: generateId() }
    p.criteria = p.criteria ?? []
    p.criteria.push(cr)
    c!.modifiedDate = new Date().toISOString()
    save()
    return cr
  }

  function updateCriterion(
    comparisonId: string,
    parameterId: string,
    criterionId: string,
    updates: Partial<Pick<Criterion, 'name' | 'textValue' | 'numericValue' | 'score'>>
  ) {
    const c = getComparison(comparisonId)
    const p = c?.parameters.find((x) => x.id === parameterId)
    const cr = p?.criteria?.find((x) => x.id === criterionId)
    if (!cr) return
    Object.assign(cr, updates)
    c!.modifiedDate = new Date().toISOString()
    save()
  }

  function removeCriterion(comparisonId: string, parameterId: string, criterionId: string) {
    const c = getComparison(comparisonId)
    const p = c?.parameters.find((x) => x.id === parameterId)
    if (!p?.criteria) return
    p.criteria = p.criteria.filter((x) => x.id !== criterionId)
    c!.modifiedDate = new Date().toISOString()
    save()
  }

  function reorderCriteria(comparisonId: string, parameterId: string, criterionIds: string[]) {
    const c = getComparison(comparisonId)
    const p = c?.parameters.find((x) => x.id === parameterId)
    if (!p?.criteria?.length) return
    const byId = new Map(p.criteria.map((cr) => [cr.id, cr]))
    p.criteria = criterionIds.map((id) => byId.get(id)).filter(Boolean) as typeof p.criteria
    c!.modifiedDate = new Date().toISOString()
    save()
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

  function addSingleSample(name: string): Comparison | null {
    const existingNames = new Set(comparisons.value.map((c) => c.name))
    if (existingNames.has(name)) return null
    const sample = getSampleComparisons().find((s) => s.name === name)
    if (!sample) return null
    comparisons.value.push(sample)
    save()
    return sample
  }

  function hasAllSamples(): boolean {
    const existingNames = new Set(comparisons.value.map((c) => c.name))
    return SAMPLE_NAMES.every((name) => existingNames.has(name))
  }

  function generateUniqueName(baseName: string): string {
    const existing = new Set(comparisons.value.map((c) => c.name))
    if (!existing.has(baseName)) return baseName
    let i = 1
    while (existing.has(`${baseName} ${i}`)) i++
    return `${baseName} ${i}`
  }

  function duplicateComparison(id: string): Comparison | null {
    const orig = getComparison(id)
    if (!orig) return null
    const newName = generateUniqueName(orig.name)
    const c: Comparison = {
      id: generateId(),
      name: newName,
      description: orig.description,
      modifiedDate: new Date().toISOString(),
      variants: [],
      parameters: [],
      values: [],
    }
    const vIdMap = new Map<string, string>()
    const pIdMap = new Map<string, string>()
    for (const op of orig.parameters) {
      const np: Parameter = {
        id: generateId(),
        name: op.name,
        description: op.description,
        number: op.number,
        weight: op.weight,
        unit: op.unit,
        parameterType: op.parameterType,
        criteria: (op.criteria ?? []).map((oc) => ({
          id: generateId(),
          name: oc.name,
          textValue: oc.textValue,
          numericValue: oc.numericValue,
          score: oc.score,
        })),
      }
      c.parameters.push(np)
      pIdMap.set(op.id, np.id)
    }
    for (const ov of orig.variants) {
      const nv: Variant = {
        id: generateId(),
        name: ov.name,
        description: ov.description,
        number: ov.number,
        totalScore: ov.totalScore,
        position: ov.position,
        url: ov.url,
        imageUrls: ov.imageUrls ? [...ov.imageUrls] : undefined,
      }
      c.variants.push(nv)
      vIdMap.set(ov.id, nv.id)
    }
    for (const ov of orig.values) {
      const nvId = vIdMap.get(ov.variantId)
      const npId = pIdMap.get(ov.parameterId)
      if (nvId && npId) {
        c.values.push({
          id: generateId(),
          variantId: nvId,
          parameterId: npId,
          textValue: ov.textValue,
          numericValue: ov.numericValue,
          score: ov.score,
        })
      }
    }
    recalculateTotalScores(c)
    comparisons.value.push(c)
    save()
    return c
  }

  function importComparisonFromJSON(jsonStr: string): Comparison | null {
    const c = importFromJSON(jsonStr)
    if (!c) return null
    c.name = generateUniqueName(c.name)
    comparisons.value.push(c)
    save()
    return c
  }

  function importComparisonFromCompact(text: string): Comparison | null {
    const parsed = parseCompactFormat(text)
    if (!parsed.ok) return null
    const c = parsedToComparison(parsed.data)
    c.name = generateUniqueName(c.name)
    comparisons.value.push(c)
    save()
    return c
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
    updateVariant,
    deleteVariant,
    updateParameter,
    addValue,
    setOrUpdateValue,
    addCriterion,
    updateCriterion,
    removeCriterion,
    reorderCriteria,
    addSampleData,
    addSingleSample,
    hasAllSamples,
    duplicateComparison,
    importComparisonFromJSON,
    importComparisonFromCompact,
    exportToJSON,
    exportToCompact,
  }
})
