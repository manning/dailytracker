import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { api } from '../lib/api'
import { saveAuth } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()

  async function handleLogin(email: string, password: string) {
    const { token, user } = await api.auth.login(email, password)
    saveAuth(token, user)
    navigate('/')
  }

  return (
    <AuthForm
      title="Sign in"
      onSubmit={handleLogin}
      footer={<>No account? <Link to="/register" className="text-blue-600 hover:underline">Register</Link></>}
    />
  )
}
