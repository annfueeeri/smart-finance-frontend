import { useEffect, useState } from 'react'
import { authErrorMessage, currentUser } from './api/auth'
import type { AuthUser } from './api/auth'
import DashboardPage from './DashboardPage'

type SessionState =
  | { route: string; status: 'loading' }
  | { route: string; status: 'authenticated'; user: AuthUser }
  | { route: string; status: 'error'; message: string }

export default function AuthenticatedDashboard({ route }: { route: string }) {
  const [state, setState] = useState<SessionState>({ route, status: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function checkSession() {
      try {
        const user = await currentUser(controller.signal)
        if (controller.signal.aborted) return
        if (!user) {
          window.location.hash = '/login'
          return
        }
        setState({ route, status: 'authenticated', user })
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ route, status: 'error', message: authErrorMessage(error) })
        }
      }
    }
    void checkSession()
    window.addEventListener('focus', checkSession)
    window.addEventListener('auth:changed', checkSession)
    return () => {
      controller.abort()
      window.removeEventListener('focus', checkSession)
      window.removeEventListener('auth:changed', checkSession)
    }
  }, [route, retry])

  if (state.route === route && state.status === 'authenticated') {
    return <DashboardPage route={route} user={state.user} />
  }

  return (
    <main className="welcome session-check">
      {state.route === route && state.status === 'error' ? <>
        <p role="alert">{state.message}</p>
        <button className="login-button" type="button" onClick={() => {
          setState({ route, status: 'loading' })
          setRetry((value) => value + 1)
        }}>もう一度試す</button>
        <a href="#/login">ログイン画面へ</a>
      </> : <p role="status">ログイン状態を確認しています…</p>}
    </main>
  )
}
