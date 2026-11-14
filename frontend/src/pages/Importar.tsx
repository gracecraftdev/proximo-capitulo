
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

// ==========================================
// PRÓXIMO CAPÍTULO — IMPORTADOR DE LIVROS
// Formatos: CSV, TXT e PDF
//
// PDF: utiliza o nome do arquivo como título.
// Os arquivos PDF não são armazenados na API.
// ==========================================

// ==========================================
// TIPOS
// ==========================================

type Book = {
  id: number;
  title: string;
  status: 'quero_ler' | 'lendo' | 'ja_li';
};

type Candidate = {
  title: string;
  source: string;
};

type ImportedTitle = Candidate & {
  normalized: string;
  duplicate: boolean;
};

type ImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
};

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8000'
    : '/api');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TITLES = 1000;

const ALLOWED_EXTENSIONS = /\.(csv|txt|pdf)$/i;

// ==========================================
// NORMALIZAÇÃO DE TÍTULOS
// ==========================================

function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}

// ==========================================
// LEITURA DE CSV
// ==========================================

function readCsvRows(
  input: string,
  delimiter: string
): string[][] {
  const rows: string[][] = [];

  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (
      !quoted &&
      (char === '\n' || char === '\r')
    ) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }

      row.push(field.trim());

      if (row.some(value => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());

  if (row.some(value => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';

  return [';', ',', '\t'].sort(
    (a, b) =>
      firstLine.split(b).length -
      firstLine.split(a).length
  )[0];
}

function parseCsv(
  fileName: string,
  content: string
): Candidate[] {
  const cleaned = content.replace(/^\uFEFF/, '');

  const rows = readCsvRows(
    cleaned,
    detectDelimiter(cleaned)
  );

  if (rows.length === 0) {
    return [];
  }

  const knownHeaders = [
    'titulo',
    'title',
    'livro',
    'nome do livro',
    'book',
    'book title',
  ];

  const firstRow = rows[0].map(value =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
  );

  const headerIndex = firstRow.findIndex(
    value => knownHeaders.includes(value)
  );

  const column = headerIndex >= 0 ? headerIndex : 0;

  const dataRows =
    headerIndex >= 0 ? rows.slice(1) : rows;

  return dataRows
    .map(row => (row[column] ?? '').trim())
    .filter(Boolean)
    .map(title => ({
      title,
      source: fileName,
    }));
}

// ==========================================
// LEITURA DE TXT
// ==========================================

function parseTxt(
  fileName: string,
  content: string
): Candidate[] {
  return content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(title => ({
      title,
      source: fileName,
    }));
}

// ==========================================
// LEITURA DE PDF
// ==========================================

// Nesta versão, o título é obtido pelo nome
// do arquivo PDF, sem extrair o texto interno.

function titleFromPdfFile(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function parsePdf(file: File): Promise<Candidate[]> {
  // Validação simples da assinatura do PDF.
  const header = new Uint8Array(
    await file.slice(0, 5).arrayBuffer()
  );

  const signature = String.fromCharCode(...header);

  if (signature !== '%PDF-') {
    throw new Error(
      `"${file.name}" não parece ser um PDF válido.`
    );
  }

  const title = titleFromPdfFile(file.name);

  if (!title) {
    throw new Error(
      `Não foi possível identificar o título de "${file.name}".`
    );
  }

  return [
    {
      title,
      source: file.name,
    },
  ];
}

// ==========================================
// FORMATAÇÃO
// ==========================================

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

// ==========================================
// ÍCONE DA ÁREA DE IMPORTAÇÃO
// ==========================================

function BookUploadIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 7v10" />
      <path d="m8 11 4-4 4 4" />
      <path d="M4 19.5c2.7-1.5 5.3-1.5 8 0" />
      <path d="M12 19.5c2.7-1.5 5.3-1.5 8 0" />
      <path d="M4 4.5c2.7-1.5 5.3-1.5 8 0v15" />
      <path d="M20 4.5c-2.7-1.5-5.3-1.5-8 0" />
      <path d="M4 4.5v15" />
      <path d="M20 4.5v15" />
    </svg>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Importar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [candidates, setCandidates] =
    useState<Candidate[]>([]);

  const [existingBooks, setExistingBooks] =
    useState<Book[]>([]);

  const [loadingBooks, setLoadingBooks] =
    useState(true);

  const [libraryReady, setLibraryReady] =
    useState(false);

  const [readingFiles, setReadingFiles] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [summary, setSummary] =
    useState<ImportSummary | null>(null);

  // ==========================================
  // CONSULTAR BIBLIOTECA
  // ==========================================

  async function loadBooks(): Promise<Book[]> {
    const response = await fetch(`${API_URL}/books`, {
      credentials: 'include',
    });

    if (!response.ok) {
      setLibraryReady(false);

      throw new Error(
        'Não foi possível consultar sua biblioteca. ' +
        'Verifique se o backend está funcionando.'
      );
    }

    const books = (await response.json()) as Book[];

    if (!Array.isArray(books)) {
      setLibraryReady(false);

      throw new Error(
        'A API retornou uma lista de livros inválida.'
      );
    }

    setExistingBooks(books);
    setLibraryReady(true);

    return books;
  }

  useEffect(() => {
    void loadBooks()
      .catch(err => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoadingBooks(false);
      });
  }, []);

  // ==========================================
  // VERIFICAR LIVROS DUPLICADOS
  // ==========================================

  const items = useMemo<ImportedTitle[]>(() => {
    const known = new Set(
      existingBooks.map(book =>
        normalizeTitle(book.title)
      )
    );

    const seen = new Set<string>();

    return candidates.map(candidate => {
      const normalized = normalizeTitle(
        candidate.title
      );

      const duplicate =
        !normalized ||
        known.has(normalized) ||
        seen.has(normalized);

      seen.add(normalized);

      return {
        ...candidate,
        normalized,
        duplicate,
      };
    });
  }, [candidates, existingBooks]);

  const ready = items.filter(
    item => !item.duplicate
  );

  const duplicateCount =
    items.length - ready.length;

  // ==========================================
  // LER ARQUIVOS
  // ==========================================

  async function handleFiles(files: File[]) {
    if (
      files.length === 0 ||
      readingFiles ||
      importing
    ) {
      return;
    }

    setError('');
    setMessage('');
    setSummary(null);
    setReadingFiles(true);

    // O novo conjunto substitui a seleção anterior.
    setSelectedFiles([]);
    setCandidates([]);

    try {
      const parsed: Candidate[] = [];

      for (const file of files) {
        if (!ALLOWED_EXTENSIONS.test(file.name)) {
          throw new Error(
            `Formato não suportado: "${file.name}". ` +
            'Utilize CSV, TXT ou PDF.'
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `"${file.name}" excede o limite de 5 MB.`
          );
        }

        if (file.size === 0) {
          throw new Error(
            `"${file.name}" está vazio.`
          );
        }

        const extension = file.name
          .split('.')
          .pop()
          ?.toLowerCase();

        let titles: Candidate[] = [];

        if (extension === 'pdf') {
          titles = await parsePdf(file);
        } else {
          const content = await file.text();

          titles =
            extension === 'csv'
              ? parseCsv(file.name, content)
              : parseTxt(file.name, content);
        }

        if (titles.length === 0) {
          throw new Error(
            `Nenhum título encontrado em "${file.name}".`
          );
        }

        parsed.push(...titles);

        if (parsed.length > MAX_TITLES) {
          throw new Error(
            `O limite é de ${MAX_TITLES} títulos por importação.`
          );
        }
      }

      setCandidates(parsed);
      setSelectedFiles(files);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReadingFiles(false);
    }
  }

  // ==========================================
  // SELEÇÃO PELO BOTÃO
  // ==========================================

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    void handleFiles(files);

    event.target.value = '';
  }

  // ==========================================
  // ARRASTAR E SOLTAR
  // ==========================================

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (!importing && !readingFiles) {
      setDragging(true);
    }
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      !event.currentTarget.contains(
        event.relatedTarget as Node | null
      )
    ) {
      setDragging(false);
    }
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragging(false);

    if (importing || readingFiles) {
      return;
    }

    const files = Array.from(
      event.dataTransfer.files
    );

    void handleFiles(files);
  }

  // ==========================================
  // LIMPAR SELEÇÃO
  // ==========================================

  function clearSelection() {
    if (importing || readingFiles) {
      return;
    }

    setSelectedFiles([]);
    setCandidates([]);
    setSummary(null);
    setError('');
    setMessage('');
    setDragging(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // ==========================================
  // IMPORTAR LIVROS
  // ==========================================

  async function importBooks() {
    if (
      importing ||
      readingFiles ||
      loadingBooks ||
      !libraryReady ||
      ready.length === 0
    ) {
      return;
    }

    setImporting(true);
    setError('');
    setMessage('');
    setSummary(null);

    let imported = 0;
    let skipped = duplicateCount;

    const failures: Candidate[] = [];

    try {
      // Consulta novamente a biblioteca antes de
      // importar para evitar duplicados recentes.

      const latest = await loadBooks();

      const known = new Set(
        latest.map(book =>
          normalizeTitle(book.title)
        )
      );

      for (const item of ready) {
        if (known.has(item.normalized)) {
          skipped += 1;
          continue;
        }

        try {
          const response = await fetch(
            `${API_URL}/books`,
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: item.title,
              }),
            }
          );

          if (!response.ok) {
            if (response.status === 409) {
              skipped += 1;
              known.add(item.normalized);
              continue;
            }

            throw new Error(
              `Erro HTTP ${response.status}`
            );
          }

          imported += 1;
          known.add(item.normalized);
        } catch {
          failures.push({
            title: item.title,
            source: item.source,
          });
        }
      }

      // Atualiza as três listas de leitura.
      await loadBooks();

      setSummary({
        imported,
        skipped,
        failed: failures.length,
      });

      if (failures.length > 0) {
        setCandidates(failures);
        setSelectedFiles([]);

        setError(
          `${failures.length} livro(s) não foram importados. ` +
          'Eles continuam disponíveis para tentar novamente.'
        );
      } else {
        setCandidates([]);
        setSelectedFiles([]);
      }

      setMessage(
        `${imported} livro(s) importado(s). ` +
        `${skipped} duplicado(s) ignorado(s).`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <section
      className="panel import-page"
      aria-labelledby="import-title"
    >
      {/* ESTILOS EXCLUSIVOS DO IMPORTADOR */}

      <style>{`
        .import-page {
          color: #f4e6d2;
        }

        .import-description {
          color: #d9c2a5;
          line-height: 1.7;
          max-width: 680px;
          margin-bottom: 26px;
        }

        .import-dropzone {
          border: 1.5px dashed rgba(224, 176, 105, 0.56);
          border-radius: 20px;
          background:
            radial-gradient(
              circle at top,
              rgba(170, 104, 45, 0.1),
              transparent 68%
            ),
            rgba(21, 12, 8, 0.48);
          padding: 34px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 12px;
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        }

        .import-dropzone.is-dragging {
          border-color: #f2c780;
          background: rgba(149, 95, 47, 0.22);
          transform: scale(1.005);
        }

        .import-dropzone-icon {
          width: 74px;
          height: 74px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f0bc72;
          background: rgba(180, 120, 57, 0.13);
          border: 1px solid rgba(223, 171, 94, 0.22);
          border-radius: 22px;
          margin-bottom: 4px;
        }

        .import-dropzone-title {
          margin: 0;
          color: #faeace;
          font-family: Georgia, serif;
          font-size: clamp(1.2rem, 2.8vw, 1.55rem);
          font-weight: 700;
        }

        .import-dropzone-subtitle {
          margin: 0;
          color: #cdb59b;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .import-file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          overflow: hidden;
        }

        .import-file-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 45px;
          padding: 0 22px;
          margin-top: 8px;
          border-radius: 10px;
          background: linear-gradient(
            135deg,
            #f1ca89,
            #dba65e
          );
          color: #2c190f;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(0, 0, 0, 0.12);
          transition:
            filter 0.2s ease,
            transform 0.2s ease;
        }

        .import-file-button:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .import-file-button:focus-within {
          outline: 2px solid #fff1cb;
          outline-offset: 4px;
        }

        .import-file-button.is-disabled {
          opacity: 0.55;
          cursor: not-allowed;
          pointer-events: none;
        }

        .import-dropzone-note {
          margin: 6px 0 0;
          color: #aa947d;
          font-size: 0.82rem;
        }

        .import-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          padding: 15px 17px;
          background: rgba(165, 111, 48, 0.08);
          border: 1px solid rgba(220, 169, 100, 0.16);
          border-radius: 12px;
          color: #d1b99b;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .import-info-icon {
          color: #dfb16b;
          flex-shrink: 0;
        }

        .import-selected-files {
          margin-top: 18px;
          padding: 17px;
          border: 1px solid rgba(221, 171, 107, 0.3);
          border-radius: 13px;
          background: rgba(224, 176, 105, 0.07);
        }

        .import-selected-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .import-selected-name {
          display: block;
          overflow-wrap: anywhere;
          color: #f3d8a9;
          font-weight: 600;
        }

        .import-selected-size {
          color: #bca68e;
          font-size: 0.82rem;
        }

        .import-selected-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .import-selected-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(221, 171, 107, 0.12);
        }

        .import-clear {
          border: 1px solid rgba(221, 171, 107, 0.35);
          border-radius: 8px;
          padding: 9px 14px;
          background: transparent;
          color: #ead5b8;
          cursor: pointer;
          font: inherit;
        }

        .import-clear:hover {
          background: rgba(234, 186, 119, 0.12);
        }

        .import-feedback {
          margin-top: 18px;
          border-radius: 12px;
          padding: 14px 17px;
          line-height: 1.6;
          font-size: 0.94rem;
        }

        .import-feedback.is-error {
          border: 1px solid rgba(244, 139, 124, 0.38);
          color: #ffc0b5;
          background: rgba(177, 65, 45, 0.12);
        }

        .import-feedback.is-success {
          border: 1px solid rgba(195, 166, 92, 0.32);
          color: #e8d19b;
          background: rgba(140, 112, 45, 0.12);
        }

        .import-preview {
          margin-top: 24px;
          padding: 24px;
          border-radius: 18px;
          background: rgba(27, 17, 12, 0.72);
          border: 1px solid rgba(214, 171, 101, 0.28);
        }

        .import-preview h3 {
          margin: 0 0 18px;
          color: #f7e6ca;
          font-family: Georgia, serif;
        }

        .import-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .import-stat {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 16px;
          border-radius: 12px;
          background: rgba(226, 179, 112, 0.06);
          border: 1px solid rgba(221, 171, 107, 0.16);
          text-align: center;
        }

        .import-stat strong {
          color: #f0cb91;
          font-size: 1.6rem;
        }

        .import-stat span {
          color: #c8b198;
          font-size: 0.82rem;
        }

        .import-title-list {
          list-style: none;
          max-height: 330px;
          overflow-y: auto;
          margin: 0 0 20px;
          padding: 0;
        }

        .import-title-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 3px;
          border-bottom: 1px solid rgba(214, 171, 101, 0.13);
        }

        .import-title-details {
          min-width: 0;
        }

        .import-title-name {
          display: block;
          color: #e8d5bf;
          overflow-wrap: anywhere;
        }

        .import-title-source {
          display: block;
          margin-top: 4px;
          color: #a9957e;
          font-size: 0.76rem;
          overflow-wrap: anywhere;
        }

        .import-tag {
          flex-shrink: 0;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .import-tag.is-new {
          color: #e6d19e;
          background: rgba(174, 139, 62, 0.17);
        }

        .import-tag.is-duplicate {
          color: #ebad9e;
          background: rgba(186, 94, 67, 0.17);
        }

        .import-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .import-submit {
          border: none;
          border-radius: 11px;
          padding: 13px 20px;
          background: linear-gradient(
            135deg,
            #f0ca8c,
            #d9a35a
          );
          color: #2c190f;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .import-submit:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .import-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .import-secondary {
          border: 1px solid rgba(222, 172, 104, 0.25);
          border-radius: 11px;
          padding: 13px 20px;
          background: rgba(79, 53, 37, 0.5);
          color: #ead8c0;
          font: inherit;
          cursor: pointer;
        }

        .import-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .import-dropzone {
            padding: 27px 16px;
          }

          .import-stats {
            gap: 8px;
          }

          .import-stat {
            padding: 12px 5px;
          }

          .import-stat strong {
            font-size: 1.3rem;
          }

          .import-stat span {
            font-size: 0.75rem;
          }

          .import-preview {
            padding: 16px;
          }

          .import-selected-list li {
            align-items: flex-start;
          }
        }
      `}</style>

      {/* CABEÇALHO */}

      <span className="eyebrow">
        TRAGA SUAS HISTÓRIAS
      </span>

      <h2 id="import-title">
        📚 Importar biblioteca
      </h2>

      <p className="import-description">
        Adicione vários livros de uma só vez usando
        arquivos CSV, TXT ou PDF.
      </p>

      {/* ÁREA DE ARQUIVOS */}

      <div
        className={
          `import-dropzone${dragging ? ' is-dragging' : ''}`
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="import-dropzone-icon">
          <BookUploadIcon />
        </div>

        <h3 className="import-dropzone-title">
          Arraste seus arquivos para cá
        </h3>

        <p className="import-dropzone-subtitle">
          ou selecione os livros do seu dispositivo
        </p>

        <label
          className={
            'import-file-button' +
            (readingFiles || importing
              ? ' is-disabled'
              : '')
          }
        >
          <span aria-hidden="true">↥</span>
          Escolher arquivos

          <input
            ref={fileInputRef}
            className="import-file-input"
            type="file"
            accept=".csv,.txt,.pdf,text/plain,text/csv,application/pdf"
            multiple
            onChange={handleInputChange}
            disabled={readingFiles || importing}
            aria-label="Escolher arquivos CSV, TXT ou PDF"
          />
        </label>

        <p className="import-dropzone-note">
          CSV, TXT ou PDF · Até 5 MB por arquivo
        </p>

        {readingFiles && (
          <p role="status">
            Lendo seus arquivos...
          </p>
        )}
      </div>

      {/* INFORMAÇÃO */}

      <div className="import-info">
        <span
          className="import-info-icon"
          aria-hidden="true"
        >
          ✦
        </span>

        <span>
          CSV e TXT importam listas de títulos. Para
          PDFs, utilizamos o nome do arquivo como
          título do livro. Arquivos PDF não são salvos
          na biblioteca nesta versão.
        </span>
      </div>

      {/* ESTADO DA API */}

      {loadingBooks && (
        <p
          role="status"
          className="import-feedback"
        >
          Consultando sua biblioteca...
        </p>
      )}

      {!loadingBooks && !libraryReady && (
        <button
          type="button"
          className="import-secondary"
          onClick={() => {
            setLoadingBooks(true);
            setError('');

            void loadBooks()
              .catch(err => {
                setError((err as Error).message);
              })
              .finally(() => {
                setLoadingBooks(false);
              });
          }}
        >
          Tentar conectar novamente
        </button>
      )}

      {/* ARQUIVOS SELECIONADOS */}

      {selectedFiles.length > 0 && (
        <div className="import-selected-files">
          <div className="import-selected-header">
            <strong>
              {selectedFiles.length}{' '}
              {selectedFiles.length === 1
                ? 'arquivo selecionado'
                : 'arquivos selecionados'}
            </strong>

            <button
              type="button"
              className="import-clear"
              onClick={clearSelection}
              disabled={importing}
            >
              Remover arquivos
            </button>
          </div>

          <ul className="import-selected-list">
            {selectedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span className="import-selected-name">
                  {file.name.toLowerCase().endsWith('.pdf')
                    ? '📕'
                    : '📄'}{' '}
                  {file.name}
                </span>

                <span className="import-selected-size">
                  {formatFileSize(file.size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MENSAGENS */}

      {error && (
        <div
          className="import-feedback is-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="import-feedback is-success"
          role="status"
        >
          ✨ {message}
        </div>
      )}

      {/* RESUMO DA IMPORTAÇÃO */}

      {summary && (
        <div className="import-stats">
          <div className="import-stat">
            <strong>{summary.imported}</strong>
            <span>Importados</span>
          </div>

          <div className="import-stat">
            <strong>{summary.skipped}</strong>
            <span>Duplicados</span>
          </div>

          <div className="import-stat">
            <strong>{summary.failed}</strong>
            <span>Falhas</span>
          </div>
        </div>
      )}

      {/* PRÉ-VISUALIZAÇÃO */}

      {items.length > 0 && (
        <div className="import-preview">
          <h3>
            Pré-visualização da biblioteca
          </h3>

          <div className="import-stats">
            <div className="import-stat">
              <strong>{items.length}</strong>
              <span>Encontrados</span>
            </div>

            <div className="import-stat">
              <strong>{ready.length}</strong>
              <span>Novos livros</span>
            </div>

            <div className="import-stat">
              <strong>{duplicateCount}</strong>
              <span>Duplicados</span>
            </div>
          </div>

          <ul className="import-title-list">
            {items.map((item, index) => (
              <li
                key={`${item.normalized}-${index}`}
                className="import-title-item"
              >
                <div className="import-title-details">
                  <span className="import-title-name">
                    {item.title}
                  </span>

                  <small className="import-title-source">
                    Origem: {item.source}
                  </small>
                </div>

                <span
                  className={
                    'import-tag ' +
                    (item.duplicate
                      ? 'is-duplicate'
                      : 'is-new')
                  }
                >
                  {item.duplicate
                    ? 'Duplicado'
                    : 'Novo'}
                </span>
              </li>
            ))}
          </ul>

          <div className="import-actions">
            <button
              type="button"
              className="import-submit"
              onClick={() => void importBooks()}
              disabled={
                importing ||
                readingFiles ||
                loadingBooks ||
                !libraryReady ||
                ready.length === 0
              }
            >
              {importing
                ? 'Importando livros...'
                : `Importar ${ready.length} livro(s)`}
            </button>

            <button
              type="button"
              className="import-secondary"
              onClick={clearSelection}
              disabled={importing}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
