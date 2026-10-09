import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { API_ENDPOINTS } from './api/endpoints'
import { AuthApiError, authErrorMessage } from './api/auth'
import { ledgerRequest } from './api/ledger'
import type { Options } from './api/ledger'
import { budgetRequest } from './api/budgets'
import type { Budget, BudgetInput, BudgetOverview, Template, Notice, History, Adjustment } from './api/budgets'
import './LedgerPage.css'
import './BudgetPage.css'
const periods: Record<string, string> = { MONTH: '月度', WEEK: '週次', QUARTER: '四半期', YEAR: '年次', CUSTOM: 'カスタム' }
const rollovers: Record<string, string> = { NONE: '繰越なし', ONCE: '一度だけ繰越', CUMULATIVE: '累積繰越' }
/** 日期字符串在 UTC 中进行纯日历运算，不因浏览器时区改变用户当地日期。 */
function range(anchor: string, period: string): { start: string; end: string } {
  const date = new Date(`${anchor}T00:00:00Z`)
  if (period === 'MONTH') date.setUTCDate(1)
  if (period === 'QUARTER') { date.setUTCDate(1); date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3) }
  if (period === 'YEAR') { date.setUTCDate(1); date.setUTCMonth(0) }
  if (period === 'WEEK') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const end = new Date(date)
  if (period === 'MONTH') end.setUTCMonth(end.getUTCMonth() + 1)
  if (period === 'QUARTER') end.setUTCMonth(end.getUTCMonth() + 3)
  if (period === 'YEAR') end.setUTCFullYear(end.getUTCFullYear() + 1)
  if (period === 'WEEK') end.setUTCDate(end.getUTCDate() + 7)
  if (period !== 'CUSTOM') end.setUTCDate(end.getUTCDate() - 1)
  return { start: date.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}
