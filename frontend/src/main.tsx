import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Book = { id:number; title:string; status:'quero_ler'|'ja_li'; read_at:string|null };
type Draw = {id:number; title:string; drawn_at:string};
const API = 'http://127.0.0.1:8000';
async function request<T>(path:string, options?:RequestInit):Promise<T> {
  const res = await fetch(API+path, {headers:{'Content-Type':'application/json'},...options});
  if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.detail || 'Não foi possível concluir a operação.');}
  return res.status===204 ? undefined as T : res.json();
}
function App(){
 const [books,setBooks]=useState<Book[]>([]),[history,setHistory]=useState<Draw[]>([]),[title,setTitle]=useState(''),[message,setMessage]=useState(''),[selected,setSelected]=useState<Book|null>(null),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[tab,setTab]=useState<'quero_ler'|'ja_li'>('quero_ler');
 const refresh=async()=>{try{setBooks(await request<Book[]>('/books'));setHistory(await request<Draw[]>('/history'));}catch(e){setMessage((e as Error).message)}};
 useEffect(()=>{void refresh()},[]);
 const run=async(fn:()=>Promise<unknown>)=>{try{setMessage('');await fn();await refresh()}catch(e){setMessage((e as Error).message)}};
 const add=async(e:React.FormEvent)=>{e.preventDefault();await run(async()=>{await request('/books',{method:'POST',body:JSON.stringify({title})});setTitle('')})};
 const draw=async()=>{if(busy)return;setBusy(true);setSelected(null);setMessage('');const options=books.filter(b=>b.status==='quero_ler');let i=0;const interval=window.setInterval(()=>{setPreview(options[i++%options.length]?.title||'')},85);try{const book=await request<Book>('/draw',{method:'POST'});await new Promise(r=>setTimeout(r,1200));setSelected(book);await refresh()}catch(e){setMessage((e as Error).message)}finally{clearInterval(interval);setPreview('');setBusy(false)}};
 const pending=books.filter(b=>b.status==='quero_ler'),done=books.filter(b=>b.status==='ja_li');
 return <main className="app"><div className="backdrop"/><div className="shell"><header><img src="/images/capa-proximo-capitulo.png" alt="Capa Próximo Capítulo"/><div><span className="eyebrow">SUA BIBLIOTECA PESSOAL</span><h1>Próximo Capítulo</h1><p>Deixe o acaso escolher sua próxima história.</p></div></header>
 <section className="stats"><div><strong>{books.length}</strong><span>Total de livros</span></div><div><strong>{pending.length}</strong><span>Quero ler</span></div><div><strong>{done.length}</strong><span>Já li</span></div></section>
 <section className="hero"><span className="eyebrow">UMA NOVA HISTÓRIA ESPERA POR VOCÊ</span><h2>Qual será sua próxima leitura?</h2><p>O destino está entre as páginas.</p><button className="primary" disabled={busy||!pending.length} onClick={()=>void draw()}>{busy?'🎲 Sorteando...':'🎲 Sortear meu próximo livro'}</button>{busy&&<p className="reveal">{preview}</p>}{selected&&!busy&&<div className="result"><small>📖 Seu próximo livro será...</small><h3>{selected.title}</h3><div className="actions"><button onClick={()=>setMessage('Boa leitura! 📖')}>📖 Vou ler este</button><button onClick={()=>void draw()}>🎲 Sortear outro</button><button onClick={()=>void run(async()=>{await request(`/books/${selected.id}/read`,{method:'PATCH'});setSelected(null)})}>✅ Já li este livro</button></div></div>}</section>
 <section className="panel"><h2>Minha biblioteca</h2><form onSubmit={e=>void add(e)}><input aria-label="Título do livro" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Digite o título de um livro..." required/><button type="submit">+ Adicionar</button></form><nav><button className={tab==='quero_ler'?'active':''} onClick={()=>setTab('quero_ler')}>📚 Quero ler ({pending.length})</button><button className={tab==='ja_li'?'active':''} onClick={()=>setTab('ja_li')}>✅ Já li ({done.length})</button></nav><ul>{(tab==='quero_ler'?pending:done).map(b=><li key={b.id}><div><strong>{b.title}</strong>{b.read_at&&<small>Lido em {new Date(b.read_at).toLocaleDateString('pt-BR')}</small>}</div><div className="actions"><button onClick={()=>void run(()=>request(`/books/${b.id}/${tab==='quero_ler'?'read':'unread'}`,{method:'PATCH'}))}>{tab==='quero_ler'?'Marcar lido':'Devolver'}</button><button onClick={()=>{if(confirm(`Excluir "${b.title}"?`))void run(()=>request(`/books/${b.id}`,{method:'DELETE'}))}}>Excluir</button></div></li>)}</ul>{!(tab==='quero_ler'?pending:done).length&&<p className="empty">Nenhum livro nesta lista ainda.</p>}</section>
 {history.length>0&&<section className="panel"><h2>Últimos sorteios</h2><ul>{history.slice(0,5).map(d=><li key={d.id}>{d.title}<small>{new Date(d.drawn_at).toLocaleDateString('pt-BR')}</small></li>)}</ul></section>}
 {message&&<div role="status" className="notice">{message}<button onClick={()=>setMessage('')}>×</button></div>}
 <footer>Próximo Capítulo · Sua biblioteca, suas histórias.</footer></div></main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
