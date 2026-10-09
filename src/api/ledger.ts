import { API_ENDPOINTS } from './endpoints'
import type { ApiEndpoint } from './endpoints'
import { request, checkResponse, responseBody, csrfToken, AuthApiError } from './auth'
export type Account = { id: number; name: string; currency: string }
export type EntryInput = { accountId: number; kind: string; amount: string; date: string; category: string; merchant: string; note: string }
export type Entry = EntryInput & { id: number; currency: string; accountName: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; deleted: boolean }
export type Options = { accounts: Account[]; categories: { code: string; kind: string; name: string }[]; currency: string; timezone: string; today: string }
export type EntryPage = { items: Entry[]; total: number; page: number; size: number }
export type Filters = { kind: string; start: string; end: string; accountId: string }
export type Inspection = { headers: string[]; sampleRows: string[][]; totalRows: number }
export type Mapping = { columns: Record<string, number>; defaultKind: string; defaultAccountId: number | null; defaultCategory: string | null }
export type Preview = { rows: { rowNumber: number; entry: EntryInput | null; duplicate: boolean; errors: string[] }[]; valid: number; duplicates: number; invalid: number }
/** 判断响应是否为普通 JSON 对象，避免数组或 null 被当成数据结构。 */
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
/** 检查非负安全整数，主键和源行号必须大于零。 */
function integer(value: unknown, positive = false): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= (positive ? 1 : 0)
}
/** 验证账户选项的基础字段，防止与后端账户结构不一致时静默使用错误字段。 */
function accountValue(value: unknown): boolean {
  return record(value) && integer(value.id, true) && typeof value.name === 'string' && typeof value.currency === 'string'
}
/** 验证预览或流水的共同字段；金额必须是字符串，避免浮点转换。 */
function entryValue(value: unknown): boolean {
  return record(value) && integer(value.accountId, true) && (value.kind === 'INCOME' || value.kind === 'EXPENSE')
    && ['amount', 'date', 'category', 'merchant', 'note'].every(field => typeof value[field] === 'string')
}
/** 验证标准流水的主键、账户及审计字段。 */
function savedEntryValue(value: unknown): boolean {
  return record(value) && entryValue(value) && integer(value.id, true) && typeof value.deleted === 'boolean'
    && ['currency', 'accountName', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'].every(field => typeof value[field] === 'string')
}
/** 按完整路径验证各 API 返回结构，字段缺失或金额类型不匹配时给出接口异常提示。 */
function validResponse(path: string, value: unknown): boolean {
  if (!record(value)) return false
  if (path === API_ENDPOINTS.ledgerOptions.path) {
    return Array.isArray(value.accounts) && value.accounts.every(accountValue)
      && Array.isArray(value.categories) && value.categories.every(category => record(category)
        && ['code', 'kind', 'name'].every(field => typeof category[field] === 'string'))
      && ['currency', 'timezone', 'today'].every(field => typeof value[field] === 'string')
  }
  if (path === API_ENDPOINTS.createAccount.path) return accountValue(value)
  if (path === API_ENDPOINTS.listTransactions.path) {
    if ('items' in value) return Array.isArray(value.items) && value.items.every(savedEntryValue)
      && integer(value.total) && integer(value.page) && integer(value.size, true)
    return savedEntryValue(value)
  }
  if (path === API_ENDPOINTS.inspectImport.path) return Array.isArray(value.headers) && value.headers.every(header => typeof header === 'string')
    && Array.isArray(value.sampleRows) && value.sampleRows.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string')) && integer(value.totalRows, true)
  if (path === API_ENDPOINTS.previewImport.path) return Array.isArray(value.rows) && value.rows.every(row => record(row)
    && integer(row.rowNumber, true) && (row.entry === null || entryValue(row.entry)) && typeof row.duplicate === 'boolean'
    && Array.isArray(row.errors) && row.errors.every(error => typeof error === 'string'))
    && ['valid', 'duplicates', 'invalid'].every(field => integer(value[field]))
  if (path === API_ENDPOINTS.commitImport.path) return integer(value.imported) && integer(value.skipped)
  return false
}
/** 使用集中声明的完整路径获取 JSON，写入操作实时获取 CSRF，文件上传保留浏览器生成的边界。 */
export async function ledgerRequest<T>(endpoint: ApiEndpoint, body?: unknown): Promise<T> {
  const headers = new Headers()
  if (endpoint.method !== 'GET') { const token = await csrfToken(); headers.set(token.headerName, token.token) }
  if (body !== undefined && !(body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await request(endpoint, { headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) })
  await checkResponse(response)
  const value = await responseBody(response)
  if (!validResponse(endpoint.path.split('?')[0], value)) throw new AuthApiError(502, 'INVALID_RESPONSE')
  return value as T
}
/** 仅将已填写的白名单筛选字段放入 URL，不携带客户端身份或用户 ID。 */
export function filterQuery(filters: Filters): URLSearchParams {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
}
/** 根据个人筛选条件下载完整 CSV/XLSX，释放临时下载 URL。 */
export async function downloadEntries(filters: Filters, format: 'csv' | 'xlsx'): Promise<void> {
  const query = filterQuery(filters); query.set('format', format)
  const response = await request({ ...API_ENDPOINTS.exportTransactions, path: `${API_ENDPOINTS.exportTransactions.path}?${query}` })
  await checkResponse(response)
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a')
  link.href = url; link.download = `transactions.${format}`; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
