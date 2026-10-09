import { useEffect, useRef, useState } from 'react'
import { AuthApiError, authErrorMessage, listUsers, updateUserRole } from './api/auth'
import type { ManagedUser, UserRole } from './api/auth'
import './UserManagementPage.css'

export default function UserManagementPage({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [roles, setRoles] = useState<Record<number, UserRole>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState<number | null>(null)
  const pendingSave = useRef<AbortController | null>(null)

  function reportError(cause: unknown) {
    if (cause instanceof AuthApiError && cause.status === 401) {
      window.location.hash = '/login'
      return
    }
    if (cause instanceof AuthApiError && cause.status === 403) {
      setError('ユーザー管理を操作できるのは管理者だけです。')
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

  async function save(user: ManagedUser) {
    if (pendingSave.current || roles[user.id] === user.role) return
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

  return (
    <section className="dashboard-panel user-management" aria-labelledby="user-list-title">
      <div className="panel-header">
        <div><h2 id="user-list-title">ユーザー一覧</h2><p>管理者はユーザーの権限を変更できます。変更は保存後に反映されます。</p></div>
        <button className="user-refresh" disabled={saving !== null} onClick={() => { setUsers(null); setError(''); setNotice(''); setRetry((value) => value + 1) }}>一覧を更新</button>
      </div>
      {error && <p role="alert" className="user-error">{error}</p>}
      {notice && <p role="status" className="user-notice">{notice}</p>}
      {!users && !error && <p role="status" className="user-loading">ユーザーを読み込んでいます…</p>}
      {users && <div className="user-table-scroll"><table className="user-table">
        <thead><tr><th scope="col">ユーザー名</th><th scope="col">現在の権限</th><th scope="col">状態</th><th scope="col">変更後の権限</th><th scope="col">操作</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <th scope="row">{user.username}{user.username === currentUsername && <span className="current-user-label">自分</span>}</th>
          <td><span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role === 'ADMIN' ? '管理者' : '一般ユーザー'}</span></td>
          <td>{user.enabled ? '有効' : '無効'}</td>
          <td><select aria-label={`${user.username} の権限`} value={roles[user.id] ?? user.role} disabled={saving !== null} onChange={(event) => setRoles((items) => ({ ...items, [user.id]: event.target.value as UserRole }))}>
            <option value="USER">一般ユーザー</option><option value="ADMIN">管理者</option>
          </select></td>
          <td><button className="user-save" aria-label={`${user.username} の権限を保存`} disabled={saving !== null || roles[user.id] === user.role} onClick={() => void save(user)}>{saving === user.id ? '保存中…' : '保存'}</button></td>
        </tr>)}</tbody>
      </table></div>}
      <p className="user-management-note">最後の有効な管理者は一般ユーザーに変更できません。自身を一般ユーザーに変更すると、ユーザー管理は利用できなくなります。</p>
    </section>
  )
}
