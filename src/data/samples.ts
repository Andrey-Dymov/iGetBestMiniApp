import type { Comparison, Variant, Parameter, Criterion, Value } from '../types'

function id() {
  return crypto.randomUUID()
}

function makeVariant(name: string, num: number): Variant {
  return { id: id(), name, number: num, totalScore: 0, position: 0 }
}

function makeParam(name: string, num: number, weight: number, type: 'number' | 'text', criteria: Criterion[]): Parameter {
  return { id: id(), name, number: num, weight, parameterType: type, criteria }
}

function makeCriterion(name: string, textValue: string, numericValue: number | undefined, score: number): Criterion {
  return { id: id(), name, textValue, numericValue, score }
}

function makeValue(variantId: string, parameterId: string, textValue?: string, numericValue?: number, score = 0): Value {
  return { id: id(), variantId, parameterId, textValue, numericValue, score }
}

function findScore(criteria: { value: string | number; score: number }[], val: string | number, type: 'number' | 'text'): number {
  if (type === 'text') {
    const c = criteria.find((x) => String(x.value).toLowerCase() === String(val).toLowerCase())
    return c?.score ?? 0
  }
  const num = Number(val)
  const exact = criteria.find((x) => Number(x.value) === num)
  if (exact) return exact.score
  const sorted = [...criteria].sort((a, b) => Number(a.value) - Number(b.value))
  if (num <= Number(sorted[0]?.value)) return sorted[0]?.score ?? 0
  if (num >= Number(sorted[sorted.length - 1]?.value)) return sorted[sorted.length - 1]?.score ?? 0
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]
    const next = sorted[i + 1]
    if (!curr || !next) continue
    const lo = Number(curr.value)
    const hi = Number(next.value)
    if (num >= lo && num <= hi) {
      const t = (num - lo) / (hi - lo)
      return curr.score + t * (next.score - curr.score)
    }
  }
  return sorted[0]?.score ?? 0
}

/** Создаёт тестовое сравнение. IDs генерируются при вызове. */
export function createSampleComparison(
  name: string,
  variants: string[],
  params: { name: string; weight: number; type: 'number' | 'text'; criteria: { name: string; value: string | number; score: number }[] }[],
  values: Record<string, Record<string, string | number>>
): Comparison {
  const vList = variants.map((n, i) => makeVariant(n, i + 1))
  const pList = params.map((p, i) => {
    const criteria = p.criteria.map((c) =>
      makeCriterion(c.name, String(c.value), typeof c.value === 'number' ? c.value : undefined, c.score)
    )
    return makeParam(p.name, i + 1, p.weight, p.type, criteria)
  })

  const valueList: Value[] = []
  for (const v of vList) {
    for (const p of pList) {
      const val = values[v.name]?.[p.name]
      if (val === undefined) continue
      const rawCriteria = params.find((x) => x.name === p.name)?.criteria ?? []
      const score = findScore(rawCriteria, val, p.parameterType)
      valueList.push(
        makeValue(
          v.id,
          p.id,
          typeof val === 'string' ? val : undefined,
          typeof val === 'number' ? val : Number(val),
          score
        )
      )
    }
  }

  // Пересчёт totalScore
  for (const v of vList) {
    let total = 0
    for (const val of valueList.filter((x) => x.variantId === v.id)) {
      const p = pList.find((x) => x.id === val.parameterId)
      if (p) total += val.score * p.weight
    }
    v.totalScore = total
  }
  const sorted = [...vList].sort((a, b) => b.totalScore - a.totalScore)
  sorted.forEach((v, i) => {
    v.position = i + 1
  })

  return {
    id: id(),
    name,
    modifiedDate: new Date().toISOString(),
    variants: vList,
    parameters: pList,
    values: valueList,
  }
}

export const SAMPLE_NAMES = [
  'Выбор телевизора',
  'Выбор телефона',
  'Выбор курорта',
  'Выбор сотрудника',
] as const

