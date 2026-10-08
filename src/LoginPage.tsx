import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './LoginPage.css'

function LoginPage() {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Smart Finance · 登录'
    heading.current?.focus()
    return () => { document.title = previousTitle }
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.location.hash = '/dashboard'
  }

  return (
    <main className="welcome login-page">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance 首页">
          <span className="brand-mark" aria-hidden="true">S<span>F</span></span>
          <span>SMART<span className="brand-light"> FINANCE</span></span>
        </a>
        <a className="back-link" href="#/"><span aria-hidden="true">←</span> 返回欢迎页</a>
      </header>

      <div className="login-layout">
        <section className="login-story" aria-labelledby="story-title">
          <p className="eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="story-title">每一次登录，<br />都是向未来<br /><span>更近一步。</span></h2>
          <p className="story-description">连接今天的积累与明天的可能。<br />你的智慧财务旅程，从这里继续。</p>
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
          <h1 id="login-title" ref={heading} tabIndex={-1}>欢迎回来<span className="title-dot">.</span></h1>
          <p className="card-description">登录账户，继续你的财务旅程。</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor={`${id}-email`}>邮箱地址</label>
              <input id={`${id}-email`} name="email" type="email" autoComplete="username" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-password`}>密码</label>
              <div className="password-control">
                <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="请输入你的密码" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="password-toggle" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} aria-controls={`${id}-password`} onClick={() => setShowPassword((previous) => !previous)}>{showPassword ? '隐藏' : '显示'}</button>
              </div>
            </div>
            <button type="submit" className="login-button submit-login"><span>登录账户</span><span className="button-arrow" aria-hidden="true">↗</span></button>
          </form>
          <div className="card-bottom"><span aria-hidden="true">✦</span><span>演示模式 · 无需填写账号密码</span></div>
        </section>
      </div>
      <footer className="footer"><span>SMART FINANCE</span><span className="footer-message"><span /> 每一步，向未来</span><span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span></footer>
    </main>
  )
}

export default LoginPage
