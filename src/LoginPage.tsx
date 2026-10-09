import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorMessage, login } from './api/auth'
import './LoginPage.css'

function LoginPage() {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const usernameInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const pendingRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Smart Finance · ログイン'
    heading.current?.focus()
    return () => {
      document.title = previousTitle
      pendingRequest.current?.abort()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRequest.current) return
    const account = username.trim()
    if (!account || account.length > 64 || /\s/.test(account) || !password) {
      setError('ユーザー名とパスワードを正しく入力してください。')
      if (!account || /\s/.test(account)) usernameInput.current?.focus()
      else passwordInput.current?.focus()
      return
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('パスワードは UTF-8 で 72 バイト以内にしてください。')
      passwordInput.current?.focus()
      return
    }
    setSubmitting(true)
    setError('')
    const controller = new AbortController()
    pendingRequest.current = controller
    try {
      await login({ username: account, password }, controller.signal)
      if (!controller.signal.aborted) {
        setPassword('')
        window.location.hash = '/dashboard'
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(authErrorMessage(cause))
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
      if (pendingRequest.current === controller) pendingRequest.current = null
    }
  }

  return (
    <main className="welcome login-page">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance ホーム">
          <span className="brand-mark" aria-hidden="true">S<span>F</span></span>
          <span>SMART<span className="brand-light"> FINANCE</span></span>
        </a>
        <a className="back-link" href="#/"><span aria-hidden="true">←</span> ホームに戻る</a>
      </header>

      <div className="login-layout">
        <section className="login-story" aria-labelledby="story-title">
          <p className="eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="story-title">ログインから、<br />未来に向けて<br /><span>もう一歩。</span></h2>
          <p className="story-description">今日の積み重ねを、明日の可能性へ。<br />あなたの資産管理を、ここから続けよう。</p>
          <div className="login-art" aria-hidden="true">
            <div className="art-ring art-ring-one" />
            <div className="art-ring art-ring-two" />
            <div className="art-ring art-ring-three" />
            <div className="art-center">✦</div>
            <span className="art-label">A NEW PERSPECTIVE</span>
            <span className="art-point" />
          </div>
          <p className="story-footnote">YOUR MONEY. YOUR POSSIBILITIES.</p>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="card-topline"><span>SMART FINANCE ID</span><span aria-hidden="true">↗</span></div>
          <h1 id="login-title" ref={heading} tabIndex={-1}>おかえりなさい<span className="title-dot">.</span></h1>
          <p className="card-description">ログインして、資産管理を続けましょう。</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <div className="form-field">
              <label htmlFor={`${id}-username`}>ユーザー名</label>
              <input id={`${id}-username`} ref={usernameInput} name="username" type="text" autoComplete="username" placeholder="ユーザー名を入力" value={username} maxLength={64} required disabled={submitting} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-password`}>パスワード</label>
              <div className="password-control">
                <input id={`${id}-password`} ref={passwordInput} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="パスワードを入力" value={password} maxLength={72} required disabled={submitting} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="password-toggle" disabled={submitting} aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'} aria-pressed={showPassword} aria-controls={`${id}-password`} onClick={() => setShowPassword((previous) => !previous)}>{showPassword ? '非表示' : '表示'}</button>
              </div>
            </div>
            {error && <p className="login-error" id={`${id}-error`} role="alert">{error}</p>}
            <button type="submit" className="login-button submit-login" disabled={submitting}><span>{submitting ? 'ログイン中…' : 'ログイン'}</span><span className="button-arrow" aria-hidden="true">↗</span></button>
            <span className="login-progress" role="status">{submitting ? 'ログイン情報を確認しています…' : ''}</span>
          </form>
          <div className="card-bottom"><span aria-hidden="true">✦</span><span>登録済みのユーザー名でログインしてください</span></div>
        </section>
      </div>
      <footer className="footer"><span>SMART FINANCE</span><span className="footer-message"><span /> 一歩ずつ、未来へ</span><span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span></footer>
    </main>
  )
}

export default LoginPage
