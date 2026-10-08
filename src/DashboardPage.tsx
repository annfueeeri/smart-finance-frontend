import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './DashboardPage.css'

const modules = [
  { id: 'overview', name: '财务一览', caption: 'OVERVIEW', icon: 'overview', description: '每一份积累，都清晰可见。' },
  { id: 'transactions', name: '收支明细', caption: 'TRANSACTIONS', icon: 'transactions', description: '记录每一笔流动，看见收支的轨迹。' },
  { id: 'accounts', name: '账户管理', caption: 'ACCOUNTS', icon: 'accounts', description: '集中查看账户，让资金管理更从容。' },
  { id: 'budgets', name: '预算管理', caption: 'BUDGETS', icon: 'budgets', description: '为每一笔支出，规划更好的方向。' },
  { id: 'analytics', name: '资产分析', caption: 'ANALYTICS', icon: 'analytics', description: '从数据出发，了解你的资产构成。' },
  { id: 'settings', name: '系统设置', caption: 'SETTINGS', icon: 'settings', description: '让你的财务空间，更适合自己。' },
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
  { name: '工资收入', category: '工作收入', date: '10月08日', amount: '+ ¥18,000.00', positive: true, icon: 'accounts' },
  { name: '日常购物', category: '生活消费', date: '10月08日', amount: '− ¥268.00', positive: false, icon: 'transactions' },
  { name: '交通出行', category: '出行费用', date: '10月07日', amount: '− ¥45.00', positive: false, icon: 'transactions' },
  { name: '投资收益', category: '理财收入', date: '10月06日', amount: '+ ¥1,200.00', positive: true, icon: 'analytics' },
] as const

function TransactionTable() {
  return <table className="transaction-table"><thead><tr><th scope="col">交易项目</th><th scope="col">类别</th><th scope="col">日期</th><th scope="col">金额</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.name}><td><span className="transaction-name"><span className="transaction-icon"><Icon name={item.icon} /></span>{item.name}</span></td><td>{item.category}</td><td>{item.date}</td><td className={item.positive ? 'amount-positive' : ''}>{item.amount}</td></tr>)}</tbody></table>
}

