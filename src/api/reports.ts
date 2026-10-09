import { API_ENDPOINTS } from './endpoints'
import type { ApiEndpoint } from './endpoints'
import { request, csrfToken, responseBody, checkResponse, AuthApiError } from './auth'
export type ReportFilters = { start: string; end: string; grouping: string; accountId: string; currency: string; kind: string; category: string; tag: string }
export type Trend = { start: string; end: string; income: string; expense: string; net: string }
export type Ranking = { name: string; amount: string; count: number }
export type CashFlow = { accountId: number; name: string; type: string; openingBalance: string; openingKnown: boolean; inflow: string; outflow: string; internalInflow: string; internalOutflow: string; balanceAdjustment: string; closingBalance: string; closingKnown: boolean }
export type AssetPoint = { date: string; assets: string; liabilities: string; netAssets: string; unknownAccounts: number }
export type Change = { current: string; previous: string; difference: string; percentage: string | null }
export type Comparison = { start: string; end: string; income: Change; expense: Change; net: Change }
export type CurrencyReport = { currency: string; summary: { income: string; expense: string; net: string; averageDailyExpense: string; incomeCount: number; expenseCount: number }; trend: Trend[]; categories: { category: string; amount: string; percentage: string; count: number }[]; categoryTrend: { month: string; category: string; amount: string }[]; merchants: Ranking[]; tags: Ranking[]; cashFlow: CashFlow[]; assets: AssetPoint[]; balances: { accountId: number; name: string; type: string; balance: string; known: boolean; history: { date: string; balance: string; known: boolean }[] }[]; monthOverMonth: Comparison; yearOverYear: Comparison }
export type FinancialReport = { filter: { start: string; end: string; grouping: string; accountId: number | null; currency: string | null; kind: string | null; category: string | null; tag: string | null }; currencies: CurrencyReport[] }
export type Transfer = { id: number; fromAccountId: number; toAccountId: number; currency: string; amount: string; date: string; note: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type Valuation = { id: number; accountId: number; date: string; balance: string; note: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
/** 将非空报表筛选参数放入URL，身份始终来自当前会话。 */
export function reportQuery(filters: ReportFilters): string { return new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString() }
/** 检查JSON对象，避免null和数组被当成金额结构。 */
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
/** 验证所需字符串字段，金额也必须为字符串。 */
function strings(value: unknown, keys: string[]): boolean { return record(value) && keys.every(key => typeof value[key] === 'string') }
/** 验证主键和数量，避免客户端误用浮点主键。 */
function integer(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
/** 验证同比/环比金额、差额及可空变化率。 */
function comparison(value: unknown): boolean { return record(value) && strings(value, ['start', 'end']) && ['income', 'expense', 'net'].every(key => record(value[key]) && strings(value[key], ['current', 'previous', 'difference']) && (value[key].percentage === null || typeof value[key].percentage === 'string')) }
/** 验证每币种报表的全部图表和核心财务字段，金额数值响应会被明确拒绝。 */
function currencyReport(value: unknown): boolean {
  if (!record(value) || typeof value.currency !== 'string' || !strings(value.summary, ['income', 'expense', 'net', 'averageDailyExpense']) || !record(value.summary) || !integer(value.summary.incomeCount) || !integer(value.summary.expenseCount)) return false
  return Array.isArray(value.trend) && value.trend.every(row => strings(row, ['start', 'end', 'income', 'expense', 'net']))
    && Array.isArray(value.categories) && value.categories.every(row => strings(row, ['category', 'amount', 'percentage']) && integer(row.count))
    && Array.isArray(value.categoryTrend) && value.categoryTrend.every(row => strings(row, ['month', 'category', 'amount']))
    && ['merchants', 'tags'].every(key => Array.isArray(value[key]) && value[key].every((row: unknown) => strings(row, ['name', 'amount']) && record(row) && integer(row.count)))
    && Array.isArray(value.cashFlow) && value.cashFlow.every(row => strings(row, ['name', 'type', 'openingBalance', 'inflow', 'outflow', 'internalInflow', 'internalOutflow', 'balanceAdjustment', 'closingBalance']) && integer(row.accountId) && typeof row.openingKnown === 'boolean' && typeof row.closingKnown === 'boolean')
    && Array.isArray(value.assets) && value.assets.every(row => strings(row, ['date', 'assets', 'liabilities', 'netAssets']) && integer(row.unknownAccounts))
    && Array.isArray(value.balances) && value.balances.every(row => strings(row, ['name', 'type', 'balance']) && integer(row.accountId) && typeof row.known === 'boolean' && Array.isArray(row.history) && row.history.every((point: unknown) => strings(point, ['date', 'balance']) && record(point) && typeof point.known === 'boolean'))
    && comparison(value.monthOverMonth) && comparison(value.yearOverYear)
}
/** 读取报表或写入账户/转账/估值，实时CSRF验证及超时沿用认证模块。 */
export async function reportRequest<T>(endpoint: ApiEndpoint, body?: unknown): Promise<T> {
  const headers = new Headers()
  if (endpoint.method !== 'GET') { const csrf = await csrfToken(); headers.set(csrf.headerName, csrf.token) }
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await request(endpoint, { headers, body: body === undefined ? undefined : JSON.stringify(body) })
  await checkResponse(response); const value = await responseBody(response); const path = endpoint.path.split('?')[0]
  let valid = false
  if (path === API_ENDPOINTS.financialReport.path) valid = record(value) && record(value.filter) && strings(value.filter, ['start', 'end', 'grouping']) && (value.filter.accountId === null || integer(value.filter.accountId)) && ['currency', 'kind', 'category', 'tag'].every(key => value.filter && record(value.filter) && (value.filter[key] === null || typeof value.filter[key] === 'string')) && Array.isArray(value.currencies) && value.currencies.every(currencyReport)
  else if (path === API_ENDPOINTS.reportOptions.path) valid = record(value) && Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string')
  else if (path === API_ENDPOINTS.listTransfers.path) valid = (Array.isArray(value) ? value : [value]).every(row => strings(row, ['currency', 'amount', 'date', 'note', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']) && record(row) && integer(row.id) && integer(row.fromAccountId) && integer(row.toAccountId) && typeof row.deleted === 'boolean')
  else if (/\/valuations$/.test(path)) valid = (Array.isArray(value) ? value : [value]).every(row => strings(row, ['date', 'balance', 'note', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']) && record(row) && integer(row.id) && integer(row.accountId) && typeof row.deleted === 'boolean')
  else if (/^\/api\/accounts\/\d+$/.test(path)) valid = strings(value, ['name', 'currency', 'type', 'openingBalance', 'openingDate']) && record(value) && integer(value.id)
  if (!valid) throw new AuthApiError(502, 'INVALID_RESPONSE')
  return value as T
}
/** 下载与页面已应用条件一致的完整统计，释放临时URL，格式含CSV/XLSX/PDF。 */
export async function downloadReport(filters: ReportFilters, format: 'csv' | 'xlsx' | 'pdf'): Promise<void> {
  const response = await request({ ...API_ENDPOINTS.exportReport, path: `${API_ENDPOINTS.exportReport.path}?${reportQuery(filters)}&format=${format}` })
  await checkResponse(response); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a')
  link.href = url; link.download = `financial-report.${format}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
