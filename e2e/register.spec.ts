import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function account() {
  return { username: `register-${randomUUID()}`, password: randomUUID() }
}

async function fillRegistration(page: Page, username: string, password: string, confirmation = password) {
  await page.getByLabel('ユーザー名', { exact: true }).fill(username)
  await page.getByLabel('パスワード', { exact: true }).fill(password)
  await page.getByLabel('パスワード（確認）', { exact: true }).fill(confirmation)
}

test('registration entry appears below login on the home and login screens', async ({ page }) => {
  await page.goto('/')
  const homeLogin = await page.getByRole('link', { name: 'ログインして始める' }).boundingBox()
  const homeRegister = await page.getByRole('link', { name: '新規登録', exact: true }).boundingBox()
  expect(homeRegister!.y).toBeGreaterThanOrEqual(homeLogin!.y + homeLogin!.height)
  await page.getByRole('link', { name: 'ログインして始める' }).click()
  const login = await page.getByRole('button', { name: 'ログイン', exact: true }).boundingBox()
  const register = await page.getByRole('link', { name: '新規登録', exact: true }).boundingBox()
  expect(register!.y).toBeGreaterThanOrEqual(login!.y + login!.height)
  await page.getByRole('link', { name: '新規登録', exact: true }).click()
  await expect(page).toHaveURL(/#\/register$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'アカウントを作成' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('a registered account can log in, restore its session and log out', async ({ page }) => {
  const user = account()
  await page.goto('/#/register')
  await fillRegistration(page, user.username, user.password)
  const registration = page.waitForResponse((response) => response.url().endsWith('/api/auth/register'))
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  const result = await registration
  expect(result.status()).toBe(201)
  const payload = result.request().postDataJSON()
  // Do not print password values if an assertion fails.
  expect(payload.username === user.username && payload.password === user.password
    && payload.confirmPassword === user.password).toBe(true)
  expect(Object.keys(payload).sort()).toEqual(['confirmPassword', 'password', 'username'])
  expect(result.request().headers()['x-csrf-token']?.length).toBeGreaterThan(0)
  expect(Object.keys(await result.json())).toEqual(['username'])
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  await page.getByRole('link', { name: 'ログインへ' }).click()
  await page.getByLabel('ユーザー名', { exact: true }).fill(user.username)
  await page.getByLabel('パスワード', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(user.username)
  await page.reload()
  await expect(page.locator('.topbar-profile')).toContainText(user.username)
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page).toHaveURL(/#\/login$/)
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
})

test('invalid registration fields are rejected before sending credentials', async ({ page }) => {
  let requests = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/register')) requests++
  })
  await page.goto('/#/register')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('ユーザー名')
  await fillRegistration(page, 'invalid user', 'a-valid-password')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('空白を含まない')
  await fillRegistration(page, 'valid-user', 'short')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('8 文字以上')
  await fillRegistration(page, 'valid-user', '密'.repeat(25))
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('72 バイト以内')
  await fillRegistration(page, 'valid-user', 'a-valid-password', 'a-different-password')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('一致しません')
  await expect(page.getByLabel('パスワード（確認）', { exact: true })).toBeFocused()
  expect(requests).toBe(0)
})

test('duplicate usernames show the server error and allow a corrected retry', async ({ page }) => {
  const user = account()
  await page.goto('/#/register')
  const token = await (await page.request.get('/api/auth/csrf')).json()
  const created = await page.request.post('/api/auth/register', {
    headers: { [token.headerName]: token.token },
    data: { ...user, confirmPassword: user.password },
  })
  expect(created.status()).toBe(201)
  await fillRegistration(page, user.username, user.password)
  const registration = page.waitForResponse((response) => response.url().endsWith('/api/auth/register'))
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  expect((await registration).status()).toBe(409)
  await expect(page.getByRole('alert')).toContainText('すでに登録されています')
  await expect(page.getByRole('button', { name: 'アカウントを作成' })).toBeEnabled()
  await page.getByLabel('ユーザー名', { exact: true }).fill(`register-${randomUUID()}`)
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
})

test('failed or malformed registration responses never display success and can be retried', async ({ page }) => {
  const user = account()
  await page.goto('/#/register')
  await fillRegistration(page, user.username, user.password)
  await page.route('**/api/auth/register', (route) => route.abort())
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('サーバーに接続できませんでした')
  await page.unroute('**/api/auth/register')
  await page.route('**/api/auth/register', (route) => route.fulfill({
    status: 201, contentType: 'application/json', body: '{"success":true}',
  }))
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('正しい応答を受信できませんでした')
  await expect(page.getByRole('heading', { name: '登録完了.' })).toHaveCount(0)
  await page.unroute('**/api/auth/register')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
})
