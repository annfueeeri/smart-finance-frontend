import { useEffect, useRef, useState } from 'react'
import { AuthApiError, authErrorMessage, listUsers, updateUserRole } from './api/auth'
import type { ManagedUser, UserRole } from './api/auth'
import './UserManagementPage.css'

/** 保留数据库日期时间的原始含义，显示到秒，不擅自转换为浏览器时区。 */
function displayTime(value: string): string {
  return value.replace('T', ' ').slice(0, 19)
}

/** 展示后端限定范围的用户一览，管理员可编辑其他用户身份，一般用户只读自身信息。 */
export default function UserManagementPage({ currentUsername, currentRole }: { currentUsername: string; currentRole: UserRole }) {
  const isAdmin = currentRole === 'ADMIN'
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [roles, setRoles] = useState<Record<number, UserRole>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState<number | null>(null)
  const pendingSave = useRef<AbortController | null>(null)

  /** 会话失效时返回登录页，权限变化时清空列表并触发重新查询当前身份。 */
  function reportError(cause: unknown) {
    if (cause instanceof AuthApiError && cause.status === 401) {
      window.location.hash = '/login'
      return
    }
    if (cause instanceof AuthApiError && cause.status === 403) {
      setUsers(null)
      setError('操作権限またはセキュリティ確認が変更されました。一覧を更新してください。')
      window.dispatchEvent(new Event('auth:changed'))
      return
    }
    setError(authErrorMessage(cause))
  }

  useEffect(() => {
    const controller = new AbortController()
    void listUsers(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setUsers(items)
      setRoles(Object.fromEntries(items.map((item) => [item.id, item.role])))
    }).catch((cause) => {
      if (!controller.signal.aborted) reportError(cause)
    })
    return () => controller.abort()
  }, [retry])

  useEffect(() => () => { pendingSave.current?.abort() }, [])

  /** 提交其他账号的身份变更，并以服务器返回的审计信息更新该行；重复提交被阻止。 */
  async function save(user: ManagedUser) {
    if (!isAdmin || user.username === currentUsername || pendingSave.current || roles[user.id] === user.role) return
    const controller = new AbortController()
    pendingSave.current = controller
    setSaving(user.id)
    setError('')
    setNotice('')
    try {
      const updated = await updateUserRole(user.id, roles[user.id], controller.signal)
      if (controller.signal.aborted) return
      setUsers((items) => items?.map((item) => item.id === updated.id ? updated : item) ?? null)
      setRoles((items) => ({ ...items, [updated.id]: updated.role }))
      setNotice(`${updated.username} の権限を${updated.role === 'ADMIN' ? '管理者' : '一般ユーザー'}に変更しました。`)
      window.dispatchEvent(new Event('auth:changed'))
    } catch (cause) {
      if (!controller.signal.aborted) reportError(cause)
    } finally {
      if (!controller.signal.aborted) setSaving(null)
      if (pendingSave.current === controller) pendingSave.current = null
    }
  }

  // 身份降级的当前渲染立即隐藏其他账号，随后重新向后端查询自身信息。
  const visibleUsers = isAdmin ? users : users?.filter((user) => user.username === currentUsername)

  return (
    <section className="dashboard-panel user-management" aria-labelledby="user-list-title">
      <div className="panel-header">
        <div><h2 id="user-list-title">ユーザー情報</h2><p>{isAdmin ? 'すべてのユーザー情報を表示しています。他のユーザーの権限を変更できます。' : '自分のユーザー情報を表示しています。権限の変更は管理者に依頼してください。'}</p></div>
        <button className="user-refresh" disabled={saving !== null} onClick={() => { setUsers(null); setError(''); setNotice(''); setRetry((value) => value + 1) }}>一覧を更新</button>
      </div>
      {error && <p role="alert" className="user-error">{error}</p>}
      {notice && <p role="status" className="user-notice">{notice}</p>}
      {!users && !error && <p role="status" className="user-loading">ユーザーを読み込んでいます…</p>}
      {visibleUsers && <div className="user-table-scroll" role="region" aria-label="ユーザー情報一覧" tabIndex={0}><table className="user-table">
        <thead><tr><th scope="col">ID</th><th scope="col">ログインアカウント</th><th scope="col">名前</th><th scope="col">メール</th><th scope="col">電話番号</th><th scope="col">通貨</th><th scope="col">タイムゾーン</th><th scope="col">月額予算</th><th scope="col">予算開始日</th><th scope="col">現在の権限</th><th scope="col">状態</th><th scope="col">作成日時</th><th scope="col">作成ユーザー</th><th scope="col">更新日時</th><th scope="col">更新ユーザー</th><th scope="col">削除状態</th>{isAdmin && <><th scope="col">変更後の権限</th><th scope="col">操作</th></>}</tr></thead>
        <tbody>{visibleUsers.map((user) => <tr key={user.id}>
          <td>{user.id}</td>
          <th scope="row">{user.username}{user.username === currentUsername && <span className="current-user-label">自分</span>}</th>
          <td>{user.displayName}</td><td>{user.email || '未登録'}</td><td>{user.phone || '未登録'}</td><td>{user.currency}</td><td>{user.timezone}</td><td>{user.monthlyBudget ? `${user.monthlyBudget} ${user.currency}` : '未設定'}</td><td>毎月 {user.budgetStartDay} 日</td>
          <td><span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role === 'ADMIN' ? '管理者' : '一般ユーザー'}</span></td>
          <td>{user.enabled ? '有効' : '無効'}</td>
          <td className="user-datetime"><time dateTime={user.createdAt} title={user.createdAt}>{displayTime(user.createdAt)}</time></td>
          <td>{user.createdBy}</td>
          <td className="user-datetime"><time dateTime={user.updatedAt} title={user.updatedAt}>{displayTime(user.updatedAt)}</time></td>
          <td>{user.updatedBy}</td>
          <td>{user.isDeleted ? '削除済み' : '未削除'}</td>
          {isAdmin && (user.username === currentUsername ? <><td>自分の権限</td><td>変更不可</td></> : <><td><select aria-label={`${user.username} の権限`} value={roles[user.id] ?? user.role} disabled={saving !== null} onChange={(event) => setRoles((items) => ({ ...items, [user.id]: event.target.value as UserRole }))}>
            <option value="USER">一般ユーザー</option><option value="ADMIN">管理者</option>
          </select></td>
          <td><button className="user-save" aria-label={`${user.username} の権限を保存`} disabled={saving !== null || roles[user.id] === user.role} onClick={() => void save(user)}>{saving === user.id ? '保存中…' : '保存'}</button></td></>)}
        </tr>)}</tbody>
      </table></div>}
      {visibleUsers?.length === 0 && <p role="status" className="user-loading">表示できるユーザーはいません。</p>}
      <p className="user-management-note">{isAdmin ? '権限の変更は保存後に反映されます。自分の権限はこの画面では変更できません。' : '自分の登録情報のみ閲覧できます。'}</p>
    </section>
  )
}
