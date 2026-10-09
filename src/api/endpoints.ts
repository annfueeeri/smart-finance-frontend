export type ApiEndpoint = {
  readonly method: 'GET' | 'POST' | 'PUT'
  readonly path: string
}

// Complete, same-origin API paths. Vite forwards these paths unchanged to BACKEND_URL.
export const API_ENDPOINTS = {
  health: { method: 'GET', path: '/api/health' },
  csrf: { method: 'GET', path: '/api/auth/csrf' },
  register: { method: 'POST', path: '/api/auth/register' },
  login: { method: 'POST', path: '/api/auth/login' },
  currentUser: { method: 'GET', path: '/api/auth/me' },
  logout: { method: 'POST', path: '/api/auth/logout' },
  ledgerOptions: { method: 'GET', path: '/api/ledger/options' },
  createAccount: { method: 'POST', path: '/api/accounts' },
  listTransactions: { method: 'GET', path: '/api/transactions' },
  createTransaction: { method: 'POST', path: '/api/transactions' },
  inspectImport: { method: 'POST', path: '/api/transactions/import/inspect' },
  previewImport: { method: 'POST', path: '/api/transactions/import/preview' },
  commitImport: { method: 'POST', path: '/api/transactions/import' },
  exportTransactions: { method: 'GET', path: '/api/transactions/export' },
  listUsers: { method: 'GET', path: '/api/users' },
  updateUserRole: (id: number): ApiEndpoint => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('User ID must be a positive safe integer')
    return { method: 'PUT', path: `/api/admin/users/${id}/role` }
  },
} as const
