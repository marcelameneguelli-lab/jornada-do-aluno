/* Jornada do Aluno · service worker
   Guarda só a "casca" do app. Dados de alunos nunca passam por aqui:
   as chamadas ao Apps Script vão direto para a rede. */
const VERSAO = 'jornada-1.2.6';
const CASCA = ['./', './index.html', './manifest.webmanifest', './nucleo/estilo.css', './nucleo/config.js', './nucleo/api.js', './nucleo/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  const mesmaOrigem = url.origin === self.location.origin;
  const biblioteca = /cdnjs\.cloudflare\.com/.test(url.hostname);
  if (!mesmaOrigem && !biblioteca) return;
  // rede primeiro (sempre a versão nova); cache só quando estiver sem internet
  e.respondWith(fetch(req).then(r => {
    if (r && r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => caches.match(req).then(r => {
    if (r) return r;
    // a página inicial só substitui navegação; script ou estilo que falhou continua falhando
    if (req.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  })));
});
