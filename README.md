# Próximo Capítulo 📚

Aplicativo pessoal de sorteio e organização de livros, com frontend React/TypeScript e API Python/FastAPI.

## Iniciar o backend (PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

API: http://127.0.0.1:8000/docs

## Iniciar o frontend (outro terminal)

```powershell
cd frontend
npm install
npm run dev
```

Aplicativo: http://127.0.0.1:5173

## Estado atual

MVP inicial: cadastrar, listar, excluir, marcar como lido, devolver para Quero Ler, sortear livros não lidos e consultar histórico. Persistência local SQLite em `backend/books.db`.

**Próximas etapas:** edição de títulos, pesquisa, importação PDF/EPUB/MOBI/AZW/TXT, migração para PostgreSQL, testes automatizados, autenticação futura, tema claro/escuro e deploy.

## GitHub

O repositório não é criado nem publicado automaticamente. Aprovações e merges são responsabilidade exclusiva da proprietária do projeto. Nenhuma assinatura de IA é adicionada aos arquivos ou commits.
