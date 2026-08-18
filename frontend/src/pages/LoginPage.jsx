import { useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Icon } from '../components/ui/Icon.jsx';

export function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submitting = useAuthStore((s) => s.submitting);
  const error = useAuthStore((s) => s.error);
  const awaitingConfirmation = useAuthStore((s) => s.awaitingConfirmation);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    if (mode === 'signin') signIn(email.trim(), password);
    else signUp(email.trim(), password);
  };

  const switchMode = (next) => {
    setMode(next);
    clearError();
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand" aria-hidden="true">
          <Icon name="bag" size={28} strokeWidth={1.5} />
        </div>
        <h1 className="login__title">Courses</h1>
        <p className="login__subtitle">
          Les courses du foyer, du canapé au drive.
        </p>

        <div className="login__tabs" role="tablist" aria-label="Connexion ou inscription">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`login__tab ${mode === 'signin' ? 'login__tab--active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Connexion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`login__tab ${mode === 'signup' ? 'login__tab--active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Créer un compte
          </button>
        </div>

        {awaitingConfirmation ? (
          <div className="login__confirm">
            <Icon name="check" size={20} />
            <p>
              Compte créé. Ouvre le lien reçu par e-mail pour confirmer ton
              adresse, puis connecte-toi.
            </p>
          </div>
        ) : (
          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span className="login__label">Adresse e-mail</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>
            <label className="login__field">
              <span className="login__label">Mot de passe</span>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </label>

            {error && (
              <p className="login__error" role="alert">
                <Icon name="alert" size={14} />
                {error}
              </p>
            )}

            <Button type="submit" full disabled={submitting}>
              {submitting
                ? 'Un instant…'
                : mode === 'signin'
                  ? 'Se connecter'
                  : 'Créer le compte'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
