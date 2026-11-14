
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import './login.css';

// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================

const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8000'
    : '/api');

type AuthResponse = {
  authenticated?: boolean;
  user?: string;
  detail?: string;
};

// ==========================================
// PÁGINA DE LOGIN
// ==========================================

export default function LoginEmBreve() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ========================================
  // VERIFICAR SESSÃO EXISTENTE
  // ========================================

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch(`${API}/auth/me`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!active) return;

        if (response.ok) {
          const data: AuthResponse = await response.json();

          setAuthenticated(data.authenticated === true);
        } else {
          setAuthenticated(false);
        }
      } catch {
        if (active) {
          setAuthenticated(false);
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // REALIZAR LOGIN
  // ========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data: AuthResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || data.authenticated !== true) {
        throw new Error(
          response.status === 401
            ? 'E-mail ou senha incorretos.'
            : typeof data.detail === 'string'
              ? data.detail
              : 'Não foi possível realizar o login.'
        );
      }

      // Confirma se o cookie de sessão foi recebido
      // e pode ser utilizado na próxima requisição.
      const sessionResponse = await fetch(
        `${API}/auth/me`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!sessionResponse.ok) {
        throw new Error(
          'O login foi aceito, mas não foi possível ' +
          'confirmar a sessão. Verifique a configuração ' +
          'dos cookies e da API.'
        );
      }

      const session: AuthResponse =
        await sessionResponse.json();

      if (session.authenticated !== true) {
        throw new Error(
          'Não foi possível confirmar sua sessão.'
        );
      }

      setAuthenticated(true);
      setPassword('');
      setNotice('Login realizado com sucesso!');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível conectar ao servidor.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // REALIZAR LOGOUT
  // ========================================

  async function handleLogout() {
    if (loading) return;

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(
          'Não foi possível encerrar sua sessão.'
        );
      }

      setAuthenticated(false);
      setPassword('');
      setNotice('Você saiu da sua conta.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Erro ao encerrar a sessão.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <main className="pc-login-scene">
      <div
        className="pc-login-ambient"
        aria-hidden="true"
      />

      <img
        className="pc-login-books"
        src="/images/login-livros-decorativos.png"
        alt=""
        aria-hidden="true"
      />

      <img
        className="pc-login-coffee"
        src="/images/login-xicara-decorativa.png"
        alt=""
        aria-hidden="true"
      />

      <section
        className="pc-login-panel"
        aria-label="Entrar na biblioteca"
      >
        <div className="pc-login-brand">
          <img
            src="/images/login-icone-proximo-capitulo.png"
            alt="Livro mágico, dado e estrelas"
          />
        </div>

        <h1>Próximo Capítulo</h1>

        <div
          className="pc-login-ornament"
          aria-hidden="true"
        >
          <span>◇ ✧ ◇</span>
        </div>

        <p className="pc-login-subtitle">
          {authenticated
            ? 'Bem-vinda à sua biblioteca'
            : 'Entre na sua biblioteca'}
        </p>

        {checkingSession ? (
          <p className="pc-login-note" role="status">
            Verificando sua sessão...
          </p>
        ) : authenticated ? (
          <div className="pc-login-form">
            <p className="pc-login-signup">
              Sua sessão está ativa.
            </p>

            <Link
              className="pc-login-submit"
              to="/biblioteca"
              style={{ textDecoration: 'none' }}
            >
              Ir para minha biblioteca
            </Link>

            <button
              className="pc-login-google"
              type="button"
              onClick={() => void handleLogout()}
              disabled={loading}
            >
              {loading ? 'Saindo...' : 'Sair da conta'}
            </button>
          </div>
        ) : (
          <form
            className="pc-login-form"
            onSubmit={handleSubmit}
          >
            <label
              className="pc-login-inputbox"
              htmlFor="pc-login-email"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="4"
                  width="20"
                  height="16"
                  rx="2"
                />
                <path d="m2 6 10 8 10-8" />
              </svg>

              <input
                id="pc-login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={event =>
                  setEmail(event.target.value)
                }
                placeholder="E-mail"
                aria-label="E-mail"
                required
              />
            </label>

            <label
              className="pc-login-inputbox"
              htmlFor="pc-login-password"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="12"
                  rx="2"
                />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="16" r="1" />
              </svg>

              <input
                id="pc-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={event =>
                  setPassword(event.target.value)
                }
                placeholder="Senha"
                aria-label="Senha"
                required
              />

              <button
                className="pc-login-visibility"
                type="button"
                aria-label={
                  showPassword
                    ? 'Ocultar senha'
                    : 'Mostrar senha'
                }
                aria-pressed={showPassword}
                onClick={() =>
                  setShowPassword(value => !value)
                }
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="m3 3 18 18" />
                    <path d="M10.5 5.1 12 5c6 0 10 7 10 7a15 15 0 0 1-3.4 3.8M6 6.5C3.4 8.5 2 12 2 12s4 7 10 7c1.8 0 3.3-.5 4.7-1.5" />
                  </svg>
                )}
              </button>
            </label>

            <div className="pc-login-options">
              <label title="Em breve">
                <input
                  type="checkbox"
                  disabled
                />
                Lembrar meu acesso
              </label>

              <span
                title="Em breve"
                className="pc-login-forgot"
              >
                Esqueci minha senha
              </span>
            </div>

            {error && (
              <p
                className="pc-login-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="pc-login-submit"
              type="submit"
              disabled={loading}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M10 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9" />
                <path d="m12 8 4 4-4 4M16 12H3" />
              </svg>

              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}

        {notice && (
          <p
            className="pc-login-signup"
            role="status"
          >
            {notice}
          </p>
        )}

        {authenticated && error && (
          <p
            className="pc-login-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="pc-login-divider">
          <span>ou</span>
        </div>

        <button
          className="pc-login-google"
          type="button"
          disabled
          title="Em breve"
        >
          <span
            className="pc-login-google-g"
            aria-hidden="true"
          >
            G
          </span>

          Entrar com o Google
        </button>

        <p className="pc-login-signup">
          Ainda não tem uma conta?{' '}
          <span title="Em breve">
            Cadastre-se
          </span>
        </p>

        <Link
          className="pc-login-back"
          to="/"
        >
          ← Voltar à página inicial
        </Link>

        <p className="pc-login-note">
          Google, cadastro e recuperação de senha:
          em breve.
        </p>
      </section>
    </main>
  );
}
