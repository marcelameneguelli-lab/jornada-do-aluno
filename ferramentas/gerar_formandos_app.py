# Gera app/modulos/formandos/index.html a partir do index.html do Painel Formandos,
# trocando só a conexão (passa a usar o login e o servidor únicos da Jornada).
import os
src=open('/home/claude/jornada/_referencia/formandos/index.html',encoding='utf8').read()
def troca(s, velho, novo, n=1):
    assert s.count(velho)==n, (velho[:70], s.count(velho)); return s.replace(velho, novo)
s=src
# 1. cabeçalho: ícones do app único, sem manifest próprio
s=troca(s,'<link rel="manifest" href="manifest.webmanifest">','')
s=s.replace('href="icon-192.png"','href="../../icones/icon-192.png"').replace('href="apple-touch-icon.png"','href="../../icones/icon-192.png"').replace('href="icon-512.png"','href="../../icones/icon-512.png"')
# 2. carrega o núcleo da Jornada antes dos scripts do painel
i=s.index('<script'); 
s=s[:i]+'<script src="../../nucleo/config.js"></script>\n<script src="../../nucleo/api.js"></script>\n<script>/* Jornada: login e avisos ficam na tela base */ window.App = (window.parent && window.parent !== window) ? window.parent.App : null;</script>\n'+s[i:]
# 3. ponte: toda chamada vai para o servidor único como "formandos.<ação>"
velho_ini='  async function bruto(corpo) {'
a=s.index(velho_ini); b=s.index('  async function chamar(corpo) {')
s=s[:a]+'''  async function bruto(corpo) {
    // Jornada do Aluno: conexão pelo núcleo (login único). Respostas no formato que o painel já entende.
    const { action, token: _semUso, ...resto } = corpo;
    const acao = action || (Array.isArray(corpo.ops) ? 'ops' : 'ping');
    if (acao === 'entrar') return { ok: false, error: 'auth', ver: VERSAO_SERVIDOR };
    let j;
    try {
      if (acao === 'trocar_senha') {
        j = await Api.chamar('nucleo.trocar_senha', { atual: resto.atual, nova: resto.nova });
        if (j && j.ok) { const s = Api.Sessao.ler() || {}; Api.Sessao.gravar(Object.assign(s, { token: j.token, exp: j.exp })); j.token = 'jornada'; }
      } else {
        j = await Api.chamar('formandos.' + acao, window.JORNADA_IMPORTACAO ? Object.assign({ importacao: true }, resto) : resto);
      }
    } catch (e) {
      if (e.auth) return { ok: false, error: 'auth', ver: VERSAO_SERVIDOR };
      const err = new Error(e.message || 'sem resposta do Google'); err.rede = true; throw err;
    }
    if (!j) { const err = new Error('resposta vazia do servidor'); err.rede = true; throw err; }
    if (j.permissao === false) j.error = 'sem_permissao';
    if (j.ok === false && !j.error && j.erro) j.error = j.erro;
    j.ver = VERSAO_SERVIDOR;
    return j;
  }
'''+s[b:]
# 4. sem login próprio: a sessão é a da Jornada
s=troca(s,"      url = urlFixa() ? GAS_URL : (localStorage.getItem(LS_GAS_URL) || '');","      url = 'jornada';")
s=troca(s,"      token = localStorage.getItem(LS_GAS_TOKEN) || '';","      token = 'jornada';")
s=troca(s,"  const guardarToken = () => { try { localStorage.setItem(LS_GAS_TOKEN, token); if (!urlFixa()) localStorage.setItem(LS_GAS_URL, url); } catch (e) {} };","  const guardarToken = () => {};")
a=s.index('  async function entrarInterativo(aviso) {'); b=s.index('  let reauth = null;')
s=s[:a]+'''  async function entrarInterativo(aviso) {
    // Jornada do Aluno: o login é feito na tela base. Ao entrar de novo, o painel é recarregado.
    if (window.App && window.App.mostrarLogin) window.App.mostrarLogin(aviso || 'Entre novamente.');
    return new Promise(() => {});
  }

'''+s[b:]
s=troca(s,"""function sairDesteComputador() {
  try { localStorage.removeItem('formandos_gas_key'); localStorage.removeItem('formandos_gas_token'); localStorage.removeItem(USER_KEY); } catch(e) {}
  location.reload();
}""","""function sairDesteComputador() {
  try { localStorage.removeItem(USER_KEY); } catch(e) {}
  if (window.App && window.App.sair) window.App.sair(); else location.reload();
}""")
# 4b. importação e configurações saíram de dentro do painel (decisão de 21/11/2026):
#     ficam na Central de Bases (?modo=importar) e em Configurações (?modo=config) da Jornada.
_i=s.rfind('</body>'); s=s[:_i]+'''<style>
  html.jornada-normal #btn-import, html.jornada-normal #btn-import-formados, html.jornada-normal #btn-enade, html.jornada-normal #btn-clear { display: none !important; }
  html.jornada-normal #sem-badge { cursor: default; }
  html.jornada-modo .tab-nav, html.jornada-modo .tab-panel, html.jornada-modo .header-right > :not(#sync-label) { display: none !important; }
  #jornada-painel-modo { display: none; }
  html.jornada-modo #jornada-painel-modo { display: block; max-width: 640px; margin: 28px auto; padding: 0 18px; }
  #jornada-painel-modo .jm-card { background: #fff; border: 1px solid #dde4ee; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
  #jornada-painel-modo h3 { margin: 0 0 6px; font-size: 16px; }
  #jornada-painel-modo p { margin: 0 0 12px; font-size: 13px; color: #5b6676; line-height: 1.5; }
</style>
<script>
/* Jornada: modo importar (Central de Bases) e modo config (Configurações) */
(function () {
  var modo = new URLSearchParams(location.search).get('modo');
  modo = (modo === 'importar' || modo === 'config') ? modo : '';
  var raiz = document.documentElement, pai = (window.parent && window.parent !== window) ? window.parent : null;
  if (!modo) {
    raiz.classList.add('jornada-normal');
    // o semestre agora é trocado em Configurações
    var _sem = openSemModal;
    openSemModal = function () { if (pai && ehAdmin()) { pai.location.hash = '#/config/formandos'; return; } if (!pai) return _sem(); };
    return;
  }
  raiz.classList.add('jornada-modo', 'jornada-modo-' + modo);
  if (modo === 'importar' && (function () { try { return ((window.Api && Api.Sessao.ler()) || {}).me || {}; } catch (e) { return {}; } })().bases) {
    // Central de Bases: quem tem "bases" (inclusive atendente) importa alunos, formados e ENADE
    window.JORNADA_IMPORTACAO = true;
    ehAdmin = function () { return true; };
  }
  var painel = document.createElement('div');
  painel.id = 'jornada-painel-modo';
  painel.innerHTML = modo === 'importar'
    ? '<div class="jm-card"><h3>👥 Prováveis formandos</h3><p>Planilha de alunos do semestre. Os contatos, observações e etapas já registrados são mantidos.</p><button class="btn btn-primary" onclick="openImportAlunos()">+ Importar alunos</button></div>'
      + '<div class="jm-card"><h3>🎓 Formados</h3><p>Lista de alunos que já colaram grau.</p><button class="btn btn-primary" onclick="openImportFormados()">+ Importar formados</button></div>'
      + '<div class="jm-card"><h3>📝 ENADE</h3><p>Arquivos de situação do ENADE, aplicados aos alunos do painel.</p><button class="btn btn-ghost" onclick="openEnade()">Importar ENADE</button></div>'
    : '<div class="jm-card"><h3>📅 Semestre de trabalho</h3><p>Semestre atual do painel: <b id="jm-sem">—</b></p><button class="btn btn-primary" onclick="openSemModal()">Alterar semestre</button></div>'
      + '<div class="jm-card"><h3>🗑️ Limpar dados</h3><p>Apaga os dados do painel (pede a senha de limpeza). Use só no fechamento do semestre.</p><button class="btn btn-danger-ghost" onclick="confirmClear()">Limpar dados</button></div>';
  var cab = document.querySelector('.app-header');
  cab.parentNode.insertBefore(painel, cab.nextSibling);
  if (modo === 'config') {
    var copiar = function () { var b = document.getElementById('sem-badge'), d = document.getElementById('jm-sem'); if (b && d) d.textContent = b.textContent; };
    copiar(); setInterval(copiar, 1500);
  }
})();
</script>
'''+s[_i:]
# 4b. celular e e-mail de cada aluno vêm da base líquida (cruzados pela matrícula, sempre atualizados)
s=troca(s,"""      <td class="td-mat">${esc(s.mat||'')}</td>""","""      <td class="td-mat">${esc(s.mat||'')}${contatoBaseHtml(s)}</td>""",2)
s=troca(s,"""  document.getElementById('dr-meta').textContent = [s.mat, s.curso, s.turno, s.ingresso].filter(Boolean).join(', ');""","""  document.getElementById('dr-meta').textContent = [s.mat, s.curso, s.turno, s.ingresso].filter(Boolean).join(', ');
  contatoBaseDrawer(s);""")
