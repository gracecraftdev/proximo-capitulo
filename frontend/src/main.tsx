
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

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

const API = 'http://127.0.0.1:8000';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : 'Não foi possível concluir a operação.'
    );
  }

  return res.status === 204
    ? undefined as T
    : res.json();
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
  const [selected, setSelected] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState<'quero_ler' | 'ja_li'>('quero_ler');

  // Estados da edição
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Estados da busca e ordenação
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ==========================================
  // CARREGAR DADOS
  // ==========================================

  const refresh = async () => {
    try {
      setBooks(await request<Book[]>('/books'));
      setHistory(await request<Draw[]>('/history'));
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

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

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

  const saveEditing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingBook) return;

    try {
      setMessage('');

      const updated = await request<Book>(
        `/books/${editingBook.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: editingTitle }),
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

    let i = 0;

    const interval = window.setInterval(() => {
      setPreview(options[i++ % options.length]?.title || '');
    }, 85);

    try {
      const book = await request<Book>('/draw', {
        method: 'POST',
      });

      await new Promise(resolve => setTimeout(resolve, 1200));

      setSelected(book);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      clearInterval(interval);
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
        .includes(search.trim().toLocaleLowerCase('pt-BR'))
    )
    .sort((a, b) =>
      sortOrder === 'asc'
        ? a.title.localeCompare(b.title, 'pt-BR')
        : b.title.localeCompare(a.title, 'pt-BR')
    );

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <main className="app">
      <div className="backdrop" />

      <div className="shell">
        <header>
          <img
            src="/images/capa-proximo-capitulo.png"
            alt="Capa Próximo Capítulo"
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

        {/* ESTATÍSTICAS */}

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

        {/* SORTEADOR */}

        <section className="hero">
          <span className="eyebrow">
            UMA NOVA HISTÓRIA ESPERA POR VOCÊ
          </span>

          <h2>Qual será sua próxima leitura?</h2>

          <p>O destino está entre as páginas.</p>

          <button
            className="primary"
            disabled={busy || !pending.length}
            onClick={() => void draw()}
          >
            {busy
              ? '🎲 Sorteando...'
              : '🎲 Sortear meu próximo livro'}
          </button>

          {busy && (
            <p className="reveal">{preview}</p>
          )}

          {selected && !busy && (
            <div className="result">
              <small>📖 Seu próximo livro será...</small>

              <h3>{selected.title}</h3>

              <div className="actions">
                <button
                  onClick={() => setMessage('Boa leitura! 📖')}
                >
                  📖 Vou ler este
                </button>

                <button onClick={() => void draw()}>
                  🎲 Sortear outro
                </button>

                <button
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

        {/* BIBLIOTECA */}

        <section className="panel">
          <h2>Minha biblioteca</h2>

          {/* BUSCA E ORDENAÇÃO */}

          <div className="library-filters">
            <input
              type="search"
              aria-label="Pesquisar livros"
              placeholder="🔎 Pesquisar livros..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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
                  current === 'asc' ? 'desc' : 'asc'
                )
              }
            >
              <span className="sort-icon" aria-hidden="true">
                {sortOrder === 'asc' ? '↓' : '↑'}
              </span>
              <span className="sort-label">
                {sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
              </span>
            </button>
          </div>

          {/* CADASTRO */}

          <form onSubmit={e => void add(e)}>
            <input
              aria-label="Título do livro"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Digite o título de um livro..."
              maxLength={250}
              required
            />

            <button type="submit">
              + Adicionar
            </button>
          </form>

          {/* ABAS */}

          <nav>
            <button
              className={tab === 'quero_ler' ? 'active' : ''}
              onClick={() => setTab('quero_ler')}
            >
              📚 Quero ler ({pending.length})
            </button>

            <button
              className={tab === 'ja_li' ? 'active' : ''}
              onClick={() => setTab('ja_li')}
            >
              ✅ Já li ({done.length})
            </button>
          </nav>

          {/* LISTA DE LIVROS */}

          <ul>
            {visibleBooks.map(book => (
              <li key={book.id}>
                <div>
                  <strong>{book.title}</strong>

                  {book.read_at && (
                    <small>
                      Lido em{' '}
                      {new Date(book.read_at)
                        .toLocaleDateString('pt-BR')}
                    </small>
                  )}
                </div>

                <div className="actions">
                  <button
                    onClick={() => startEditing(book)}
                  >
                    ✏️ Editar
                  </button>

                  <button
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
                    onClick={() => {
                      if (confirm(`Excluir "${book.title}"?`)) {
                        void run(async () => {
                          await request(
                            `/books/${book.id}`,
                            { method: 'DELETE' }
                          );

                          if (editingBook?.id === book.id) {
                            cancelEditing();
                          }

                          if (selected?.id === book.id) {
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

          {/* MENSAGEM DE LISTA VAZIA */}

          {!visibleBooks.length && (
            <p className="empty">
              {search.trim()
                ? 'Nenhum livro encontrado para sua pesquisa.'
                : 'Nenhum livro nesta lista ainda.'}
            </p>
          )}

          {search.trim() && (
            <p className="empty" role="status">
              {visibleBooks.length}{' '}
              {visibleBooks.length === 1
                ? 'livro encontrado'
                : 'livros encontrados'}
            </p>
          )}
        </section>

        {/* FORMULÁRIO DE EDIÇÃO */}

        {editingBook && (
          <section className="panel">
            <h2>✏️ Editar livro</h2>

            <p>
              Alterando: <strong>{editingBook.title}</strong>
            </p>

            <form onSubmit={e => void saveEditing(e)}>
              <input
                aria-label="Novo título do livro"
                value={editingTitle}
                onChange={e =>
                  setEditingTitle(e.target.value)
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

        {/* HISTÓRICO */}

        {history.length > 0 && (
          <section className="panel">
            <h2>Últimos sorteios</h2>

            <ul>
              {history.slice(0, 5).map(draw => (
                <li key={draw.id}>
                  {draw.title}

                  <small>
                    {new Date(draw.drawn_at)
                      .toLocaleDateString('pt-BR')}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* NOTIFICAÇÕES */}

        {message && (
          <div role="status" className="notice">
            {message}

            <button
              onClick={() => setMessage('')}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        )}

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
    <App />
  </React.StrictMode>
);
