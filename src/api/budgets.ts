import type { ApiEndpoint } from './endpoints'
import { AuthApiError, request, checkResponse, responseBody, csrfToken } from './auth'
export type BudgetInput = { name: string; category: string; currency: string; period: string; start: string; end: string; amount: string; thresholds: number[]; rolloverMode: string }
export type Budget = BudgetInput & { id: number; carryIn: string; carryFromId: number | null; effectiveAmount: string; spent: string; remaining: string; overage: string; executionRate: string; overrunRate: string; forecast: string; projectedOverage: string; elapsedDays: number; remainingDays: number; status: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type BudgetOverview = { items: Budget[]; today: string; currency: string; suggestedAmount: string; unreadCount: number }
export type Template = { id: number; name: string; items: Omit<BudgetInput, 'start' | 'end' | 'period'>[]; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type Notice = { id: number; budgetId: number; eventKey: string; message: string; read: boolean; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type Adjustment = { id: number; budgetId: number; oldAmount: string; newAmount: string; oldCarry: string; newCarry: string; reason: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type History = { months: Budget[]; categories: { category: string; currency: string; periods: number; overspentPeriods: number; totalBudget: string; totalSpent: string; totalOverage: string; executionRate: string }[] }
/** 检查预算执行响应的主键、所有金额字符串及核心字段，确保接口字段对应。 */
function budget(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'number' && Number.isSafeInteger(record.id) && record.id > 0
    && ['name', 'category', 'currency', 'period', 'start', 'end', 'amount', 'rolloverMode', 'carryIn', 'effectiveAmount', 'spent', 'remaining', 'overage', 'executionRate', 'overrunRate', 'forecast', 'projectedOverage', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'].every(key => typeof record[key] === 'string')
    && Array.isArray(record.thresholds) && record.thresholds.every(item => typeof item === 'number')
    && typeof record.elapsedDays === 'number' && typeof record.remainingDays === 'number' && typeof record.deleted === 'boolean'
}
/** 根据接口路径校验列表、历史、模板、提醒和修改记录的响应，避免静默接受错误结构。 */
function valid(path: string, value: unknown): boolean {
  const list = Array.isArray(value) ? value : null
  const object = value && typeof value === 'object' && !list ? value as Record<string, unknown> : null
  if (path === '/api/budgets') return object && 'items' in object ? Array.isArray(object.items) && object.items.every(budget)
    && typeof object.today === 'string' && typeof object.currency === 'string' && typeof object.suggestedAmount === 'string' && typeof object.unreadCount === 'number' : budget(value)
  if (path === '/api/budgets/history') return Boolean(object && Array.isArray(object.months) && object.months.every(budget) && Array.isArray(object.categories)
    && object.categories.every(category => category && typeof category === 'object' && ['category', 'currency', 'totalBudget', 'totalSpent', 'totalOverage', 'executionRate'].every(key => typeof category[key] === 'string') && typeof category.periods === 'number' && typeof category.overspentPeriods === 'number'))
  if (path === '/api/budgets/copy-month' || /\/apply$/.test(path)) return Boolean(list && list.every(budget))
  if (/\/adjustments$/.test(path)) return Boolean(list && list.every(item => item && typeof item.id === 'number' && ['oldAmount', 'newAmount', 'oldCarry', 'newCarry', 'reason', 'createdAt', 'createdBy'].every(key => typeof item[key] === 'string')))
  if (/^\/api\/budgets\/\d+$/.test(path)) return budget(value)
  if (path === '/api/budget-notifications') return Boolean(list && list.every(item => item && typeof item.id === 'number' && typeof item.budgetId === 'number' && typeof item.message === 'string' && typeof item.read === 'boolean' && typeof item.createdAt === 'string'))
  if (path === '/api/budget-templates') {
    const templates = list || [value]
    return templates.every(item => item && typeof item.id === 'number' && typeof item.name === 'string' && Array.isArray(item.items)
      && item.items.every((entry: Record<string, unknown>) => entry && ['name', 'category', 'currency', 'amount', 'rolloverMode'].every(key => typeof entry[key] === 'string') && Array.isArray(entry.thresholds)))
  }
  return false
}
/** 使用同源认证和完整接口路径，写操作实时获取 CSRF，金额保持字符串。 */
export async function budgetRequest<T>(endpoint: ApiEndpoint, body?: unknown): Promise<T> {
  const headers = new Headers()
  if (endpoint.method !== 'GET') { const csrf = await csrfToken(); headers.set(csrf.headerName, csrf.token) }
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await request(endpoint, { headers, body: body === undefined ? undefined : JSON.stringify(body) })
  await checkResponse(response)
  if (response.status === 204) return undefined as T
  const value = await responseBody(response)
  if (!valid(endpoint.path.split('?')[0], value)) throw new AuthApiError(502, 'INVALID_RESPONSE')
  return value as T
}
