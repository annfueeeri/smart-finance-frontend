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

/** 使用独立浏览器会话登录，确认页面显示对应账号，供权限测试准备真实会话。 */
async function login(page: Page, account: string, credential: string) {
  await page.goto('/#/login')
  await page.getByLabel('ユーザー名', { exact: true }).fill(account)
  await page.getByLabel('パスワード', { exact: true }).fill(credential)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(account)
}

test('regular users can view only their own information and cannot grant administrator access', async ({ page }) => {
  await login(page, username!, password!)
  await expect(page.locator('.topbar-profile .role-badge')).toHaveText('一般ユーザー')
  await expect(page.getByRole('link', { name: 'ユーザー一覧', exact: true })).toBeVisible()
  expect((await page.request.get('/api/admin/users')).status()).toBe(403)
  const token = await (await page.request.get('/api/auth/csrf')).json()
  expect((await page.request.put('/api/admin/users/1/role', {
    headers: { [token.headerName]: token.token }, data: { role: 'ADMIN' },
  })).status()).toBe(403)
  await page.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
  await expect(page.locator('.user-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.user-table tbody')).toContainText(username!)
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /の権限を保存/ })).toHaveCount(0)
  await expect(page.locator('.user-table time')).toHaveCount(2)
  const visible = await (await page.request.get('/api/users?username=' + adminUsername + '&role=ADMIN')).json()
  expect(visible).toHaveLength(1)
  expect(visible[0].username).toBe(username)
  await page.reload()
  await expect(page.locator('.user-table tbody tr')).toHaveCount(1)
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
    await page.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
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
    expect(Object.keys(summary).sort()).toEqual(['createdAt', 'createdBy', 'enabled', 'id', 'isDeleted', 'role', 'updatedAt', 'updatedBy', 'username'])
    expect(summary.updatedBy).toBe(adminUsername)
    expect(summary.createdAt).toBeTruthy()
    expect((await (await target.request.get('/api/auth/me')).json()).role).toBe('ADMIN')
    await page.reload()
    await expect(row.locator('.role-badge')).toHaveText('管理者')
    await target.reload()
    await expect(target.locator('.topbar-profile .role-badge')).toHaveText('管理者')
    await target.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
    await expect(target.locator('.user-table')).toBeVisible()
    // The original admin demotes the target while its admin session remains active.
    await row.getByRole('combobox').selectOption('USER')
    await row.getByRole('button', { name: `${account.username} の権限を保存` }).click()
    await expect(row.locator('.role-badge')).toHaveText('一般ユーザー')
    expect((await target.request.get('/api/admin/users')).status()).toBe(403)
    await target.reload()
    await expect(target.locator('.user-table tbody tr')).toHaveCount(1)
    await expect(target.locator('.user-table tbody')).toContainText(account.username)
    await expect(target.getByRole('combobox')).toHaveCount(0)
    await expect(target.getByRole('link', { name: 'ユーザー一覧', exact: true })).toBeVisible()
    await expect(target.locator('.topbar-profile .role-badge')).toHaveText('一般ユーザー')
  } finally { await targetContext.close() }
})

test('administrator own row is read only and the API preserves last admin protection', async ({ page }) => {
  await login(page, adminUsername!, adminPassword!)
  await page.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
  const self = page.locator('.user-table tbody tr').filter({ has: page.getByRole('rowheader').filter({ hasText: adminUsername! }) })
  await expect(self.locator('.role-badge')).toHaveText('管理者')
  await expect(self.getByRole('combobox')).toHaveCount(0)
  await expect(self.getByRole('button')).toHaveCount(0)
  await expect(self).toContainText('変更不可')
  const visible = await (await page.request.get('/api/users')).json()
  const account = visible.find((value: { username: string }) => value.username === adminUsername)
  const token = await (await page.request.get('/api/auth/csrf')).json()
  const response = await page.request.put(`/api/admin/users/${account.id}/role`, {
    headers: { [token.headerName]: token.token }, data: { role: 'USER' },
  })
  expect(response.status()).toBe(409)
  expect((await response.json()).code).toBe('LAST_ADMIN')
  await page.reload()
  await expect(self.locator('.role-badge')).toHaveText('管理者')
})
