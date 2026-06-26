import { AlertCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  AuthShell,
  authInputClass,
  authInputErrorClass,
  authLabelClass,
} from '../components/auth/AuthShell'
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
} from '../components/auth/validation'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
    confirm?: string
  }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    const confirmError = password !== confirm ? 'Passwords do not match.' : null
    if (emailError || passwordError || confirmError) {
      setErrors({
        email: emailError ?? undefined,
        password: passwordError ?? undefined,
        confirm: confirmError ?? undefined,
      })
      return
    }
    setErrors({})

    setSubmitting(true)
    try {
      // signup() registers, then logs in automatically.
      await signup(email.trim(), password)
      navigate('/', { replace: true })
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
      title="Create your account"
      subtitle="Sign up to get your own portal"
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand hover:underline dark:text-brand-light"
          >
            Log in
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className={`${authInputClass} ${errors.password ? authInputErrorClass : ''}`}
            aria-invalid={errors.password ? true : undefined}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-semantic-danger dark:text-semantic-danger-light">
              {errors.password}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirm" className={authLabelClass}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            className={`${authInputClass} ${errors.confirm ? authInputErrorClass : ''}`}
            aria-invalid={errors.confirm ? true : undefined}
          />
          {errors.confirm && (
            <p className="mt-1 text-xs text-semantic-danger dark:text-semantic-danger-light">
              {errors.confirm}
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
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
