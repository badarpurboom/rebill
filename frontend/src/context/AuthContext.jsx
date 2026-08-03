import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import * as authService from '@/services/auth'
import { tokens } from '@/services/api'
import { ROLES } from '@/utils/roles'

const AuthContext = createContext(null)

const initialState = { user: null, status: 'loading' } // loading | authed | guest

function reducer(state, action) {
  switch (action.type) {
    case 'AUTHED':
      return { user: action.user, status: 'authed' }
    case 'GUEST':
      return { user: null, status: 'guest' }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // On boot, a stored token is a claim, not proof. Ask the server who we are.
  useEffect(() => {
    if (!tokens.access) {
      dispatch({ type: 'GUEST' })
      return
    }
    let cancelled = false
    authService
      .fetchMe()
      .then((user) => !cancelled && dispatch({ type: 'AUTHED', user }))
      .catch(() => {
        if (cancelled) return
        authService.logout()
        dispatch({ type: 'GUEST' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const user = await authService.login(username, password)
    dispatch({ type: 'AUTHED', user })
    return user
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    dispatch({ type: 'GUEST' })
  }, [])

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      role: state.user?.role ?? null,
      isOwner: state.user?.role === ROLES.OWNER,
      isCashier: state.user?.role === ROLES.CASHIER,
      isWaiter: state.user?.role === ROLES.WAITER,
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
