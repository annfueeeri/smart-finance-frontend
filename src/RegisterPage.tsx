import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorMessage, register } from './api/auth'
import './LoginPage.css'
import './RegisterPage.css'

/** 展示完整注册资料，姓名与账号独立；联系信息可选，成功后引导用户单独登录。 */
function RegisterPage() {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const pendingRequest = useRef<AbortController | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState('JPY')
  const [timezone, setTimezone] = useState('Asia/Tokyo')
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [budgetStartDay, setBudgetStartDay] = useState('1')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState({ field: '', message: '' })
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

  /** 显示对应字段的错误，并将焦点移到该输入框，便于直接修正。 */
  function reject(field: string, message: string) {
    setError({ field, message })
    const input = form.current?.elements.namedItem(field)
    if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) input.focus()
  }

  /** 校验并提交完整资料；后端决定身份及审计字段，不自动建立登录会话。 */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRequest.current) return
    const name = displayName.trim()
    const account = username.trim()
    const contactEmail = email.trim()
    const contactPhone = phone.trim()
    const budget = monthlyBudget.trim()
    if (!name || name.length > 80 || Array.from(name).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      reject('displayName', '名前・ニックネームを 1〜80 文字で入力してください。')
      return
    }
    if (!account || account.length > 64 || /\s/.test(account)) {
      reject('username', 'ログインアカウントは空白を含まない 1〜64 文字で入力してください。')
      return
    }
    if (contactEmail.length > 254 || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
      reject('email', '連絡用メールアドレスの形式を確認してください。未入力でも登録できます。')
      return
    }
    if (contactPhone.length > 32 || (contactPhone && !/^\+?[0-9][0-9 ()-]{5,29}[0-9]$/.test(contactPhone))) {
      reject('phone', '電話番号は 7〜32 文字で入力してください。数字・国番号（+）・空白・括弧・ハイフンが使えます。')
      return
    }
    const fractionDigits = new Intl.NumberFormat('ja-JP', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    if (budget && (!/^[0-9]{1,12}(\.[0-9]{1,4})?$/.test(budget) || (budget.split('.')[1]?.length ?? 0) > fractionDigits)) {
      reject('monthlyBudget', `${currency} の月額予算は 0 以上、整数 12 桁以内・小数 ${fractionDigits} 桁以内で入力してください。`)
      return
    }
    const startDay = Number(budgetStartDay)
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
      reject('budgetStartDay', '予算の開始日は 1〜28 日から選んでください。')
      return
    }
    if (!password.trim() || password.length < 8 || new TextEncoder().encode(password).length > 72) {
      reject('password', 'パスワードは 8 文字以上、UTF-8 で 72 バイト以内にしてください。')
      return
    }
    if (password !== confirmPassword) {
      reject('confirmPassword', '確認用パスワードが一致しません。')
      return
    }
    setSubmitting(true)
    setError({ field: '', message: '' })
    const controller = new AbortController()
    pendingRequest.current = controller
    try {
      await register({ username: account, displayName: name, email: contactEmail, phone: contactPhone,
        currency, timezone, monthlyBudget: budget, budgetStartDay: startDay,
        password, confirmPassword }, controller.signal)
      if (!controller.signal.aborted) {
        setUsername(account)
        setDisplayName(name)
        setPassword('')
        setConfirmPassword('')
        setRegistered(true)
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError({ field: '', message: authErrorMessage(cause) })
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
      if (pendingRequest.current === controller) pendingRequest.current = null
    }
  }

  /** 为输入框关联错误信息，只将存在错误的具体字段标记为无效。 */
  function feedback(field: string, hint?: string) {
    return {
      'aria-invalid': error.field === field,
      'aria-describedby': [hint, error.field === field ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined,
    }
  }

  return (
    <main className="welcome login-page register-page">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance ホーム"><span className="brand-mark" aria-hidden="true">S<span>F</span></span><span>SMART<span className="brand-light"> FINANCE</span></span></a>
        <a className="back-link" href="#/login"><span aria-hidden="true">←</span> ログインに戻る</a>
      </header>
      <div className="login-layout">
        <section className="login-story" aria-labelledby="register-story-title">
          <p className="eyebrow"><span /> YOUR PERSONAL FINANCE SPACE</p>
          <h2 id="register-story-title">あなたらしい<br /><span>アカウントで、</span><br />新しい一歩を。</h2>
          <p className="story-description">表示する名前と、ログインに使うアカウント。<br />それぞれを自由に選んで始めましょう。</p>
          <div className="register-profile-preview" aria-hidden="true"><span className="register-avatar">{Array.from(displayName.trim())[0] || 'S'}</span><div><strong>{displayName.trim() || 'あなたの名前'}</strong><span>{username.trim() || 'your_account'}</span></div><span className="register-profile-mark">✦</span></div>
          <ul className="register-benefits"><li><span>01</span><div><strong>名前とアカウントを分けて登録</strong><p>名前はニックネームでも大丈夫。</p></div></li><li><span>02</span><div><strong>メール以外のアカウントも選べます</strong><p>英数字、日本語、メール形式に対応。</p></div></li><li><span>03</span><div><strong>連絡先は、必要なものだけ</strong><p>メール・電話番号は任意です。</p></div></li></ul>
          <p className="story-footnote">YOUR MONEY. YOUR POSSIBILITIES.</p>
        </section>
        <section className="login-card register-card" aria-labelledby="register-title">
          <div className="card-topline"><span>CREATE YOUR SMART FINANCE ID</span><span aria-hidden="true">↗</span></div>
          <h1 id="register-title" ref={heading} tabIndex={-1}>{registered ? '登録完了' : '新規登録'}<span className="title-dot">.</span></h1>
          {registered ? <div className="registration-success">
            <span className="register-success-mark" aria-hidden="true">✓</span>
            <p className="card-description" role="status">{displayName} さん、アカウントを作成しました。登録したログインアカウントとパスワードでログインしてください。</p>
            <dl className="register-success-account"><dt>ログインアカウント</dt><dd>{username}</dd></dl>
            <a className="login-button submit-login" href="#/login"><span>ログインへ</span><span className="button-arrow" aria-hidden="true">↗</span></a>
          </div> : <>
            <p className="card-description">あなたの情報を登録して、資産管理を始めましょう。<span className="register-required-note">＊ は必須項目です</span></p>
            <form ref={form} className="login-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <fieldset className="register-section" disabled={submitting}>
                <legend><span>01</span> 基本情報</legend>
                <div className="form-field"><label htmlFor={`${id}-name`}>名前・ニックネーム <span className="required-mark" aria-hidden="true">＊</span></label><input id={`${id}-name`} name="displayName" autoComplete="name" placeholder="例：山田 太郎、たろう" value={displayName} maxLength={80} required {...feedback('displayName', `${id}-name-hint`)} onChange={(event) => setDisplayName(event.target.value)} /><p className="field-hint" id={`${id}-name-hint`}>表示する名前です。ログインアカウントとは別に登録します。</p></div>
                <div className="form-field"><label htmlFor={`${id}-username`}>ログインアカウント <span className="required-mark" aria-hidden="true">＊</span></label><input id={`${id}-username`} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="例：taro_2026、山田太郎、taro@example.com" value={username} maxLength={64} required {...feedback('username', `${id}-account-hint`)} onChange={(event) => setUsername(event.target.value)} /><p className="field-hint" id={`${id}-account-hint`}>メール形式でなくても登録できます。1〜64 文字、空白は使えません。</p></div>
              </fieldset>
              <fieldset className="register-section" disabled={submitting}>
                <legend><span>02</span> 連絡先 <small>任意</small></legend>
                <div className="register-field-grid">
                  <div className="form-field"><label htmlFor={`${id}-email`}>連絡用メールアドレス</label><input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="taro@example.com" value={email} maxLength={254} {...feedback('email')} onChange={(event) => setEmail(event.target.value)} /></div>
                  <div className="form-field"><label htmlFor={`${id}-phone`}>電話番号</label><input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="+81 90-1234-5678" value={phone} maxLength={32} {...feedback('phone')} onChange={(event) => setPhone(event.target.value)} /></div>
                </div><p className="field-hint">どちらも未入力で登録できます。ログインには上のログインアカウントを使用します。</p>
              </fieldset>
              <fieldset className="register-section" disabled={submitting}>
                <legend><span>03</span> 記帳の設定</legend>
                <div className="register-field-grid">
                  <div className="form-field"><label htmlFor={`${id}-currency`}>基本通貨</label><select id={`${id}-currency`} name="currency" value={currency} {...feedback('currency')} onChange={(event) => setCurrency(event.target.value)}>{[['JPY', '日本円'], ['CNY', '人民元'], ['USD', '米ドル'], ['EUR', 'ユーロ'], ['GBP', '英ポンド'], ['HKD', '香港ドル'], ['TWD', '台湾ドル'], ['KRW', '韓国ウォン'], ['SGD', 'シンガポールドル']].map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></div>
                  <div className="form-field"><label htmlFor={`${id}-timezone`}>タイムゾーン</label><select id={`${id}-timezone`} name="timezone" value={timezone} {...feedback('timezone')} onChange={(event) => setTimezone(event.target.value)}>{[['Asia/Tokyo', '東京'], ['Asia/Shanghai', '上海'], ['Asia/Hong_Kong', '香港'], ['Asia/Taipei', '台北'], ['Asia/Seoul', 'ソウル'], ['Asia/Singapore', 'シンガポール'], ['America/New_York', 'ニューヨーク'], ['Europe/London', 'ロンドン'], ['UTC', 'UTC']].map(([zone, label]) => <option key={zone} value={zone}>{label} · {zone}</option>)}</select></div>
                  <div className="form-field"><label htmlFor={`${id}-budget`}>月額予算（任意）</label><input id={`${id}-budget`} name="monthlyBudget" type="text" inputMode="decimal" maxLength={17} placeholder={`例：50000（${currency}）`} value={monthlyBudget} {...feedback('monthlyBudget')} onChange={(event) => setMonthlyBudget(event.target.value)} /></div>
                  <div className="form-field"><label htmlFor={`${id}-start-day`}>予算の開始日</label><select id={`${id}-start-day`} name="budgetStartDay" value={budgetStartDay} {...feedback('budgetStartDay')} onChange={(event) => setBudgetStartDay(event.target.value)}>{Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>毎月 {day} 日</option>)}</select></div>
                </div><p className="field-hint">予算は未入力でも登録できます。毎月同じ日に開始できるよう、開始日は 1〜28 日から選択します。</p>
              </fieldset>
              <fieldset className="register-section" disabled={submitting}>
                <legend><span>04</span> パスワード設定</legend>
                <div className="register-field-grid">
                  <div className="form-field"><label htmlFor={`${id}-password`}>パスワード <span className="required-mark" aria-hidden="true">＊</span></label><div className="password-control"><input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8 文字以上" value={password} maxLength={72} required {...feedback('password', `${id}-password-hint`)} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'} aria-pressed={showPassword} aria-controls={`${id}-password ${id}-confirm`} onClick={() => setShowPassword((value) => !value)}>{showPassword ? '非表示' : '表示'}</button></div></div>
                  <div className="form-field"><label htmlFor={`${id}-confirm`}>パスワード（確認） <span className="required-mark" aria-hidden="true">＊</span></label><input id={`${id}-confirm`} name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="同じパスワードを再入力" value={confirmPassword} maxLength={72} required {...feedback('confirmPassword')} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
                </div><p className="field-hint" id={`${id}-password-hint`}>8 文字以上、UTF-8 で 72 バイト以内（日本語は通常 1 文字 3 バイト）</p>
              </fieldset>
              {error.message && <p className="login-error" id={`${id}-error`} role="alert">{error.message}</p>}
              <button type="submit" className="login-button submit-login" disabled={submitting}><span>{submitting ? '登録中…' : 'アカウントを作成'}</span><span className="button-arrow" aria-hidden="true">↗</span></button>
              <p className="register-signin">すでに登録済みですか？ <a href="#/login">ログイン</a></p>
              <span className="login-progress" role="status">{submitting ? 'アカウントを作成しています…' : ''}</span>
            </form>
          </>}
        </section>
      </div>
      <footer className="footer"><span>SMART FINANCE</span><span className="footer-message"><span /> 一歩ずつ、未来へ</span><span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span></footer>
    </main>
  )
}

export default RegisterPage
