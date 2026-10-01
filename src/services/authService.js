import { supabase } from './supabase'

export const authService = {
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata.fullName || '',
          phone: metadata.phone || '',
          region: metadata.region || '',
        }
      }
    })
    if (error) throw error

    // If profile was auto-created by database trigger, ensure extra details like phone and region are set
    if (data?.user?.id) {
      try {
        await supabase.from('profiles').update({
          full_name: metadata.fullName || '',
          phone: metadata.phone || null,
          region: metadata.region || null,
        }).eq('id', data.user.id)
      } catch (e) {
        console.warn('Profile sync warning:', e)
      }
    }

    return data
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) throw error
    return data
  },

  async updateProfile(userId, updates) {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) throw error
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }
}
