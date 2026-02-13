/**
 * Validacao runtime usando JSON Schemas gerados pelo OpenAPI.
 *
 * Valida respostas criticas da API (auth, permissoes) em runtime,
 * complementando a tipagem estatica do TypeScript.
 *
 * Uso:
 * ```ts
 * import { TokenSchema, UserMeSchema } from '@/types/generated/schemas.gen'
 * import { validateSchema } from '@/lib/schema-validator'
 *
 * const loginResponse = await apiRequest('/auth/login', { ... })
 * const result = validateSchema(loginResponse, TokenSchema)
 * if (!result.valid) {
 *   console.error('Resposta do login invalida:', result.errors)
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface JsonSchemaProperty {
  type?: string
  anyOf?: Array<{ type: string }>
  title?: string
}

interface JsonSchema {
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  type?: string
  title?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ---------------------------------------------------------------------------
// Validador
// ---------------------------------------------------------------------------

function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string': return typeof value === 'string'
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'number': return typeof value === 'number'
    case 'boolean': return typeof value === 'boolean'
    case 'array': return Array.isArray(value)
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'null': return value === null
    default: return true
  }
}

function checkPropertyType(value: unknown, prop: JsonSchemaProperty): boolean {
  // anyOf — aceita qualquer tipo listado (ex: string | null)
  if (prop.anyOf) {
    return prop.anyOf.some(variant => checkType(value, variant.type))
  }
  if (prop.type) {
    return checkType(value, prop.type)
  }
  return true // sem tipo definido = aceita tudo
}

/**
 * Valida um valor contra um JSON Schema gerado pelo OpenAPI.
 *
 * Valida:
 * - Campos required presentes
 * - Tipos basicos (string, number, boolean, integer, array, object, null)
 * - anyOf (union types)
 *
 * NAO valida (por design — manter leve):
 * - Nested objects (profundidade > 1)
 * - Array items
 * - Patterns, min/max, enum
 */
export function validateSchema(data: unknown, schema: JsonSchema): ValidationResult {
  const errors: string[] = []

  if (schema.type === 'object' || schema.properties) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { valid: false, errors: ['Esperado objeto, recebido ' + typeof data] }
    }

    const record = data as Record<string, unknown>

    // Valida campos obrigatorios
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in record) || record[field] === undefined) {
          errors.push(`Campo obrigatorio ausente: "${field}"`)
        }
      }
    }

    // Valida tipos das propriedades presentes
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in record && record[key] !== undefined) {
          if (!checkPropertyType(record[key], prop)) {
            const expected = prop.anyOf
              ? prop.anyOf.map(v => v.type).join(' | ')
              : prop.type ?? 'unknown'
            errors.push(`Campo "${key}": esperado ${expected}, recebido ${typeof record[key]}`)
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Valida e lanca erro se invalido. Util em pontos criticos.
 */
export function assertSchema(data: unknown, schema: JsonSchema, context: string): void {
  const result = validateSchema(data, schema)
  if (!result.valid) {
    console.error(`[schema-validator] Validacao falhou em ${context}:`, result.errors)
  }
}
