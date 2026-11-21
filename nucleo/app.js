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
    h += '<div class="menu-grupo">Ferramentas da equipe</div>';
    JORNADA.ferramentas.forEach(f => { h += `<a href="#/f/${f.id}" data-rota="f/${f.id}" title="${esc(f.nome)}"><span>${f.icone}</span>${esc(f.nome)}</a>`; });
    if (me.gestao || me.admin) {
      h += '<div class="menu-grupo">Administração</div>';
      if (me.gestao) h += '<a href="#/bases" data-rota="bases" title="Central de Bases"><span>🗂️</span>Central de Bases</a>';
      if (me.admin) h += '<a href="#/config" data-rota="config" title="Configurações dos sistemas"><span>⚙️</span>Configurações</a>';
      if (me.admin) h += '<a href="#/relatorio" data-rota="relatorio" title="Relatório diário"><span>📨</span>Relatório diário</a>';
      if (me.admin) h += '<a href="#/usuarios" data-rota="usuarios" title="Usuários e perfis"><span>👥</span>Usuários e perfis</a>';
    }
    $('#menu').innerHTML = h;
  }

  function rota() {
    const r = (location.hash || '#/inicio').replace(/^#\/?/, '') || 'inicio';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.rota === r.split('?')[0].split('/')[0] || a.dataset.rota === r.split('?')[0]));
    document.body.classList.remove('menu-aberto');
    const area = $('#conteudo');
    document.body.classList.remove('com-sistema');
    const me = eu();
    if (r === 'inicio') return telaInicio(area);
    if (r === 'usuarios' && me.admin) return telaUsuarios(area);
    if (r === 'bases' && me.gestao) return telaBases(area);
    if (r === 'config' && me.admin) return telaConfig(area);
    const mc = r.match(/^(bases|config)\/([a-z]+)(?:\?(.*))?/);
    if (mc && (mc[1] === 'bases' ? me.gestao : me.admin)) return abrirCentral(area, mc[1], mc[2], mc[3] || '');
    const mf = r.match(/^f\/([a-z]+)/);
    if (mf) {
      const ferr = JORNADA.ferramentas.filter(f => f.id === mf[1])[0];
      if (ferr) return abrirFerramenta(area, ferr);
    }
    const m = r.match(/^s\/([a-z]+)(?:\?(.*))?/);
    if (m) {
      const sis = sistemasLiberados().filter(s => s.id === m[1])[0];
      if (sis) return abrirSistema(area, sis, m[2] || '');
    }
    if (r === 'relatorio' && me.admin) return telaRelatorio(area);
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
      <div class="grade-sistemas">${cards || '<p class="vazio">Nenhum sistema liberado para o seu usuário. Fale com a coordenação.</p>'}</div>
      <h2 class="titulo-secao">Ferramentas da equipe</h2>
      <div class="grade-sistemas">${JORNADA.ferramentas.map(f => `
        <a class="card-sistema ferramenta" href="#/f/${f.id}">
          <div class="cs-icone">${f.icone}</div>
          <div class="cs-nome">${esc(f.nome)}</div>
          <div class="cs-desc">${esc(f.descricao)}</div>
        </a>`).join('')}</div>`;
  }

  /** Abre o sistema numa moldura própria (cada sistema mantém o visual e os scripts dele, sem conflito). */
  function abrirSistema(area, sis, extra) {
    if (!sis.pronto) return emMigracao(area, sis);
    document.body.classList.add('com-sistema');
    const pagina = sis.pagina || `modulos/${sis.id}/index.html`;
    const params = (extra ? extra.replace(/[^a-z0-9=&_-]/gi, '') + '&' : '') + 'v=' + JORNADA.versao;
    area.innerHTML = `<iframe class="moldura-sistema" title="${esc(sis.nome)}" src="${pagina}${pagina.indexOf('?') >= 0 ? '&' : '?'}${params}"></iframe>`;
  }

  /** Calendário, Tarefas e Tutoriais: as telas do EngajaVR em modo ferramenta, para toda a equipe. */
  function abrirFerramenta(area, f) {
    document.body.classList.add('com-sistema');
    area.innerHTML = `<iframe class="moldura-sistema" title="${esc(f.nome)}" src="modulos/engajamento/index.html?ferramenta=${f.id}&v=${JORNADA.versao}"></iframe>`;
  }

  function emMigracao(area, sis) {
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>${sis.icone} ${esc(sis.nome)}</h1></div>
      <div class="painel aviso-migracao">Este sistema está sendo migrado para a Jornada do Aluno (etapa ${sis.etapa} do plano).
      Até lá, continue usando o sistema atual.</div>`;
  }

  /* ── Central de Bases e Configurações (administração) ──
   * As bases são importadas só aqui; os sistemas apenas consomem os dados.
   * Cada importação reaproveita a tela original do sistema, aberta em "modo importar" (sem o restante do sistema).
   * As configurações de cada sistema ficam reunidas em Configurações, abertas em "modo config". */
  const CENTRAL = {
    renovacao: { sis: 'renovacao', nome: 'Renovação', icone: '🔄', importar: 'modulos/renovacao/index.html?modo=importar', config: 'modulos/renovacao/index.html?modo=config',
      descConfig: 'Ritmo e metas, período e prazo da renovação, painel do administrador.' },
    engajamento: { sis: 'engajamento', nome: 'Engajamento', icone: '🤝', importar: 'modulos/engajamento/index.html?modo=importar', config: 'modulos/engajamento/index.html?modo=config',
      descConfig: 'Equipe de atendentes, renomear no histórico, relatório por atendente e limpeza das bases.' },
    formandos: { sis: 'formandos', nome: 'Formandos', icone: '🎓', importar: 'modulos/formandos/index.html?modo=importar', config: 'modulos/formandos/index.html?modo=config',
      descConfig: 'Semestre de trabalho e limpeza dos dados do painel.' },
    nps: { sis: 'nps', nome: 'NPS (Medallia)', icone: '⭐', importar: 'modulos/acompanhamento/index.html?sistema=nps&modo=importar' },
  };
  const liberado = (sis) => sistemasLiberados().some(s => s.id === sis);

  function abrirCentral(area, tipo, alvo, extra) {
    const c = CENTRAL[alvo], pagina = c && c[tipo === 'bases' ? 'importar' : 'config'];
    if (!pagina) { location.hash = '#/' + tipo; return; }
    if (!liberado(c.sis)) { aviso('Seu usuário não tem o sistema ' + c.nome + ' liberado.', 'erro'); location.hash = '#/' + tipo; return; }
    document.body.classList.add('com-sistema');
    const params = (extra ? '&' + extra.replace(/[^a-z0-9=&_-]/gi, '') : '') + '&v=' + JORNADA.versao;
    const titulo = tipo === 'bases' ? 'Importar base · ' + c.nome : 'Configurações · ' + c.nome;
    const volta = tipo === 'bases' ? '← Central de Bases' : '← Configurações';
    area.innerHTML = `<div class="moldura-central">
      <div class="barra-central"><a href="#/${tipo}">${volta}</a><b>${c.icone} ${esc(titulo)}</b></div>
      <iframe class="moldura-sistema" title="${esc(titulo)}" src="${pagina}${params}"></iframe></div>`;
  }

  async function telaBases(area) {
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>🗂️ Central de Bases</h1><p>Todas as bases são importadas aqui. Depois de importada, a base fica disponível para os sistemas que a usam, sem nova importação.</p></div>
      <div class="grade-sistemas" id="cards-bases"><div class="carregando">Consultando as bases...</div></div>`;
    let r;
    try { r = await Api.chamar('nucleo.bases_resumo'); } catch (e) { if (!e.auth) aviso(e.message, 'erro'); return; }
    if (!r || !r.ok) { aviso((r && r.erro) || 'Não foi possível consultar as bases.', 'erro'); return; }
    const fmtData = (ms) => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca importada';
    const n = (v) => Number(v || 0).toLocaleString('pt-BR');
    const card = (icone, titulo, linhas, usadaPor, botao) => `<div class="card-sistema base"><div class="cs-icone">${icone}</div><div class="cs-nome">${titulo}</div><div class="cs-desc">${linhas}${usadaPor ? `<br><small>Usada por: ${usadaPor}</small>` : ''}</div>${botao || ''}</div>`;
    const btn = (alvo, extra, txt) => liberado(CENTRAL[alvo].sis)
      ? `<a class="btn mini primario" href="#/bases/${alvo}${extra ? '?' + extra : ''}" style="margin-top:10px;display:inline-block">${txt}</a>`
      : `<small class="sem-acesso">Sistema não liberado para o seu usuário</small>`;
    const ciclos = r.renovacao ? Object.keys(r.renovacao.ciclos).sort() : [];
    const nomesEng = { impar: 'Ímpar', par: 'Par', ct: 'Técnico' };
    let h = card('🔄', 'Renovação', ciclos.length ? ciclos.map(c => `Ciclo ${esc(c)}: <b>${n(r.renovacao.ciclos[c])}</b> alunos`).join('<br>') : 'Nenhum ciclo importado', 'Renovação', btn('renovacao', '', 'Importar base da Renovação'));
    ['impar', 'par', 'ct'].forEach(b => {
      const e = (r.engajamento || {})[b] || {};
      h += card('🤝', 'Base líquida ' + nomesEng[b], `<b>${n(e.total)}</b> alunos<br>Última importação: ${fmtData(e.ts)}`, 'Engajamento, Provas, Estágio, Financeiro e Financiamentos', btn('engajamento', 'base=' + b, 'Importar base ' + nomesEng[b]));
    });
    h += card('🎓', 'Formandos', r.formandos ? `<b>${n(r.formandos.total)}</b> alunos no painel` : 'Sem informação', 'Formandos (alunos, formados e ENADE)', btn('formandos', '', 'Importar no Formandos'));
    h += card('⭐', 'NPS (Medallia)', r.nps && r.nps.total ? `<b>${n(r.nps.total)}</b> respostas<br>Respostas até ${esc((r.nps.ate || '').split('-').reverse().join('/'))}<br>Última importação: ${fmtData(r.nps.ultima)}` : 'Nenhuma resposta importada', 'NPS', btn('nps', '', 'Importar respostas do Medallia'));
    if (eu().admin) h += card('🗃️', 'Acionamentos do EngajaVR atual', 'Traz para a Jornada os acionamentos gravados pelo EngajaVR em uso (desde agosto eles ficam só no Drive dele). Só lê o EngajaVR, nada é alterado lá. Pode repetir: não duplica.', 'Engajamento, Provas, Estágio, Financeiro e Financiamentos (último acionamento e produtividade)',
      '<button class="btn mini primario" id="btn-hist-engajavr" style="margin-top:10px">Trazer acionamentos</button><div id="res-hist-engajavr" class="dica"></div>');
    $('#cards-bases').innerHTML = h + (r.erros && r.erros.length ? `<p class="erro">Não foi possível ler: ${esc(r.erros.join(' | '))}</p>` : '');
    const bh = $('#btn-hist-engajavr');
    if (bh) bh.onclick = async () => {
      bh.disabled = true; bh.textContent = 'Trazendo... (pode levar 1 minuto)';
      try {
        const x = await Api.chamar('nucleo.historico_engajavr', {}, { timeout: 300000 });
        if (!x || !x.ok) throw new Error((x && x.erro) || 'Não foi possível trazer os acionamentos.');
        $('#res-hist-engajavr').innerHTML = Object.keys(x.bases).map(b => { const v = x.bases[b]; return `${nomesEng[b]}: ${v.encontrado ? `<b>${n(v.novos)}</b> novo(s), ${n(v.total)} no total` : 'sem arquivo no EngajaVR'}`; }).join('<br>');
        aviso('Acionamentos do EngajaVR trazidos para a Jornada.', 'ok');
      } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
      bh.disabled = false; bh.textContent = 'Trazer acionamentos';
    };
  }

  function telaConfig(area) {
    const cards = Object.keys(CENTRAL).filter(k => CENTRAL[k].config).map(k => {
      const c = CENTRAL[k];
      return `<div class="card-sistema base"><div class="cs-icone">${c.icone}</div><div class="cs-nome">${esc(c.nome)}</div><div class="cs-desc">${esc(c.descConfig)}</div>
        ${liberado(c.sis) ? `<a class="btn mini primario" href="#/config/${k}" style="margin-top:10px;display:inline-block">Abrir configurações</a>` : '<small class="sem-acesso">Sistema não liberado para o seu usuário</small>'}</div>`;
    }).join('');
    area.innerHTML = `
      <div class="cabecalho-tela"><h1>⚙️ Configurações dos sistemas</h1><p>As áreas de administrador que ficavam dentro de cada sistema agora ficam aqui. Usuários, perfis e senhas estão em <a href="#/usuarios">Usuários e perfis</a>, e o relatório da equipe em <a href="#/relatorio">Relatório diário</a>.</p></div>
      <div class="grade-sistemas">${cards}</div>
      <p class="dica-central">Provas, Estágio, Financeiro, Financiamentos e NPS não têm configurações próprias: usam a base líquida (ou a do Medallia) e os usuários da Jornada.</p>`;
  }

  /* ── Relatório diário único (admin) ── */
  async function telaRelatorio(area) {
    area.innerHTML = `
      <div class="cabecalho-tela linha">
        <div><h1>📨 Relatório diário</h1><p id="rel-info">Um único e-mail com todos os sistemas: segunda a sexta às 20h e sábado às 13h.</p></div>
        <div><button class="btn" id="rel-ativar">Ativar envio automático</button> <button class="btn primario" id="rel-enviar">Enviar agora</button></div>
      </div>
      <div class="painel" id="rel-previa"><div class="carregando">Montando a prévia de hoje...</div></div>`;
    $('#rel-enviar').onclick = async () => {
      if (!confirmarAcao('Enviar agora o relatório de hoje por e-mail?')) return;
      try { const r = await Api.chamar('nucleo.relatorio_enviar'); if (r.ok) aviso('Relatório enviado para ' + r.para + '.', 'ok'); else aviso(r.erro || 'Não foi possível enviar.', 'erro'); } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
    };
    $('#rel-ativar').onclick = async () => {
      try { const r = await Api.chamar('nucleo.relatorio_ativar'); if (r.ok) { aviso('Envio automático ativado.', 'ok'); telaRelatorio(area); } else aviso(r.erro || 'Não foi possível ativar.', 'erro'); } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
    };
    try {
      const r = await Api.chamar('nucleo.relatorio_previa');
      if (!r.ok) { $('#rel-previa').innerHTML = `<p class="erro">${esc(r.erro || 'Não foi possível montar a prévia.')}</p>`; return; }
      $('#rel-info').innerHTML = `Destino: <b>${esc(r.para)}</b> · segunda a sexta às 20h e sábado às 13h · Envio automático: ${r.ativo ? '<span class="selo verde">ativo</span>' : '<span class="selo amarelo">desligado</span>'}`;
      if (r.ativo) $('#rel-ativar').textContent = 'Reativar envio automático';
      $('#rel-previa').innerHTML = `<p class="dica">Prévia do e-mail de hoje (${esc(r.assunto)}):</p><iframe id="rel-frame" sandbox style="width:100%;height:520px;border:1px solid var(--borda);border-radius:8px"></iframe>`;
      $('#rel-frame').srcdoc = r.html;
    } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
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
