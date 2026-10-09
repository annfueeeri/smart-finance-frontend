import { useSyncExternalStore } from 'react'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import AuthenticatedDashboard from './AuthenticatedDashboard'
import './App.css'

const copyrightYear = new Date().getFullYear()

function subscribeToRoute(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function App() {
  const route = useSyncExternalStore(
    subscribeToRoute,
    () => window.location.hash,
    () => '',
  )

  if (route === '#/login') return <LoginPage />
  if (route === '#/register') return <RegisterPage />
  if (route === '#/dashboard' || route.startsWith('#/dashboard/')) return <AuthenticatedDashboard route={route} />

  return (
    <main className="welcome">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />

      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance ホーム">
          <span className="brand-mark" aria-hidden="true">S<span>F</span></span>
          <span>SMART<span className="brand-light"> FINANCE</span></span>
        </a>
        <span className="edition">YOUR NEXT CHAPTER · 01</span>
      </header>

      <section className="hero" aria-labelledby="welcome-title">
        <div className="orbital" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orb-core"><span>✦</span></div>
          <span className="orbit-dot" />
        </div>
        <p className="eyebrow"><span /> THE FUTURE IS IN YOUR HANDS</p>
        <h1 id="welcome-title">ようこそ<br /><span>資産の新たな未来へ</span><span className="title-dot">.</span></h1>
        <p className="intro">日々の積み重ねが、未来の可能性を広げる。<br />ここから、スマートな資産管理を始めよう。</p>
        <div className="login-area">
          <a className="login-button" href="#/login">
            <span>ログインして始める</span><span className="button-arrow" aria-hidden="true">↗</span>
          </a>
          <a className="register-button" href="#/register">新規登録</a>
          <p className="login-caption">YOUR MONEY. YOUR POSSIBILITIES.</p>
        </div>
      </section>

      <footer className="footer">
        <span>© {copyrightYear} SMART FINANCE</span>
        <span className="footer-message"><span /> 一歩ずつ、未来へ</span>
        <span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span>
      </footer>

    </main>
  )
}

export default App