/** 为上月复制和模板应用生成相邻月份，避免月份末尾加减导致跳月。 */
function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7)
}
/** 真实预算管理页面，显示执行、预测、超支、结转、模板、调整历史和站内提醒。 */
export default function BudgetPage() {
  const [options, setOptions] = useState<Options | null>(null)
  const [overview, setOverview] = useState<BudgetOverview | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [history, setHistory] = useState<History | null>(null)
  const [month, setMonth] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState<BudgetInput>({ name: '', category: 'TOTAL', currency: '', period: 'MONTH', start: '', end: '', amount: '', thresholds: [50, 80, 100], rolloverMode: 'NONE' })
  const [thresholdText, setThresholdText] = useState('50,80,100')
  const [templateName, setTemplateName] = useState('')
  const [targetMonth, setTargetMonth] = useState('')
  const [editing, setEditing] = useState<Budget | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustThresholds, setAdjustThresholds] = useState('')
  const [adjustRollover, setAdjustRollover] = useState('NONE')
  const [adjustments, setAdjustments] = useState<{ id: number; items: Adjustment[] } | null>(null)
  useEffect(() => {
    let active = true
    /** 加载用户偏好及分类，以用户时区的今天初始化月份和预算日期。 */
    async function initialize() {
      try {
        const value = await ledgerRequest<Options>(API_ENDPOINTS.ledgerOptions)
        const budgets = await budgetRequest<BudgetOverview>(API_ENDPOINTS.listBudgets)
        if (!active) return
        setOptions(value); setMonth(value.today.slice(0, 7)); setTargetMonth(shiftMonth(value.today.slice(0, 7), 1))
        setHistoryFrom(shiftMonth(value.today.slice(0, 7), -12)); setHistoryTo(shiftMonth(value.today.slice(0, 7), -1))
        setInput(current => ({ ...current, currency: value.currency, amount: budgets.suggestedAmount, ...range(value.today, 'MONTH') }))
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void initialize(); return () => { active = false }
  }, [])
  useEffect(() => {
    if (!month) return
    let active = true
    /** 同步加载当前月份、常用方案和站内提醒，每半分钟刷新真实预算进度。 */
    async function load() {
      try {
        const dates = range(`${month}-01`, 'MONTH')
        const [budgets, saved, messages] = await Promise.all([
          budgetRequest<BudgetOverview>({ ...API_ENDPOINTS.listBudgets, path: `${API_ENDPOINTS.listBudgets.path}?start=${dates.start}&end=${dates.end}` }),
          budgetRequest<Template[]>(API_ENDPOINTS.listBudgetTemplates), budgetRequest<Notice[]>(API_ENDPOINTS.budgetNotifications),
        ])
        if (!active) return
        setOverview(budgets); setTemplates(saved); setNotices(messages)
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void load(); const interval = setInterval(() => void load(), 30_000)
    window.addEventListener('focus', load)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', load) }
  }, [month, revision])
  useEffect(() => {
    if (!historyFrom || !historyTo) return
    let active = true
    /** 读取指定月份范围的历史执行与分类超支频次，所有金额按币种分组。 */
    async function loadHistory() {
      try { const value = await budgetRequest<History>({ ...API_ENDPOINTS.budgetHistory, path: `${API_ENDPOINTS.budgetHistory.path}?from=${historyFrom}&to=${historyTo}` }); if (active) setHistory(value) }
      catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void loadHistory(); return () => { active = false }
  }, [historyFrom, historyTo, revision])
  /** 统一处理操作状态，配置冲突时保留已有预算和用户输入。 */
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await work() } catch (cause) {
      setError(cause instanceof AuthApiError && cause.code === 'BUDGET_CONFLICT' ? '同じ分類・通貨・期間の予算、または同名テンプレートは登録済みです。既存予算は上書きされません。'
        : cause instanceof AuthApiError && cause.code === 'INVALID_BUDGET' ? '予算の金額、通貨精度、周期、日付、閾値を確認してください。週は月曜日から、月・四半期・年は暦の区切りに合わせます。'
          : authErrorMessage(cause))
    } finally { setBusy(false) }
  }
  /** 把用户填写的百分比列表转换成整数，拒绝空白、重复、小数和范围外数值。 */
  function thresholds(text: string): number[] {
    const values = text.split(',').map(value => Number(value.trim()))
    if (!values.length || values.length > 10 || values.some(value => !Number.isInteger(value) || value < 1 || value > 100) || new Set(values).size !== values.length) throw new AuthApiError(400, 'INVALID_BUDGET')
    return values
  }
  /** 保存本人预算，后端按真实支出立即计算执行与预警信息。 */
  function create(event: FormEvent) {
    event.preventDefault(); void action(async () => {
      await budgetRequest(API_ENDPOINTS.createBudget, { ...input, thresholds: thresholds(thresholdText) })
      setMonth(input.start.slice(0, 7)); setRevision(value => value + 1); setInput(current => ({ ...current, name: '', amount: '' })); setNotice('予算を登録しました。')
    })
  }
  /** 加载调整记录并初始化编辑表单，不改变预算的数据归属或周期。 */
  function edit(value: Budget) {
    void action(async () => {
      setEditing(value); setAdjustAmount(value.amount); setAdjustReason(''); setAdjustThresholds(value.thresholds.join(',')); setAdjustRollover(value.rolloverMode)
      setAdjustments({ id: value.id, items: await budgetRequest<Adjustment[]>(API_ENDPOINTS.budgetAdjustments(value.id)) })
    })
  }
  /** 保存预算调整理由及前后金额，同时重新核算结转和预警。 */
  function adjust(event: FormEvent) {
    event.preventDefault(); if (!editing) return
    void action(async () => {
      await budgetRequest(API_ENDPOINTS.adjustBudget(editing.id), { amount: adjustAmount, reason: adjustReason, thresholds: thresholds(adjustThresholds), rolloverMode: adjustRollover })
      setAdjustments({ id: editing.id, items: await budgetRequest<Adjustment[]>(API_ENDPOINTS.budgetAdjustments(editing.id)) })
      setEditing(null); setRevision(value => value + 1); setNotice('予算を調整し、変更履歴を保存しました。')
    })
  }
  /** 查找支出分类名称，总预算显示独立标签。 */
  function category(code: string) { return code === 'TOTAL' ? '支出総額' : options?.categories.find(value => value.code === code)?.name || code }
  return <div className="ledger-page budget-page">
    {error && <p role="alert" className="ledger-error">{error}</p>}{notice && <p role="status" className="ledger-notice">{notice}</p>}
    {!options || !overview ? <p role="status">予算を読み込んでいます…</p> : <>
      <section className="dashboard-panel ledger-section"><h2>予算を設定</h2><p>実際の支出だけを集計します。通貨ごとに管理し、総予算と分類予算は別々に比較します。登録時の月額予算は入力候補です。</p>
        <form className="ledger-form" onSubmit={create}>
          <label>予算名<input required maxLength={80} value={input.name} onChange={event => setInput({ ...input, name: event.target.value })} /></label>
          <label>予算分類<select value={input.category} onChange={event => setInput({ ...input, category: event.target.value })}><option value="TOTAL">支出総額</option>{options.categories.filter(value => value.kind === 'EXPENSE').map(value => <option key={value.code} value={value.code}>{value.name}</option>)}</select></label>
          <label>予算通貨<input required pattern="[A-Z]{3}" maxLength={3} value={input.currency} onChange={event => setInput({ ...input, currency: event.target.value.toUpperCase() })} /></label>
          <label>予算周期<select value={input.period} onChange={event => { const period = event.target.value; setInput({ ...input, period, ...range(input.start || options.today, period), rolloverMode: period === 'MONTH' ? input.rolloverMode : 'NONE' }) }}>{Object.entries(periods).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label>予算開始日<input required type="date" value={input.start} onChange={event => { const start = event.target.value; if (start) setInput({ ...input, ...(input.period === 'CUSTOM' ? { start } : range(start, input.period)) }) }} /></label>
          <label>予算終了日<input required type="date" min={input.start} readOnly={input.period !== 'CUSTOM'} value={input.end} onChange={event => setInput({ ...input, end: event.target.value })} /></label>
          <label>予算額<input required inputMode="decimal" pattern="[0-9]{1,12}(\.[0-9]{1,4})?" value={input.amount} onChange={event => setInput({ ...input, amount: event.target.value })} /></label>
          <label>通知閾値（%、カンマ区切り）<input required value={thresholdText} onChange={event => setThresholdText(event.target.value)} placeholder="50,80,100" /></label>
          <label>月末の繰越<select disabled={input.period !== 'MONTH'} value={input.rolloverMode} onChange={event => setInput({ ...input, rolloverMode: event.target.value })}>{Object.entries(rollovers).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <button type="submit" disabled={busy}>予算を保存</button>
        </form><p>月度は暦月、週次は月曜〜日曜。日付を自由に設定する場合はカスタム周期を選択してください。日付は前後10年以内です。</p>
      </section>
      <section className="dashboard-panel ledger-section"><div className="budget-title"><h2>予算の実行状況</h2><label>表示する月<input type="month" value={month} onChange={event => { if (event.target.value) { setOverview(null); setMonth(event.target.value) } }} /></label><button disabled={busy} onClick={() => setRevision(value => value + 1)}>最新に更新</button></div><p>支出登録時に再計算、表示中は30秒ごとに更新。予測は今日までの平均日額を周期末まで延長した目安です。</p>
        <div className="budget-grid">{overview.items.map(value => <article key={value.id} className={`budget-card${Number(value.overage) > 0 ? ' budget-over' : ''}`} data-budget-id={value.id}>
          <div className="budget-card-title"><h3>{value.name}</h3><span>{periods[value.period]} · {category(value.category)}</span></div><p>{value.start} 〜 {value.end} · {value.currency}</p>
          <div className="budget-amount">{value.spent} <small>/ {value.effectiveAmount} {value.currency}</small></div>
          <progress max={100} value={Math.min(100, Number(value.executionRate))} aria-label={`${value.name} の予算使用率`} /><p className="budget-rate">実行率 {value.executionRate}% · 残り {value.remaining} {value.currency}</p>
          {Number(value.overage) > 0 && <strong className="budget-warning">超過 {value.overage} {value.currency} · 超過率 {value.overrunRate}%</strong>}
          <dl><div><dt>基本予算</dt><dd>{value.amount}</dd></div><div><dt>繰越額</dt><dd>{value.carryIn}</dd></div><div><dt>期間末予測</dt><dd>{value.forecast} {value.currency}</dd></div><div><dt>残り日数</dt><dd>{value.remainingDays}日</dd></div></dl>
          {Number(value.projectedOverage) > 0 && <p className="budget-warning">予測超過 {value.projectedOverage} {value.currency}。支出ペースに注意してください。</p>}
          <p>{rollovers[value.rolloverMode]} · 通知 {value.thresholds.join(' / ')}%{value.status === 'NOT_STARTED' ? ' · 未開始' : value.end < overview.today ? ' · 期間終了' : ' · 実行中'}</p>
          <button disabled={busy} onClick={() => edit(value)}>金額調整・変更履歴</button><details><summary>記録情報</summary>ID {value.id} / 作成 {value.createdAt} · {value.createdBy}<br />更新 {value.updatedAt} · {value.updatedBy}<br />削除 {value.deleted ? 'はい' : 'いいえ'}</details>
        </article>)}</div>{!overview.items.length && <p>この月に重なる予算はありません。</p>}
        {editing && <form className="ledger-form budget-edit" onSubmit={adjust}><h3 className="ledger-wide">「{editing.name}」を調整</h3><label>調整後の予算額<input required inputMode="decimal" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} /></label><label>調整後の通知閾値<input required value={adjustThresholds} onChange={event => setAdjustThresholds(event.target.value)} /></label><label>調整後の繰越<select disabled={editing.period !== 'MONTH'} value={adjustRollover} onChange={event => setAdjustRollover(event.target.value)}>{Object.entries(rollovers).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label className="ledger-wide">調整理由<input required maxLength={300} value={adjustReason} onChange={event => setAdjustReason(event.target.value)} /></label><button disabled={busy} type="submit">調整を保存</button><button type="button" onClick={() => setEditing(null)}>閉じる</button></form>}
        {adjustments && <div><h3>予算 #{adjustments.id} の変更履歴</h3>{!adjustments.items.length && <p>変更履歴はありません。</p>}<div className="ledger-table-scroll"><table className="ledger-table budget-adjustments"><thead><tr><th>日時・変更者</th><th>基本額 前 → 後</th><th>繰越 前 → 後</th><th>理由</th></tr></thead><tbody>{adjustments.items.map(value => <tr key={value.id}><td>{value.createdAt} / {value.createdBy}</td><td>{value.oldAmount} → {value.newAmount}</td><td>{value.oldCarry} → {value.newCarry}</td><td>{value.reason}</td></tr>)}</tbody></table></div></div>}
        <p>累積繰越は未使用の繰越も翌月へ引き継ぎます。一度だけ繰越は基本予算の未使用分だけを次月へ渡し、受け取った繰越を再転送しません。過去の支出補録・金額調整で後続月も再計算します。</p>
      </section>
      <section className="dashboard-panel ledger-section"><h2>予算テンプレート・月のコピー</h2><div className="ledger-form"><label>適用先の月<input type="month" required value={targetMonth} onChange={event => setTargetMonth(event.target.value)} /></label><label>テンプレート名<input maxLength={80} value={templateName} onChange={event => setTemplateName(event.target.value)} /></label><button disabled={busy || !templateName.trim()} onClick={() => void action(async () => { await budgetRequest(API_ENDPOINTS.saveBudgetTemplate, { name: templateName, sourceMonth: month }); setTemplateName(''); setRevision(value => value + 1); setNotice('月度予算をテンプレートに保存しました。') })}>表示月をテンプレート保存</button><button disabled={busy || !targetMonth} onClick={() => void action(async () => { await budgetRequest(API_ENDPOINTS.copyBudgetMonth, { sourceMonth: shiftMonth(targetMonth, -1), targetMonth }); setMonth(targetMonth); setRevision(value => value + 1); setNotice('前月の予算設定をコピーしました。') })}>適用先の前月をコピー</button><button disabled={busy || !targetMonth || month === targetMonth} onClick={() => void action(async () => { await budgetRequest(API_ENDPOINTS.copyBudgetMonth, { sourceMonth: month, targetMonth }); setMonth(targetMonth); setRevision(value => value + 1); setNotice('表示月の予算設定をコピーしました。') })}>表示月を適用先へコピー</button></div>
        <p>月度の総予算・分類・通貨・閾値・繰越設定だけをコピーします。実際の支出や残高はコピーしません。既存の同じ分類・通貨の月度予算は上書きしません。</p>
        <ul className="budget-templates">{templates.map(value => <li key={value.id}><span>{value.name} · {value.items.length}件</span><button disabled={busy || !targetMonth} onClick={() => void action(async () => { await budgetRequest(API_ENDPOINTS.applyBudgetTemplate(value.id), { month: targetMonth }); setMonth(targetMonth); setRevision(current => current + 1); setNotice('テンプレートを適用しました。') })}>{value.name} を適用</button></li>)}</ul>
      </section>
      <section className="dashboard-panel ledger-section"><h2>站内消息・予算通知 <span className="panel-tag">未読 {overview.unreadCount}</span></h2><p>設定閾値ごとに一度だけ通知します。超過は別に通知。メール・プッシュ設定は将来の送信連携用で、現在は站内消息を使います。</p><ul className="budget-notices">{notices.map(value => <li key={value.id} className={value.read ? '' : 'unread'}><div><p>{value.message}</p><time>{value.createdAt}</time></div>{!value.read && <button disabled={busy} onClick={() => void action(async () => { await budgetRequest(API_ENDPOINTS.readBudgetNotification(value.id)); setRevision(current => current + 1) })}>既読にする</button>}</li>)}</ul>{!notices.length && <p>予算の通知はまだありません。</p>}</section>
      <section className="dashboard-panel ledger-section"><h2>予算と実績・履歴分析</h2><div className="ledger-form"><label>履歴の開始月<input type="month" value={historyFrom} onChange={event => setHistoryFrom(event.target.value)} /></label><label>履歴の終了月<input type="month" min={historyFrom} value={historyTo} onChange={event => setHistoryTo(event.target.value)} /></label></div><p>終了した月度予算を比較します。金額差は予算−支出、超過率は超過額÷予算。分類分析には総予算を混ぜず、通貨も分けます。</p>
        {history && <><div className="ledger-table-scroll"><table className="ledger-table budget-history"><thead><tr>{['月・予算', '分類', '通貨', '予算（繰越込）', '実績', '差額', '実行率', '超過率'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{history.months.map(value => <tr key={value.id}><td>{value.start.slice(0, 7)} · {value.name}</td><td>{category(value.category)}</td><td>{value.currency}</td><td>{value.effectiveAmount}</td><td>{value.spent}</td><td className={Number(value.overage) > 0 ? 'budget-warning' : ''}>{value.remaining}</td><td>{value.executionRate}%</td><td>{value.overrunRate}%</td></tr>)}</tbody></table></div>{!history.months.length && <p>この範囲の終了した月度予算はありません。</p>}<h3>継続的に超過している分類</h3><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>分類・通貨</th><th>対象月数</th><th>超過月数</th><th>累計予算</th><th>累計支出</th><th>累計超過</th><th>実行率</th></tr></thead><tbody>{history.categories.map(value => <tr key={`${value.category}:${value.currency}`}><td>{category(value.category)} · {value.currency}</td><td>{value.periods}</td><td>{value.overspentPeriods}</td><td>{value.totalBudget}</td><td>{value.totalSpent}</td><td>{value.totalOverage}</td><td>{value.executionRate}%</td></tr>)}</tbody></table></div></>}
      </section>
    </>}
  </div>
}