export function getSampleComparisons(): Comparison[] {
  return [
    createSampleComparison(
      'Выбор телевизора',
      ['Samsung QLED', 'LG OLED', 'Sony Bravia'],
      [
        { name: 'Цена', weight: 8, type: 'number', criteria: [{ name: 'Дорого', value: 150000, score: 3 }, { name: 'Средне', value: 80000, score: 7 }, { name: 'Доступно', value: 40000, score: 10 }] },
        { name: 'Диагональ', weight: 7, type: 'number', criteria: [{ name: '55"', value: 55, score: 6 }, { name: '65"', value: 65, score: 8 }, { name: '75"', value: 75, score: 10 }] },
        { name: 'Качество', weight: 9, type: 'text', criteria: [{ name: 'Хорошо', value: 'Хорошо', score: 6 }, { name: 'Отлично', value: 'Отлично', score: 9 }, { name: 'Топ', value: 'Топ', score: 10 }] },
      ],
      {
        'Samsung QLED': { 'Цена': 120000, 'Диагональ': 65, 'Качество': 'Отлично' },
        'LG OLED': { 'Цена': 95000, 'Диагональ': 55, 'Качество': 'Топ' },
        'Sony Bravia': { 'Цена': 140000, 'Диагональ': 75, 'Качество': 'Отлично' },
      }
    ),
    createSampleComparison(
      'Выбор телефона',
      ['iPhone 15', 'Samsung Galaxy S24', 'Xiaomi 14'],
      [
        { name: 'Цена', weight: 8, type: 'number', criteria: [{ name: 'Дорого', value: 100000, score: 2 }, { name: 'Средне', value: 60000, score: 7 }, { name: 'Доступно', value: 35000, score: 10 }] },
        { name: 'Камера', weight: 9, type: 'text', criteria: [{ name: 'Средняя', value: 'Средняя', score: 5 }, { name: 'Хорошая', value: 'Хорошая', score: 8 }, { name: 'Топ', value: 'Топ', score: 10 }] },
        { name: 'Батарея', weight: 7, type: 'number', criteria: [{ name: '3000', value: 3000, score: 4 }, { name: '4000', value: 4000, score: 7 }, { name: '5000', value: 5000, score: 10 }] },
      ],
      {
        'iPhone 15': { 'Цена': 89990, 'Камера': 'Топ', 'Батарея': 3349 },
        'Samsung Galaxy S24': { 'Цена': 79990, 'Камера': 'Хорошая', 'Батарея': 4000 },
        'Xiaomi 14': { 'Цена': 54990, 'Камера': 'Хорошая', 'Батарея': 4610 },
      }
    ),
    createSampleComparison(
      'Выбор курорта',
      ['Турция', 'Греция', 'Мальдивы'],
      [
        { name: 'Цена', weight: 8, type: 'number', criteria: [{ name: 'Дорого', value: 300000, score: 2 }, { name: 'Средне', value: 150000, score: 7 }, { name: 'Доступно', value: 80000, score: 10 }] },
        { name: 'Погода', weight: 9, type: 'text', criteria: [{ name: 'Нестабильная', value: 'Нестабильная', score: 4 }, { name: 'Хорошая', value: 'Хорошая', score: 7 }, { name: 'Идеальная', value: 'Идеальная', score: 10 }] },
        { name: 'Инфраструктура', weight: 7, type: 'text', criteria: [{ name: 'Базовая', value: 'Базовая', score: 5 }, { name: 'Развитая', value: 'Развитая', score: 8 }, { name: 'Топ', value: 'Топ', score: 10 }] },
      ],
      {
        'Турция': { 'Цена': 120000, 'Погода': 'Хорошая', 'Инфраструктура': 'Развитая' },
        'Греция': { 'Цена': 140000, 'Погода': 'Хорошая', 'Инфраструктура': 'Развитая' },
        'Мальдивы': { 'Цена': 350000, 'Погода': 'Идеальная', 'Инфраструктура': 'Топ' },
      }
    ),
    createSampleComparison(
      'Выбор сотрудника',
      ['Алексей', 'Мария', 'Дмитрий'],
      [
        { name: 'Опыт', weight: 9, type: 'number', criteria: [{ name: '1 год', value: 1, score: 3 }, { name: '3 года', value: 3, score: 6 }, { name: '5+ лет', value: 5, score: 10 }] },
        { name: 'Коммуникация', weight: 8, type: 'text', criteria: [{ name: 'Слабая', value: 'Слабая', score: 3 }, { name: 'Хорошая', value: 'Хорошая', score: 7 }, { name: 'Отличная', value: 'Отличная', score: 10 }] },
        { name: 'Надёжность', weight: 8, type: 'text', criteria: [{ name: 'Низкая', value: 'Низкая', score: 2 }, { name: 'Средняя', value: 'Средняя', score: 6 }, { name: 'Высокая', value: 'Высокая', score: 10 }] },
      ],
      {
        'Алексей': { 'Опыт': 4, 'Коммуникация': 'Хорошая', 'Надёжность': 'Высокая' },
        'Мария': { 'Опыт': 6, 'Коммуникация': 'Отличная', 'Надёжность': 'Высокая' },
        'Дмитрий': { 'Опыт': 2, 'Коммуникация': 'Хорошая', 'Надёжность': 'Средняя' },
      }
    ),
  ]
}
