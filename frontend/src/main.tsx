
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

type Status = 'quero_ler' | 'lendo' | 'ja_li';
type Decision = 'vou_ler' | 'agora_nao';

type Book = {
  id: number;
  title: string;
  status: Status;
  read_at: string | null;
};

type DrawResult = Book & {
  draw_id: number;
};

type DrawHistory = {
  id: number;
  book_id: number;
  title: string;
  drawn_at: string;
  decision: Decision | null;
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
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
// FUNÇÕES AUXILIARES
// ==========================================

function decisionLabel(decision: Decision | null) {
  if (decision === 'vou_ler') return '📖 Vou ler';
  if (decision === 'agora_nao') return '↩️ Agora não';

  return 'Sem decisão registrada';
}

function formatDate(date: string) {
  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

// ==========================================
// NAVEGAÇÃO
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

      <NavLink to="/historico">
        📜 Histórico
      </NavLink>

      <NavLink to="/login">
        👤 Entrar
      </NavLink>
    </nav>
  );
}

// ==========================================
// MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// ==========================================

type DeleteModalProps = {
  book: Book;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteModal({
  book,
  deleting,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );

      document.body.style.overflow = previousOverflow;
    };
  }, [deleting, onCancel]);

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel();
        }
      }}
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
      >
        <div className="confirm-icon-wrap">
          <span className="confirm-icon" aria-hidden="true">
            <img
              src="/images/icone-excluir.png"
              alt=""
              width={32}
              height={32}
              style={{ display: 'block', objectFit: 'contain' }}
            />
          </span>
        </div>

        <h3
          id="confirm-delete-title"
          className="confirm-title"
        >
          Excluir este livro?
        </h3>

        <p className="confirm-text">
          Tem certeza de que deseja remover
        </p>

        <p className="confirm-book">
          “{book.title}”
        </p>

        <p
          id="confirm-delete-description"
          className="confirm-warning"
        >
          Este título será removido permanentemente da
          sua biblioteca. Essa ação não poderá ser desfeita.
        </p>

        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
          >
            Cancelar
          </button>

          <button
            type="button"
            className="confirm-delete"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting
              ? 'Excluindo...'
              : '🗑️ Excluir livro'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// APLICATIVO PRINCIPAL
// ==========================================

