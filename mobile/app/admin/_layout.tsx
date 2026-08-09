import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'

export default function AdminLayout() {
  const { effectivePlan, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && effectivePlan !== 'admin') {
      router.back()
    }
  }, [effectivePlan, loading, router])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  )
}
