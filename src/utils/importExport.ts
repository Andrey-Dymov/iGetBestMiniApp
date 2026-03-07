/**
 * Импорт/экспорт сравнений. Совместимость с iGetBest (Swift).
 */
import type { Comparison, Variant, Parameter, Criterion, Value } from '../types'

function id() {
  return crypto.randomUUID()
}

export function recalculateTotalScores(c: Comparison) {
  for (const v of c.variants) {
    let total = 0
    for (const val of c.values.filter((x) => x.variantId === v.id)) {
      const p = c.parameters.find((x) => x.id === val.parameterId)
      if (p) total += val.score * p.weight
    }
    v.totalScore = total
  }
  const sorted = [...c.variants].sort((a, b) => b.totalScore - a.totalScore)
  sorted.forEach((v, i) => {
    v.position = i + 1
  })
}

/** Экспорт в JSON (совместимость со Swift) */
export function exportToJSON(c: Comparison): string {
  const params = [...c.parameters].sort((a, b) => a.number - b.number)
  const variants = [...c.variants].sort((a, b) => a.number - b.number)

  const comparisonData = {
    name: c.name,
    description: c.description ?? '',
    parameters: params.map((p) => ({
      name: p.name,
      weight: p.weight,
      type: p.parameterType,
      unit: p.unit ?? undefined,
      criteria: [...(p.criteria ?? [])]
        .sort((a, b) => a.score - b.score)
        .map((cr) => ({
          name: cr.name,
          value: cr.textValue ?? String(cr.numericValue ?? 0),
          score: Math.round(cr.score),
        })),
    })),
    variants: variants.map((v) => {
      const valuesDict: Record<string, string | number> = {}
      for (const val of c.values.filter((x) => x.variantId === v.id)) {
        const param = params.find((x) => x.id === val.parameterId)
        if (param) {
          if (val.numericValue != null) valuesDict[param.name] = val.numericValue
          else if (val.textValue) valuesDict[param.name] = val.textValue
        }
      }
      return {
        name: v.name,
        description: v.description ?? '',
        url: v.url ?? '',
        values: valuesDict,
      }
    }),
  }
  return JSON.stringify({ comparison: comparisonData }, null, 2)
}

/** Экспорт в краткий формат */
export function exportToCompact(c: Comparison): string {
  const params = [...c.parameters].sort((a, b) => b.weight - a.weight)
  const variants = [...c.variants].sort((a, b) => a.number - b.number)
  const paramStrings = params.map((p) => {
    let s = p.name
    const criteria = [...(p.criteria ?? [])]
    if (criteria.length) {
      const sorted =
        p.parameterType === 'number'
          ? criteria.sort((a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0))
          : criteria.sort((a, b) => a.score - b.score)
      s += ' (' + sorted.map((c) => `${c.name}:${Math.round(c.score)}`).join('-') + ')'
    }
    s += `, вес ${p.weight}`
    return s
  })
  let result = `Сравнение: ${c.name}\n`
  result += `Параметры: ${paramStrings.join(', ')}\n`
  for (const v of variants) {
    const vals = params.map((p) => {
      const val = c.values.find((x) => x.variantId === v.id && x.parameterId === p.id)
      if (!val) return '-'
      if (p.parameterType === 'number' && val.numericValue != null) {
        return Number.isInteger(val.numericValue) ? String(val.numericValue) : String(val.numericValue)
      }
      return val.textValue ?? '-'
    })
    result += `${v.name}: ${vals.join(', ')}.\n`
  }
  return result.trim()
}

/** Парсинг краткого формата */
export interface ParsedComparison {
  name: string
  parameters: { name: string; type: 'number' | 'text'; weight: number; criteria: { name: string; score: number }[] }[]
  variants: { name: string; values: string[] }[]
}