function App() {
  // ----------------------------------------
  // BIBLIOTECA E HISTÓRICO
  // ----------------------------------------

  const [books, setBooks] = useState<Book[]>([]);
  const [history, setHistory] = useState<DrawHistory[]>([]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // ----------------------------------------
  // SORTEADOR
  // ----------------------------------------

  const [selected, setSelected] =
    useState<DrawResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [deciding, setDeciding] = useState(false);

  // ----------------------------------------
  // FILTROS E LISTAS
  // ----------------------------------------

  const [tab, setTab] = useState<Status>('quero_ler');
  const [search, setSearch] = useState('');

  const [sortOrder, setSortOrder] =
    useState<'asc' | 'desc'>('asc');

  const [historySearch, setHistorySearch] =
    useState('');

  // ----------------------------------------
  // EDIÇÃO
  // ----------------------------------------

  const [editingBook, setEditingBook] =
    useState<Book | null>(null);

  const [editingTitle, setEditingTitle] =
    useState('');

  // ----------------------------------------
  // EXCLUSÃO
  // ----------------------------------------

  const [bookToDelete, setBookToDelete] =
    useState<Book | null>(null);

  const [deleting, setDeleting] = useState(false);

  // ==========================================
  // CARREGAMENTO DOS DADOS
  // ==========================================

  async function refresh() {
    const [loadedBooks, loadedHistory] =
      await Promise.all([
        request<Book[]>('/books'),
        request<DrawHistory[]>('/history'),
      ]);

    setBooks(loadedBooks);
    setHistory(loadedHistory);
  }

  useEffect(() => {
    void refresh().catch(error => {
      setMessage((error as Error).message);
    });
  }, []);

  // ==========================================
  // EXECUÇÃO DE OPERAÇÕES
  // ==========================================

  async function run(
    operation: () => Promise<void>,
    successMessage?: string
  ) {
    try {
      setMessage('');

      await operation();
      await refresh();

      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  // ==========================================
  // CADASTRAR LIVRO
  // ==========================================

  async function add(event: React.FormEvent) {
    event.preventDefault();

    await run(async () => {
      await request('/books', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      setTitle('');
    }, 'Livro adicionado à lista Quero ler!');
  }

  // ==========================================
  // EDITAR LIVRO
  // ==========================================

  function startEditing(book: Book) {
    setEditingBook(book);
    setEditingTitle(book.title);
    setMessage('');
  }

  function cancelEditing() {
    setEditingBook(null);
    setEditingTitle('');
  }

  async function saveEditing(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!editingBook) return;

    await run(async () => {
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
        current?.id === updated.id
          ? {
              ...current,
              title: updated.title,
            }
          : current
      );

      cancelEditing();
    }, 'Livro atualizado com sucesso!');
  }

  // ==========================================
  // MUDAR STATUS DO LIVRO
  // ==========================================

  async function changeBookStatus(
    bookId: number,
    action: 'reading' | 'read' | 'unread',
    successMessage: string
  ) {
    await run(async () => {
      await request(`/books/${bookId}/${action}`, {
        method: 'PATCH',
      });
    }, successMessage);
  }

  // ==========================================
  // EXCLUIR LIVRO COM MODAL
  // ==========================================

  function askToDelete(book: Book) {
    setBookToDelete(book);
    setMessage('');
  }

  function cancelDelete() {
    if (deleting) return;

    setBookToDelete(null);
  }

  async function confirmDelete() {
    if (!bookToDelete || deleting) return;

    const book = bookToDelete;

    setDeleting(true);
    setMessage('');

    try {
      await request(`/books/${book.id}`, {
        method: 'DELETE',
      });

      if (editingBook?.id === book.id) {
        cancelEditing();
      }

      if (selected?.id === book.id) {
        setSelected(null);
      }

      await refresh();

      setBookToDelete(null);

      setMessage(
        `"${book.title}" foi excluído da biblioteca.`
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // ==========================================
  // SORTEAR LIVRO
  // ==========================================

  async function draw() {
    if (busy || deciding) return;

    setBusy(true);
    setSelected(null);
    setMessage('');

    const options = books.filter(
      book => book.status === 'quero_ler'
    );

    let index = 0;

    const interval = window.setInterval(() => {
      if (options.length > 0) {
        setPreview(
          options[index++ % options.length].title
        );
      }
    }, 85);

    try {
      const result = await request<DrawResult>(
        '/draw',
        {
          method: 'POST',
        }
      );

      await new Promise(resolve =>
        window.setTimeout(resolve, 1200)
      );

      setSelected(result);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      window.clearInterval(interval);

      setPreview('');
      setBusy(false);
    }
  }

  // ==========================================
  // DECIDIR O RESULTADO DO SORTEIO
  // ==========================================

  async function decide(decision: Decision) {
    if (!selected || deciding) return;

    setDeciding(true);
    setMessage('');

    try {
      const result = await request<{
        book: Book;
        decision: Decision;
        draw_id: number;
      }>(
        `/draw/${selected.draw_id}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({ decision }),
        }
      );

      setSelected(null);

      await refresh();

      setMessage(
        result.decision === 'vou_ler'
          ? `"${result.book.title}" foi para Lendo! 📖`
          : `"${result.book.title}" continua em Quero ler.`
      );
    } catch (error) {
      setMessage((error as Error).message);

      await refresh().catch(() => undefined);
    } finally {
      setDeciding(false);
    }
  }

  // ==========================================
  // LISTAS
  // ==========================================

  const pending = books.filter(
    book => book.status === 'quero_ler'
  );

  const reading = books.filter(
    book => book.status === 'lendo'
  );

  const done = books.filter(
    book => book.status === 'ja_li'
  );

  // ==========================================
  // PESQUISA E ORDENAÇÃO
  // ==========================================

  const visibleBooks = books
    .filter(book => book.status === tab)
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

  const filteredHistory = history.filter(item =>
    item.title
      .toLocaleLowerCase('pt-BR')
      .includes(
        historySearch
          .trim()
          .toLocaleLowerCase('pt-BR')
      )
  );

  // ==========================================
  // COMPONENTE DO HISTÓRICO
  // ==========================================

  function historyList(items: DrawHistory[]) {
    return (
      <ul>
        {items.map(item => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>

              <small>
                {formatDate(item.drawn_at)}
              </small>
            </div>

            <span className="history-decision">
              {decisionLabel(item.decision)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <main className="app">
      <div className="backdrop" />

      <div className="shell">
        {/* ==================================
            CABEÇALHO
           ================================== */}

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

        {/* NAVEGAÇÃO */}

        <Navigation />

        {/* ==================================
            PÁGINAS
           ================================== */}

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
                    <strong>{reading.length}</strong>
                    <span>Lendo</span>
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

                  <h2>
                    Qual será sua próxima leitura?
                  </h2>

                  <p>
                    O destino está entre as páginas.
                  </p>

                  <button
                    type="button"
                    className="primary"
                    disabled={
                      busy ||
                      deciding ||
                      pending.length === 0
                    }
                    onClick={() => void draw()}
                  >
                    {busy
                      ? '🎲 Sorteando...'
                      : '🎲 Sortear meu próximo livro'}
                  </button>

                  {pending.length === 0 && (
                    <p className="empty">
                      Nenhum livro disponível em Quero ler.
                    </p>
                  )}

                  {busy && (
                    <p
                      className="reveal"
                      role="status"
                    >
                      {preview}
                    </p>
                  )}

                  {/* CAPA MÁGICA */}

                  {selected && !busy && (
                    <div className="result">
                      <small className="draw-result-heading">
                        ✨ O destino escolheu sua próxima
                        história...
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

                          <h3>
                            {selected.title}
                          </h3>

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
                          disabled={deciding}
                          onClick={() =>
                            void decide('vou_ler')
                          }
                        >
                          📖 Vou ler
                        </button>

                        <button
                          type="button"
                          disabled={deciding}
                          onClick={() =>
                            void decide('agora_nao')
                          }
                        >
                          ↩️ Agora não
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* ÚLTIMOS SORTEIOS */}

                <section className="panel">
                  <h2>
                    📜 Últimos sorteios
                  </h2>

                  {history.length > 0 ? (
                    historyList(
                      history.slice(0, 3)
                    )
                  ) : (
                    <p className="empty">
                      Nenhum sorteio nos últimos 30 dias.
                    </p>
                  )}

                  <NavLink
                    className="page-link"
                    to="/historico"
                  >
                    Ver histórico completo
                  </NavLink>
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

                  <h2>
                    Minha biblioteca
                  </h2>

                  <p>
                    Todos os seus livros em um só lugar.
                  </p>

                  {/* PESQUISA */}

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
                      title="Alternar ordem alfabética"
                      aria-label={
                        sortOrder === 'asc'
                          ? 'Ordem A a Z. Clique para inverter.'
                          : 'Ordem Z a A. Clique para inverter.'
                      }
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
                        {sortOrder === 'asc'
                          ? '↓'
                          : '↑'}
                      </span>

                      <span className="sort-label">
                        {sortOrder === 'asc'
                          ? 'A–Z'
                          : 'Z–A'}
                      </span>
                    </button>
                  </div>

                  {/* ADICIONAR LIVRO */}

                  <form
                    onSubmit={event => void add(event)}
                  >
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

                  {/* ABAS */}

                  <nav
                    className="library-tabs"
                    aria-label="Listas de leitura"
                  >
                    <button
                      type="button"
                      className={
                        tab === 'quero_ler'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setTab('quero_ler')
                      }
                    >
                      📚 Quero ler ({pending.length})
                    </button>

                    <button
                      type="button"
                      className={
                        tab === 'lendo'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setTab('lendo')
                      }
                    >
                      📖 Lendo ({reading.length})
                    </button>

                    <button
                      type="button"
                      className={
                        tab === 'ja_li'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setTab('ja_li')
                      }
                    >
                      ✅ Já li ({done.length})
                    </button>
                  </nav>

                  {/* LIVROS */}

                  <ul>
                    {visibleBooks.map(book => (
                      <li key={book.id}>
                        <div>
                          <strong>
                            {book.title}
                          </strong>

                          {book.read_at && (
                            <small>
                              Lido em{' '}
                              {formatDate(
                                book.read_at
                              )}
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

                          {/* QUERO LER */}

                          {tab === 'quero_ler' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void changeBookStatus(
                                    book.id,
                                    'reading',
                                    'Livro movido para Lendo!'
                                  )
                                }
                              >
                                📖 Começar leitura
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void changeBookStatus(
                                    book.id,
                                    'read',
                                    'Livro marcado como concluído!'
                                  )
                                }
                              >
                                ✅ Já li
                              </button>
                            </>
                          )}

                          {/* LENDO */}

                          {tab === 'lendo' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void changeBookStatus(
                                    book.id,
                                    'read',
                                    'Leitura concluída!'
                                  )
                                }
                              >
                                ✅ Concluído
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void changeBookStatus(
                                    book.id,
                                    'unread',
                                    'Livro devolvido para Quero ler!'
                                  )
                                }
                              >
                                ↩️ Ler depois
                              </button>
                            </>
                          )}

                          {/* JÁ LI */}

                          {tab === 'ja_li' && (
                            <button
                              type="button"
                              onClick={() =>
                                void changeBookStatus(
                                  book.id,
                                  'unread',
                                  'Livro devolvido para Quero ler!'
                                )
                              }
                            >
                              ↩️ Quero ler novamente
                            </button>
                          )}

                          {/* EXCLUIR */}

                          <button
                            type="button"
                            onClick={() =>
                              askToDelete(book)
                            }
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {!visibleBooks.length && (
                    <p className="empty">
                      {search.trim()
                        ? 'Nenhum livro encontrado.'
                        : 'Nenhum livro nesta lista ainda.'}
                    </p>
                  )}

                  {search.trim() && (
                    <p
                      className="empty"
                      role="status"
                    >
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
                    <h2>
                      ✏️ Editar livro
                    </h2>

                    <p>
                      Alterando:{' '}
                      <strong>
                        {editingBook.title}
                      </strong>
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
                          setEditingTitle(
                            event.target.value
                          )
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
              HISTÓRICO
             ================================== */}

          <Route
            path="/historico"
            element={
              <section className="panel">
                <span className="eyebrow">
                  SUAS DESCOBERTAS LITERÁRIAS
                </span>

                <h2>
                  📜 Histórico de sorteios
                </h2>

                <p>
                  Sorteios realizados nos últimos 30 dias.
                </p>

                <div className="library-filters">
                  <input
                    type="search"
                    aria-label="Pesquisar histórico"
                    placeholder="🔎 Pesquisar título sorteado..."
                    value={historySearch}
                    onChange={event =>
                      setHistorySearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                {filteredHistory.length > 0 ? (
                  historyList(filteredHistory)
                ) : (
                  <p className="empty">
                    Nenhum sorteio encontrado.
                  </p>
                )}

                <p
                  className="empty"
                  role="status"
                >
                  {filteredHistory.length}{' '}
                  {filteredHistory.length === 1
                    ? 'sorteio encontrado'
                    : 'sorteios encontrados'}
                </p>
              </section>
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

                <h2>
                  📥 Importar biblioteca
                </h2>

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

                <h2>
                  ✨ Entre na sua biblioteca
                </h2>

                <p>
                  Estamos preparando o acesso por e-mail,
                  senha e conta Google.
                </p>

                <p>
                  A tela definitiva seguirá o modelo
                  marrom e dourado que você escolheu.
                </p>

                <NavLink
                  className="page-link"
                  to="/"
                >
                  Voltar ao início
                </NavLink>
              </section>
            }
          />

          {/* ENDEREÇO DESCONHECIDO */}

          <Route
            path="*"
            element={
              <Navigate to="/" replace />
            }
          />
        </Routes>

        {/* ==================================
            NOTIFICAÇÕES
           ================================== */}

        {message && (
          <div
            role="status"
            className="notice"
          >
            {message}

            <button
              type="button"
              onClick={() =>
                setMessage('')
              }
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        )}

        {/* RODAPÉ */}

        <footer>
          Próximo Capítulo · Sua biblioteca,
          suas histórias.
        </footer>
      </div>

      {/* ==================================
          MODAL DE EXCLUSÃO
         ================================== */}

      {bookToDelete && (
        <DeleteModal
          book={bookToDelete}
          deleting={deleting}
          onCancel={cancelDelete}
          onConfirm={() =>
            void confirmDelete()
          }
        />
      )}
    </main>
  );
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
