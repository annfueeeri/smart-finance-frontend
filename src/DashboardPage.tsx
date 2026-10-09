import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { authErrorMessage, logout } from './api/auth'
import type { AuthUser } from './api/auth'
import UserManagementPage from './UserManagementPage'
import LedgerPage from './LedgerPage'
import './DashboardPage.css'

const modules = [
  { id: 'overview', name: '資産一覧', caption: 'OVERVIEW', icon: 'overview', description: '積み重ねた資産を、ひと目で把握。' },
  { id: 'transactions', name: '収支明細', caption: 'TRANSACTIONS', icon: 'transactions', description: '日々の取引を記録し、収支の流れを確認。' },
  { id: 'accounts', name: '口座管理', caption: 'ACCOUNTS', icon: 'accounts', description: '口座をまとめて確認し、資金管理をもっと手軽に。' },
  { id: 'budgets', name: '予算管理', caption: 'BUDGETS', icon: 'budgets', description: '支出を計画し、無理のない家計管理を。' },
  { id: 'analytics', name: '資産分析', caption: 'ANALYTICS', icon: 'analytics', description: 'データから、資産の内訳を読み解く。' },
  { id: 'settings', name: 'システム設定', caption: 'SETTINGS', icon: 'settings', description: '自分に合った使いやすい環境に。' },
  { id: 'users', name: 'ユーザー一覧', caption: 'USERS', icon: 'settings', description: 'ユーザー情報を確認し、管理者は他のユーザーの権限を変更できます。' },
] as const

type IconName = typeof modules[number]['icon'] | 'logout' | 'arrow'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    transactions: <><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></>,
    accounts: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M15 14h3" /></>,
    budgets: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16m-11 5h6" /></>,
    analytics: <><path d="M4 4v16h17M8 15l4-5 4 2 5-7" /></>,
    settings: <><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>,
    logout: <><path d="M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const transactions = [
  { name: '給与収入', category: '給与', date: '10月08日', amount: '+ ¥18,000.00', positive: true, icon: 'accounts' },
  { name: '日用品の購入', category: '生活費', date: '10月08日', amount: '− ¥268.00', positive: false, icon: 'transactions' },
  { name: '交通費', category: '交通・移動', date: '10月07日', amount: '− ¥45.00', positive: false, icon: 'transactions' },
  { name: '投資収益', category: '運用収入', date: '10月06日', amount: '+ ¥1,200.00', positive: true, icon: 'analytics' },
] as const

function TransactionTable() {
  return <table className="transaction-table"><thead><tr><th scope="col">取引内容</th><th scope="col">カテゴリ</th><th scope="col">日付</th><th scope="col">金額</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.name}><td><span className="transaction-name"><span className="transaction-icon"><Icon name={item.icon} /></span>{item.name}</span></td><td>{item.category}</td><td>{item.date}</td><td className={item.positive ? 'amount-positive' : ''}>{item.amount}</td></tr>)}</tbody></table>
}