export function parseCompactFormat(text: string): { ok: true; data: ParsedComparison } | { ok: false; error: string } {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 3) return { ok: false, error: 'Минимум 3 строки: заголовок, параметры, вариант' }
  if (!lines[0].startsWith('Сравнение: ')) return { ok: false, error: 'Первая строка должна начинаться с "Сравнение: "' }
  if (!lines[1].startsWith('Параметры: ')) return { ok: false, error: 'Вторая строка должна начинаться с "Параметры: "' }

  const name = lines[0].slice('Сравнение: '.length).trim()
  const paramsText = lines[1].slice('Параметры: '.length)

  const parameters: ParsedComparison['parameters'] = []
  const paramParts = paramsText.split(', вес ')
  for (let i = 0; i + 1 < paramParts.length; i += 2) {
    const paramWithCriteria = paramParts[i].trim()
    const weightStr = paramParts[i + 1]
    const weightMatch = weightStr?.match(/^(\d+)/)
    const weight = weightMatch ? parseInt(weightMatch[1], 10) : 5

    let paramName = paramWithCriteria
    let criteria: { name: string; score: number }[] = []
    const parenStart = paramWithCriteria.indexOf(' (')
    const parenEnd = paramWithCriteria.indexOf(')', parenStart)
    if (parenStart >= 0 && parenEnd > parenStart) {
      paramName = paramWithCriteria.slice(0, parenStart).trim()
      const critStr = paramWithCriteria.slice(parenStart + 2, parenEnd)
      for (const c of critStr.split('-')) {
        const colon = c.indexOf(':')
        if (colon >= 0) {
          const cName = c.slice(0, colon).trim()
          const cScore = parseInt(c.slice(colon + 1).trim(), 10)
          if (!isNaN(cScore)) criteria.push({ name: cName, score: cScore })
        }
      }
    }
    const isNumeric = criteria.every((x) => !isNaN(Number(x.name)))
    parameters.push({ name: paramName, type: isNumeric ? 'number' : 'text', weight, criteria })
  }

  const variants: ParsedComparison['variants'] = []
  for (let i = 2; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(': ')
    if (colonIdx < 0) continue
    const vName = lines[i].slice(0, colonIdx).trim()
    const valsStr = lines[i].slice(colonIdx + 2).replace(/\.\s*$/, '')
    const values = valsStr ? valsStr.split(', ').map((s) => s.trim()) : []
    variants.push({ name: vName, values })
  }

  if (parameters.length === 0 || variants.length === 0) {
    return { ok: false, error: 'Нужны хотя бы один параметр и один вариант' }
  }

  return { ok: true, data: { name, parameters, variants } }
}

/** Конвертация ParsedComparison в Comparison */
export function parsedToComparison(parsed: ParsedComparison): Comparison {
  const c: Comparison = {
    id: id(),
    name: parsed.name,
    modifiedDate: new Date().toISOString(),
    variants: [],
    parameters: [],
    values: [],
  }

  const vMap = new Map<number, Variant>()
  parsed.variants.forEach((pv, i) => {
    const v: Variant = {
      id: id(),
      name: pv.name,
      number: i + 1,
      totalScore: 0,
      position: 0,
    }
    c.variants.push(v)
    vMap.set(i + 1, v)
  })

  const pMap = new Map<number, Parameter>()
  parsed.parameters.forEach((pp, i) => {
    const criteria: Criterion[] = pp.criteria.map((cr) => ({
      id: id(),
      name: cr.name,
      textValue: cr.name,
      numericValue: pp.type === 'number' ? Number(cr.name) : undefined,
      score: cr.score,
    }))
    const p: Parameter = {
      id: id(),
      name: pp.name,
      number: i + 1,
      weight: pp.weight,
      parameterType: pp.type,
      criteria,
    }
    c.parameters.push(p)
    pMap.set(i + 1, p)
  })

  function findScore(criteria: { name: string; score: number }[], val: string | number, type: 'number' | 'text'): number {
    if (type === 'text') {
      const x = criteria.find((c) => String(c.name).toLowerCase() === String(val).toLowerCase())
      return x?.score ?? 0
    }
    const num = Number(val)
    const exact = criteria.find((c) => Number(c.name) === num)
    if (exact) return exact.score
    const sorted = [...criteria].sort((a, b) => Number(a.name) - Number(b.name))
    if (sorted.length === 0) return 0
    if (num <= Number(sorted[0]?.name)) return sorted[0]?.score ?? 0
    if (num >= Number(sorted[sorted.length - 1]?.name)) return sorted[sorted.length - 1]?.score ?? 0
    for (let j = 0; j < sorted.length - 1; j++) {
      const curr = sorted[j]
      const next = sorted[j + 1]
      if (!curr || !next) continue
      const lo = Number(curr.name)
      const hi = Number(next.name)
      if (num >= lo && num <= hi) {
        const t = (num - lo) / (hi - lo)
        return curr.score + t * (next.score - curr.score)
      }
    }
    return sorted[0]?.score ?? 0
  }

  parsed.variants.forEach((pv, vi) => {
    const variant = vMap.get(vi + 1)
    if (!variant) return
    parsed.parameters.forEach((pp, pi) => {
      const param = pMap.get(pi + 1)
      if (!param) return
      const valStr = pv.values[pi] ?? pv.values.find((v) => v !== '-') ?? '-'
      if (valStr === '-') return
      const score = findScore(pp.criteria, pp.type === 'number' ? Number(valStr) : valStr, pp.type)
      const val: Value = {
        id: id(),
        variantId: variant.id,
        parameterId: param.id,
        score,
      }
      if (pp.type === 'number') val.numericValue = Number(valStr)
      else val.textValue = valStr
      c.values.push(val)
    })
  })

  recalculateTotalScores(c)
  return c
}

