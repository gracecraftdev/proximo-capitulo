
import { Link } from 'react-router-dom';

export default function LoginEmBreve() {
  return (
    <section className="login-soon-page">
      <style>{`
        .login-soon-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 480px;
          padding: 42px 16px 64px;
        }

        .login-soon-card {
          width: 100%;
          max-width: 560px;
          padding: clamp(28px, 6vw, 56px);
          text-align: center;
          border-radius: 24px;
          border: 1px solid rgba(217, 169, 99, 0.45);
          background:
            radial-gradient(
              circle at top,
              rgba(168, 106, 48, 0.16),
              transparent 60%
            ),
            linear-gradient(150deg, #332116, #21140e);
          box-shadow: 0 25px 65px rgba(0, 0, 0, 0.3);
          color: #f5e5d0;
        }

        .login-soon-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 90px;
          height: 90px;
          margin: 0 auto 24px;
          border-radius: 50%;
          color: #e8bb77;
          background: rgba(214, 160, 85, 0.09);
          border: 1px solid rgba(214, 160, 85, 0.25);
        }

        .login-soon-eyebrow {
          color: #d7a967;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .login-soon-card h2 {
          margin: 18px 0;
          color: #f9e8cc;
          font-family: Georgia, serif;
          font-size: clamp(1.8rem, 5vw, 2.5rem);
          line-height: 1.2;
        }

        .login-soon-description {
          max-width: 410px;
          margin: 0 auto;
          color: #d0baa0;
          line-height: 1.8;
        }

        .login-soon-status {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin: 26px 0 12px;
          padding: 11px 20px;
          border-radius: 999px;
          color: #ecc58c;
          font-weight: 700;
          border: 1px solid rgba(217, 169, 99, 0.3);
          background: rgba(196, 140, 69, 0.12);
        }

        .login-soon-note {
          margin: 12px auto 28px;
          color: #bda58c;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .login-soon-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 13px 24px;
          border-radius: 11px;
          border: 1px solid #d4a56a;
          color: #f4d6a8;
          text-decoration: none;
          font-weight: 700;
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .login-soon-back:hover {
          background: rgba(212, 165, 106, 0.15);
          transform: translateY(-2px);
        }

        .login-soon-back:focus-visible {
          outline: 2px solid #f4d6a8;
          outline-offset: 4px;
        }

        @media (max-width: 600px) {
          .login-soon-page {
            padding: 28px 0 42px;
          }
        }
      `}</style>

      <div className="login-soon-card">
        <div className="login-soon-icon" aria-hidden="true">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 7.5c-2.5-1.5-5.5-1.7-9-1v12c3.5-.7 6.5-.5 9 1" />
            <path d="M12 7.5c2.5-1.5 5.5-1.7 9-1v12c-3.5-.7-6.5-.5-9 1" />
            <path d="M12 7.5v12" />
            <path d="m17 2 .5 1.5L19 4l-1.5.5L17 6l-.5-1.5L15 4l1.5-.5L17 2Z" />
          </svg>
        </div>

        <span className="login-soon-eyebrow">
          Um novo capítulo está chegando
        </span>

        <h2>Sua biblioteca, seu universo.</h2>

        <p className="login-soon-description">
          Estamos preparando um espaço especial para você
          guardar suas histórias, organizar suas leituras
          e continuar exatamente de onde parou.
        </p>

        <div className="login-soon-status">
          <span aria-hidden="true">✦</span>
          Em breve
          <span aria-hidden="true">✦</span>
        </div>

        <p className="login-soon-note">
          Login e criação de conta estarão disponíveis
          em uma próxima atualização.
        </p>

        <Link to="/" className="login-soon-back">
          ← Voltar à biblioteca
        </Link>
      </div>
    </section>
  );
}
