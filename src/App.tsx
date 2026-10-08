import { useSyncExternalStore } from 'react'
import LoginPage from './LoginPage'
import DashboardPage from './DashboardPage'
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
  if (route === '#/dashboard' || route.startsWith('#/dashboard/')) return <DashboardPage route={route} />

  return (
    <main className="welcome">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />

      <header className="masthead">
        <a className="brand" href="#/" aria-label="Smart Finance 首页">
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
        <h1 id="welcome-title">欢迎来到<br /><span>财富的下一站</span><span className="title-dot">.</span></h1>
        <p className="intro">让每一份积累，都有更远的未来。<br />从这里，开启你的智慧财务旅程。</p>
        <div className="login-area">
          <a className="login-button" href="#/login">
            <span>登录，开启未来</span><span className="button-arrow" aria-hidden="true">↗</span>
          </a>
          <p className="login-caption">YOUR MONEY. YOUR POSSIBILITIES.</p>
        </div>
      </section>

      <footer className="footer">
        <span>© {copyrightYear} SMART FINANCE</span>
        <span className="footer-message"><span /> 每一步，向未来</span>
        <span className="footer-coordinate">DESIGNED FOR WHAT’S NEXT ↗</span>
      </footer>

    </main>
  )
}

export default App
