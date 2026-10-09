export interface LoginRequest {
  email: string
  password: string
}

export async function login(parameters: LoginRequest, signal: AbortSignal): Promise<void> {
  const response = await fetch(import.meta.env.VITE_LOGIN_API_URL || '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(parameters),
    signal,
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('メールアドレスまたはパスワードが正しくありません。')
  }
  if (response.status === 429) {
    throw new Error('試行回数が多すぎます。しばらく待ってからお試しください。')
  }
  if (!response.ok) {
    throw new Error('ログインできませんでした。しばらく待ってからお試しください。')
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error('サーバーから正しい応答を受信できませんでした。')
  }
  if (typeof result !== 'object' || result === null || !('success' in result)) {
    throw new Error('サーバーから正しい応答を受信できませんでした。')
  }
  if (result.success === false) {
    throw new Error('メールアドレスまたはパスワードが正しくありません。')
  }
  if (result.success !== true) {
    throw new Error('サーバーから正しい応答を受信できませんでした。')
  }
}
