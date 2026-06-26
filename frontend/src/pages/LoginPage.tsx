import { AlertCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  AuthShell,
  authInputClass,
  authInputErrorClass,
  authLabelClass,
} from '../components/auth/AuthShell'
import { validateEmail } from '../components/auth/validation'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface LocationState {
  from?: { pathname?: string }
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const emailError = validateEmail(email)
    const passwordError = password ? null : 'Password is required.'
    if (emailError || passwordError) {
      setErrors({ email: emailError ?? undefined, password: passwordError ?? undefined })
      return
    }
    setErrors({})

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to access your portal"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="font-medium text-brand hover:underline dark:text-brand-light"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-semantic-danger/30 bg-semantic-danger/10 px-3.5 py-2.5 text-sm text-semantic-danger dark:text-semantic-danger-light">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${authInputClass} ${errors.email ? authInputErrorClass : ''}`}
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-semantic-danger dark:text-semantic-danger-light">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={`${authInputClass} ${errors.password ? authInputErrorClass : ''}`}
            aria-invalid={errors.password ? true : undefined}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-semantic-danger dark:text-semantic-danger-light">
              {errors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary-gradient"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  )
}
