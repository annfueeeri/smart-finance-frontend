import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { API_ENDPOINTS } from './api/endpoints'
import { authErrorMessage, AuthApiError } from './api/auth'
import { ledgerRequest, filterQuery, downloadEntries } from './api/ledger'
import type { Options, EntryInput, EntryPage, Filters, Inspection, Mapping, Preview } from './api/ledger'
import './LedgerPage.css'
const emptyFilters: Filters = { kind: '', start: '', end: '', accountId: '' }
/** 个人收支页面，连接真实账户和记录 API，并提供 CSV/Excel 映射、预览与确认导入。 */
export default function LedgerPage() {
  const [options, setOptions] = useState<Options | null>(null)
  const [data, setData] = useState<EntryPage | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [applied, setApplied] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [entry, setEntry] = useState<EntryInput>({ accountId: 0, kind: 'EXPENSE', amount: '', date: '', category: 'FOOD', merchant: '', note: '' })
  const [tagText, setTagText] = useState('')
  const [accountType, setAccountType] = useState('CASH')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [openingDate, setOpeningDate] = useState('1900-01-01')
  const [accountName, setAccountName] = useState('')
  const [currency, setCurrency] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [mapping, setMapping] = useState<Mapping>({ columns: {}, defaultKind: 'EXPENSE', defaultAccountId: null, defaultCategory: null })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  useEffect(() => {
    let active = true
    /** 加载本人账户与偏好，为未填写的账户及日期设置默认值。 */
    async function loadOptions() {
      try {
        const value = await ledgerRequest<Options>(API_ENDPOINTS.ledgerOptions)
        if (!active) return
        setOptions(value); setCurrency(current => current || value.currency)
        setEntry(current => ({ ...current, accountId: current.accountId || value.accounts[0]?.id || 0, date: current.date || value.today }))
        setMapping(current => ({ ...current, defaultAccountId: current.defaultAccountId || value.accounts[0]?.id || null }))
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void loadOptions(); return () => { active = false }
  }, [revision])
  useEffect(() => {
    let active = true
    /** 按提交后的筛选条件和页码加载本人记录，丢弃卸载后或旧查询的响应。 */
    async function loadEntries() {
      try {
        const query = filterQuery(applied); query.set('page', String(page))
        const value = await ledgerRequest<EntryPage>({ ...API_ENDPOINTS.listTransactions, path: `${API_ENDPOINTS.listTransactions.path}?${query}` })
        if (active) setData(value)
      } catch (cause) { if (active) setError(authErrorMessage(cause)) }
    }
    void loadEntries(); return () => { active = false }
  }, [applied, page, revision])
  /** 统一处理写入及下载状态，错误不清除用户输入；成功信息通过状态区域宣读。 */
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await work() } catch (cause) {
      setError(cause instanceof AuthApiError && cause.code === 'ACCOUNT_DUPLICATE' ? '同じ名前・通貨の口座は登録済みです。' : authErrorMessage(cause))
    } finally { setBusy(false) }
  }
  /** 创建本人账户，随后重新加载选项，币种决定可接受的金额小数位。 */
  function createAccount(event: FormEvent) {
    event.preventDefault(); void action(async () => {
      const account = await ledgerRequest<{ id: number }>(API_ENDPOINTS.createAccount, { name: accountName, currency, type: accountType, openingBalance, openingDate })
      setAccountName(''); setEntry(current => ({ ...current, accountId: account.id })); setMapping(current => ({ ...current, defaultAccountId: account.id }))
      setRevision(current => current + 1); setNotice('口座を登録しました。')
    })
  }
  /** 保存一条收支，保留常用账户、分类和日期，清空金额及可选备注并刷新列表。 */
  function saveEntry(event: FormEvent) {
    event.preventDefault(); void action(async () => {
      await ledgerRequest(API_ENDPOINTS.createTransaction, { ...entry, tags: tagText.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) })
      setEntry(current => ({ ...current, amount: '', merchant: '', note: '' })); setTagText(''); setPage(0); setRevision(current => current + 1)
      setPreview(null); setNotice('収支を登録しました。')
    })
  }
  /** 读取上传文件的表头与样例，按标准导出字段自动建议映射，仍允许用户修改。 */
  function inspectFile() {
    if (!file) return
    void action(async () => {
      const form = new FormData(); form.set('file', file)
      const value = await ledgerRequest<Inspection>(API_ENDPOINTS.inspectImport, form)
      const aliases: Record<string, string[]> = { amount: ['amount', '金额', '金額'], date: ['date', '日期', '日付'], kind: ['kind', '类型', '収支'], account: ['account', '账户', '口座'], category: ['category', '分类', 'カテゴリ'], merchant: ['merchant', '商家', '店舗'], note: ['note', '备注', 'メモ'], currency: ['currency', '币种', '通貨'], tags: ['tags', '标签', 'タグ'] }
      const columns: Record<string, number> = {}
      for (const [field, names] of Object.entries(aliases)) { const index = value.headers.findIndex(header => names.includes(header.toLowerCase())); if (index >= 0) columns[field] = index }
      setInspection(value); setMapping(current => ({ ...current, columns })); setPreview(null)
    })
  }
  /** 使用文件和映射请求只读预览，展示每行异常与重复状态，确认前不入库。 */
  function previewFile() {
    if (!file) return
    void action(async () => {
      const form = new FormData(); form.set('file', file); form.set('mapping', JSON.stringify(mapping))
      setPreview(await ledgerRequest<Preview>(API_ENDPOINTS.previewImport, form))
    })
  }
  /** 仅提交没有错误的预览行；后端再次验证并执行默认去重，成功后清理导入状态。 */
  function commitFile() {
    if (!preview) return
    void action(async () => {
      const entries = preview.rows.filter(row => !row.errors.length && row.entry).map(row => row.entry!)
      const result = await ledgerRequest<{ imported: number; skipped: number }>(API_ENDPOINTS.commitImport, { entries, skipDuplicates })
      setPreview(null); setInspection(null); setFile(null); if (fileInput.current) fileInput.current.value = ''; setRevision(current => current + 1); setPage(0)
      setNotice(`${result.imported}件を登録しました。重複${result.skipped}件をスキップしました。`)
    })
  }
  const account = options?.accounts.find(value => value.id === entry.accountId)
  return <div className="ledger-page">
    {error && <p role="alert" className="ledger-error">{error} CSV は UTF-8、Excel は .xlsx / .xls、5MB・500行までです。金額は正数で口座通貨の小数位に合わせてください。</p>}
    {notice && <p role="status" className="ledger-notice">{notice}</p>}
    {!options ? <p role="status">口座情報を読み込んでいます…</p> : <>
      <section className="dashboard-panel ledger-section"><h2>収支を登録</h2><p>給与・賞与・副業・投資収益などの収入と、日々の支出を自分の口座に記録します。</p>
        <form onSubmit={saveEntry} className="ledger-form">
          <label>収支区分<select value={entry.kind} onChange={event => setEntry({ ...entry, kind: event.target.value, category: event.target.value === 'INCOME' ? 'SALARY' : 'FOOD' })}><option value="INCOME">収入</option><option value="EXPENSE">支出</option></select></label>
          <label>支払・入金口座<select required value={entry.accountId || ''} onChange={event => setEntry({ ...entry, accountId: Number(event.target.value) })}><option value="">口座を選択</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label>
          <label>金額{account && ` (${account.currency})`}<input required inputMode="decimal" pattern="[0-9]{1,12}(\.[0-9]{1,4})?" value={entry.amount} onChange={event => setEntry({ ...entry, amount: event.target.value })} /></label>
          <label>取引日<input required type="date" value={entry.date} onChange={event => setEntry({ ...entry, date: event.target.value })} /></label>
          <label>カテゴリ<select value={entry.category} onChange={event => setEntry({ ...entry, category: event.target.value })}>{options.categories.filter(value => value.kind === entry.kind).map(value => <option key={value.code} value={value.code}>{value.name}</option>)}</select></label>
          <label>店舗・取引先<input maxLength={120} value={entry.merchant} onChange={event => setEntry({ ...entry, merchant: event.target.value })} /></label>
          <label>タグ（カンマ区切り）<input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="旅行,出張,家族（最大10件）" /></label>
          <label className="ledger-wide">メモ<textarea maxLength={1000} value={entry.note} onChange={event => setEntry({ ...entry, note: event.target.value })} /></label>
          <button disabled={busy || !entry.accountId} type="submit">収支を保存</button>
        </form>
        <details open={!options.accounts.length}><summary>口座を追加</summary><form onSubmit={createAccount} className="ledger-form"><label>口座名<input required maxLength={80} value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="銀行・現金・電子マネーなど" /></label><label>口座通貨<input required pattern="[A-Z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} /></label><label>口座タイプ<select value={accountType} onChange={event => setAccountType(event.target.value)}><option value="BANK">銀行預金</option><option value="CASH">現金</option><option value="EWALLET">電子マネー</option><option value="INVESTMENT">投資資産</option><option value="LIABILITY">負債</option></select></label><label>期初残高（負債は負数）<input required inputMode="decimal" value={openingBalance} onChange={event => setOpeningBalance(event.target.value)} /></label><label>残高基準日<input required type="date" value={openingDate} onChange={event => setOpeningDate(event.target.value)} /></label><button disabled={busy} type="submit">口座を保存</button></form></details>
      </section>
      <section className="dashboard-panel ledger-section"><h2>収支履歴</h2><p>本人の記録のみ表示します。管理者も他の人の収支を閲覧できません。</p>
        <form className="ledger-form" onSubmit={event => { event.preventDefault(); setApplied({ ...filters }); setPage(0); setError('') }}>
          <label>種類で絞り込み<select value={filters.kind} onChange={event => setFilters({ ...filters, kind: event.target.value })}><option value="">すべて</option><option value="INCOME">収入</option><option value="EXPENSE">支出</option></select></label>
          <label>開始日<input type="date" value={filters.start} onChange={event => setFilters({ ...filters, start: event.target.value })} /></label><label>終了日<input type="date" min={filters.start || undefined} value={filters.end} onChange={event => setFilters({ ...filters, end: event.target.value })} /></label>
          <label>口座で絞り込み<select value={filters.accountId} onChange={event => setFilters({ ...filters, accountId: event.target.value })}><option value="">すべての口座</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label>
          <button type="submit" disabled={busy}>絞り込む</button><button type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(0) }}>条件をクリア</button>
        </form>
        <div className="ledger-actions"><button disabled={busy || !data?.total} onClick={() => void action(() => downloadEntries(applied, 'csv'))}>CSV をエクスポート</button><button disabled={busy || !data?.total} onClick={() => void action(() => downloadEntries(applied, 'xlsx'))}>Excel をエクスポート</button><span>現在の絞り込み条件で全件出力（最大10,000件）</span></div>
        {!data ? <p role="status">収支履歴を読み込んでいます…</p> : <><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr>{['日付', '収支', '金額', '口座', 'カテゴリ', '店舗・取引先', 'タグ', 'メモ', '記録情報'].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{data.items.map(value => <tr key={value.id}><td>{value.date}</td><td>{value.kind === 'INCOME' ? '収入' : '支出'}</td><td className={value.kind === 'INCOME' ? 'amount-positive' : ''}>{value.amount} {value.currency}</td><td>{value.accountName}</td><td>{options.categories.find(category => category.code === value.category)?.name || value.category}</td><td>{value.merchant || '—'}</td><td>{value.tags?.join(' / ') || '—'}</td><td>{value.note || '—'}</td><td><details><summary>ID {value.id}</summary><p>作成: {value.createdAt} / {value.createdBy}<br />更新: {value.updatedAt} / {value.updatedBy}<br />削除: {value.deleted ? 'はい' : 'いいえ'}</p></details></td></tr>)}</tbody></table></div>{!data.total && <p>収支はまだありません。上のフォームから登録できます。</p>}<div className="ledger-actions"><button disabled={!page || busy} onClick={() => setPage(current => current - 1)}>前のページ</button><span>{data.total}件 · {page + 1}ページ</span><button disabled={(page + 1) * data.size >= data.total || busy} onClick={() => setPage(current => current + 1)}>次のページ</button></div></>}
      </section>
      <section className="dashboard-panel ledger-section"><h2>CSV・Excel をインポート</h2><p>UTF-8 CSV / .xlsx / .xls、先頭行は見出し。Excel は最初のシートを使用します。5MB・500行・30列まで、数式は使用できません。日付は YYYY-MM-DD または YYYY/M/D。</p>
        <label>流水ファイル<input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setInspection(null); setPreview(null) }} /></label><button disabled={busy || !file} onClick={inspectFile}>ファイルを読み込む</button>
        {inspection && <><h3>フィールドの対応付け · {inspection.totalRows}行</h3><div className="ledger-form">{Object.entries({ amount: '金額（必須）', date: '日付（必須）', kind: '収支区分', account: '口座名', category: 'カテゴリ', merchant: '店舗・取引先', note: 'メモ', currency: '通貨', tags: 'タグ' }).map(([field, label]) => <label key={field}>{label}<select value={mapping.columns[field] ?? ''} disabled={busy} onChange={event => { const columns = { ...mapping.columns }; if (event.target.value === '') delete columns[field]; else columns[field] = Number(event.target.value); setMapping({ ...mapping, columns }); setPreview(null) }}><option value="">列なし（既定値）</option>{inspection.headers.map((header, index) => <option key={index} value={index}>{index + 1}: {header || '名称なし'}</option>)}</select></label>)}
          <label>既定の収支区分<select value={mapping.defaultKind} onChange={event => { setMapping({ ...mapping, defaultKind: event.target.value, defaultCategory: null }); setPreview(null) }}><option value="INCOME">収入</option><option value="EXPENSE">支出</option></select></label>
          <label>既定の口座<select value={mapping.defaultAccountId ?? ''} onChange={event => { setMapping({ ...mapping, defaultAccountId: Number(event.target.value) || null }); setPreview(null) }}><option value="">口座を選択</option>{options.accounts.map(value => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label>
          <label>既定のカテゴリ<select value={mapping.defaultCategory ?? ''} onChange={event => { setMapping({ ...mapping, defaultCategory: event.target.value || null }); setPreview(null) }}><option value="">収支に応じて「その他」</option>{options.categories.filter(value => value.kind === mapping.defaultKind).map(value => <option key={value.code} value={value.code}>{value.name}</option>)}</select></label></div>
          <details><summary>元データの例（先頭5行）</summary><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr>{inspection.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{inspection.sampleRows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div></details>
          <button disabled={busy || mapping.columns.amount === undefined || mapping.columns.date === undefined} onClick={previewFile}>データをプレビュー</button></>}
        {preview && <><p role="status">有効 {preview.valid}件 / 重複 {preview.duplicates}件 / エラー {preview.invalid}件。エラー行は登録されません。</p><div className="ledger-table-scroll"><table className="ledger-table import-preview"><thead><tr><th>元の行</th><th>日付</th><th>収支</th><th>金額</th><th>口座</th><th>カテゴリ</th><th>店舗・取引先</th><th>メモ</th><th>判定</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.entry?.date || '—'}</td><td>{row.entry?.kind === 'INCOME' ? '収入' : row.entry?.kind === 'EXPENSE' ? '支出' : '—'}</td><td>{row.entry?.amount || '—'}</td><td>{options.accounts.find(account => account.id === row.entry?.accountId)?.name || '—'}</td><td>{options.categories.find(category => category.code === row.entry?.category)?.name || '—'}</td><td>{row.entry?.merchant || '—'}</td><td>{row.entry?.note || '—'}</td><td>{row.errors.length ? row.errors.join(' / ') : row.duplicate ? '重複（既存またはファイル内）' : '登録可能'}</td></tr>)}</tbody></table></div><label className="ledger-checkbox"><input type="checkbox" checked={skipDuplicates} onChange={event => setSkipDuplicates(event.target.checked)} />重複をスキップ（推奨）</label><button disabled={busy || !preview.valid} onClick={commitFile}>確認してインポート</button></>}
      </section>
    </>}
  </div>
}
