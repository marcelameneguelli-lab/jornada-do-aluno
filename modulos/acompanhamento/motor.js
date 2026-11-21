/* Jornada do Aluno · motor de acompanhamento
 * Alunos (da base do Engajamento) + acionamentos + follow-up + dashboard + produtividade,
 * separados por sistema. Usado por Provas, Estágio, Financeiro e Financiamentos.
 */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SIS = new URLSearchParams(location.search).get('sistema');
  // modo importar: a tela é aberta pela Central de Bases da Jornada (a importação não fica dentro do sistema)
  const MODO_IMPORTAR = new URLSearchParams(location.search).get('modo') === 'importar';
  const CFG = (window.SISTEMAS_ACOMP || {})[SIS];
  const NOMES_BASE = { impar: 'Ímpar', par: 'Par', ct: 'Técnico' };
  const POR_PAGINA = 50;
  const CANAIS = ['WhatsApp', 'Ligação', 'E-mail', 'Presencial', 'SMS'];

  const E = {
    base: 'impar', alunos: [], todos: 0, regs: {}, fichas: {}, desde: 0,
    aba: 'alunos', pagina: 1, filtro: { busca: '', curso: '', mod: '', situacao: '', extra: '', programa: '', tipo: '', canal: '', atend: '', de: '', ate: '' },
    hist: {}, // acionamentos do Engajamento (todas as bases), por matrícula: entram no "último acionamento"
    fuQuem: 'meus', periodo: '7', apoio: {}, motivo: '', comEngajamento: true,
  };
  const eu = () => { const s = Api.Sessao.ler(); return (s && s.me) || { nome: '', perfil: '' }; };

  function aviso(msg, tipo) {
    if (window.App && window.App.aviso) return window.App.aviso(msg, tipo);
    const el = document.createElement('div'); el.className = 'aviso ' + (tipo || ''); el.textContent = msg;
    $('#avisos').appendChild(el); setTimeout(() => el.remove(), 4000);
  }

  async function chamar(acao, dados) {
    const r = await Api.chamar(SIS + '.' + acao, dados || {});
    if (r && r.permissao === false) throw new Error(r.erro || 'Seu perfil não tem acesso a este sistema.');
    return r;
  }

  /* ── contexto para as funções da configuração (tipo de prova escolhido, último acionamento) ── */
  const ctx = () => ({ tipo: E.filtro.tipo || (CFG.seletor ? CFG.seletor.opcoes[0][0] : ''), ultimo: (r) => ultimoAc(mat(r)) });
  const aplicaSeletor = (r, c) => !CFG.seletor || CFG.seletor.filtra(r, c.tipo);

  /* Datas do histórico do EngajaVR: "dd/mm/aaaa hh:mm:ss" ou "dd/mm/aaaa, hh:mm:ss" */
  function msDeDataBR(t) {
    const m = String(t || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : 0;
  }
  /** Todos os acionamentos do aluno: os deste sistema e, quando configurado, os do Engajamento. */
  function acionamentos(m) {
    const proprios = regsDoAluno(m).map((x) => ({ ms: x.criado, canal: x.canal, atend: x.atendente, resultado: x.resultado, origem: CFG.nome }));
    return proprios.concat(E.hist[m] || []).sort((a, b) => b.ms - a.ms);
  }
  const ultimoAc = (m) => acionamentos(m)[0] || null;
  async function carregarHistoricoEngajamento() {
    if (!CFG.historicoEngajamento) return;
    const h = {};
    await Promise.all(Object.keys(NOMES_BASE).map(async (b) => {
      try {
        const r = await chamar('getHistory', { base: b });
        const d = (r && r.data) || {};
        Object.keys(d).forEach((mt) => (d[mt] || []).forEach((a) => {
          const k = String(mt).replace(/\D/g, '');
          (h[k] = h[k] || []).push({ ms: msDeDataBR(a.datetime || a.date), canal: a.canal || a.canal_envio || '', atend: a.atendente || a.atend || '', resultado: a.motivo || a.tipo || '', origem: 'Engajamento ' + NOMES_BASE[b] });
        }));
      } catch (e) { /* sem o histórico do Engajamento, vale só o deste sistema */ }
    }));
    E.hist = h;
    if (E.alunos.length && $('#modal').hidden && E.aba !== 'original') desenhar();
  }

  /* ── dados ── */
  const mat = (r) => CFG && CFG.chave ? String(CFG.chave(r)) : String(r.COD_MATRICULA || r.MATRICULA || '').trim();
  const matVis = (r) => CFG && CFG.matriculaVisivel ? CFG.matriculaVisivel(r) : mat(r);
  const unidade = () => (CFG && CFG.unidade) || 'alunos';
  const nomeBase = () => (CFG && CFG.fonte) ? CFG.nomeFonte : 'base ' + NOMES_BASE[E.base];
  const regsDoAluno = (m) => Object.values(E.regs).filter((x) => x.matricula === m && (!x.base || x.base === E.base)).sort((a, b) => b.criado - a.criado);
  const fichaDe = (m) => (E.fichas[m] && E.fichas[m].dados) || {};

  async function carregarBase() {
    $('#area').innerHTML = `<div class="carregando-base">Carregando ${CFG.fonte ? CFG.nomeFonte : 'a base ' + NOMES_BASE[E.base] + ' do Engajamento'}...</div>`;
    try {
      const r = CFG.fonte ? await chamar(CFG.fonte, {}) : await chamar('carregarBase', { base: E.base });
      let dados = (r && r.dados) || [];
      if (CFG.ordenar) dados = dados.slice().sort(CFG.ordenar);
      E.todos = dados.length;
      E.alunos = dados.filter((x) => { try { return CFG.elegivel(x); } catch (e) { return false; } });
      E.pagina = 1;
      if (!dados.length && !MODO_IMPORTAR) aviso(CFG.fonte ? CFG.semDados : `A base ${NOMES_BASE[E.base]} ainda não foi importada. A coordenação importa na Central de Bases.`);
    } catch (e) {
      if (!e.auth) aviso(e.message, 'erro');
      E.alunos = []; E.todos = 0;
    }
    desenhar();
  }

  async function sincronizar() {
    try {
      const r = await chamar('listar', { since: E.desde });
      if (!r || !r.ok) throw new Error((r && r.erro) || 'sem resposta');
      (r.regs || []).forEach((x) => { E.regs[x.id] = x; });
      Object.keys(r.fichas || {}).forEach((m) => { E.fichas[m] = r.fichas[m]; });
      const mudou = E.desde && ((r.regs || []).length || Object.keys(r.fichas || {}).length);
      E.desde = r.agora || Date.now();
      $('#sync').innerHTML = `<b>●</b> Ao vivo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      atualizarContadorFu();
      if (mudou && E.aba !== 'original' && $('#modal').hidden) desenhar();
    } catch (e) {
      if (!e.auth) $('#sync').textContent = 'Sem conexão, tentando de novo...';
    }
  }

  /* ── filtros ── */
  function filtrados() {
    const f = E.filtro, busca = f.busca.trim().toLowerCase(), c = ctx();
    const extra = (CFG.filtros || []).filter((x) => x.id === f.extra)[0];
    return E.alunos.filter((r) => {
      const m = mat(r);
      if (!aplicaSeletor(r, c)) return false;
      if (CFG.filtroData && (f.de || f.ate)) { const d = CFG.filtroData.v(r, c); if (!d || (f.de && d < f.de) || (f.ate && d > f.ate)) return false; }
      if (f.canal || f.atend) { if (!acionamentos(m).some((a) => (!f.canal || a.canal === f.canal) && (!f.atend || a.atend === f.atend))) return false; }
      if (busca && (String(r.NOM_ALUNO || '').toLowerCase().indexOf(busca) < 0) && m.indexOf(busca) < 0 && String(matVis(r)).indexOf(busca) < 0) return false;
      if (f.curso && r.NOM_CURSO !== f.curso) return false;
      if (f.mod && (r.MODALIDADE_PP_PC || r.MODALIDADE || '') !== f.mod) return false;
      if (f.programa && CFG.filtroPrograma && CFG.filtroPrograma(r) !== f.programa) return false;
      if (extra && !extra.f(r, fichaDe(m), c)) return false;
      if (f.situacao) {
        const rs = regsDoAluno(m), tem = acionamentos(m).length > 0;
        if (f.situacao === 'sem' && tem) return false;
        if (f.situacao === 'com' && !tem) return false;
        if (f.situacao === 'fu' && !rs.some((x) => x.fu_status === 'pendente')) return false;
      }
      return true;
    });
  }
  const unicos = (lista, fn) => Array.from(new Set(lista.map(fn).filter(Boolean))).sort();

  /* ── telas ── */
  function desenhar() {
    document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === E.aba));
    document.querySelectorAll('#bases button').forEach((b) => { b.classList.toggle('ativa', b.dataset.base === E.base); b.classList.toggle(b.dataset.base, true); });
    if (MODO_IMPORTAR) return telaImportar();
    ({ alunos: telaAlunos, followup: telaFollowup, dashboard: telaDashboard, produtividade: telaProdutividade, original: telaOriginal })[E.aba]();
  }

  function telaAlunos() {
    const lista = filtrados();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    E.pagina = Math.min(E.pagina, paginas);
    const fatia = lista.slice((E.pagina - 1) * POR_PAGINA, E.pagina * POR_PAGINA);
    const f = E.filtro;
    const opc = (arr, sel, rotulo) => `<option value="">${rotulo}</option>` + arr.map((x) => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const cols = CFG.colunas || [];
    const c = ctx();
    const doTipo = E.alunos.filter((r) => aplicaSeletor(r, c));
    // cartões clicáveis (como no sistema antigo): cada um aplica um filtro
    const cards = (CFG.filtros || []).filter((x) => x.card);
    const canais = new Set(), atends = new Set();
    doTipo.forEach((r) => acionamentos(mat(r)).forEach((a) => { if (a.canal) canais.add(a.canal); if (a.atend) atends.add(a.atend); }));
    $('#area').innerHTML = `
      ${cards.length ? `<div class="cartoes">
        <button class="cartao ${!f.extra ? 'ativo' : ''}" data-card=""><b>${doTipo.length.toLocaleString('pt-BR')}</b><span>${esc(CFG.rotuloTotal || 'Total')}</span></button>
        ${cards.map((x) => `<button class="cartao ${x.cor || ''} ${f.extra === x.id ? 'ativo' : ''}" data-card="${x.id}"><b>${doTipo.filter((r) => { try { return x.f(r, fichaDe(mat(r)), c); } catch (e) { return false; } }).length.toLocaleString('pt-BR')}</b><span>${esc(x.t)}</span></button>`).join('')}
      </div>` : ''}
      <div class="filtros">
        ${CFG.seletor ? `<label class="rot">${esc(CFG.seletor.rotulo)}<select id="f-tipo">${CFG.seletor.opcoes.map(([v, t]) => `<option value="${v}" ${v === c.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}
        <input type="search" id="f-busca" placeholder="Buscar por nome ou matrícula" value="${esc(f.busca)}">
        <select id="f-curso">${opc(unicos(E.alunos, (r) => r.NOM_CURSO), f.curso, 'Todos os cursos')}</select>
        <select id="f-mod">${opc(unicos(E.alunos, (r) => r.MODALIDADE_PP_PC || r.MODALIDADE), f.mod, 'Todas as modalidades')}</select>
        ${CFG.filtroPrograma ? `<select id="f-programa">${opc(unicos(E.alunos, CFG.filtroPrograma), f.programa, CFG.filtroProgramaRotulo || 'Todos os programas')}</select>` : ''}
        <select id="f-extra"><option value="">Todos</option>${(CFG.filtros || []).map((x) => `<option value="${x.id}" ${x.id === f.extra ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}</select>
        <select id="f-situacao">
          <option value="">${CFG.historicoEngajamento ? 'Acionamento: todos' : 'Qualquer situação'}</option>
          <option value="sem" ${f.situacao === 'sem' ? 'selected' : ''}>Sem acionamento</option>
          <option value="com" ${f.situacao === 'com' ? 'selected' : ''}>Com acionamento</option>
          <option value="fu" ${f.situacao === 'fu' ? 'selected' : ''}>Com follow-up pendente</option>
        </select>
        ${CFG.historicoEngajamento ? `<select id="f-canal">${opc(Array.from(canais).sort(), f.canal, 'Todos os canais')}</select>
        <select id="f-atend">${opc(Array.from(atends).sort(), f.atend, 'Todos os atendentes')}</select>` : ''}
        ${CFG.filtroData ? `<label class="rot">${esc(CFG.filtroData.t)} de<input type="date" id="f-de" value="${esc(f.de)}"></label><label class="rot">até<input type="date" id="f-ate" value="${esc(f.ate)}"></label>` : ''}
        <button class="btn mini" id="f-exportar">Exportar CSV</button>
        <span class="total">${lista.length.toLocaleString('pt-BR')} de ${E.alunos.length.toLocaleString('pt-BR')} ${unidade()}</span>
      </div>
      <div class="painel"><table class="tabela"><thead><tr>
        <th>Aluno</th><th>Curso</th><th>Modalidade</th>${cols.map((c) => `<th>${esc(c.t)}</th>`).join('')}<th>${CFG.historicoEngajamento ? 'Último acionamento' : 'Último contato'}</th><th>Follow-up</th>
      </tr></thead><tbody>${fatia.map((r) => {
        const m = mat(r), rs = regsDoAluno(m), ult = CFG.historicoEngajamento ? ultimoAc(m) : rs[0];
        const fu = rs.filter((x) => x.fu_status === 'pendente').map((x) => x.fu_data).sort()[0];
        return `<tr class="clicavel" data-mat="${esc(m)}">
          <td class="nome"><b>${esc(r.NOM_ALUNO)}${Apoio.selo(E.apoio[Apoio.norm(matVis(r))])}</b><small>${esc(matVis(r))}</small></td>
          <td>${esc(r.NOM_CURSO)}</td><td>${esc(r.MODALIDADE_PP_PC || r.MODALIDADE || '')}</td>
          ${cols.map((k) => { let v = ''; try { v = k.v(r, c); } catch (e) {} const al = k.alerta && k.alerta(r, c); return `<td class="${al ? 'alerta' : ''}">${k.html ? v : esc(v)}${al ? ' ⚠️' : ''}</td>`; }).join('')}
          <td>${!ult ? '<span class="selo cinza">Sem contato</span>' : CFG.historicoEngajamento
            ? `${esc(dataAA(ult.ms))}<br><small>${esc([ult.canal, ult.atend].filter(Boolean).join(' · '))}</small>${ult.origem !== CFG.nome ? `<br><small class="origem">${esc(ult.origem)}</small>` : ''}`
            : `${esc(dataCurta(ult.criado))}<br><small>${esc(ult.resultado || ult.canal)}</small>`}</td>
          <td>${fu ? esc(dataBR(fu)) : ''}</td></tr>`;
      }).join('') || `<tr><td colspan="${cols.length + 5}" class="vazio">${E.todos ? 'Nenhum registro com esses filtros.' : (CFG.fonte ? CFG.semDados : 'A base ' + NOMES_BASE[E.base] + ' ainda não foi importada. A coordenação importa na Central de Bases.')}</td></tr>`}</tbody></table></div>
      <div class="paginas"><button class="btn mini" id="p-ant" ${E.pagina <= 1 ? 'disabled' : ''}>Anterior</button> Página ${E.pagina} de ${paginas} <button class="btn mini" id="p-prox" ${E.pagina >= paginas ? 'disabled' : ''}>Próxima</button></div>`;
    const reaplicar = (campo, el) => { E.filtro[campo] = el.value; E.pagina = 1; telaAlunos(); };
    let t; $('#f-busca').oninput = (ev) => { clearTimeout(t); t = setTimeout(() => { reaplicar('busca', ev.target); const i = $('#f-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    [['#f-curso', 'curso'], ['#f-mod', 'mod'], ['#f-extra', 'extra'], ['#f-situacao', 'situacao'], ['#f-programa', 'programa'], ['#f-tipo', 'tipo'], ['#f-canal', 'canal'], ['#f-atend', 'atend'], ['#f-de', 'de'], ['#f-ate', 'ate']].forEach(([s, k]) => { const el = $(s); if (el) el.onchange = () => reaplicar(k, el); });
    document.querySelectorAll('[data-card]').forEach((b) => { b.onclick = () => { E.filtro.extra = b.dataset.card; E.pagina = 1; telaAlunos(); }; });
    $('#p-ant').onclick = () => { E.pagina--; telaAlunos(); };
    $('#p-prox').onclick = () => { E.pagina++; telaAlunos(); };
    $('#f-exportar').onclick = () => exportar(lista);
    if ($('#f-importar')) { $('#f-importar').onclick = () => $('#f-arquivo').click(); $('#f-arquivo').onchange = (ev) => importarArquivo(ev.target.files[0]); }
    document.querySelectorAll('tr[data-mat]').forEach((tr) => { tr.onclick = () => abrirAluno(tr.dataset.mat); });
  }

  function exportar(lista) {
    const cols = CFG.colunas || [];
    const c = ctx(), semHtml = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '');
    const cab = ['Matrícula', 'Nome', 'Curso', 'Modalidade', 'Telefone', 'E-mail'].concat(cols.map((k) => k.t), ['Último acionamento', 'Canal', 'Resultado', 'Atendente', 'Follow-up']);
    const linhas = lista.map((r) => {
      const m = mat(r), ult = ultimoAc(m), fu = regsDoAluno(m).filter((x) => x.fu_status === 'pendente').map((x) => x.fu_data).sort()[0];
      return [matVis(r), r.NOM_ALUNO, r.NOM_CURSO, r.MODALIDADE_PP_PC || r.MODALIDADE, r.NUM_TELEF_CELULAR || r.NUM_TELEFONE, r.END_EMAIL]
        .concat(cols.map((k) => { try { return semHtml(k.v(r, c)); } catch (e) { return ''; } }),
          [ult ? dataAA(ult.ms) : '', ult ? ult.canal : '', ult ? ult.resultado : '', ult ? ult.atend : '', fu ? dataBR(fu) : '']);
    });
    const csv = [cab].concat(linhas).map((l) => l.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${SIS}_${E.base}${c.tipo ? '_' + c.tipo : ''}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  /* ── ficha do aluno + acionamento ── */
  function abrirAluno(m) {
    const r = E.alunos.filter((x) => mat(x) === m)[0];
    if (!r) return aviso('Aluno não encontrado nesta base.', 'erro');
    const rs = regsDoAluno(m);
    const tel = String(r.NUM_TELEF_CELULAR || r.NUM_TELEFONE || '').replace(/\D/g, '');
    const email = r.END_EMAIL || '';
    const cols = CFG.colunas || [];
    const campos = CFG.ficha ? CFG.ficha(r) : [];
    const fic = fichaDe(m);
    const hoje = new Date().toISOString().slice(0, 10);
    abrirModal(`
      <h2>${esc(r.NOM_ALUNO)}</h2>
      <div class="ficha-aluno">
        <div><span>Matrícula</span>${esc(matVis(r))}</div><div><span>Curso</span>${esc(r.NOM_CURSO)}</div>
        <div><span>Modalidade</span>${esc(r.MODALIDADE_PP_PC || r.MODALIDADE || '')}</div><div><span>Base</span>${CFG.fonte ? esc(CFG.nomeFonte) : NOMES_BASE[E.base]}</div>
        ${cols.map((k) => { let v = ''; try { v = k.v(r, ctx()); } catch (e) {} return `<div><span>${esc(k.t)}</span>${k.html ? (v || '—') : esc(v === 0 ? 0 : (v || '—'))}</div>`; }).join('')}
      </div>
      ${Apoio.quadro(E.apoio[Apoio.norm(matVis(r))])}
      ${CFG.detalhe ? CFG.detalhe(r, esc) : ''}
      <div class="contatos">
        ${tel ? `<a class="btn mini" target="_blank" rel="noopener" href="https://wa.me/55${tel}">💬 WhatsApp</a><a class="btn mini" href="tel:${tel}">📞 ${esc(tel)}</a>` : '<span class="selo cinza">Sem telefone</span>'}
        ${email ? `<a class="btn mini" href="mailto:${esc(email)}">✉️ ${esc(email)}</a>` : ''}
      </div>
      ${campos.length ? `<div class="secao">Acompanhamento do aluno</div>
        <div class="grade2" id="ficha-campos">${campos.map((c) => `<label>${esc(c.t)}<select data-campo="${c.id}">${c.opcoes.map((o) => `<option ${String(fic[c.id] || '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`).join('')}</div>
        <div class="botoes" style="margin-top:0"><button class="btn mini" id="btn-ficha">Salvar acompanhamento</button></div>
        ${E.fichas[m] ? `<p class="dica">Atualizado por ${esc(E.fichas[m].quem)} em ${dataCurta(E.fichas[m].atualizado)}</p>` : ''}` : ''}
      <div class="secao">Histórico neste sistema (${rs.length})</div>
      <div class="hist">${rs.map((x) => `<div><b>${esc(x.resultado || x.canal)}</b> · ${esc(x.canal)} <small>· ${esc(x.atendente)} · ${dataCurta(x.criado)}</small><br>${esc(x.obs)}
        ${x.fu_data ? `<br><small>Follow-up ${dataBR(x.fu_data)}: ${x.fu_status === 'feito' ? 'concluído' : 'pendente'}</small>` : ''}</div>`).join('') || '<p class="dica">Nenhum acionamento ainda.</p>'}</div>
      ${CFG.historicoEngajamento && (E.hist[m] || []).length ? `<div class="secao">Acionamentos no Engajamento (${E.hist[m].length})</div>
      <div class="hist">${E.hist[m].slice().sort((p, q) => q.ms - p.ms).slice(0, 8).map((x) => `<div><b>${esc(x.resultado || x.canal)}</b> · ${esc(x.canal)} <small>· ${esc(x.atend)} · ${dataAA(x.ms)} · ${esc(x.origem)}</small></div>`).join('')}</div>` : ''}
      <div class="secao">Novo acionamento</div>
      <form id="form-ac">
        <div class="grade2">
          <label>Canal<select name="canal">${CANAIS.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Resultado<select name="resultado">${CFG.resultados.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        </div>
        <label>Observação (obrigatória)<textarea name="obs" required placeholder="O que foi conversado"></textarea></label>
        <label>Próximo contato (follow-up, opcional)<input type="date" name="fu" min="${hoje}"></label>
        <p class="erro" id="ac-erro"></p>
        <div class="botoes"><button type="button" class="btn" data-fechar>Fechar</button><button class="btn primario" id="btn-ac">Registrar acionamento</button></div>
      </form>`);
    const bf = $('#btn-ficha');
    if (bf) bf.onclick = async () => {
      const dados = {};
      document.querySelectorAll('#ficha-campos [data-campo]').forEach((s) => { dados[s.dataset.campo] = s.value; });
      bf.disabled = true;
      try {
        const r2 = await chamar('ficha', { matricula: m, dados: dados });
        if (!r2.ok) throw new Error(r2.erro || 'Não foi possível salvar.');
        E.fichas[m] = { dados: r2.dados, atualizado: r2.atualizado, quem: eu().nome };
        aviso('Acompanhamento salvo.', 'ok');
      } catch (e) { if (!e.auth) aviso(e.message, 'erro'); }
      bf.disabled = false;
    };
    $('#form-ac').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target, btn = $('#btn-ac');
      if (!f.obs.value.trim()) { $('#ac-erro').textContent = 'Preencha a observação do atendimento.'; return; }
      btn.disabled = true; btn.textContent = 'Registrando...';
      const reg = { id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7), matricula: m, aluno: r.NOM_ALUNO, base: E.base,
        canal: f.canal.value, resultado: f.resultado.value, obs: f.obs.value.trim(), fu_data: f.fu.value };
      try {
        const r2 = await chamar('registrar', { reg: reg });
        if (!r2.ok) throw new Error(r2.erro || 'Não foi possível registrar.');
        E.regs[reg.id] = Object.assign(reg, { atendente: eu().nome, criado: Date.now(), atualizado: Date.now(), fu_status: reg.fu_data ? 'pendente' : '' });
        aviso('Acionamento registrado.', 'ok');
        fecharModal(); atualizarContadorFu(); desenhar();
      } catch (e) {
        if (!e.auth) $('#ac-erro').textContent = e.message;
        btn.disabled = false; btn.textContent = 'Registrar acionamento';
      }
    };
  }

  /* ── importação de arquivo (NPS: exportação do Medallia), só pela Central de Bases ── */
  function telaImportar() {
    if (!CFG.importar) { $('#area').innerHTML = '<div class="carregando-base">Este sistema não tem importação própria.</div>'; return; }
    if (!eu().gestao) { $('#area').innerHTML = '<div class="carregando-base">Seu perfil não tem acesso à importação.</div>'; return; }
    const datas = E.alunos.map((r) => CFG.dataDe ? CFG.dataDe(r) : '').filter(Boolean).sort();
    $('#area').innerHTML = `<div class="painel importar-central">
      <h3>${esc(CFG.importar.rotulo)}</h3>
      <p>${esc(CFG.importar.ajuda || '')}</p>
      <p class="situacao">Hoje o sistema tem <b>${E.alunos.length.toLocaleString('pt-BR')}</b> ${unidade()}${datas.length ? `, de ${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}` : ''}.</p>
      <button class="btn primario" id="f-importar">${esc(CFG.importar.rotulo)}</button><input type="file" id="f-arquivo" accept=".xlsx,.xls,.csv" hidden>
    </div>`;
    $('#f-importar').onclick = () => $('#f-arquivo').click();
    $('#f-arquivo').onchange = (ev) => importarArquivo(ev.target.files[0]);
  }
  function carregarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, falha) => { const s2 = document.createElement('script'); s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s2.onload = ok; s2.onerror = () => falha(new Error('Não foi possível carregar o leitor de planilhas. Confira a internet.')); document.head.appendChild(s2); });
  }
  async function importarArquivo(arq) {
    if (!arq) return;
    const btn = $('#f-importar'); btn.disabled = true; btn.textContent = 'Lendo o arquivo...';
    try {
      await carregarXLSX();
      const wb = XLSX.read(await arq.arrayBuffer(), { type: 'array', cellDates: false });
      // raw: true mantém as datas como número do Excel (o sistema converte); raw: false gerava datas no formato americano
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      const respostas = CFG.importar.converter(linhas);
      if (!respostas.length) throw new Error(CFG.importar.erroFormato);
      let novas = 0, atualizadas = 0;
      for (let i = 0; i < respostas.length; i += 300) {
        btn.textContent = `Enviando ${Math.min(i + 300, respostas.length)} de ${respostas.length}...`;
        const r = await chamar('importar', { respostas: respostas.slice(i, i + 300) });
        if (!r || !r.ok) throw new Error((r && r.erro) || 'Falha ao enviar.');
        novas += r.novas; atualizadas += r.atualizadas;
      }
      aviso(`Importação concluída: ${novas} resposta(s) nova(s) e ${atualizadas} atualizada(s).`, 'ok');
      await carregarBase();
    } catch (e) {
      if (!e.auth) aviso(e.message, 'erro');
      if ($('#f-importar')) { $('#f-importar').disabled = false; $('#f-importar').textContent = CFG.importar.rotulo; }
    }
  }

  /* ── follow-up ── */
  function pendentes() {
    const nome = eu().nome;
    return Object.values(E.regs).filter((x) => x.fu_status === 'pendente' && x.fu_data && (!x.base || x.base === E.base) && (E.fuQuem === 'todos' || x.atendente === nome));
  }
  /* matrícula para mostrar (no NPS a chave é o ID da resposta, não a matrícula) */
  function matriculaDoReg(x) { const r = E.alunos.filter((a) => mat(a) === x.matricula)[0]; return r ? matVis(r) : x.matricula; }
  function atualizarContadorFu() { const n = pendentes().length; $('#cont-fu').textContent = n; }

  function telaFollowup() {
    const hoje = new Date().toISOString().slice(0, 10);
    const L = pendentes().sort((a, b) => String(a.fu_data).localeCompare(String(b.fu_data)));
    const grupos = [['Atrasados', L.filter((x) => x.fu_data < hoje), 'atrasado'], ['Hoje', L.filter((x) => x.fu_data === hoje), 'hoje'], ['Próximos', L.filter((x) => x.fu_data > hoje), '']];
    $('#area').innerHTML = `
      <div class="filtros">
        <select id="fu-quem"><option value="meus" ${E.fuQuem === 'meus' ? 'selected' : ''}>Meus follow-ups</option><option value="todos" ${E.fuQuem === 'todos' ? 'selected' : ''}>Toda a equipe</option></select>
        <span class="total">${L.length} pendente(s) · ${esc(nomeBase())}</span>
      </div>
      ${grupos.map(([t, lista, cls]) => `<div class="grupo-fu"><h3>${t} (${lista.length})</h3>${lista.map((x) => `
        <div class="fu ${cls}"><div><b>${esc(x.aluno || x.matricula)}</b> <small>${esc(matriculaDoReg(x))} · ${dataBR(x.fu_data)} · ${esc(x.atendente)}</small>
          <small>${esc(x.resultado)}: ${esc(x.obs)}</small></div>
          <button class="btn mini" data-abrir="${esc(x.matricula)}">Abrir aluno</button><button class="btn mini primario" data-feito="${esc(x.id)}">Concluir</button></div>`).join('') || '<p class="dica">Nada aqui.</p>'}</div>`).join('')}`;
    $('#fu-quem').onchange = (ev) => { E.fuQuem = ev.target.value; atualizarContadorFu(); telaFollowup(); };
    document.querySelectorAll('[data-abrir]').forEach((b) => { b.onclick = () => abrirAluno(b.dataset.abrir); });
    document.querySelectorAll('[data-feito]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await chamar('followup', { id: b.dataset.feito, status: 'feito' });
          if (!r.ok) throw new Error(r.erro);
          E.regs[b.dataset.feito].fu_status = 'feito';
          aviso('Follow-up concluído.', 'ok'); atualizarContadorFu(); telaFollowup();
        } catch (e) { if (!e.auth) aviso(e.message || 'Não foi possível concluir.', 'erro'); b.disabled = false; }
      };
    });
  }

  /* ── dashboard ── */
  function contar(lista, fn) { const c = {}; lista.forEach((x) => { const k = fn(x) || 'Não informado'; c[k] = (c[k] || 0) + 1; }); return c; }
  function barras(c, manterOrdem) {
    const max = Math.max(1, ...Object.values(c));
    return Object.keys(c).sort((a, b) => manterOrdem ? 0 : c[b] - c[a]).map((k) => `<div class="barra"><span>${esc(k)}</span><div class="trilho"><i style="width:${(c[k] / max * 100).toFixed(1)}%"></i></div><b>${c[k]}</b></div>`).join('') || '<p class="dica">Sem dados ainda.</p>';
  }
  function telaDashboard() {
    const mats = new Set(E.alunos.map(mat));
    const regs = Object.values(E.regs).filter((x) => mats.has(x.matricula) && (!x.base || x.base === E.base));
    const acionados = new Set(regs.map((x) => x.matricula));
    if (CFG.historicoEngajamento) E.alunos.forEach((r) => { const m = mat(r); if ((E.hist[m] || []).length) acionados.add(m); });
    const hoje = new Date().toISOString().slice(0, 10);
    const pend = regs.filter((x) => x.fu_status === 'pendente');
    const cobertura = E.alunos.length ? (acionados.size / E.alunos.length * 100) : 0;
    const dias = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); dias.push(d.toISOString().slice(0, 10)); }
    const porDia = contar(regs, (x) => new Date(x.criado).toISOString().slice(0, 10));
    const maxDia = Math.max(1, ...dias.map((d) => porDia[d] || 0));
    $('#area').innerHTML = `
      <div class="kpis">
        <div class="kpi"><span>${unidade()} no sistema</span><b>${E.alunos.length.toLocaleString('pt-BR')}</b><small>de ${E.todos.toLocaleString('pt-BR')} · ${esc(nomeBase())}</small></div>
        <div class="kpi"><span>${unidade()} ${CFG.feminino ? 'acionadas' : 'acionados'}</span><b>${acionados.size.toLocaleString('pt-BR')}</b><small>${cobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de cobertura</small></div>
        <div class="kpi"><span>Acionamentos</span><b>${regs.length.toLocaleString('pt-BR')}</b><small>${regs.filter((x) => new Date(x.criado).toISOString().slice(0, 10) === hoje).length} hoje</small></div>
        <div class="kpi"><span>Follow-ups pendentes</span><b>${pend.length}</b><small>${pend.filter((x) => x.fu_data < hoje).length} atrasado(s)</small></div>
        ${(CFG.indicadores || []).map((k) => { let v = ''; try { v = k.v(E.alunos, ctx()); } catch (e) {} return `<div class="kpi"><span>${esc(k.t)}</span><b style="font-size:${String(v).length > 12 ? 15 : 24}px">${esc(v)}</b></div>`; }).join('')}
      </div>
      ${CFG.dashboardExtra ? CFG.dashboardExtra(E.alunos, esc, barras, ctx()) : ''}
      <div class="duas">
        <div class="painel"><h2>Resultados dos contatos</h2>${barras(contar(regs, (x) => x.resultado))}</div>
        <div class="painel"><h2>Canais</h2>${barras(contar(regs, (x) => x.canal))}</div>
      </div>
      <div class="painel"><h2>Acionamentos nos últimos 14 dias</h2>
        <div class="dias">${dias.map((d) => { const n = porDia[d] || 0; return `<div><i style="height:${Math.round(n / maxDia * 100)}px"></i>${n}<br>${d.slice(8)}/${d.slice(5, 7)}</div>`; }).join('')}</div></div>`;
  }

  /* ── produtividade ── */
  function telaProdutividade() {
    const lim = E.periodo === 'tudo' ? 0 : (E.periodo === 'hoje' ? new Date(new Date().toDateString()).getTime() : Date.now() - Number(E.periodo) * 86400000);
    const regs = Object.values(E.regs).filter((x) => (!x.base || x.base === E.base) && x.criado >= lim);
    const porAt = {};
    const soma = (nome, mt, ms, origem, fu) => {
      if (!nome) return;
      const a = porAt[nome] = porAt[nome] || { n: 0, sis: 0, eng: 0, alunos: new Set(), fu: 0, ultimo: 0 };
      a.n++; a[origem]++; a.alunos.add(mt); if (fu) a.fu++; a.ultimo = Math.max(a.ultimo, ms);
    };
    regs.forEach((x) => soma(x.atendente, x.matricula, x.criado, 'sis', !!x.fu_data));
    // acionamentos feitos no Engajamento para os alunos deste sistema (como eram registrados antes)
    const usaEng = CFG.historicoEngajamento && E.comEngajamento;
    const motivos = new Set();
    if (CFG.historicoEngajamento) {
      E.alunos.forEach((r) => { const m = mat(r); (E.hist[m] || []).forEach((h) => {
        if (h.resultado) motivos.add(h.resultado);
        if (!usaEng || h.ms < lim || (E.motivo && h.resultado !== E.motivo)) return;
        soma(h.atend, m, h.ms, 'eng', false);
      }); });
    }
    const feitos = {};
    Object.values(E.regs).forEach((x) => { if (x.fu_status === 'feito' && x.atualizado >= lim && (!x.base || x.base === E.base)) feitos[x.quem_atualizou || x.atendente] = (feitos[x.quem_atualizou || x.atendente] || 0) + 1; });
    const nomes = Object.keys(porAt).concat(Object.keys(feitos)).filter((v, i, a) => v && a.indexOf(v) === i).sort((a, b) => ((porAt[b] || {}).n || 0) - ((porAt[a] || {}).n || 0));
    const vazio = { n: 0, sis: 0, eng: 0, alunos: new Set(), fu: 0, ultimo: 0 };
    $('#area').innerHTML = `
      <div class="filtros"><select id="per">
        ${[['hoje', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['tudo', 'Todo o período']].map(([v, t]) => `<option value="${v}" ${E.periodo === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      ${CFG.historicoEngajamento ? `<label class="rot"><input type="checkbox" id="com-eng" ${E.comEngajamento ? 'checked' : ''} style="width:auto;margin:0"> Incluir acionamentos feitos no Engajamento</label>
        <select id="motivo" ${E.comEngajamento ? '' : 'disabled'}><option value="">Todos os motivos (Engajamento)</option>${Array.from(motivos).sort().map((x) => `<option ${x === E.motivo ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
      <span class="total">${esc(nomeBase())}</span></div>
      <div class="painel"><table class="tabela"><thead><tr><th>Atendente</th><th>Acionamentos</th>${usaEng ? `<th>Em ${esc(CFG.nome)}</th><th>No Engajamento</th>` : ''}<th>Alunos diferentes</th><th>Follow-ups agendados</th><th>Follow-ups concluídos</th><th>Último registro</th></tr></thead>
      <tbody>${nomes.map((nm) => { const a = porAt[nm] || vazio; return `<tr><td><b>${esc(nm)}</b></td><td><b>${a.n}</b></td>${usaEng ? `<td>${a.sis}</td><td>${a.eng}</td>` : ''}<td>${a.alunos.size}</td><td>${a.fu}</td><td>${feitos[nm] || 0}</td><td>${a.ultimo ? dataCurta(a.ultimo) : ''}</td></tr>`; }).join('') || `<tr><td colspan="${usaEng ? 8 : 6}" class="vazio">Nenhum acionamento no período.</td></tr>`}</tbody></table></div>
      ${usaEng ? '<p class="dica">"No Engajamento" são os acionamentos registrados no EngajaVR (ou na tela original) para os alunos deste sistema.</p>' : ''}`;
    $('#per').onchange = (ev) => { E.periodo = ev.target.value; telaProdutividade(); };
    if ($('#com-eng')) { $('#com-eng').onchange = (ev) => { E.comEngajamento = ev.target.checked; telaProdutividade(); }; $('#motivo').onchange = (ev) => { E.motivo = ev.target.value; telaProdutividade(); }; }
  }

  /* ── tela original do EngajaVR (TCE, agendamento de provas, disparo em lote) ── */
  function telaOriginal() {
    $('#area').innerHTML = `<p class="dica">Tela do EngajaVR, mantida para os recursos que ela já tinha (marcações, disparo em lote, exportação). Base ${NOMES_BASE[E.base]}.</p>
      <iframe class="original" src="../engajamento/index.html?ferramenta=${CFG.original}&sistema=${SIS}&base=${E.base}&v=${JORNADA.versao}"></iframe>`;
  }

  /* ── utilidades ── */
  // sistemas com anoCurto (NPS) mostram as datas como dd/mm/aa
  function dataCurta(ms) { return ms ? new Date(ms).toLocaleString('pt-BR', CFG && CFG.anoCurto ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; }
  function dataAA(ms) { return ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; }
  function dataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${CFG && CFG.anoCurto ? m[1].slice(2) : m[1]}` : String(iso || ''); }
  function abrirModal(html) { $('#modal-corpo').innerHTML = html; $('#modal').hidden = false; document.querySelectorAll('#modal [data-fechar]').forEach((b) => { b.onclick = fecharModal; }); }
  function fecharModal() { $('#modal').hidden = true; $('#modal-corpo').innerHTML = ''; }

  /* ── início ── */
  function iniciar() {
    if (!CFG) { $('#area').innerHTML = '<div class="carregando-base">Sistema desconhecido.</div>'; return; }
    if (!Api.Sessao.ler()) { if (window.App) window.App.mostrarLogin('Entre novamente.'); return; }
    document.title = CFG.nome + ' · Jornada do Aluno';
    $('#titulo').textContent = CFG.icone + ' ' + CFG.nome;
    $('#subtitulo').textContent = CFG.subtitulo;
    $('#aba-original').hidden = !CFG.original;
    if (MODO_IMPORTAR) { $('#abas').style.display = 'none'; $('#sync').style.display = 'none'; }
    if (CFG.fonte) $('#bases').style.display = 'none';
    try { const b = localStorage.getItem('jornada_base_' + SIS); if (NOMES_BASE[b]) E.base = b; } catch (e) {}
    document.querySelectorAll('#abas button').forEach((b) => { b.onclick = () => { E.aba = b.dataset.aba; desenhar(); }; });
    document.querySelectorAll('#bases button').forEach((b) => {
      b.onclick = () => { if (b.dataset.base === E.base) return; E.base = b.dataset.base; try { localStorage.setItem('jornada_base_' + SIS, E.base); } catch (e) {} atualizarContadorFu(); carregarBase(); };
    });
    $('#modal').onclick = (ev) => { if (ev.target.id === 'modal') fecharModal(); };
    if (MODO_IMPORTAR) { carregarBase(); return; }
    // orientações de apoio do NAAP/NAE (selo na lista e quadro na ficha)
    Apoio.carregar().then((m) => { E.apoio = m; if (E.alunos.length && $('#modal').hidden) desenhar(); });
    carregarHistoricoEngajamento();
    sincronizar().then(carregarBase);
    setInterval(sincronizar, 45000);
  }
  window.Motor = { estado: E, abrirAluno, sincronizar };
  document.addEventListener('DOMContentLoaded', iniciar);
})();