/** 渲染已认证的业务页面；用户一览向所有身份开放，身份变化时重新加载对应范围的列表。 */
function DashboardPage({ route, user }: { route: string; user: AuthUser }) {
  const moduleId = route.split('/')[2] || 'overview'
  const activeModule = modules.find((item) => item.id === moduleId) || modules[0]
  const heading = useRef<HTMLHeadingElement>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  /** 调用后端销毁会话后回到登录页；失败时保留当前页面并显示可重试的错误。 */
  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      window.location.hash = '/login'
    } catch (error) {
      setLogoutError(authErrorMessage(error))
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = `Smart Finance · ${activeModule.name}`
    heading.current?.focus()
    return () => { document.title = previousTitle }
  }, [activeModule.name])

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <a className="brand dashboard-brand" href="#/dashboard" aria-label="Smart Finance 資産一覧"><span className="brand-mark" aria-hidden="true">S<span>F</span></span><span>SMART<br /><span className="brand-light">FINANCE</span></span></a>
        <div className="workspace-label">個人資産ダッシュボード<span>WORKSPACE / 01</span></div>
        <p className="nav-caption">ワークスペース</p>
        <nav aria-label="資産管理メニュー" className="module-nav">{modules.map((item) => <a key={item.id} href={item.id === 'overview' ? '#/dashboard' : `#/dashboard/${item.id}`} className={`module-link${activeModule.id === item.id ? ' is-active' : ''}`} aria-current={activeModule.id === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.name}</span>{activeModule.id === item.id && <span className="nav-active-dot" />}</a>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-spark" aria-hidden="true">✦</span><p>一歩ずつ、未来へ。<span>資産管理を、もっと心地よく。</span></p></div><button type="button" className="module-link logout-link" onClick={handleLogout} disabled={loggingOut}><Icon name="logout" /><span>{loggingOut ? 'ログアウト中…' : 'ログアウト'}</span></button>{logoutError && <p className="logout-error" role="alert">{logoutError}</p>}</div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar"><div className="breadcrumb">ワークスペース <span>/</span> <strong>{activeModule.name}</strong></div><div className="topbar-profile"><span className="demo-badge"><span /> {['users', 'transactions'].includes(activeModule.id) ? '登録データ' : 'サンプルデータ'}</span><span className="profile-avatar">{Array.from(user.username)[0]?.toUpperCase() || 'S'}</span><span>{user.username}</span><span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role === 'ADMIN' ? '管理者' : '一般ユーザー'}</span></div></header>
        <main className="dashboard-main">
          <div className="dashboard-heading"><div><p className="dashboard-eyebrow">{activeModule.caption}</p><h1 ref={heading} tabIndex={-1}>{activeModule.name}<span className="title-dot">.</span></h1><p>{activeModule.description}</p></div><span className="workspace-status">{activeModule.id === 'overview' ? 'ログインしました · おかえりなさい' : '個人資産ダッシュボード'}</span></div>

          {activeModule.id === 'users' ? <UserManagementPage key={`${user.username}:${user.role}`} currentUsername={user.username} currentRole={user.role} /> : activeModule.id === 'overview' ? <>
            <section className="summary-grid" aria-label="資産サマリー">
              {[{label: '総資産', value: '128,560', decimals: '.00', note: '全口座の資産合計', icon: 'accounts'}, {label: '今月の収入', value: '19,200', decimals: '.00', note: '給与と投資収益', icon: 'analytics'}, {label: '今月の支出', value: '5,840', decimals: '.00', note: '今月の支出合計', icon: 'transactions'}, {label: '今月の収支差額', value: '13,360', decimals: '.00', note: '日々の積み重ねを未来へ', icon: 'budgets'}].map((item, index) => <article className={`summary-card${index === 0 ? ' primary-summary' : ''}`} key={item.label}><div className="summary-label">{item.label}<Icon name={item.icon as IconName} /></div><p className="summary-value"><span>¥</span>{item.value}<small>{item.decimals}</small></p><span className="summary-note">{item.note}</span></article>)}
            </section>
            <div className="overview-middle">
              <section className="dashboard-panel trend-panel" aria-labelledby="trend-title"><div className="panel-header"><div><h2 id="trend-title">資産推移</h2><p>着実な積み重ねを、グラフで確認</p></div><span className="panel-tag">直近6か月</span></div><div className="asset-chart" role="img" aria-label="資産推移のサンプル：5月8.2万、6月9.1万、7月8.8万、8月10.5万、9月11.6万、10月12.856万"><div className="chart-y-labels"><span>14万</span><span>10万</span><span>6万</span></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="asset-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cf3df" stopOpacity=".22" /><stop offset="100%" stopColor="#8cf3df" stopOpacity="0" /></linearGradient></defs><path d="M0 20H600M0 85H600M0 150H600" stroke="#718da624" strokeDasharray="4 6" /><path d="M0 114 120 100 240 105 360 78 480 60 600 39V170H0Z" fill="url(#asset-fill)" /><path d="M0 114 120 100 240 105 360 78 480 60 600 39" fill="none" stroke="#9ceadf" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x-labels">{['5月', '6月', '7月', '8月', '9月', '10月'].map((month) => <span key={month}>{month}</span>)}</div></div></section>
              <section className="dashboard-panel allocation-panel" aria-labelledby="allocation-title"><div className="panel-header"><div><h2 id="allocation-title">資産配分</h2><p>未来のために、可能性を広げる</p></div><Icon name="analytics" /></div><div className="allocation-body"><div className="allocation-donut" role="img" aria-label="資産配分のサンプル：貯蓄口座60%、投資・運用30%、日常用口座10%"><span>3<small>資産区分</small></span></div><div className="allocation-legend">{[{name:'貯蓄口座', value:'60%', color:'#9ceadf'}, {name:'投資・運用', value:'30%', color:'#8b9bdf'}, {name:'日常用口座', value:'10%', color:'#43667e'}].map((item) => <div key={item.name}><span style={{'--legend-color': item.color} as CSSProperties} /><p>{item.name}</p><strong>{item.value}</strong></div>)}</div></div></section>
            </div>
            <section className="dashboard-panel"><div className="panel-header"><div><h2>最近の収支</h2><p>日々の取引を、一つずつ記録</p></div><a className="panel-link" href="#/dashboard/transactions">すべて見る <Icon name="arrow" /></a></div><TransactionTable /></section>
          </> : activeModule.id === 'transactions' ? <LedgerPage key={user.username} /> : <section className="dashboard-panel module-placeholder"><span className="placeholder-icon"><Icon name={activeModule.icon} /></span><p className="dashboard-eyebrow">{activeModule.caption}</p><h2>{activeModule.name}</h2><p>{activeModule.description}</p><span className="placeholder-note">このモジュールの機能は今後追加予定です。</span><a className="panel-link" href="#/dashboard">資産一覧に戻る <Icon name="arrow" /></a></section>}
          <footer className="dashboard-footer"><span>SMART FINANCE / YOUR PERSONAL WORKSPACE</span><span>{activeModule.id === 'users' ? 'ユーザー情報は最新の登録データです' : 'サンプルデータは画面のデモ用です'}</span></footer>
        </main>
      </div>
    </div>
  )
}

export default DashboardPage