function DashboardPage({ route }: { route: string }) {
  const moduleId = route.split('/')[2] || 'overview'
  const activeModule = modules.find((item) => item.id === moduleId) || modules[0]
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `Smart Finance · ${activeModule.name}`
    heading.current?.focus()
    return () => { document.title = previousTitle }
  }, [activeModule.name])

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <a className="brand dashboard-brand" href="#/dashboard" aria-label="Smart Finance 财务一览"><span className="brand-mark" aria-hidden="true">S<span>F</span></span><span>SMART<br /><span className="brand-light">FINANCE</span></span></a>
        <div className="workspace-label">个人财务工作台<span>WORKSPACE / 01</span></div>
        <p className="nav-caption">工作空间</p>
        <nav aria-label="财务模块" className="module-nav">{modules.map((item) => <a key={item.id} href={item.id === 'overview' ? '#/dashboard' : `#/dashboard/${item.id}`} className={`module-link${activeModule.id === item.id ? ' is-active' : ''}`} aria-current={activeModule.id === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.name}</span>{activeModule.id === item.id && <span className="nav-active-dot" />}</a>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-spark" aria-hidden="true">✦</span><p>每一步，向未来。<span>让财富管理成为一种从容。</span></p></div><a className="module-link logout-link" href="#/login"><Icon name="logout" /><span>退出登录</span></a></div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar"><div className="breadcrumb">工作空间 <span>/</span> <strong>{activeModule.name}</strong></div><div className="topbar-profile"><span className="demo-badge"><span /> 演示模式 · 示例数据</span><span className="profile-avatar">S</span><span>演示用户</span></div></header>
        <main className="dashboard-main">
          <div className="dashboard-heading"><div><p className="dashboard-eyebrow">{activeModule.caption}</p><h1 ref={heading} tabIndex={-1}>{activeModule.name}<span className="title-dot">.</span></h1><p>{activeModule.description}</p></div><span className="workspace-status">{activeModule.id === 'overview' ? '登录成功 · 欢迎回来' : '个人财务工作台'}</span></div>

          {activeModule.id === 'overview' ? <>
            <section className="summary-grid" aria-label="财务汇总">
              {[{label: '总资产', value: '128,560', decimals: '.00', note: '账户资产合计', icon: 'accounts'}, {label: '本月收入', value: '19,200', decimals: '.00', note: '工资与投资收益', icon: 'analytics'}, {label: '本月支出', value: '5,840', decimals: '.00', note: '本月累计消费', icon: 'transactions'}, {label: '本月结余', value: '13,360', decimals: '.00', note: '让积累持续发生', icon: 'budgets'}].map((item, index) => <article className={`summary-card${index === 0 ? ' primary-summary' : ''}`} key={item.label}><div className="summary-label">{item.label}<Icon name={item.icon as IconName} /></div><p className="summary-value"><span>¥</span>{item.value}<small>{item.decimals}</small></p><span className="summary-note">{item.note}</span></article>)}
            </section>
            <div className="overview-middle">
              <section className="dashboard-panel trend-panel" aria-labelledby="trend-title"><div className="panel-header"><div><h2 id="trend-title">资产走势</h2><p>稳步积累，看见成长的轨迹</p></div><span className="panel-tag">近 6 个月</span></div><div className="asset-chart" role="img" aria-label="示例资产走势：5月8.2万元、6月9.1万元、7月8.8万元、8月10.5万元、9月11.6万元、10月12.856万元"><div className="chart-y-labels"><span>14万</span><span>10万</span><span>6万</span></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="asset-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cf3df" stopOpacity=".22" /><stop offset="100%" stopColor="#8cf3df" stopOpacity="0" /></linearGradient></defs><path d="M0 20H600M0 85H600M0 150H600" stroke="#718da624" strokeDasharray="4 6" /><path d="M0 114 120 100 240 105 360 78 480 60 600 39V170H0Z" fill="url(#asset-fill)" /><path d="M0 114 120 100 240 105 360 78 480 60 600 39" fill="none" stroke="#9ceadf" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x-labels">{['5月', '6月', '7月', '8月', '9月', '10月'].map((month) => <span key={month}>{month}</span>)}</div></div></section>
              <section className="dashboard-panel allocation-panel" aria-labelledby="allocation-title"><div className="panel-header"><div><h2 id="allocation-title">资产分布</h2><p>为未来，留出更多可能</p></div><Icon name="analytics" /></div><div className="allocation-body"><div className="allocation-donut" role="img" aria-label="示例资产分布：储蓄账户60%，投资理财30%，日常账户10%"><span>3<small>资产类别</small></span></div><div className="allocation-legend">{[{name:'储蓄账户', value:'60%', color:'#9ceadf'}, {name:'投资理财', value:'30%', color:'#8b9bdf'}, {name:'日常账户', value:'10%', color:'#43667e'}].map((item) => <div key={item.name}><span style={{'--legend-color': item.color} as CSSProperties} /><p>{item.name}</p><strong>{item.value}</strong></div>)}</div></div></section>
            </div>
            <section className="dashboard-panel"><div className="panel-header"><div><h2>最近收支</h2><p>你的每一笔流动，都值得被记录</p></div><a className="panel-link" href="#/dashboard/transactions">查看全部 <Icon name="arrow" /></a></div><TransactionTable /></section>
          </> : activeModule.id === 'transactions' ? <section className="dashboard-panel"><div className="panel-header"><div><h2>收支记录</h2><p>以下为示例交易，供查看页面布局</p></div><span className="panel-tag">共 4 笔</span></div><TransactionTable /></section> : <section className="dashboard-panel module-placeholder"><span className="placeholder-icon"><Icon name={activeModule.icon} /></span><p className="dashboard-eyebrow">{activeModule.caption}</p><h2>{activeModule.name}</h2><p>{activeModule.description}</p><span className="placeholder-note">模块已预留，业务功能待接入。</span><a className="panel-link" href="#/dashboard">返回财务一览 <Icon name="arrow" /></a></section>}
          <footer className="dashboard-footer"><span>SMART FINANCE / YOUR PERSONAL WORKSPACE</span><span>示例数据仅用于页面演示</span></footer>
        </main>
      </div>
    </div>
  )
}

export default DashboardPage
