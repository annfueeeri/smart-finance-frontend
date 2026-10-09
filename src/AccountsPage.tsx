import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { API_ENDPOINTS } from './api/endpoints'
import { authErrorMessage } from './api/auth'
import { ledgerRequest } from './api/ledger'
import type { Options, Account } from './api/ledger'
import { reportRequest } from './api/reports'
import type { FinancialReport, Transfer, Valuation } from './api/reports'
import './LedgerPage.css'
const types: Record<string, string> = { BANK: '銀行預金', CASH: '現金', EWALLET: '電子マネー', INVESTMENT: '投資資産', LIABILITY: '負債' }
/** 本人账户管理，维护余额基准、资产/负债类别、日终估值及独立内部转账。 */
export default function AccountsPage() {
  const [options, setOptions] = useState<Options | null>(null)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newAccount, setNewAccount] = useState({ name: '', currency: '', type: 'BANK', openingBalance: '0', openingDate: '' })
  const [transfer, setTransfer] = useState({ fromAccountId: 0, toAccountId: 0, amount: '', date: '', note: '' })
  const [valuation, setValuation] = useState({ accountId: 0, date: '', balance: '', note: '' })
  const [values, setValues] = useState<{ accountId: number; items: Valuation[] } | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileType, setProfileType] = useState('BANK')
  useEffect(() => {
    let active = true
    /** 同步加载个人账户、今日记账余额和转账历史，不连接外部银行余额。 */
    async function load() {
      try {
        const value = await ledgerRequest<Options>(API_ENDPOINTS.ledgerOptions)
        const [report, transfers] = await Promise.all([reportRequest<FinancialReport>({ ...API_ENDPOINTS.financialReport, path: `${API_ENDPOINTS.financialReport.path}?start=${value.today.slice(0, 8)}01&end=${value.today}&grouping=MONTH` }), reportRequest<Transfer[]>(API_ENDPOINTS.listTransfers)])
        if (!active) return
        setOptions(value); setReport(report); setTransfers(transfers)
        setNewAccount(current => ({ ...current, currency: current.currency || value.currency, openingDate: current.openingDate || value.today }))
        setTransfer(current => ({ ...current, fromAccountId: current.fromAccountId || value.accounts[0]?.id || 0, date: current.date || value.today }))
        setValuation(current => ({ ...current, accountId: current.accountId || value.accounts[0]?.id || 0, date: current.date || value.today }))
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void load(); return () => { active = false }
  }, [revision])
  /** 统一写入状态，保留失败输入并显示业务错误，成功后刷新真实余额。 */
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice(''); try { await work() } catch (cause) { setError(authErrorMessage(cause)) } finally { setBusy(false) }
  }
  /** 创建个人账户及其期初基准，负数作为负债，币种决定小数位。 */
  function create(event: FormEvent) { event.preventDefault(); void action(async () => { const value = await ledgerRequest<Account>(API_ENDPOINTS.createAccount, newAccount); setNewAccount(current => ({ ...current, name: '', openingBalance: '0' })); setValuation(current => ({ ...current, accountId: value.id })); setRevision(value => value + 1); setNotice('口座を登録しました。') }) }
  /** 保存内部转账，不生成收入/支出或预算消费。 */
  function saveTransfer(event: FormEvent) { event.preventDefault(); void action(async () => { await reportRequest(API_ENDPOINTS.createTransfer, transfer); setTransfer(current => ({ ...current, amount: '', note: '' })); setRevision(value => value + 1); setNotice('振替を記録しました（収支・予算には含みません）。') }) }
  /** 记录日终余额或投资市值，留下新审计记录而不覆盖旧历史。 */
  function saveValue(event: FormEvent) { event.preventDefault(); void action(async () => { await reportRequest(API_ENDPOINTS.createValuation(valuation.accountId), { date: valuation.date, balance: valuation.balance, note: valuation.note }); setValues({ accountId: valuation.accountId, items: await reportRequest<Valuation[]>(API_ENDPOINTS.listValuations(valuation.accountId)) }); setValuation(current => ({ ...current, balance: '', note: '' })); setRevision(value => value + 1); setNotice('日終残高・評価額を保存しました。') }) }
  /** 保存本人账户名称和类别，币种和期初基准不借此改变。 */
  function profile(event: FormEvent) { event.preventDefault(); if (!editing) return; void action(async () => { await reportRequest(API_ENDPOINTS.updateAccount(editing.id), { name: profileName, type: profileType }); setEditing(null); setRevision(value => value + 1); setNotice('口座情報を更新しました。') }) }
  const source = options?.accounts.find(account => account.id === transfer.fromAccountId)
  return <div className="ledger-page">
    {error && <p className="ledger-error" role="alert">{error} 金額の通貨精度・同通貨の別口座・日付を確認してください。</p>}{notice && <p className="ledger-notice" role="status">{notice}</p>}
    {!options || !report ? <p role="status">本人の口座を読み込んでいます…</p> : <>
      <section className="dashboard-panel ledger-section"><h2>口座残高・資産区分</h2><p>{options.today} 時点の記帳残高です。銀行のリアルタイム残高ではありません。マイナス残高を負債として計上します。</p><div className="ledger-table-scroll"><table className="ledger-table accounts-table"><thead><tr><th>口座</th><th>種類</th><th>通貨</th><th>期初基準</th><th>今日の記帳残高</th><th>記録・操作</th></tr></thead><tbody>{options.accounts.map(value => { const balance = report.currencies.flatMap(c => c.balances).find(row => row.accountId === value.id); return <tr key={value.id}><td>{value.name}</td><td>{types[value.type]}</td><td>{value.currency}</td><td>{value.openingDate} · {value.openingBalance}</td><td>{balance?.known ? balance.balance : '基準前・不明'}</td><td><button disabled={busy} onClick={() => { setEditing(value); setProfileName(value.name); setProfileType(value.type) }}>口座情報を編集</button><button disabled={busy} onClick={() => void action(async () => { setValues({ accountId: value.id, items: await reportRequest<Valuation[]>(API_ENDPOINTS.listValuations(value.id)) }); setValuation(current => ({ ...current, accountId: value.id })) })}>残高評価の履歴</button><details><summary>監査情報</summary>ID {value.id}<br />作成 {value.createdAt} / {value.createdBy}<br />更新 {value.updatedAt} / {value.updatedBy}<br />削除 {value.deleted ? 'はい' : 'いいえ'}</details></td></tr> })}</tbody></table></div>
        {editing && <form className="ledger-form" onSubmit={profile}><h3 className="ledger-wide">口座 #{editing.id} の情報</h3><label>変更後の口座名<input required maxLength={80} value={profileName} onChange={event => setProfileName(event.target.value)} /></label><label>変更後の口座タイプ<select value={profileType} onChange={event => setProfileType(event.target.value)}>{Object.entries(types).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><button disabled={busy} type="submit">口座情報を保存</button></form>}
      </section>
      <section className="dashboard-panel ledger-section"><h2>口座を新規登録</h2><form className="ledger-form" onSubmit={create}><label>新規口座名<input required maxLength={80} value={newAccount.name} onChange={event => setNewAccount({ ...newAccount, name: event.target.value })} /></label><label>新規口座通貨<input required pattern="[A-Z]{3}" maxLength={3} value={newAccount.currency} onChange={event => setNewAccount({ ...newAccount, currency: event.target.value.toUpperCase() })} /></label><label>新規口座タイプ<select value={newAccount.type} onChange={event => setNewAccount({ ...newAccount, type: event.target.value })}>{Object.entries(types).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><label>期初残高<input required inputMode="decimal" value={newAccount.openingBalance} onChange={event => setNewAccount({ ...newAccount, openingBalance: event.target.value })} /></label><label>期初基準日<input required type="date" value={newAccount.openingDate} onChange={event => setNewAccount({ ...newAccount, openingDate: event.target.value })} /></label><button disabled={busy} type="submit">新規口座を保存</button></form><p>基準日は日の始まりの残高です。同日以降の収支・振替を加減します。基準前の記録は収支分析に含めますが、残高を二重に加算しません。</p></section>
      <section className="dashboard-panel ledger-section"><h2>口座間の内部振替</h2><form className="ledger-form" onSubmit={saveTransfer}><label>振替元口座<select required value={transfer.fromAccountId || ''} onChange={event => setTransfer({ ...transfer, fromAccountId: Number(event.target.value), toAccountId: 0 })}><option value="">選択</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label><label>振替先口座<select required value={transfer.toAccountId || ''} onChange={event => setTransfer({ ...transfer, toAccountId: Number(event.target.value) })}><option value="">同じ通貨の別口座を選択</option>{options.accounts.filter(value => value.id !== source?.id && value.currency === source?.currency).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label><label>振替金額<input required inputMode="decimal" value={transfer.amount} onChange={event => setTransfer({ ...transfer, amount: event.target.value })} /></label><label>振替日<input required type="date" value={transfer.date} onChange={event => setTransfer({ ...transfer, date: event.target.value })} /></label><label>振替メモ<input maxLength={1000} value={transfer.note} onChange={event => setTransfer({ ...transfer, note: event.target.value })} /></label><button disabled={busy || !transfer.toAccountId} type="submit">内部振替を保存</button></form><p>同じ通貨の本人の口座だけに対応します。内部振替は収入・支出・予算に含まれません。借入・返済の元本移動は負債口座との振替、利息は支出として記録できます。</p><div className="ledger-table-scroll"><table className="ledger-table transfer-table"><thead><tr><th>日付</th><th>振替元</th><th>振替先</th><th>金額</th><th>メモ・作成者</th></tr></thead><tbody>{transfers.map(value => <tr key={value.id}><td>{value.date}</td><td>{options.accounts.find(account => account.id === value.fromAccountId)?.name}</td><td>{options.accounts.find(account => account.id === value.toAccountId)?.name}</td><td>{value.amount} {value.currency}</td><td>{value.note} / {value.createdBy}</td></tr>)}</tbody></table></div></section>
      <section className="dashboard-panel ledger-section"><h2>日終残高・投資評価を記録</h2><form className="ledger-form" onSubmit={saveValue}><label>評価する口座<select required value={valuation.accountId || ''} onChange={event => setValuation({ ...valuation, accountId: Number(event.target.value) })}><option value="">選択</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label><label>評価日<input required type="date" value={valuation.date} onChange={event => setValuation({ ...valuation, date: event.target.value })} /></label><label>日終残高・評価額<input required inputMode="decimal" value={valuation.balance} onChange={event => setValuation({ ...valuation, balance: event.target.value })} /></label><label>評価メモ<input maxLength={1000} value={valuation.note} onChange={event => setValuation({ ...valuation, note: event.target.value })} /></label><button disabled={busy || !valuation.accountId} type="submit">日終評価を保存</button></form><p>日終値は当日までの記録を含む確定残高です。その翌日からの記録を加算します。同日は最後の評価が有効ですが、元の記録は履歴に残ります。評価差額は消費や所得として計上しません。</p>{values && <><h3>口座 #{values.accountId} の評価履歴</h3><div className="ledger-table-scroll"><table className="ledger-table valuation-table"><thead><tr><th>評価日</th><th>評価額</th><th>メモ</th><th>作成・変更者</th></tr></thead><tbody>{values.items.map(value => <tr key={value.id}><td>{value.date}</td><td>{value.balance}</td><td>{value.note}</td><td>{value.createdAt} / {value.createdBy} · {value.updatedAt} / {value.updatedBy}</td></tr>)}</tbody></table></div></>}</section>
    </>}
  </div>
}