s=troca(s,"""  const headers=['Nome','Matrícula','Curso','Nome Fantasia',""","""  const headers=['Nome','Matrícula','Celular','E-mail','Curso','Nome Fantasia',""")
s=troca(s,"""      cc(s.nome), cc(s.mat), cc(s.curso), cc(s.fantasia),""","""      cc(s.nome), cc(s.mat), cc((contatoBase(s)||{}).tel||''), cc((contatoBase(s)||{}).email||''), cc(s.curso), cc(s.fantasia),""")
s=troca(s,"""  const headers=['Nome','Matrícula','Curso','Turno','Confirmação Cerimônia','Observações'];""","""  const headers=['Nome','Matrícula','Celular','E-mail','Curso','Turno','Confirmação Cerimônia','Observações'];""")
s=troca(s,"""      cc(s.nome), cc(s.mat), cc(s.curso), cc(s.turno),""","""      cc(s.nome), cc(s.mat), cc((contatoBase(s)||{}).tel||''), cc((contatoBase(s)||{}).email||''), cc(s.curso), cc(s.turno),""")
s=troca(s,"</body>","""<style>
  .ct-base{display:flex;flex-direction:column;gap:1px;margin-top:3px;font-size:11.5px;white-space:nowrap}
  .ct-base a{color:var(--muted,#6b6459);text-decoration:none;max-width:210px;overflow:hidden;text-overflow:ellipsis}
  .ct-base a:hover{color:inherit;text-decoration:underline}
  #dr-contato{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:13px}
  #dr-contato a{text-decoration:none;color:inherit;opacity:.92;font-weight:600}
  #dr-contato a:hover{text-decoration:underline;opacity:1}
  #dr-contato{color:inherit}
</style>
<script>
/* Jornada: celular e e-mail de cada aluno, cruzados pela matrícula com a base líquida (Ímpar, Par e Técnico) */
window.CONTATOS_BASE = {};
function _normMatCt(m) { return String(m == null ? '' : m).replace(/\\.0$/, '').replace(/\\D/g, ''); }
function contatoBase(s) { return (s && (CONTATOS_BASE[_normMatCt(s.mat)] || CONTATOS_BASE[_normMatCt(s.id)])) || null; }
function _foneWa(t) { let d = String(t || '').replace(/\\D/g, ''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return d; }
function _fmtFone(t) { const d = String(t || '').replace(/\\D/g, '').replace(/^55(?=\\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : String(t || ''); }
function _ctLinks(c) {
  return (c.tel ? `<a href="https://wa.me/${_foneWa(c.tel)}" target="_blank" rel="noopener" title="Abrir conversa no WhatsApp" onclick="event.stopPropagation()">📱 ${esc(_fmtFone(c.tel))}</a>` : '')
    + (c.email ? `<a href="mailto:${esc(c.email)}" title="${esc(c.email)}" onclick="event.stopPropagation()">✉️ ${esc(c.email)}</a>` : '');
}
function contatoBaseHtml(s) { const c = contatoBase(s); return c && (c.tel || c.email) ? `<div class="ct-base">${_ctLinks(c)}</div>` : ''; }
function contatoBaseDrawer(s) {
  const meta = document.getElementById('dr-meta'); if (!meta) return;
  let el = document.getElementById('dr-contato');
  if (!el) { el = document.createElement('div'); el.id = 'dr-contato'; meta.insertAdjacentElement('afterend', el); }
  const c = contatoBase(s);
  el.innerHTML = c && (c.tel || c.email) ? _ctLinks(c) : '<span style="color:var(--faint,#999)">Sem celular ou e-mail na base líquida</span>';
}
(function () {
  if (!window.Api) return;
  let ultimo = '', rodando = false, carregadoEm = 0;
  async function carregar() {
    if (rodando) return;
    const mats = [];
    try { students.forEach((s) => mats.push(s.mat || s.id)); formados.forEach((s) => mats.push(s.mat || s.id)); } catch (e) { return; }
    if (!mats.length) return;
    const chave = mats.length + ':' + mats.slice(0, 3).join(',');
    if (chave === ultimo && Date.now() - carregadoEm < 30 * 60000) return;
    rodando = true;
    try {
      const r = await Api.chamar('formandos.contatos', { mats: mats }, { timeout: 90000 });
      if (r && r.ok && r.contatos) {
        window.CONTATOS_BASE = r.contatos; ultimo = chave; carregadoEm = Date.now();
        try { renderTable(); } catch (e) {}
        try { if (typeof renderFormados === 'function') renderFormados(); } catch (e) {}
        try { if (drawerId) refreshDrawer(true); } catch (e) {}
      }
    } catch (e) { /* tenta de novo no próximo ciclo */ } finally { rodando = false; }
  }
  setInterval(carregar, 5000); setTimeout(carregar, 1500);
})();
</script>
</body>""")
# 5. o service worker é o da Jornada (não registra outro)
s=troca(s,"if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {","if (false) { // Jornada: service worker único na tela base")
os.makedirs('/home/claude/jornada/app/modulos/formandos',exist_ok=True)
open('/home/claude/jornada/app/modulos/formandos/index.html','w',encoding='utf8').write(s)
print('ok', len(s))
