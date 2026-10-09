import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const adminUsername = process.env.E2E_ADMIN_USERNAME
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const username = process.env.E2E_LOGIN_USERNAME
const password = process.env.E2E_LOGIN_PASSWORD
if (!adminUsername || !adminPassword || !username || !password) {
  throw new Error('Set E2E_ADMIN_USERNAME/PASSWORD and E2E_LOGIN_USERNAME/PASSWORD for separate ADMIN and USER accounts.')
}

async function login(page: Page, account: string, credential: string) {
  await page.goto('/#/login')
  await page.getByLabel('ユーザー名', { exact: true }).fill(account)
  await page.getByLabel('パスワード', { exact: true }).fill(credential)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(account)
}

test('regular users cannot open user management or grant themselves administrator access', async ({ page }) => {
  await login(page, username!, password!)
  await expect(page.locator('.topbar-profile .role-badge')).toHaveText('一般ユーザー')
  await expect(page.getByRole('link', { name: 'ユーザー管理', exact: true })).toHaveCount(0)
  expect((await page.request.get('/api/admin/users')).status()).toBe(403)
  const token = await (await page.request.get('/api/auth/csrf')).json()
  expect((await page.request.put('/api/admin/users/1/role', {
    headers: { [token.headerName]: token.token }, data: { role: 'ADMIN' },
  })).status()).toBe(403)
  await page.goto('/#/dashboard/users')
  await expect(page.getByRole('alert')).toContainText('管理者だけ')
  await expect(page.locator('.user-table')).toHaveCount(0)
})

test('administrator changes persist and update the target existing session immediately', async ({ page, browser }) => {
  await login(page, adminUsername!, adminPassword!)
  const account = { username: `role-browser-${randomUUID()}`, password: randomUUID() }
  const token = await (await page.request.get('/api/auth/csrf')).json()
  expect((await page.request.post('/api/auth/register', {
    headers: { [token.headerName]: token.token }, data: { ...account, confirmPassword: account.password },
  })).status()).toBe(201)
  const targetContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' })
  try {
    const target = await targetContext.newPage()
    await login(target, account.username, account.password)
    await page.getByRole('link', { name: 'ユーザー管理', exact: true }).click()
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: account.username, exact: true }) })
    await expect(row.locator('.role-badge')).toHaveText('一般ユーザー')
    await row.getByRole('combobox').selectOption('ADMIN')
    const update = page.waitForResponse((value) => /\/api\/admin\/users\/\d+\/role$/.test(value.url()))
    await row.getByRole('button', { name: `${account.username} の権限を保存` }).click()
    const response = await update
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({ role: 'ADMIN' })
    expect(response.request().headers()['x-csrf-token']?.length).toBeGreaterThan(0)
    const summary = await response.json()
    expect(Object.keys(summary).sort()).toEqual(['enabled', 'id', 'role', 'username'])
    expect((await (await target.request.get('/api/auth/me')).json()).role).toBe('ADMIN')
    await page.reload()
    await expect(row.locator('.role-badge')).toHaveText('管理者')
    await target.reload()
    await expect(target.locator('.topbar-profile .role-badge')).toHaveText('管理者')
    await target.getByRole('link', { name: 'ユーザー管理', exact: true }).click()
    await expect(target.locator('.user-table')).toBeVisible()
    // The original admin demotes the target while its admin session remains active.
    await row.getByRole('combobox').selectOption('USER')
    await row.getByRole('button', { name: `${account.username} の権限を保存` }).click()
    await expect(row.locator('.role-badge')).toHaveText('一般ユーザー')
    expect((await target.request.get('/api/admin/users')).status()).toBe(403)
    await target.reload()
    await expect(target.getByRole('alert')).toContainText('管理者だけ')
    await expect(target.getByRole('link', { name: 'ユーザー管理', exact: true })).toHaveCount(0)
    await expect(target.locator('.topbar-profile .role-badge')).toHaveText('一般ユーザー')
  } finally { await targetContext.close() }
})

test('the last administrator cannot remove their own administrator role', async ({ page }) => {
  await login(page, adminUsername!, adminPassword!)
  await page.getByRole('link', { name: 'ユーザー管理', exact: true }).click()
  const select = page.getByRole('combobox', { name: `${adminUsername} の権限`, exact: true })
  await select.selectOption('USER')
  const update = page.waitForResponse((value) => /\/api\/admin\/users\/\d+\/role$/.test(value.url()))
  await page.getByRole('button', { name: `${adminUsername} の権限を保存`, exact: true }).click()
  const response = await update
  expect(response.status()).toBe(409)
  expect((await response.json()).code).toBe('LAST_ADMIN')
  await expect(page.getByRole('alert')).toContainText('最後の有効な管理者')
  await page.reload()
  await expect(select).toHaveValue('ADMIN')
  await expect(page.locator('.topbar-profile .role-badge')).toHaveText('管理者')
})
