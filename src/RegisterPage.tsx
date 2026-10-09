import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorMessage, register } from './api/auth'
import './LoginPage.css'

function RegisterPage() {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const usernameInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmInput = useRef<HTMLInputElement>(null)
  const pendingRequest = useRef<AbortController | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Smart Finance · 新規登録'
    return () => {
      document.title = previousTitle
      pendingRequest.current?.abort()
    }
  }, [])

  useEffect(() => { heading.current?.focus() }, [registered])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRequest.current) return
    const account = username.trim()
    if (!account || account.length > 64 || /\s/.test(account)) {
      setError('ユーザー名は空白を含まない 1〜64 文字で入力してください。')
      usernameInput.current?.focus()
      return
    }
    if (!password.trim() || password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError('パスワードは 8 文字以上、UTF-8 で 72 バイト以内にしてください。')
      passwordInput.current?.focus()
      return
    }
    if (password !== confirmPassword) {
      setError('確認用パスワードが一致しません。')
      confirmInput.current?.focus()
      return
    }
    setSubmitting(true)
    setError('')
    const controller = new AbortController()
    pendingRequest.current = controller
    try {
      await register({ username: account, password, confirmPassword }, controller.signal)
      if (!controller.signal.aborted) {
        setPassword('')
        setConfirmPassword('')
        setRegistered(true)
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(authErrorMessage(cause))
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
      if (pendingRequest.current === controller) pendingRequest.current = null
    }
  }

  return (
    <main className="welcome login-page register-page">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance ホーム">
          <span className="brand-mark" aria-hidden="true">S<span>F</span></span>
          <span>SMART<span className="brand-light"> FINANCE</span></span>
        </a>
        <a className="back-link" href="#/login"><span aria-hidden="true">←</span> ログインに戻る</a>
      </header>
      <div className="login-layout">
        <section className="login-story" aria-labelledby="register-story-title">
          <p className="eyebrow"><span /> YOUR FUTURE STARTS TODAY</p>
          <h2 id="register-story-title">ここから、<br />あなたの未来を<br /><span>始めよう。</span></h2>
          <p className="story-description">ひとつのアカウントから、新しい可能性へ。<br />資産管理の最初の一歩を、一緒に。</p>
          <div className="login-art" aria-hidden="true">
            <div className="art-ring art-ring-one" /><div className="art-ring art-ring-two" /><div className="art-ring art-ring-three" />
            <div className="art-center">✦</div><span className="art-label">A NEW BEGINNING</span><span className="art-point" />
          </div>
          <p className="story-footnote">YOUR MONEY. YOUR POSSIBILITIES.</p>
        </section>
        <section className="login-card" aria-labelledby="register-title">
          <div className="card-topline"><span>CREATE YOUR SMART FINANCE ID</span><span aria-hidden="true">↗</span></div>
          <h1 id="register-title" ref={heading} tabIndex={-1}>{registered ? '登録完了' : '新規登録'}<span className="title-dot">.</span></h1>
          {registered ? (
            <div className="registration-success">
              <p className="card-description" role="status">アカウントを作成しました。登録したユーザー名とパスワードでログインしてください。</p>
              <a className="login-button submit-login" href="#/login"><span>ログインへ</span><span className="button-arrow" aria-hidden="true">↗</span></a>
            </div>
          ) : (
            <>
              <p className="card-description">アカウントを作成して、資産管理を始めましょう。</p>
              <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
                <div className="form-field">
                  <label htmlFor={`${id}-username`}>ユーザー名</label>
                  <input id={`${id}-username`} ref={usernameInput} name="username" type="text" autoComplete="username" placeholder="ユーザー名を入力" value={username} maxLength={64} required disabled={submitting} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setUsername(event.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor={`${id}-password`}>パスワード</label>
                  <div className="password-control">
                    <input id={`${id}-password`} ref={passwordInput} name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8 文字以上のパスワード" value={password} maxLength={72} required disabled={submitting} aria-invalid={!!error} aria-describedby={`${id}-password-hint${error ? ` ${id}-error` : ''}`} onChange={(event) => setPassword(event.target.value)} />
                    <button type="button" className="password-toggle" disabled={submitting} aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'} aria-pressed={showPassword} aria-controls={`${id}-password ${id}-confirm`} onClick={() => setShowPassword((previous) => !previous)}>{showPassword ? '非表示' : '表示'}</button>
                  </div>
                  <p className="field-hint" id={`${id}-password-hint`}>8 文字以上、UTF-8 で 72 バイト以内（日本語は通常 1 文字 3 バイト）</p>
                </div>
                <div className="form-field">
                  <label htmlFor={`${id}-confirm`}>パスワード（確認）</label>
                  <input id={`${id}-confirm`} ref={confirmInput} name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="同じパスワードをもう一度入力" value={confirmPassword} maxLength={72} required disabled={submitting} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
                {error && <p className="login-error" id={`${id}-error`} role="alert">{error}</p>}
                <button type="submit" className="login-button submit-login" disabled={submitting}><span>{submitting ? '登録中…' : 'アカウントを作成'}</span><span className="button-arrow" aria-hidden="true">↗</span></button>
                <a className="register-button" href="#/login">登録済みの方はログイン</a>
                <span className="login-progress" role="status">{submitting ? 'アカウントを作成しています…' : ''}</span>
              </form>
            </>
          )}
        </section>
      </div>
      <footer className="footer"><span>SMART FINANCE</span><span className="footer-message"><span /> 一歩ずつ、未来へ</span><span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span></footer>
    </main>
  )
}

export default RegisterPage
