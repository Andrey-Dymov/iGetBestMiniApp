/**
 * Типы данных iGetBest.
 * Соответствие DecisionMakingModels.swift
 */
export interface Comparison {
  id: string
  name: string
  description?: string
  modifiedDate: string
  variants: Variant[]
  parameters: Parameter[]
  values: Value[]
}

export interface Variant {
  id: string
  name: string
  description?: string
  number: number
  totalScore: number
  position: number
  url?: string
  imageUrls?: string[]
}

export interface Parameter {
  id: string
  name: string
  description?: string
  number: number
  weight: number
  unit?: string
  parameterType: 'number' | 'text'
  criteria: Criterion[]
}

export interface Criterion {
  id: string
  name: string
  textValue: string
  numericValue?: number
  score: number
}

export interface Value {
  id: string
  variantId: string
  parameterId: string
  textValue?: string
  numericValue?: number
  score: number
}
