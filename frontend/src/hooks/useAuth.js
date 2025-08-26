import { useState, useEffect } from 'react'
import pb from '../services/pocketbase'

export default function useAuth() {
  const [user, setUser] = useState(pb.authStore.model)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    await pb.collection('users').authWithPassword(email, password)
    setUser(pb.authStore.model)
    setLoading(false)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return { user, login, logout, loading }
}
