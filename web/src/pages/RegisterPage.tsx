import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { api } from '../lib/api'
import { saveAuth } from '../lib/auth'

export default function RegisterPage() {
  const navigate = useNavigate()

  async function handleRegister(email: string, password: string, name?: string) {
    const { token, user } = await api.auth.register(email, password, name)
    saveAuth(token, user)
    navigate('/')
  }

  return (
    <AuthForm
      title="Create account"
      onSubmit={handleRegister}
      showName
      footer={<>Have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link></>}
    />
  )
}
