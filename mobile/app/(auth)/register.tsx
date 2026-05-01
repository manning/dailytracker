import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { api } from '../../lib/api'
import { saveAuth } from '../../lib/auth'

export default function RegisterScreen() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleRegister() {
    if (!email || !password) return
    setLoading(true)
    try {
      const { token, user } = await api.auth.register(email.trim(), password, name.trim() || undefined)
      await saveAuth(token, user)
      router.replace('/')
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.title}>Create account</Text>

        <TextInput style={s.input} placeholder="Name (optional)" value={name} onChangeText={setName} />
        <TextInput
          style={s.input} placeholder="Email"
          autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail}
        />
        <TextInput
          style={s.input} placeholder="Password (min 8 chars)"
          secureTextEntry value={password} onChangeText={setPassword}
          onSubmitEditing={handleRegister}
        />

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create account</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={s.link}>
            <Text style={s.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  card:    { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  title:   { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 24 },
  input:   { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 12 },
  btn:     { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link:    { alignItems: 'center', paddingVertical: 8 },
  linkText:{ color: '#2563eb', fontSize: 14 },
})
