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
  listUsers: { method: 'GET', path: '/api/admin/users' },
  updateUserRole: (id: number): ApiEndpoint => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('User ID must be a positive safe integer')
    return { method: 'PUT', path: `/api/admin/users/${id}/role` }
  },
} as const
