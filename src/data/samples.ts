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
  'Телевизор',
  'Телефон',
  'Курорт',
  'Сотрудник',
  'Образ',
  'Кафе',
  'Жених',
  'Smartphone',
  '咖啡馆',
] as const

export function getSampleComparisons(): Comparison[] {
  return [
    createSampleComparison(
      'Телевизор',
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
      'Телефон',
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
      'Курорт',
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
      'Сотрудник',
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
    createSampleComparison(
      'Образ',
      ['Платье', 'Комбинезон', 'Пальто'],
      [
        { name: 'Цена', weight: 7, type: 'number', criteria: [{ name: 'Дорого', value: 15000, score: 3 }, { name: 'Средне', value: 7000, score: 7 }, { name: 'Доступно', value: 3000, score: 10 }] },
        { name: 'Удобство', weight: 9, type: 'text', criteria: [{ name: 'Средне', value: 'Средне', score: 5 }, { name: 'Хорошо', value: 'Хорошо', score: 8 }, { name: 'Отлично', value: 'Отлично', score: 10 }] },
        { name: 'Универсальность', weight: 8, type: 'text', criteria: [{ name: 'Ограничена', value: 'Ограничена', score: 4 }, { name: 'Норма', value: 'Норма', score: 7 }, { name: 'Подходит везде', value: 'Подходит везде', score: 10 }] },
      ],
      {
        'Платье': { 'Цена': 5500, 'Удобство': 'Отлично', 'Универсальность': 'Подходит везде' },
        'Комбинезон': { 'Цена': 8900, 'Удобство': 'Хорошо', 'Универсальность': 'Норма' },
        'Пальто': { 'Цена': 12000, 'Удобство': 'Отлично', 'Универсальность': 'Подходит везде' },
      }
    ),
    createSampleComparison(
      'Кафе',
      ['Кофейня у парка', 'Булочная на углу', 'Лофт-кафе'],
      [
        { name: 'Цена', weight: 8, type: 'number', criteria: [{ name: 'Дорого', value: 800, score: 3 }, { name: 'Средне', value: 400, score: 7 }, { name: 'Дёшево', value: 200, score: 10 }] },
        { name: 'Атмосфера', weight: 9, type: 'text', criteria: [{ name: 'Обычная', value: 'Обычная', score: 5 }, { name: 'Уютная', value: 'Уютная', score: 8 }, { name: 'Топ', value: 'Топ', score: 10 }] },
        { name: 'Удалённость', weight: 6, type: 'number', criteria: [{ name: 'Далеко', value: 30, score: 3 }, { name: 'Средне', value: 15, score: 7 }, { name: 'Рядом', value: 5, score: 10 }] },
      ],
      {
        'Кофейня у парка': { 'Цена': 450, 'Атмосфера': 'Уютная', 'Удалённость': 12 },
        'Булочная на углу': { 'Цена': 250, 'Атмосфера': 'Обычная', 'Удалённость': 3 },
        'Лофт-кафе': { 'Цена': 650, 'Атмосфера': 'Топ', 'Удалённость': 20 },
      }
    ),
    createSampleComparison(
      'Жених',
      ['Александр', 'Максим', 'Артём'],
      [
        { name: 'Чувство юмора', weight: 10, type: 'text', criteria: [{ name: 'Скучный', value: 'Скучный', score: 2 }, { name: 'Норма', value: 'Норма', score: 6 }, { name: 'Убивает', value: 'Убивает', score: 10 }] },
        { name: 'Надёжность', weight: 9, type: 'text', criteria: [{ name: 'Низкая', value: 'Низкая', score: 2 }, { name: 'Средняя', value: 'Средняя', score: 6 }, { name: 'Высокая', value: 'Высокая', score: 10 }] },
        { name: 'Доход', weight: 7, type: 'number', criteria: [{ name: 'Низкий', value: 50000, score: 3 }, { name: 'Средний', value: 120000, score: 7 }, { name: 'Высокий', value: 250000, score: 10 }] },
        { name: 'Жильё', weight: 6, type: 'text', criteria: [{ name: 'Снимает', value: 'Снимает', score: 3 }, { name: 'Ипотека', value: 'Ипотека', score: 6 }, { name: 'Своё', value: 'Своё', score: 10 }] },
        { name: 'Готовность к компромиссам', weight: 8, type: 'text', criteria: [{ name: 'Упрямый', value: 'Упрямый', score: 3 }, { name: 'Иногда', value: 'Иногда', score: 6 }, { name: 'Всегда', value: 'Всегда', score: 10 }] },
      ],
      {
        'Александр': { 'Чувство юмора': 'Убивает', 'Надёжность': 'Высокая', 'Доход': 180000, 'Жильё': 'Своё', 'Готовность к компромиссам': 'Иногда' },
        'Максим': { 'Чувство юмора': 'Норма', 'Надёжность': 'Высокая', 'Доход': 95000, 'Жильё': 'Ипотека', 'Готовность к компромиссам': 'Всегда' },
        'Артём': { 'Чувство юмора': 'Убивает', 'Надёжность': 'Средняя', 'Доход': 140000, 'Жильё': 'Своё', 'Готовность к компромиссам': 'Всегда' },
      }
    ),
    createSampleComparison(
      'Smartphone',
      ['iPhone 15', 'Samsung Galaxy S24', 'Google Pixel 8'],
      [
        { name: 'Price', weight: 8, type: 'number', criteria: [{ name: 'Expensive', value: 900, score: 2 }, { name: 'Mid', value: 600, score: 7 }, { name: 'Affordable', value: 350, score: 10 }] },
        { name: 'Camera', weight: 9, type: 'text', criteria: [{ name: 'Average', value: 'Average', score: 5 }, { name: 'Good', value: 'Good', score: 8 }, { name: 'Top', value: 'Top', score: 10 }] },
        { name: 'Battery', weight: 7, type: 'number', criteria: [{ name: '3000', value: 3000, score: 4 }, { name: '4000', value: 4000, score: 7 }, { name: '5000', value: 5000, score: 10 }] },
      ],
      {
        'iPhone 15': { 'Price': 799, 'Camera': 'Top', 'Battery': 3349 },
        'Samsung Galaxy S24': { 'Price': 699, 'Camera': 'Good', 'Battery': 4000 },
        'Google Pixel 8': { 'Price': 549, 'Camera': 'Top', 'Battery': 4575 },
      }
    ),
    createSampleComparison(
      '咖啡馆',
      ['星巴克', '瑞幸', 'Manner'],
      [
        { name: '价格', weight: 8, type: 'number', criteria: [{ name: '贵', value: 50, score: 3 }, { name: '中', value: 25, score: 7 }, { name: '便宜', value: 10, score: 10 }] },
        { name: '氛围', weight: 9, type: 'text', criteria: [{ name: '一般', value: '一般', score: 5 }, { name: '舒适', value: '舒适', score: 8 }, { name: '很棒', value: '很棒', score: 10 }] },
        { name: '距离', weight: 6, type: 'number', criteria: [{ name: '远', value: 30, score: 3 }, { name: '中', value: 15, score: 7 }, { name: '近', value: 5, score: 10 }] },
      ],
      {
        '星巴克': { '价格': 35, '氛围': '舒适', '距离': 12 },
        '瑞幸': { '价格': 15, '氛围': '一般', '距离': 3 },
        'Manner': { '价格': 20, '氛围': '很棒', '距离': 8 },
      }
    ),
  ]
}
