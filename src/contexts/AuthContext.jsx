import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../supabase/client'
import { ROLE_HOME_ROUTES } from '../constants/roles'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [user, setUser]         = useState(null)     // DB user profile
  const [role, setRole]         = useState(null)     // 'admin'|'supervisor'|'helper'|'helpee'
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        loadUserProfile(session.user.id)
      } else {
        setUser(null)
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserProfile(authUserId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, departments(department_name), job_specifications(job_type_name)')
        .eq('auth_user_id', authUserId)
        .single()

      if (error) throw error
      setUser(data)
      setRole(data.user_type)
    } catch (err) {
      console.error('Failed to load user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setSession(null)
  }

  const value = {
    session,
    user,
    role,
    loading,
    signOut,
    homeRoute: role ? ROLE_HOME_ROUTES[role] : '/',
    isAdmin:      role === 'admin',
    isSupervisor: role === 'supervisor',
    isHelper:     role === 'helper',
    isHelpee:     role === 'helpee',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
