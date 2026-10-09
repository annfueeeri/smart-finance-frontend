import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { login } from './api/auth'
import './LoginPage.css'

function LoginPage() {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const requestController = useRef<AbortController | null>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Smart Finance · ログイン'
    heading.current?.focus()
    return () => {
      document.title = previousTitle
      requestController.current?.abort()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestController.current) return
    setError('')
    if (!email.trim() || emailInput.current?.validity.typeMismatch) {
      setError('有効なメールアドレスを入力してください。')
      emailInput.current?.focus()
      return
    }
    if (!password) {
      setError('パスワードを入力してください。')
      passwordInput.current?.focus()
      return
    }

    const controller = new AbortController()
    requestController.current = controller
    setIsSubmitting(true)
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15000)
    try {
      await login({ email: email.trim(), password }, controller.signal)
      if (!controller.signal.aborted) {
        setPassword('')
        window.location.hash = '/dashboard'
      }
    } catch (cause) {
      if (timedOut) {
        setError('接続がタイムアウトしました。もう一度お試しください。')
      } else if (!controller.signal.aborted) {
        setError(cause instanceof TypeError
          ? 'サーバーに接続できませんでした。接続先と通信環境を確認してください。'
          : cause instanceof Error ? cause.message : 'ログインできませんでした。もう一度お試しください。')
      }
    } finally {
      window.clearTimeout(timeout)
      if (!controller.signal.aborted || timedOut) setIsSubmitting(false)
      requestController.current = null
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

          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <div className="form-field">
              <label htmlFor={`${id}-email`}>メールアドレス</label>
              <input id={`${id}-email`} ref={emailInput} name="email" type="email" required disabled={isSubmitting} autoComplete="username" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-password`}>パスワード</label>
              <div className="password-control">
                <input id={`${id}-password`} ref={passwordInput} name="password" required disabled={isSubmitting} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="パスワードを入力" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="password-toggle" disabled={isSubmitting} aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'} aria-pressed={showPassword} aria-controls={`${id}-password`} onClick={() => setShowPassword((previous) => !previous)}>{showPassword ? '非表示' : '表示'}</button>
              </div>
            </div>
            <button type="submit" className="login-button submit-login" disabled={isSubmitting}><span>{isSubmitting ? 'ログイン中…' : 'ログイン'}</span><span className="button-arrow" aria-hidden="true">↗</span></button>
            {error && <p className="login-error" role="alert">{error}</p>}
            <span className="login-progress" role="status">{isSubmitting ? 'ログイン情報を確認しています…' : ''}</span>
          </form>
          <div className="card-bottom"><span aria-hidden="true">✦</span><span>メールアドレスとパスワードでログイン</span></div>
        </section>
      </div>
      <footer className="footer"><span>SMART FINANCE</span><span className="footer-message"><span /> 一歩ずつ、未来へ</span><span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span></footer>
    </main>
  )
}

export default LoginPage
