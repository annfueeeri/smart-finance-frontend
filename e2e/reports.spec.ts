import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const username = process.env.E2E_LOGIN_USERNAME
const password = process.env.E2E_LOGIN_PASSWORD
if (!username || !password) throw new Error('Set E2E_LOGIN_USERNAME and E2E_LOGIN_PASSWORD for report tests.')
/** 登录真实服务并打开本人账户管理。 */
async function login(page: Page) {
  await page.goto('/#/login')
  await page.getByLabel('ユーザー名', { exact: true }).fill(username!)
  await page.getByLabel('パスワード', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(username!)
  await page.getByRole('link', { name: '口座管理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '口座を新規登録' })).toBeVisible()
}
/** 从真实账户选项找到界面刚创建的账户，不使用固定主键。 */
async function accountId(page: Page, name: string): Promise<number> {
  const value = await (await page.request.get('/api/ledger/options')).json()
  return value.accounts.find((account: { name: string }) => account.name === name).id
}
/** 在界面登记有基准日期和余额的人民币账户。 */
async function createAccount(page: Page, name: string, balance: string) {
  await page.getByLabel('新規口座名', { exact: true }).fill(name)
  await page.getByLabel('新規口座通貨', { exact: true }).fill('CNY')
  await page.getByLabel('期初残高', { exact: true }).fill(balance)
  await page.getByLabel('期初基準日', { exact: true }).fill('2026-10-01')
  await page.getByRole('button', { name: '新規口座を保存', exact: true }).click()
  await expect(page.locator('.accounts-table')).toContainText(name)
  return accountId(page, name)
}

test('account baseline, tagged transactions, transfer, valuation and downloadable reports agree', async ({ page }) => {
  await login(page)
  const bankName = `report-bank-${randomUUID()}`
  const bank = await createAccount(page, bankName, '1000.00')
  const cash = await createAccount(page, `report-cash-${randomUUID()}`, '0.00')
  await page.getByRole('link', { name: '収支明細', exact: true }).click()
  await expect(page.getByRole('heading', { name: '収支を登録' })).toBeVisible()
  await page.getByRole('combobox', { name: '支払・入金口座', exact: true }).selectOption(String(bank))
  await page.getByRole('combobox', { name: '収支区分', exact: true }).selectOption('INCOME')
  await page.getByLabel('金額 (CNY)', { exact: true }).fill('500.00')
  await page.getByLabel('取引日', { exact: true }).fill('2026-10-02')
  await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('SALARY')
  await page.getByRole('button', { name: '収支を保存', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('収支を登録しました。')
  await page.getByRole('combobox', { name: '収支区分', exact: true }).selectOption('EXPENSE')
  await page.getByLabel('金額 (CNY)', { exact: true }).fill('123.45')
  await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('FOOD')
  await page.getByLabel('店舗・取引先', { exact: true }).fill('旅行商店')
  const tag = `旅行-${randomUUID().slice(0, 8)}`
  await page.getByLabel('タグ（カンマ区切り）', { exact: true }).fill(tag)
  await page.getByRole('button', { name: '収支を保存', exact: true }).click()
  await expect(page.locator('.ledger-table tbody')).toContainText(tag)
  await page.getByRole('link', { name: '口座管理', exact: true }).click()
  await page.getByRole('combobox', { name: '振替元口座', exact: true }).selectOption(String(bank))
  await page.getByRole('combobox', { name: '振替先口座', exact: true }).selectOption(String(cash))
  await page.getByLabel('振替金額', { exact: true }).fill('200.00')
  await page.getByLabel('振替日', { exact: true }).fill('2026-10-03')
  await page.getByRole('button', { name: '内部振替を保存', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('振替を記録しました')
  await page.getByRole('combobox', { name: '評価する口座', exact: true }).selectOption(String(bank))
  await page.getByLabel('評価日', { exact: true }).fill('2026-10-04')
  await page.getByLabel('日終残高・評価額', { exact: true }).fill('1300.00')
  await page.getByRole('button', { name: '日終評価を保存', exact: true }).click()
  await expect(page.locator('.valuation-table tbody')).toContainText('1300.0000')
  await page.getByRole('link', { name: '財務レポート', exact: true }).click()
  await expect(page.getByRole('heading', { name: '財務レポートを作成' })).toBeVisible()
  await page.getByLabel('集計開始日', { exact: true }).fill('2026-10-01')
  await page.getByLabel('集計終了日', { exact: true }).fill('2026-10-04')
  await page.getByRole('combobox', { name: '集計口座', exact: true }).selectOption(String(bank))
  await page.getByRole('button', { name: 'レポートを表示', exact: true }).click()
  await expect(page.locator('.report-summary')).toContainText('500.00')
  await expect(page.locator('.report-summary')).toContainText('123.45')
  await expect(page.locator('.report-summary')).toContainText('376.55')
  await expect(page.locator('.report-cash-flow tbody')).toContainText('200.00')
  await expect(page.locator('.report-cash-flow tbody')).toContainText('1300.00')
  await expect(page.locator('.report-assets tbody tr').last()).toContainText('1300.00')
  await expect(page.getByRole('img', { name: '収支の推移', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: '集計タグ', exact: true }).selectOption(tag)
  await page.getByRole('button', { name: 'レポートを表示', exact: true }).click()
  await expect(page.locator('.report-summary article').first()).toContainText('0.00')
  await expect(page.locator('.report-summary')).toContainText('123.45')
  await expect(page.locator('.report-cash-flow tbody')).toContainText('500.00')
  for (const [name, extension] of [['CSV を保存', 'csv'], ['Excel を保存', 'xlsx'], ['PDF を保存', 'pdf']]) {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name, exact: true }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe(`financial-report.${extension}`)
    expect(await file.failure()).toBeNull()
  }
  await page.reload()
  await expect(page.getByRole('heading', { name: '財務レポートを作成' })).toBeVisible()
  await page.getByRole('combobox', { name: '集計口座', exact: true }).selectOption(String(bank))
  await page.getByRole('button', { name: 'レポートを表示', exact: true }).click()
  await expect(page.locator('.report-summary')).toContainText('123.45')
})
