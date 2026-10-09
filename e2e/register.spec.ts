import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function account() {
  return { displayName: '登録テストユーザー', username: `register-${randomUUID()}`, password: randomUUID() }
}

/** 填写必填姓名、独立登录账号和密码，为注册用例准备基础资料。 */
async function fillRegistration(page: Page, username: string, password: string, confirmation = password) {
  await page.getByLabel('名前・ニックネーム').fill('登録テストユーザー')
  await page.getByRole('textbox', { name: 'ログインアカウント', exact: true }).fill(username)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="confirmPassword"]').fill(confirmation)
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
  expect(Object.keys(payload).sort()).toEqual(['budgetStartDay', 'confirmPassword', 'currency', 'displayName', 'email', 'monthlyBudget', 'password', 'phone', 'timezone', 'username'])
  expect(result.request().headers()['x-csrf-token']?.length).toBeGreaterThan(0)
  const registered = await result.json()
  expect(Object.keys(registered).sort()).toEqual(['role', 'username'])
  expect(registered.role).toBe('USER')
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  await page.getByRole('link', { name: 'ログインへ' }).click()
  await page.getByLabel('ユーザー名', { exact: true }).fill(user.username)
  await page.locator('input[name="password"]').fill(user.password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.locator('.topbar-profile')).toContainText(user.username)
  await page.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
  await expect(page.locator('.user-table tbody')).toContainText(user.displayName)
  await expect(page.locator('.user-table tbody')).toContainText(user.username)
  await expect(page.locator('.user-table tbody')).toContainText('未設定')
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
  await expect(page.getByRole('alert')).toContainText('名前・ニックネーム')
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
  await expect(page.locator('input[name="confirmPassword"]')).toBeFocused()
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
  await page.getByRole('textbox', { name: 'ログインアカウント', exact: true }).fill(`register-${randomUUID()}`)
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
})

test('profile, contact details and bookkeeping preferences are saved separately from the login account', async ({ page }) => {
  const user = account()
  await page.goto('/#/register')
  await fillRegistration(page, user.username, user.password)
  await page.getByLabel('名前・ニックネーム').fill('山田 太郎')
  await page.getByLabel('連絡用メールアドレス').fill('contact@example.com')
  await page.getByLabel('電話番号', { exact: true }).fill('+81 90-1234-5678')
  await page.getByLabel('基本通貨').selectOption('CNY')
  await page.getByLabel('タイムゾーン').selectOption('Asia/Shanghai')
  await page.getByLabel('月額予算（任意）').fill('12345.67')
  await page.getByLabel('予算の開始日').selectOption('15')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('heading', { name: '登録完了.' })).toBeVisible()
  await page.getByRole('link', { name: 'ログインへ' }).click()
  await page.getByLabel('ユーザー名', { exact: true }).fill(user.username)
  await page.locator('input[name="password"]').fill(user.password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await page.getByRole('link', { name: 'ユーザー一覧', exact: true }).click()
  const row = page.locator('.user-table tbody tr')
  await expect(row).toHaveCount(1)
  for (const value of ['山田 太郎', user.username, 'contact@example.com', '+81 90-1234-5678', 'CNY', 'Asia/Shanghai', '12345.67', '毎月 15 日']) {
    await expect(row).toContainText(value)
  }
})

test('invalid optional contact data and currency precision are caught before any registration request', async ({ page }) => {
  let requests = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/auth/register')) requests++ })
  await page.goto('/#/register')
  await fillRegistration(page, 'valid-account', 'a-valid-password')
  await page.getByLabel('連絡用メールアドレス').fill('invalid-email')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('メールアドレスの形式')
  await page.getByLabel('連絡用メールアドレス').fill('')
  await page.getByLabel('電話番号', { exact: true }).fill('invalid-phone')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('電話番号')
  await page.getByLabel('電話番号', { exact: true }).fill('')
  await page.getByLabel('月額予算（任意）').fill('1.5')
  await page.getByRole('button', { name: 'アカウントを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('小数 0 桁')
  await expect(page.getByLabel('月額予算（任意）')).toBeFocused()
  expect(requests).toBe(0)
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
