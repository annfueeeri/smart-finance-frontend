import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
const username = process.env.E2E_LOGIN_USERNAME
const password = process.env.E2E_LOGIN_PASSWORD
if (!username || !password) throw new Error('Set E2E_LOGIN_USERNAME/PASSWORD for budget browser tests.')
/** 以纯年月运算得到前后月份，供模板应用和历史预算浏览器测试使用。 */
function monthOffset(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7)
}

test('real budgets track spending, warn once, preserve adjustments and apply templates to a new month', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('ユーザー名', { exact: true }).fill(username!)
  await page.getByLabel('パスワード', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(username!)
  const options = await (await page.request.get('/api/ledger/options')).json()
  const month = options.today.slice(0, 7)
  await page.getByRole('link', { name: '予算管理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '予算を設定', exact: true })).toBeVisible()
  const name = `budget-${randomUUID()}`
  await page.getByLabel('予算名', { exact: true }).fill(name)
  await page.getByRole('combobox', { name: '予算分類', exact: true }).selectOption('MEDICAL')
  await page.getByLabel('予算額', { exact: true }).fill('100')
  await page.getByLabel('通知閾値（%、カンマ区切り）').fill('25,75,100')
  const created = page.waitForResponse(response => response.url().endsWith('/api/budgets') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '予算を保存', exact: true }).click()
  expect((await created).status()).toBe(201)
  const card = page.locator('.budget-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(card).toContainText('実行率 0.00%')
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  const headers = { [csrf.headerName]: csrf.token }
  const account = await (await page.request.post('/api/accounts', { headers, data: { name: `cash-${randomUUID()}`, currency: 'JPY' } })).json()
  expect((await page.request.post('/api/transactions', { headers, data: { accountId: account.id, kind: 'EXPENSE', amount: '110', date: options.today, category: 'MEDICAL', merchant: 'Clinic', note: name } })).status()).toBe(201)
  await page.getByRole('button', { name: '最新に更新', exact: true }).click()
  await expect(card).toContainText('実行率 110.00%')
  await expect(card).toContainText('超過 10 JPY')
  await expect(page.locator('.budget-notices li')).toHaveCount(4)
  await page.getByRole('button', { name: '最新に更新', exact: true }).click()
  await expect(page.locator('.budget-notices li')).toHaveCount(4)
  await page.getByRole('button', { name: '既読にする', exact: true }).first().click()
  await expect(page.locator('.budget-notices li.unread')).toHaveCount(3)
  await card.getByRole('button', { name: '金額調整・変更履歴', exact: true }).click()
  await page.getByLabel('調整後の予算額').fill('200')
  await page.getByLabel('調整理由').fill('追加の医療費に備える')
  await page.getByRole('button', { name: '調整を保存', exact: true }).click()
  await expect(card).toContainText('実行率 55.00%')
  await expect(card).not.toContainText('超過 10 JPY')
  await expect(page.locator('.budget-adjustments')).toContainText('100.0000 → 200.0000')
  await expect(page.locator('.budget-adjustments')).toContainText('追加の医療費に備える')
  const template = `template-${randomUUID()}`
  await page.getByLabel('テンプレート名').fill(template)
  await page.getByRole('button', { name: '表示月をテンプレート保存', exact: true }).click()
  await expect(page.locator('.budget-templates')).toContainText(template)
  await page.getByRole('button', { name: `${template} を適用`, exact: true }).click()
  await expect(page.getByLabel('表示する月')).toHaveValue(monthOffset(month, 1))
  await expect(card).toContainText('実行率 0.00%')
  await expect(card).toContainText('/ 200 JPY')
  await page.getByRole('button', { name: '適用先の前月をコピー', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('既存予算は上書きされません')
  const previous = monthOffset(month, -1)
  const end = new Date(`${month}-01T00:00:00Z`); end.setUTCDate(0)
  const historical = { name: `history-${randomUUID()}`, category: 'OTHER_EXPENSE', currency: 'JPY', period: 'MONTH', start: `${previous}-01`, end: end.toISOString().slice(0, 10), amount: '100', thresholds: [50, 80, 100], rolloverMode: 'NONE' }
  expect((await page.request.post('/api/budgets', { headers, data: historical })).status()).toBe(201)
  await page.reload()
  await expect(card).toContainText('実行率 55.00%')
  await expect(page.locator('.budget-history')).toContainText(historical.name)
  await expect(page.locator('.topbar-profile .demo-badge')).toContainText('登録データ')
})
