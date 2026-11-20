/* Jornada do Aluno · tela base: login, menu por perfil, navegação e usuários */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const NOMES_PERFIL = { admin: 'Administrador', coordenador: 'Coordenador', atendente: 'Atendente', apoio: 'Apoio' };

  /* ── avisos ── */
  function aviso(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'aviso ' + (tipo || '');
    el.textContent = msg;
    $('#avisos').appendChild(el);
    setTimeout(() => el.classList.add('sai'), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  function eu() { const s = Api.Sessao.ler(); return s && s.me; }

  /** Põe o cursor no campo só se a pessoa ainda não começou a digitar em outro. */
  function focar(sel) {
    setTimeout(() => { const a = document.activeElement; if (!a || a === document.body) $(sel).focus(); }, 50);
  }

  /* ── login ── */
  function mostrarLogin(msg) {
    document.body.dataset.tela = 'login';
    $('#login-erro').textContent = msg || '';
    $('#form-login').hidden = false;
    $('#form-troca').hidden = true;
    focar('#login-email');
  }

  async function entrar(ev) {
    ev.preventDefault();
    const btn = $('#btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando...';
    $('#login-erro').textContent = '';
    try {
      const r = await Api.chamar('nucleo.entrar', { email: $('#login-email').value, senha: $('#login-senha').value });
      if (!r.ok) {
        let m = Api.mensagemAcesso(r.erro);
        if (r.erro === 'credenciais' && r.restam != null && r.restam <= 2) m += ' Restam ' + r.restam + ' tentativa(s).';
        $('#login-erro').textContent = m;
        return;
      }
      Api.Sessao.gravar({ token: r.token, exp: r.exp, me: r.me });
      $('#login-senha').value = '';
      if (r.trocar) pedirTrocaSenha(true); else iniciar();
    } catch (e) {
      $('#login-erro').textContent = e.message;
    } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  }

  function pedirTrocaSenha(primeiroAcesso) {
    document.body.dataset.tela = 'login';
    $('#form-login').hidden = true;
    $('#form-troca').hidden = false;
    $('#troca-titulo').textContent = primeiroAcesso ? 'Crie a sua senha' : 'Trocar senha';
    $('#troca-erro').textContent = '';
    focar('#troca-atual');
  }

  async function trocarSenha(ev) {
    ev.preventDefault();
    const nova = $('#troca-nova').value, conf = $('#troca-conf').value;
    if (nova !== conf) { $('#troca-erro').textContent = 'A confirmação não confere com a nova senha.'; return; }
    try {
      const r = await Api.chamar('nucleo.trocar_senha', { atual: $('#troca-atual').value, nova: nova });
      if (!r.ok) { $('#troca-erro').textContent = r.detalhe || Api.mensagemAcesso(r.erro); return; }
      const s = Api.Sessao.ler() || {};
      Api.Sessao.gravar(Object.assign(s, { token: r.token, exp: r.exp }));
      ['#troca-atual', '#troca-nova', '#troca-conf'].forEach(id => { $(id).value = ''; });
      aviso('Senha criada com sucesso.', 'ok');
      iniciar();
    } catch (e) { if (!e.auth) $('#troca-erro').textContent = e.message; }
  }

  function sair() {
    Api.Sessao.limpar();
    location.hash = '';
    mostrarLogin('Você saiu do sistema.');
  }

  /* ── menu e navegação ── */
  function sistemasLiberados() {
    const me = eu();
    if (!me) return [];
    return JORNADA.sistemas.filter(s => me.sistemas.indexOf(s.id) >= 0);
  }

  function montarMenu() {
    const me = eu();
    $('#usuario-nome').textContent = me.nome;
    $('#usuario-perfil').textContent = NOMES_PERFIL[me.perfil] || me.perfil;
    let h = '<a href="#/inicio" data-rota="inicio" title="Início"><span>🏠</span>Início</a><div class="menu-grupo">Sistemas</div>';
    sistemasLiberados().forEach(s => { h += `<a href="#/s/${s.id}" data-rota="s/${s.id}" title="${esc(s.nome)}"><span>${s.icone}</span>${esc(s.nome)}</a>`; });
    if (me.gestao || me.admin) {
      h += '<div class="menu-grupo">Gestão</div>';
      if (me.gestao) h += '<a href="#/bases" data-rota="bases" title="Central de Bases"><span>🗂️</span>Central de Bases</a>';
      if (me.admin) h += '<a href="#/usuarios" data-rota="usuarios" title="Usuários e perfis"><span>👥</span>Usuários e perfis</a>';
    }
    $('#menu').innerHTML = h;
  }

  function rota() {
    const r = (location.hash || '#/inicio').replace(/^#\/?/, '') || 'inicio';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.rota === r));
    document.body.classList.remove('menu-aberto');
    const area = $('#conteudo');
    document.body.classList.remove('com-sistema');
    const me = eu();
    if (r === 'inicio') return telaInicio(area);
    if (r === 'usuarios' && me.admin) return telaUsuarios(area);
    if (r === 'bases' && me.gestao) return telaBases(area);
    const m = r.match(/^s\/([a-z]+)/);
    if (m) {
      const sis = sistemasLiberados().filter(s => s.id === m[1])[0];
      if (sis) return abrirSistema(area, sis);
    }
    location.hash = '#/inicio';
  }

  function telaInicio(area) {
    const me = eu();
    const cards = sistemasLiberados().map(s => `
      <a class="card-sistema" href="#/s/${s.id}">
        <div class="cs-icone">${s.icone}</div>
        <div class="cs-nome">${esc(s.nome)}</div>
        <div class="cs-desc">${esc(s.descricao)}</div>
      </a>`).join('');
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>Olá, ${esc(me.nome.split(' ')[0])}</h1><p>Escolha o sistema em que vai trabalhar.</p></div>
      <div class="grade-sistemas">${cards || '<p class="vazio">Nenhum sistema liberado para o seu usuário. Fale com a coordenação.</p>'}</div>`;
  }

  /** Abre o sistema numa moldura própria (cada sistema mantém o visual e os scripts dele, sem conflito). */
  function abrirSistema(area, sis) {
    if (!sis.pronto) return emMigracao(area, sis);
    document.body.classList.add('com-sistema');
    area.innerHTML = `<iframe class="moldura-sistema" title="${esc(sis.nome)}" src="modulos/${sis.id}/index.html?v=${JORNADA.versao}"></iframe>`;
  }

  function emMigracao(area, sis) {
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>${sis.icone} ${esc(sis.nome)}</h1></div>
      <div class="painel aviso-migracao">Este sistema está sendo migrado para a Jornada do Aluno (etapa ${sis.etapa} do plano).
      Até lá, continue usando o sistema atual.</div>`;
  }

  function telaBases(area) {
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>🗂️ Central de Bases</h1><p>Importação e conferência das bases de cada sistema.</p></div>
      <div class="painel aviso-migracao">A Central de Bases entra na etapa 6, depois que os sistemas estiverem migrados.</div>`;
  }

  /* ── usuários e perfis (admin) ── */
  let usuarios = [];

  async function telaUsuarios(area) {
    area.innerHTML = `
      <div class="cabecalho-tela linha">
        <div><h1>👥 Usuários e perfis</h1><p>Cada colaborador tem um usuário. O perfil e os sistemas definem o que ele acessa.</p></div>
        <button class="btn primario" id="btn-novo-usuario">+ Novo usuário</button>
      </div>
      <div class="painel"><table class="tabela" id="tab-usuarios"><thead><tr>
        <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Sistemas</th><th>Situação</th><th>Último acesso</th><th></th>
      </tr></thead><tbody><tr><td colspan="7" class="vazio">Carregando...</td></tr></tbody></table></div>`;
    $('#btn-novo-usuario').onclick = () => editarUsuario(null);
    try {
      const r = await Api.chamar('nucleo.usuarios_listar');
      if (!r.ok) { aviso(r.erro || 'Não foi possível carregar os usuários.', 'erro'); return; }
      usuarios = r.usuarios;
      desenharUsuarios();
    } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
  }

  function nomesSistemas(lista) {
    if (lista.indexOf('todos') >= 0) return 'Todos';
    return lista.map(id => (JORNADA.sistemas.filter(s => s.id === id)[0] || { nome: id }).nome).join(', ');
  }

  function desenharUsuarios() {
    const fmt = (ms) => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';
    $('#tab-usuarios tbody').innerHTML = usuarios.map((u, i) => {
      const sit = !u.ativo ? '<span class="selo cinza">Desativado</span>'
        : u.trocar ? '<span class="selo amarelo">Aguardando 1º acesso</span>'
        : '<span class="selo verde">Ativo</span>';
      return `<tr>
        <td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(NOMES_PERFIL[u.perfil])}</td>
        <td>${esc(u.perfil === 'admin' ? 'Todos' : nomesSistemas(u.sistemas))}</td><td>${sit}</td><td>${fmt(u.ultimo)}</td>
        <td class="acoes"><button class="btn mini" data-ed="${i}">Editar</button><button class="btn mini" data-pv="${i}">Nova senha</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="vazio">Nenhum usuário.</td></tr>';
    document.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => editarUsuario(usuarios[+b.dataset.ed]); });
    document.querySelectorAll('[data-pv]').forEach(b => { b.onclick = () => novaProvisoria(usuarios[+b.dataset.pv]); });
  }

  function editarUsuario(u) {
    const novo = !u;
    u = u || { nome: '', email: '', perfil: 'atendente', sistemas: ['todos'], ativo: true };
    const todos = u.sistemas.indexOf('todos') >= 0;
    const checks = JORNADA.sistemas.map(s => `
      <label class="check"><input type="checkbox" name="sis" value="${s.id}" ${todos || u.sistemas.indexOf(s.id) >= 0 ? 'checked' : ''}> ${s.icone} ${esc(s.nome)}</label>`).join('');
    abrirModal(`
      <h2>${novo ? 'Novo usuário' : 'Editar usuário'}</h2>
      <form id="form-usuario">
        <label>Nome<input name="nome" required value="${esc(u.nome)}"></label>
        <label>E-mail institucional<input name="email" type="email" required value="${esc(u.email)}" ${novo ? '' : 'readonly'}></label>
        <label>Perfil<select name="perfil">
          ${Object.keys(NOMES_PERFIL).map(p => `<option value="${p}" ${u.perfil === p ? 'selected' : ''}>${NOMES_PERFIL[p]}</option>`).join('')}
        </select></label>
        <p class="dica">Administrador: tudo. Coordenador: sistemas marcados + importar bases e ver a produtividade da equipe. Atendente e Apoio: só os sistemas marcados.</p>
        <fieldset><legend>Sistemas liberados</legend><div class="grade-checks">${checks}</div></fieldset>
        <label class="check"><input type="checkbox" name="ativo" ${u.ativo ? 'checked' : ''}> Acesso ativo</label>
        <p class="erro" id="usuario-erro"></p>
        <div class="botoes"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    $('#form-usuario').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const marcados = Array.from(f.querySelectorAll('[name=sis]:checked')).map(c => c.value);
      const sistemas = marcados.length === JORNADA.sistemas.length ? ['todos'] : marcados;
      if (!sistemas.length && f.perfil.value !== 'admin') { $('#usuario-erro').textContent = 'Marque pelo menos um sistema.'; return; }
      const dados = { nome: f.nome.value.trim(), email: f.email.value.trim(), perfil: f.perfil.value, sistemas: sistemas, ativo: f.ativo.checked };
      try {
        const r = await Api.chamar('nucleo.usuario_salvar', { usuario: dados });
        if (!r.ok) { $('#usuario-erro').textContent = r.erro; return; }
        fecharModal();
        if (r.provisoria) mostrarProvisoria(dados.nome, r.provisoria);
        else aviso('Usuário atualizado.', 'ok');
        telaUsuarios($('#conteudo'));
      } catch (e) { if (!e.auth) $('#usuario-erro').textContent = e.message; }
    };
  }

  async function novaProvisoria(u) {
    if (!confirmarAcao('Gerar uma nova senha provisória para ' + u.nome + '? A senha atual deixa de valer.')) return;
    try {
      const r = await Api.chamar('nucleo.usuario_senha', { email: u.email });
      if (!r.ok) { aviso(r.erro, 'erro'); return; }
      mostrarProvisoria(u.nome, r.provisoria);
      telaUsuarios($('#conteudo'));
    } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
  }

  function confirmarAcao(msg) { return window.confirm(msg); }

  function mostrarProvisoria(nome, senha) {
    abrirModal(`
      <h2>Senha provisória</h2>
      <p>Entregue esta senha somente para <b>${esc(nome)}</b>. No primeiro acesso, o sistema pede para criar uma senha própria.</p>
      <div class="senha-prov">${esc(senha)}</div>
      <div class="botoes"><button class="btn" id="btn-copiar-prov">Copiar</button><button class="btn primario" data-fechar>Pronto</button></div>`);
    $('#btn-copiar-prov').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(senha); aviso('Senha copiada.', 'ok'); };
  }

  /* ── modal genérico ── */
  function abrirModal(html) {
    $('#modal-corpo').innerHTML = html;
    $('#modal').hidden = false;
    $('#modal').querySelectorAll('[data-fechar]').forEach(b => { b.onclick = fecharModal; });
  }
  function fecharModal() { $('#modal').hidden = true; $('#modal-corpo').innerHTML = ''; }

  /* ── início ── */
  function iniciar() {
    if (!eu()) return mostrarLogin();
    document.body.dataset.tela = 'app';
    montarMenu();
    rota();
    Api.chamar('nucleo.sessao').then(() => montarMenu()).catch(() => {});
  }

  function preparar() {
    $('#nome-sistema').textContent = JORNADA.nome;
    $('#sub-sistema').textContent = JORNADA.subtitulo;
    $('#form-login').onsubmit = entrar;
    $('#form-troca').onsubmit = trocarSenha;
    $('#btn-sair').onclick = sair;
    $('#btn-trocar-senha').onclick = () => pedirTrocaSenha(false);
    $('#btn-voltar-app').onclick = () => { if (eu()) iniciar(); else mostrarLogin(); };
    $('#btn-menu').onclick = () => document.body.classList.toggle('menu-aberto');
    $('#modal').onclick = (ev) => { if (ev.target.id === 'modal') fecharModal(); };
    window.addEventListener('hashchange', () => { if (eu()) rota(); });
    if (location.protocol === 'file:') aviso('Abra o sistema pelo endereço publicado. Aberto como arquivo, a conexão com o servidor não funciona.', 'erro');
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    iniciar();
  }

  window.App = { mostrarLogin, pedirTrocaSenha, aviso, abrirModal, fecharModal, esc, sair };
  document.addEventListener('DOMContentLoaded', preparar);
})();
