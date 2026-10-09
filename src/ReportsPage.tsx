import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { API_ENDPOINTS } from './api/endpoints'
import { authErrorMessage } from './api/auth'
import { ledgerRequest } from './api/ledger'
import type { Options } from './api/ledger'
import { reportRequest, reportQuery, downloadReport } from './api/reports'
import type { FinancialReport, ReportFilters, Ranking, Comparison } from './api/reports'
import ReportChart from './ReportChart'
import './LedgerPage.css'
import './ReportsPage.css'
const colors = ['#288a76', '#d87e58', '#557bbb', '#ad73a6', '#d4ac49', '#659999', '#87878c']
/** 个人真实财务报表，按币种分组显示全部分析、条件筛选及文件导出。 */
export default function ReportsPage() {
  const [options, setOptions] = useState<Options | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [filters, setFilters] = useState<ReportFilters>({ start: '', end: '', grouping: 'MONTH', accountId: '', currency: '', kind: '', category: '', tag: '' })
  const [applied, setApplied] = useState<ReportFilters | null>(null)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    /** 加载本人账户、分类和已有标签，以用户当地本月起日至今天为默认统计区间。 */
    async function initialize() {
      try {
        const [ledger, values] = await Promise.all([ledgerRequest<Options>(API_ENDPOINTS.ledgerOptions), reportRequest<{ tags: string[] }>(API_ENDPOINTS.reportOptions)])
        if (!active) return
        const initial = { start: ledger.today.slice(0, 8) + '01', end: ledger.today, grouping: 'DAY', accountId: '', currency: '', kind: '', category: '', tag: '' }
        setOptions(ledger); setTags(values.tags); setFilters(initial); setApplied(initial)
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void initialize(); return () => { active = false }
  }, [])
  useEffect(() => {
    if (!applied) return
    let active = true
    /** 请求同一服务计算的全部统计，筛选改变后丢弃旧查询返回值。 */
    async function load() {
      try { const value = await reportRequest<FinancialReport>({ ...API_ENDPOINTS.financialReport, path: `${API_ENDPOINTS.financialReport.path}?${reportQuery(applied!)}` }); if (active) setReport(value) }
      catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void load(); return () => { active = false }
  }, [applied, revision])
  /** 应用用户筛选，清空旧报表让导出不能误用旧数据条件。 */
  function submit(event: FormEvent) { event.preventDefault(); setError(''); setReport(null); setApplied({ ...filters }) }
  /** 安全下载服务器生成的完整报表，失败时保留当前报表以便重试。 */
  async function download(format: 'csv' | 'xlsx' | 'pdf') {
    if (!applied) return
    setBusy(true); setError(''); try { await downloadReport(applied, format) } catch (cause) { setError(authErrorMessage(cause)) } finally { setBusy(false) }
  }
  /** 查找真实分类名称，不把报表分类代码当作用户名称。 */
  function category(code: string) { return options?.categories.find(value => value.code === code)?.name || code }
  /** 渲染商家或标签消费次数及金额，空数据保留明确提示。 */
  function ranking(title: string, rows: Ranking[]) {
    return <section className="dashboard-panel ledger-section"><h3>{title}</h3><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>名称</th><th>支出額</th><th>取引件数</th></tr></thead><tbody>{rows.map(value => <tr key={value.name}><td>{value.name}</td><td>{value.amount}</td><td>{value.count}</td></tr>)}</tbody></table></div>{!rows.length && <p>この条件の支出はありません。</p>}</section>
  }
  /** 表示比較期の金额差及百分比，比较基数为零时显示无法计算而非零增长。 */
  function comparison(title: string, value: Comparison) {
    return <div><h3>{title}</h3><p>比較対象: {value.start} 〜 {value.end}</p><table className="ledger-table"><thead><tr><th>指標</th><th>今回</th><th>比較期</th><th>差額</th><th>変化率</th></tr></thead><tbody>{(['income', 'expense', 'net'] as const).map(key => <tr key={key}><td>{{ income: '収入', expense: '支出', net: '純収支' }[key]}</td><td>{value[key].current}</td><td>{value[key].previous}</td><td>{value[key].difference}</td><td>{value[key].percentage === null ? '—（比較期ゼロ）' : `${value[key].percentage}%`}</td></tr>)}</tbody></table></div>
  }
  return <div className="ledger-page reports-page">
    {error && <p role="alert" className="ledger-error">{error} 日別は366日まで、その他の集計は10年までです。</p>}
    {!options ? <p role="status">レポートの条件を読み込んでいます…</p> : <>
      <section className="dashboard-panel ledger-section"><h2>財務レポートを作成</h2><p>本人の記録を通貨別に集計します。収支分析は全条件を使用し、キャッシュフロー・資産・残高は口座、通貨、日付を使用します。</p><form className="ledger-form" onSubmit={submit}>
        <label>集計開始日<input type="date" required value={filters.start} onChange={event => setFilters({ ...filters, start: event.target.value })} /></label><label>集計終了日<input type="date" required min={filters.start} value={filters.end} onChange={event => setFilters({ ...filters, end: event.target.value })} /></label>
        <label>集計単位<select value={filters.grouping} onChange={event => setFilters({ ...filters, grouping: event.target.value })}>{Object.entries({ DAY: '毎日', WEEK: '毎週', MONTH: '毎月', YEAR: '毎年' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>集計口座<select value={filters.accountId} onChange={event => setFilters({ ...filters, accountId: event.target.value })}><option value="">全口座</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label>
        <label>集計通貨<select value={filters.currency} onChange={event => setFilters({ ...filters, currency: event.target.value })}><option value="">通貨ごとに分ける</option>{[...new Set([options.currency, ...options.accounts.map(value => value.currency)])].sort().map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>集計取引種別<select value={filters.kind} onChange={event => setFilters({ ...filters, kind: event.target.value, category: '' })}><option value="">収入・支出</option><option value="INCOME">収入</option><option value="EXPENSE">支出</option></select></label>
        <label>集計カテゴリ<select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}><option value="">全カテゴリ</option>{options.categories.filter(value => !filters.kind || value.kind === filters.kind).map(value => <option key={value.code} value={value.code}>{value.name}</option>)}</select></label>
        <label>集計タグ<select value={filters.tag} onChange={event => setFilters({ ...filters, tag: event.target.value })}><option value="">全タグ</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label><button disabled={busy} type="submit">レポートを表示</button>
      </form><div className="ledger-actions">{(['csv', 'xlsx', 'pdf'] as const).map(format => <button key={format} disabled={busy || !report} onClick={() => void download(format)}>{format === 'xlsx' ? 'Excel' : format.toUpperCase()} を保存</button>)}<button disabled={busy || !report} onClick={() => { setReport(null); setRevision(value => value + 1) }}>最新の統計に更新</button></div><p>Excel/PDFは収支・分類・資産の図表と統計明細を保存します。CSVは全統計の数値・条件を保存します。</p></section>
      {!report ? <p role="status">実データを集計しています…</p> : report.currencies.map(c => <section key={c.currency} className="report-currency" aria-label={`${c.currency} 財務レポート`}>
        <h2>{c.currency} · {report.filter.start} 〜 {report.filter.end}</h2><div className="report-summary">{[{ name: '総収入', value: c.summary.income, note: `${c.summary.incomeCount}件` }, { name: '総支出', value: c.summary.expense, note: `${c.summary.expenseCount}件` }, { name: '純収支', value: c.summary.net, note: '収入−支出' }, { name: '平均日支出', value: c.summary.averageDailyExpense, note: '対象日数の平均' }].map(value => <article key={value.name}><h3>{value.name}</h3><strong>{value.value} <small>{c.currency}</small></strong><span>{value.note}</span></article>)}</div>
        <section className="dashboard-panel ledger-section"><ReportChart title="収支の推移" labels={c.trend.map(value => value.start)} series={[{ name: '収入', values: c.trend.map(value => value.income), color: colors[0] }, { name: '支出', values: c.trend.map(value => value.expense), color: colors[1] }]} /><details><summary>収支推移の数値</summary><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>期間</th><th>収入</th><th>支出</th><th>純収支</th></tr></thead><tbody>{c.trend.map(value => <tr key={value.start}><td>{value.start} 〜 {value.end}</td><td>{value.income}</td><td>{value.expense}</td><td>{value.net}</td></tr>)}</tbody></table></div></details></section>
        <section className="dashboard-panel ledger-section"><h3>分類別支出の割合</h3><div className="report-bars">{c.categories.map((value, index) => <div key={value.category}><span>{category(value.category)}</span><meter aria-label={`${category(value.category)} の支出割合`} min={0} max={100} value={Number(value.percentage)} style={{ accentColor: colors[index % colors.length] }} /><strong>{value.percentage}% · {value.amount}</strong></div>)}</div>{!c.categories.length && <p>この条件の支出はありません。</p>}</section>
        <section className="dashboard-panel ledger-section"><ReportChart title="分類別支出・最近6か月の推移" labels={[...new Set(c.categoryTrend.map(value => value.month))]} series={[...new Set(c.categoryTrend.map(value => value.category))].map((code, index) => ({ name: category(code), values: c.categoryTrend.filter(value => value.category === code).map(value => value.amount), color: colors[index % colors.length] }))} /><p>選択した終了月を基準に直近6か月。終了月は選択終了日までです。</p></section>
        <section className="dashboard-panel ledger-section"><h3>口座キャッシュフロー</h3><p>内部振替を収入や消費に含めません。残高調整は期初基準・日終評価などの非現金差額です。口座管理で残高基準や投資評価を記録できます。</p><div className="ledger-table-scroll"><table className="ledger-table report-cash-flow"><thead><tr>{['口座', '期首残高', '外部流入', '外部流出', '内部入金', '内部出金', '残高調整', '期末残高'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{c.cashFlow.map(value => <tr key={value.accountId}><td>{value.name}</td><td>{value.openingKnown ? value.openingBalance : '基準日前・不明'}</td><td>{value.inflow}</td><td>{value.outflow}</td><td>{value.internalInflow}</td><td>{value.internalOutflow}</td><td>{value.balanceAdjustment}</td><td>{value.closingKnown ? value.closingBalance : '基準日前・不明'}</td></tr>)}</tbody></table></div></section>
        <section className="dashboard-panel ledger-section"><ReportChart title="総資産・負債・純資産の推移" labels={c.assets.map(value => value.date)} series={[{ name: '総資産', values: c.assets.map(value => value.assets), color: colors[0] }, { name: '負債', values: c.assets.map(value => value.liabilities), color: colors[1] }, { name: '純資産', values: c.assets.map(value => value.netAssets), color: colors[2] }]} /><p>正の残高は資産、負の残高は負債として集計。基準前の不明口座は計上せず、記帳された残高と日終評価を使います。</p><div className="ledger-table-scroll"><table className="ledger-table report-assets"><thead><tr><th>日付</th><th>総資産</th><th>総負債</th><th>純資産</th><th>不明口座数</th></tr></thead><tbody>{c.assets.map(value => <tr key={value.date}><td>{value.date}</td><td>{value.assets}</td><td>{value.liabilities}</td><td>{value.netAssets}</td><td>{value.unknownAccounts}</td></tr>)}</tbody></table></div></section>
        <section className="dashboard-panel ledger-section"><h3>口座残高と資金分布</h3><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>口座</th><th>種類</th><th>選択期末残高</th><th>履歴</th></tr></thead><tbody>{c.balances.map(value => <tr key={value.accountId}><td>{value.name}</td><td>{value.type}</td><td>{value.known ? value.balance : '不明'}</td><td><details><summary>残高変動を表示</summary>{value.history.map(point => <p key={point.date}>{point.date}: {point.known ? point.balance : '不明'}</p>)}</details></td></tr>)}</tbody></table></div><ReportChart title="各口座の残高推移" labels={c.assets.map(value => value.date)} series={c.balances.map((value, index) => ({ name: value.name, values: value.history.map(point => point.known ? point.balance : null), color: colors[index % colors.length] }))} /></section>
        <section className="dashboard-panel ledger-section"><div className="ledger-table-scroll">{comparison('前月比較（同条件）', c.monthOverMonth)}{comparison('前年同期比較（同条件）', c.yearOverYear)}</div><p>選択期間を1か月/1年戻して比較します。月全体は月初〜月末で比較、その他は日付を移動。変化率の分母は比較期の絶対値です。</p></section>
        {ranking('商家支出ランキング TOP20', c.merchants)}{ranking('タグ別プロジェクト支出', c.tags)}<p className="report-note">複数タグの取引は各タグに計上します。タグ金額の合計は全体の支出と一致しないことがあります。</p>
      </section>)}
    </>}
  </div>
}
