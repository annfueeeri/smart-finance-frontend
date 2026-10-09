import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const username = process.env.E2E_LOGIN_USERNAME
const password = process.env.E2E_LOGIN_PASSWORD
if (!username || !password) {
  throw new Error('Set E2E_LOGIN_USERNAME and E2E_LOGIN_PASSWORD for an existing backend test account.')
}

async function fillCredentials(page: Page, value = password!) {
  await page.getByLabel('ユーザー名', { exact: true }).fill(username!)
  await page.getByLabel('パスワード', { exact: true }).fill(value)
}

async function signIn(page: Page) {
  await page.goto('/#/login')
  await fillCredentials(page)
  const response = page.waitForResponse((value) => value.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  const result = await response
  expect(result.status()).toBe(200)
  // Only assert booleans here: a failed assertion must not print password values.
  const body = result.request().postDataJSON()
  expect(body.username === username && body.password === password).toBe(true)
  expect(Object.keys(body).sort()).toEqual(['password', 'username'])
  expect(result.request().headers()['x-csrf-token']?.length).toBeGreaterThan(0)
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.locator('.topbar-profile')).toContainText(username!)
}

test('direct dashboard navigation requires a real session', async ({ page }) => {
  await page.goto('/#/dashboard')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByLabel('ユーザー名', { exact: true })).toBeVisible()
  await expect(page.locator('.dashboard')).toHaveCount(0)
})

test('empty fields and invalid passwords cannot enter the dashboard', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('ユーザー名とパスワード')
  await fillCredentials(page, password === 'incorrect-password' ? 'different-password' : 'incorrect-password')
  const response = page.waitForResponse((value) => value.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  expect((await response).status()).toBe(401)
  await expect(page.getByRole('alert')).toContainText('正しくありません')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeEnabled()
})

test('login retains HttpOnly session, survives reload, and logout invalidates it', async ({ page, context }) => {
  await signIn(page)
  const session = (await context.cookies()).find((cookie) => cookie.name === 'JSESSIONID')
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe('Strict')
  await page.reload()
  await expect(page.locator('.topbar-profile')).toContainText(username!)
  const logoutResponse = page.waitForResponse((value) => value.url().endsWith('/api/auth/logout'))
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  expect((await logoutResponse).status()).toBe(204)
  await expect(page).toHaveURL(/#\/login$/)
  await page.goto('/#/dashboard')
  await expect(page).toHaveURL(/#\/login$/)
})

test('a failed login request shows an error and permits retry', async ({ page }) => {
  await page.goto('/#/login')
  await page.route('**/api/auth/login', (route) => route.abort())
  await fillCredentials(page)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('サーバーに接続できませんでした')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeEnabled()
  await page.unroute('**/api/auth/login')
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(username!)
})

test('a login timeout shows an error and re-enables the form', async ({ page }) => {
  await page.goto('/#/login')
  await page.route('**/api/auth/login', () => { /* Hold the request until the client timeout. */ })
  await fillCredentials(page)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('接続がタイムアウトしました', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/#\/login$/)
})

test('the former success-only response cannot be mistaken for an authenticated user', async ({ page }) => {
  await page.goto('/#/login')
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"success":true}',
  }))
  await fillCredentials(page)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('正しい応答を受信できませんでした')
  await expect(page).toHaveURL(/#\/login$/)
})

test('a failed logout does not pretend the session has ended', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/auth/logout', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: '{"code":"UNAVAILABLE"}',
  }))
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('サーバーに接続できませんでした')
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.getByRole('button', { name: 'ログアウト', exact: true })).toBeEnabled()
  await page.unroute('**/api/auth/logout')
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page).toHaveURL(/#\/login$/)
})

test('an expired server session is detected on the next dashboard route', async ({ page }) => {
  await signIn(page)
  const csrfResponse = await page.request.get('/api/auth/csrf')
  const csrf = await csrfResponse.json()
  const response = await page.request.post('/api/auth/logout', {
    headers: { [csrf.headerName]: csrf.token },
  })
  expect(response.status()).toBe(204)
  await page.getByRole('link', { name: '収支明細', exact: true }).click()
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.locator('.dashboard')).toHaveCount(0)
})
