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
  listBudgets: { method: 'GET', path: '/api/budgets' },
  createBudget: { method: 'POST', path: '/api/budgets' },
  adjustBudget: (id: number): ApiEndpoint => ({ method: 'PUT', path: `/api/budgets/${id}` }),
  budgetAdjustments: (id: number): ApiEndpoint => ({ method: 'GET', path: `/api/budgets/${id}/adjustments` }),
  budgetHistory: { method: 'GET', path: '/api/budgets/history' },
  listBudgetTemplates: { method: 'GET', path: '/api/budget-templates' },
  saveBudgetTemplate: { method: 'POST', path: '/api/budget-templates' },
  applyBudgetTemplate: (id: number): ApiEndpoint => ({ method: 'POST', path: `/api/budget-templates/${id}/apply` }),
  copyBudgetMonth: { method: 'POST', path: '/api/budgets/copy-month' },
  budgetNotifications: { method: 'GET', path: '/api/budget-notifications' },
  readBudgetNotification: (id: number): ApiEndpoint => ({ method: 'PUT', path: `/api/budget-notifications/${id}/read` }),
  reportOptions: { method: 'GET', path: '/api/reports/options' },
  financialReport: { method: 'GET', path: '/api/reports/financial' },
  exportReport: { method: 'GET', path: '/api/reports/export' },
  createTransfer: { method: 'POST', path: '/api/transfers' },
  listTransfers: { method: 'GET', path: '/api/transfers' },
  updateAccount: (id: number): ApiEndpoint => ({ method: 'PUT', path: `/api/accounts/${id}` }),
  createValuation: (id: number): ApiEndpoint => ({ method: 'POST', path: `/api/accounts/${id}/valuations` }),
  listValuations: (id: number): ApiEndpoint => ({ method: 'GET', path: `/api/accounts/${id}/valuations` }),
  listUsers: { method: 'GET', path: '/api/users' },
  updateUserRole: (id: number): ApiEndpoint => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('User ID must be a positive safe integer')
    return { method: 'PUT', path: `/api/admin/users/${id}/role` }
  },
} as const
