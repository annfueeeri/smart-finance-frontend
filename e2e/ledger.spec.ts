import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const username = process.env.E2E_LOGIN_USERNAME
const password = process.env.E2E_LOGIN_PASSWORD
if (!username || !password) throw new Error('Set E2E_LOGIN_USERNAME and E2E_LOGIN_PASSWORD for ledger tests.')
/** 登录本人并通过侧边栏打开实际收支页面。 */
async function openLedger(page: Page) {
  await page.goto('/#/login')
  await page.getByLabel('ユーザー名', { exact: true }).fill(username!)
  await page.getByLabel('パスワード', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(username!)
  await page.getByRole('link', { name: '収支明細', exact: true }).click()
  await expect(page.getByRole('heading', { name: '収支を登録' })).toBeVisible()
  await expect(page.getByLabel('口座通貨', { exact: true })).toHaveValue('JPY')
}
/** 在界面创建独立人民币账户，供小数金额录入和映射导入使用。 */
async function createAccount(page: Page, name: string) {
  const details = page.locator('details').filter({ has: page.locator('summary', { hasText: '口座を追加' }) })
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click()
  await page.getByLabel('口座名', { exact: true }).fill(name)
  await page.getByLabel('口座通貨', { exact: true }).fill('CNY')
  await page.getByRole('button', { name: '口座を保存', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('口座を登録しました。')
  await expect(page.getByLabel('支払・入金口座')).toContainText(name)
}

test('records income and expenses, persists after refresh and exports filtered personal data', async ({ page }) => {
  await openLedger(page)
  const account = `ledger-${randomUUID()}`
  await createAccount(page, account)
  await page.getByRole('combobox', { name: '収支区分', exact: true }).selectOption('INCOME')
  await page.getByLabel('金額 (CNY)', { exact: true }).fill('1234.56')
  await page.getByLabel('取引日', { exact: true }).fill('2026-10-08')
  await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('SALARY')
  await page.getByLabel('メモ', { exact: true }).fill(account + '-salary')
  const saved = page.waitForResponse(response => response.url().endsWith('/api/transactions') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '収支を保存' }).click()
  expect((await saved).status()).toBe(201)
  await expect(page.locator('.ledger-table tbody')).toContainText(account + '-salary')
  await page.getByRole('combobox', { name: '収支区分', exact: true }).selectOption('EXPENSE')
  await page.getByLabel('金額 (CNY)', { exact: true }).fill('45.67')
  await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('FOOD')
  await page.getByLabel('店舗・取引先', { exact: true }).fill('Cafe')
  await page.getByLabel('メモ', { exact: true }).fill(account + '-food')
  await page.getByRole('button', { name: '収支を保存' }).click()
  await expect(page.locator('.ledger-table tbody')).toContainText(account + '-food')
  await page.reload()
  await expect(page.locator('.ledger-table tbody')).toContainText(account + '-salary')
  await page.getByRole('combobox', { name: '種類で絞り込み', exact: true }).selectOption('EXPENSE')
  const options = await (await page.request.get('/api/ledger/options')).json()
  const id = options.accounts.find((value: { name: string }) => value.name === account).id
  await page.getByRole('combobox', { name: '口座で絞り込み', exact: true }).selectOption(String(id))
  await page.getByRole('button', { name: '絞り込む', exact: true }).click()
  await expect(page.locator('.ledger-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.ledger-table tbody')).not.toContainText(account + '-salary')
  for (const [name, extension] of [['CSV をエクスポート', 'csv'], ['Excel をエクスポート', 'xlsx']]) {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name, exact: true }).click()
    expect((await download).suggestedFilename()).toBe(`transactions.${extension}`)
  }
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page).toHaveURL(/#\/login$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible()
})

test('maps CSV columns, previews duplicates and errors, imports valid rows once', async ({ page }) => {
  await openLedger(page)
  const account = `import-${randomUUID()}`
  await createAccount(page, account)
  const note = `import-note-${randomUUID()}`
  const contents = `value,when,description\n12.34,2026-10-09,${note}\n12.34,2026-10-09,${note}\nabc,2026-10-09,bad\n`
  await page.getByLabel('流水ファイル').setInputFiles({ name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) })
  await page.getByRole('button', { name: 'ファイルを読み込む' }).click()
  await expect(page.getByRole('heading', { name: 'フィールドの対応付け · 3行' })).toBeVisible()
  await page.getByRole('combobox', { name: '金額（必須）', exact: true }).selectOption('0')
  await page.getByRole('combobox', { name: '日付（必須）', exact: true }).selectOption('1')
  await page.getByRole('combobox', { name: 'メモ', exact: true }).selectOption('2')
  await page.getByRole('combobox', { name: '既定のカテゴリ', exact: true }).selectOption('FOOD')
  await page.getByRole('button', { name: 'データをプレビュー' }).click()
  await expect(page.getByRole('status')).toContainText('有効 2件 / 重複 1件 / エラー 1件')
  await expect(page.locator('.import-preview tbody tr')).toHaveCount(3)
  const before = await (await page.request.get('/api/transactions')).json()
  expect(before.items.some((value: { note: string }) => value.note === note)).toBe(false)
  await page.getByRole('button', { name: '確認してインポート' }).click()
  await expect(page.getByRole('status')).toContainText('1件を登録しました。重複1件をスキップしました。')
  await expect(page.locator('.ledger-table tbody')).toContainText(note)
  await page.reload()
  const after = await (await page.request.get('/api/transactions')).json()
  expect(after.items.filter((value: { note: string }) => value.note === note)).toHaveLength(1)
})
