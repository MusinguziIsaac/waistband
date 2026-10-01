import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { authService } from '../services/authService'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session?.user) {
          setUser(session.user)
          const prof = await authService.getProfile(session.user.id)
          if (mounted) setProfile(prof)
        }
      } catch (err) {
        console.error("Error getting session:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        try {
          const prof = await authService.getProfile(session.user.id)
          if (mounted) setProfile(prof)
        } catch (e) {
          console.error(e)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      const prof = await authService.getProfile(user.id)
      setProfile(prof)
    }
  }

  const value = {
    user,
    profile,
    loading,
    refreshProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  return useContext(AuthContext)
}
