import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Gauge,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../lib/api';
export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign in · Meridian';
  }, []);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from || '/';
    return <Navigate to={from} replace />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const account = await login(email, password);
      toast.success(`Welcome back, ${account.fullName.split(' ')[0]}.`);
      const from = (location.state as { from?: string } | null)?.from || '/';
      navigate(from, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <Gauge size={20} /> 
          </div>
          <div>
            <div className="brand-name">Meridian</div>
            <div className="brand-sub">Task intelligence</div>
          </div>
        </div>

        <div className="login-headline">
          Work moves through <span>real approvals</span>, not around them.
        </div>
        <p className="login-desc">
          Meridian joins task delivery, two-tier completion approvals and AI workload insight in one
          workspace — with every role scoped to exactly what they should see.
        </p>

        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-icon">
              <ShieldCheck size={15} />
            </span>
            <span>
              Mandatory activation and two-tier completion approval with a permanent audit trail.
            </span>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">
              <Workflow size={15} />
            </span>
            <span>
              Group mode A and B, independent manager and senior ratings, and controlled extensions.
            </span>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">
              <Sparkles size={15} />
            </span>
            <span>
              AI meeting extraction and workload risk insight generated only from your permitted
              scope.
            </span>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">
              <Users size={15} />
            </span>
            <span>Team isolation enforced by the API — not just hidden in the interface.</span>
          </div>
        </div>

        <div className="login-brand-foot">
          Meridian workspace · all data in this environment is fictional
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h1>Sign in to Meridian</h1>
          <p className="login-sub">Sign in with your work email and password.</p>

          <form className="login-form" onSubmit={submit}>
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <span className="spinner" /> : <Lock size={15} />}
              Sign in
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
