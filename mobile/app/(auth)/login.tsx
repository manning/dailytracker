import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { api } from '../../lib/api'
import { saveAuth } from '../../lib/auth'

export default function LoginScreen() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    try {
      const { token, user } = await api.auth.login(email.trim(), password)
      await saveAuth(token, user)
      router.replace('/')
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.title}>DailyTracker</Text>
        <Text style={s.subtitle}>Sign in to your account</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={s.link}>
            <Text style={s.linkText}>No account? Register</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  card:     { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  title:    { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 12 },
  btn:      { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  link:     { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#2563eb', fontSize: 14 },
})