/** Импорт из JSON (формат Swift) */
export function importFromJSON(jsonStr: string): Comparison | null {
  try {
    const root = JSON.parse(jsonStr)
    const data = root.comparison ?? root
    if (!data.name) return null

    const c: Comparison = {
      id: id(),
      name: String(data.name),
      description: data.description || undefined,
      modifiedDate: new Date().toISOString(),
      variants: [],
      parameters: [],
      values: [],
    }

    const vByNum = new Map<number, Variant>()
    const pByNum = new Map<number, Parameter>()

    const params = Array.isArray(data.parameters) ? data.parameters : []
    params.forEach((dp: Record<string, unknown>, i: number) => {
      const p: Parameter = {
        id: id(),
        name: String(dp.name ?? `Параметр ${i + 1}`),
        number: (dp.number as number) ?? i + 1,
        weight: Number(dp.weight ?? 5),
        parameterType: (dp.type === 'text' ? 'text' : 'number') as 'number' | 'text',
        criteria: [],
      }
      if (dp.unit) p.unit = String(dp.unit)
      const criteria = Array.isArray(dp.criteria) ? dp.criteria : []
      criteria.forEach((dc: Record<string, unknown>) => {
        p.criteria.push({
          id: id(),
          name: String(dc.name ?? ''),
          textValue: String(dc.value ?? dc.name ?? ''),
          numericValue: p.parameterType === 'number' ? Number(dc.value ?? dc.numericValue) : undefined,
          score: Number(dc.score ?? 0),
        })
      })
      c.parameters.push(p)
      pByNum.set(p.number, p)
    })

    const vars = Array.isArray(data.variants) ? data.variants : []
    vars.forEach((dv: Record<string, unknown>, i: number) => {
      const v: Variant = {
        id: id(),
        name: String(dv.name ?? `Вариант ${i + 1}`),
        number: (dv.number as number) ?? i + 1,
        totalScore: 0,
        position: 0,
      }
      if (dv.description) v.description = String(dv.description)
      if (dv.url) v.url = String(dv.url)
      if (Array.isArray(dv.imageUrls)) v.imageUrls = dv.imageUrls.map(String)
      c.variants.push(v)
      vByNum.set(v.number, v)
    })

    const values = Array.isArray(data.values) ? data.values : []
    values.forEach((dval: Record<string, unknown>) => {
      const vNum = Number(dval.variantNumber ?? dval.variant_number ?? 1)
      const pNum = Number(dval.parameterNumber ?? dval.parameter_number ?? 1)
      const variant = vByNum.get(vNum)
      const param = pByNum.get(pNum)
      if (!variant || !param) return
      const score = Number(dval.score ?? 0)
      const val: Value = {
        id: id(),
        variantId: variant.id,
        parameterId: param.id,
        score,
      }
      if (dval.numericValue != null) val.numericValue = Number(dval.numericValue)
      if (dval.textValue != null) val.textValue = String(dval.textValue)
      c.values.push(val)
    })

    if (values.length === 0 && vars.length && params.length) {
      for (const v of c.variants) {
        for (const p of c.parameters) {
          const dv = vars.find((x: Record<string, unknown>) => x.number === v.number || x.name === v.name)
          const valuesDict = dv?.values as Record<string, string | number> | undefined
          if (!valuesDict) continue
          const raw = valuesDict[p.name]
          if (raw == null) continue
          const score =
            p.parameterType === 'number'
              ? p.criteria.find((cr) => cr.numericValue === Number(raw))?.score ??
                p.criteria.find((cr) => String(cr.textValue) === String(raw))?.score ??
                0
              : p.criteria.find((cr) => String(cr.textValue).toLowerCase() === String(raw).toLowerCase())?.score ?? 0
          c.values.push({
            id: id(),
            variantId: v.id,
            parameterId: p.id,
            textValue: typeof raw === 'string' ? raw : undefined,
            numericValue: typeof raw === 'number' ? raw : undefined,
            score,
          })
        }
      }
    }

    recalculateTotalScores(c)
    return c
  } catch {
    return null
  }
}
