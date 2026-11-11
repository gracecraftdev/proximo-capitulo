
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import './style.css';
import './navigation.css';

// ==========================================
// TIPOS
// ==========================================

type Book = {
  id: number;
  title: string;
  status: 'quero_ler' | 'ja_li';
  read_at: string | null;
};

type Draw = {
  id: number;
  title: string;
  drawn_at: string;
};

// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================

const API =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : 'Não foi possível concluir a operação.'
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ==========================================
// MENU DE NAVEGAÇÃO
// ==========================================

function Navigation() {
  return (
    <nav
      className="main-navigation"
      aria-label="Menu principal"
    >
      <NavLink to="/" end>
        ✨ Início
      </NavLink>

      <NavLink to="/biblioteca">
        📚 Minha biblioteca
      </NavLink>

      <NavLink to="/importar">
        📥 Importar livros
      </NavLink>

      <NavLink to="/login">
        👤 Entrar
      </NavLink>
    </nav>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

function App() {
  // Estados da biblioteca
  const [books, setBooks] = useState<Book[]>([]);
  const [history, setHistory] = useState<Draw[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // Estados do sorteador
  const [selected, setSelected] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');

  // Estados da biblioteca
  const [tab, setTab] = useState<'quero_ler' | 'ja_li'>(
    'quero_ler'
  );

  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    'asc'
  );

  // Estados da edição
  const [editingBook, setEditingBook] = useState<Book | null>(
    null
  );
  const [editingTitle, setEditingTitle] = useState('');

  // ==========================================
  // CARREGAR DADOS
  // ==========================================

  const refresh = async () => {
    try {
      const [loadedBooks, loadedHistory] = await Promise.all([
        request<Book[]>('/books'),
        request<Draw[]>('/history'),
      ]);

      setBooks(loadedBooks);
      setHistory(loadedHistory);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // ==========================================
  // EXECUTAR OPERAÇÕES
  // ==========================================

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setMessage('');
      await fn();
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  // ==========================================
  // ADICIONAR LIVRO
  // ==========================================

  const add = async (event: React.FormEvent) => {
    event.preventDefault();

    await run(async () => {
      await request('/books', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      setTitle('');
    });
  };

  // ==========================================
  // EDITAR LIVRO
  // ==========================================

  const startEditing = (book: Book) => {
    setEditingBook(book);
    setEditingTitle(book.title);
    setMessage('');
  };

  const cancelEditing = () => {
    setEditingBook(null);
    setEditingTitle('');
  };

  const saveEditing = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingBook) return;

    try {
      setMessage('');

      const updated = await request<Book>(
        `/books/${editingBook.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: editingTitle,
          }),
        }
      );

      setSelected(current =>
        current?.id === updated.id ? updated : current
      );

      cancelEditing();
      await refresh();

      setMessage('Livro atualizado com sucesso!');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  // ==========================================
  // SORTEAR LIVRO
  // ==========================================

  const draw = async () => {
    if (busy) return;

    setBusy(true);
    setSelected(null);
    setMessage('');

    const options = books.filter(
      book => book.status === 'quero_ler'
    );

    let index = 0;

    const interval = window.setInterval(() => {
      setPreview(
        options[index++ % options.length]?.title || ''
      );
    }, 85);

    try {
      const book = await request<Book>('/draw', {
        method: 'POST',
      });

      await new Promise(resolve =>
        window.setTimeout(resolve, 1200)
      );

      setSelected(book);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      window.clearInterval(interval);
      setPreview('');
      setBusy(false);
    }
  };

  // ==========================================
  // FILTRAR E ORDENAR LIVROS
  // ==========================================

  const pending = books.filter(
    book => book.status === 'quero_ler'
  );

  const done = books.filter(
    book => book.status === 'ja_li'
  );

  const visibleBooks = (tab === 'quero_ler' ? pending : done)
    .filter(book =>
      book.title
        .toLocaleLowerCase('pt-BR')
        .includes(
          search.trim().toLocaleLowerCase('pt-BR')
        )
    )
    .sort((a, b) =>
      sortOrder === 'asc'
        ? a.title.localeCompare(b.title, 'pt-BR')
        : b.title.localeCompare(a.title, 'pt-BR')
    );

  // ==========================================
  // INTERFACE PRINCIPAL
  // ==========================================

  return (
    <main className="app">
      <div className="backdrop" />

      <div className="shell">
        {/* CABEÇALHO */}

        <header className="site-header">
          <img
            src="/images/capa-proximo-capitulo.png"
            alt="Logotipo do Próximo Capítulo"
          />

          <div>
            <span className="eyebrow">
              SUA BIBLIOTECA PESSOAL
            </span>

            <h1>Próximo Capítulo</h1>

            <p>
              Deixe o acaso escolher sua próxima história.
            </p>
          </div>
        </header>

        {/* MENU */}

        <Navigation />

        {/* PÁGINAS */}

        <Routes>
          {/* ==================================
              INÍCIO — SORTEADOR
             ================================== */}

          <Route
            path="/"
            element={
              <>
                <section className="stats">
                  <div>
                    <strong>{books.length}</strong>
                    <span>Total de livros</span>
                  </div>

                  <div>
                    <strong>{pending.length}</strong>
                    <span>Quero ler</span>
                  </div>

                  <div>
                    <strong>{done.length}</strong>
                    <span>Já li</span>
                  </div>
                </section>

                <section className="hero">
                  <span className="eyebrow">
                    UMA NOVA HISTÓRIA ESPERA POR VOCÊ
                  </span>

                  <h2>Qual será sua próxima leitura?</h2>

                  <p>O destino está entre as páginas.</p>

                  <button
                    type="button"
                    className="primary"
                    disabled={busy || !pending.length}
                    onClick={() => void draw()}
                  >
                    {busy
                      ? '🎲 Sorteando...'
                      : '🎲 Sortear meu próximo livro'}
                  </button>

                  {/* Animação do sorteio */}

                  {busy && (
                    <p className="reveal" role="status">
                      {preview}
                    </p>
                  )}

                  {/* Capa mágica do resultado */}

                  {selected && !busy && (
                    <div className="result">
                      <small className="draw-result-heading">
                        ✨ O destino escolheu sua próxima história...
                      </small>

                      <div className="draw-book-cover">
                        <img
                          src="/images/capa-livro-sorteado.png"
                          alt="Capa mágica do livro sorteado"
                        />

                        <div className="draw-book-title">
                          <span className="draw-book-caption">
                            SEU PRÓXIMO CAPÍTULO
                          </span>

                          <h3>{selected.title}</h3>

                          <span
                            className="draw-book-ornament"
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                        </div>
                      </div>

                      <div className="actions draw-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setMessage('Boa leitura! 📖')
                          }
                        >
                          📖 Vou ler este
                        </button>

                        <button
                          type="button"
                          onClick={() => void draw()}
                        >
                          🎲 Sortear outro
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void run(async () => {
                              await request(
                                `/books/${selected.id}/read`,
                                { method: 'PATCH' }
                              );

                              setSelected(null);
                            })
                          }
                        >
                          ✅ Já li este livro
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Últimos sorteios */}

                <section className="panel">
                  <h2>📜 Últimos sorteios</h2>

                  {history.length > 0 ? (
                    <ul>
                      {history.slice(0, 5).map(item => (
                        <li key={item.id}>
                          <strong>{item.title}</strong>

                          <small>
                            {new Date(
                              item.drawn_at
                            ).toLocaleDateString('pt-BR')}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty">
                      Nenhum sorteio realizado ainda.
                    </p>
                  )}
                </section>
              </>
            }
          />

          {/* ==================================
              MINHA BIBLIOTECA
             ================================== */}

          <Route
            path="/biblioteca"
            element={
              <>
                <section className="panel">
                  <span className="eyebrow">
                    ORGANIZE SUAS HISTÓRIAS
                  </span>

                  <h2>Minha biblioteca</h2>

                  <p>
                    Todos os seus livros em um só lugar.
                  </p>

                  {/* Pesquisa e ordenação */}

                  <div className="library-filters">
                    <input
                      type="search"
                      aria-label="Pesquisar livros"
                      placeholder="🔎 Pesquisar livros..."
                      value={search}
                      onChange={event =>
                        setSearch(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="sort-toggle"
                      aria-label={
                        sortOrder === 'asc'
                          ? 'Ordem A a Z. Clique para inverter.'
                          : 'Ordem Z a A. Clique para inverter.'
                      }
                      title="Alternar ordem alfabética"
                      onClick={() =>
                        setSortOrder(current =>
                          current === 'asc'
                            ? 'desc'
                            : 'asc'
                        )
                      }
                    >
                      <span
                        className="sort-icon"
                        aria-hidden="true"
                      >
                        {sortOrder === 'asc' ? '↓' : '↑'}
                      </span>

                      <span className="sort-label">
                        {sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
                      </span>
                    </button>
                  </div>

                  {/* Cadastro de livros */}

                  <form onSubmit={event => void add(event)}>
                    <input
                      aria-label="Título do livro"
                      value={title}
                      onChange={event =>
                        setTitle(event.target.value)
                      }
                      placeholder="Digite o título de um livro..."
                      maxLength={250}
                      required
                    />

                    <button type="submit">
                      + Adicionar
                    </button>
                  </form>

                  {/* Abas Quero ler e Já li */}

                  <nav
                    className="library-tabs"
                    aria-label="Listas de leitura"
                  >
                    <button
                      type="button"
                      className={
                        tab === 'quero_ler' ? 'active' : ''
                      }
                      onClick={() => setTab('quero_ler')}
                    >
                      📚 Quero ler ({pending.length})
                    </button>

                    <button
                      type="button"
                      className={
                        tab === 'ja_li' ? 'active' : ''
                      }
                      onClick={() => setTab('ja_li')}
                    >
                      ✅ Já li ({done.length})
                    </button>
                  </nav>

                  {/* Lista de livros */}

                  <ul>
                    {visibleBooks.map(book => (
                      <li key={book.id}>
                        <div>
                          <strong>{book.title}</strong>

                          {book.read_at && (
                            <small>
                              Lido em{' '}
                              {new Date(
                                book.read_at
                              ).toLocaleDateString('pt-BR')}
                            </small>
                          )}
                        </div>

                        <div className="actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEditing(book)
                            }
                          >
                            ✏️ Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void run(() =>
                                request(
                                  `/books/${book.id}/${
                                    tab === 'quero_ler'
                                      ? 'read'
                                      : 'unread'
                                  }`,
                                  { method: 'PATCH' }
                                )
                              )
                            }
                          >
                            {tab === 'quero_ler'
                              ? 'Marcar lido'
                              : 'Devolver'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir "${book.title}"?`
                                )
                              ) {
                                void run(async () => {
                                  await request(
                                    `/books/${book.id}`,
                                    { method: 'DELETE' }
                                  );

                                  if (
                                    editingBook?.id === book.id
                                  ) {
                                    cancelEditing();
                                  }

                                  if (
                                    selected?.id === book.id
                                  ) {
                                    setSelected(null);
                                  }
                                });
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Lista vazia */}

                  {!visibleBooks.length && (
                    <p className="empty">
                      {search.trim()
                        ? 'Nenhum livro encontrado para sua pesquisa.'
                        : 'Nenhum livro nesta lista ainda.'}
                    </p>
                  )}

                  {/* Resultados da pesquisa */}

                  {search.trim() && (
                    <p className="empty" role="status">
                      {visibleBooks.length}{' '}
                      {visibleBooks.length === 1
                        ? 'livro encontrado'
                        : 'livros encontrados'}
                    </p>
                  )}
                </section>

                {/* Edição */}

                {editingBook && (
                  <section className="panel">
                    <h2>✏️ Editar livro</h2>

                    <p>
                      Alterando:{' '}
                      <strong>{editingBook.title}</strong>
                    </p>

                    <form
                      onSubmit={event =>
                        void saveEditing(event)
                      }
                    >
                      <input
                        aria-label="Novo título do livro"
                        value={editingTitle}
                        onChange={event =>
                          setEditingTitle(event.target.value)
                        }
                        maxLength={250}
                        required
                        autoFocus
                      />

                      <button type="submit">
                        Salvar alterações
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditing}
                      >
                        Cancelar
                      </button>
                    </form>
                  </section>
                )}
              </>
            }
          />

          {/* ==================================
              IMPORTAR LIVROS
             ================================== */}

          <Route
            path="/importar"
            element={
              <section className="panel page-placeholder">
                <span className="eyebrow">
                  TRAGA SUAS HISTÓRIAS
                </span>

                <h2>📥 Importar biblioteca</h2>

                <p>
                  Em breve, você poderá importar sua
                  biblioteca completa de uma só vez.
                </p>

                <p>
                  Estamos preparando a importação de
                  listas de títulos e arquivos digitais,
                  com prévia e identificação de duplicados.
                </p>

                <NavLink
                  className="page-link"
                  to="/biblioteca"
                >
                  Ver minha biblioteca
                </NavLink>
              </section>
            }
          />

          {/* ==================================
              LOGIN
             ================================== */}

          <Route
            path="/login"
            element={
              <section className="panel page-placeholder">
                <span className="eyebrow">
                  SUA BIBLIOTECA PESSOAL
                </span>

                <h2>✨ Entre na sua biblioteca</h2>

                <p>
                  Estamos preparando o acesso por e-mail,
                  senha e conta Google.
                </p>

                <p>
                  A tela definitiva seguirá o modelo
                  marrom e dourado que você escolheu.
                </p>

                <NavLink className="page-link" to="/">
                  Voltar ao início
                </NavLink>
              </section>
            }
          />

          {/* ENDEREÇO NÃO ENCONTRADO */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>

        {/* NOTIFICAÇÕES */}

        {message && (
          <div role="status" className="notice">
            {message}

            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        )}

        {/* RODAPÉ */}

        <footer>
          Próximo Capítulo · Sua biblioteca, suas histórias.
        </footer>
      </div>
    </main>
  );
}

// ==========================================
// INICIALIZAÇÃO DO REACT
// ==========================================

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
