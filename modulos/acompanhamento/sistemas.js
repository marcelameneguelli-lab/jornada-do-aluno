/* Jornada do Aluno · configuração dos sistemas que usam o motor de acompanhamento.
 * Cada sistema diz quais alunos da base do Engajamento entram, que colunas mostrar,
 * quais filtros e resultados de contato usar e, quando houver, a ficha do aluno.
 * Regras de elegibilidade tiradas do EngajaVR (Provas, Estágio, Financeiro) e das
 * decisões de 20/11/2026 (Financiamentos).
 */
(function () {
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const pct = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
  const sim = (v) => ['1', 's', 'sim', 'true', 'yes'].indexOf(String(v == null ? '' : v).trim().toLowerCase()) >= 0;
  const txt = (v) => String(v == null ? '' : v).trim();
  const moeda = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (v) => { const t = txt(v); if (!t) return ''; const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : t.split(' ')[0]; };

  /* Financiamentos: programa do aluno (CLASSE_PAGANTE_SEMESTRE + colunas próprias de Ficou Fácil e Pravaler) */
  function programa(r) {
    const c = txt(r.CLASSE_PAGANTE_SEMESTRE).toUpperCase();
    if (['PROUNI', 'FIES', 'PRAVALER', 'PAR', 'BOLSISTA100'].indexOf(c) >= 0) return c === 'BOLSISTA100' ? 'BOLSISTA 100' : c;
    if (sim(r.BOLSA_FICOU_FACIL)) return 'FICOU FÁCIL';
    if (sim(r.BOLSA_PRV)) return 'PRAVALER';
    return '';
  }
  const MINIMO_APROVEITAMENTO = 75; // ProUni e FIES (editável aqui)
  const comRegra = (r) => ['PROUNI', 'FIES'].indexOf(programa(r)) >= 0;
  function abaixoDoMinimo(r) { const p = pct(r.PCT_APROVACAO_ANT); return comRegra(r) && p != null && p < MINIMO_APROVEITAMENTO; }

  const OPC_TERMO = ['', 'Pendente', 'Assinado', 'Não se aplica'];

  /* ── NPS (Medallia) ── */
  const META_NPS = 46.24; // meta de NPS Medallia do PEG 2026 (editável)
  const nota = (r) => { const n = parseFloat(String(r.nota == null ? '' : r.nota).replace(',', '.')); return isNaN(n) ? null : n; };
  const grupoNps = (r) => { const n = nota(r); return n == null ? '' : n >= 9 ? 'Promotor' : n >= 7 ? 'Neutro' : 'Detrator'; };
  const calcNps = (L) => { const v = L.map(nota).filter((n) => n != null); if (!v.length) return null; const p = v.filter((n) => n >= 9).length, d = v.filter((n) => n <= 6).length; return (p - d) / v.length * 100; };
  const fmtNps = (x) => x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const mes = (r) => txt(r.data_resposta).slice(0, 7);
  const nomeMes = (m) => { const [a, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1] + '/' + a; };
  const TEMAS = [['aprendizado', 'Aprendizado'], ['infraestrutura', 'Infraestrutura'], ['pagamento', 'Pagamento'], ['comunicacao', 'Comunicação']];
  const insatisfeito = (r) => TEMAS.filter(([k]) => txt(r['satisf_' + k]) === 'Não').map(([, t]) => t);

  /** Lê a exportação "Survey Export" do Medallia: acha a linha de cabeçalho e guarda só o que o sistema usa. */
  function converterMedallia(linhas) {
    const iCab = linhas.findIndex((l) => l.some((c) => String(c).trim() === 'ID da Pesquisa'));
    if (iCab < 0) return [];
    const cab = linhas[iCab].map((c) => String(c).trim());
    const col = (nome) => cab.indexOf(nome);
    const pega = (l, nome) => { const i = col(nome); return i < 0 ? '' : String(l[i] == null ? '' : l[i]).trim(); };
    const notaCols = cab.map((c, i) => [c, i]).filter(([c]) => /Probabilidade de recomendação/.test(c));
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    return linhas.slice(iCab + 1).filter((l) => pega(l, 'ID da Pesquisa') && pega(l, 'Matrícula')).map((l) => {
      const notaV = (notaCols.map(([, i]) => String(l[i] == null ? '' : l[i]).trim()).filter(Boolean)[0]) || '';
      const o = {
        id: pega(l, 'ID da Pesquisa').replace(/\.0$/, ''),
        matricula: pega(l, 'Matrícula').replace(/\.0$/, ''),
        NOM_ALUNO: pega(l, 'Nome Social') || pega(l, 'Nome'),
        NOM_CURSO: pega(l, 'Curso'), MODALIDADE_PP_PC: pega(l, 'Modalidade'),
        END_EMAIL: pega(l, 'Email do aluno'), NUM_TELEF_CELULAR: soDigitos(pega(l, 'Celular do aluno') || pega(l, 'Telefone do aluno')),
        campus: pega(l, 'Campus'), periodo: pega(l, 'Período vigente'), semestre: pega(l, 'Semestre par ou ímpar'),
        programa: pega(l, 'Programa de Pesquisa'), data_resposta: pega(l, 'Data de Resposta (Brasília)').slice(0, 16),
        nota: notaV.replace(/\.0$/, ''),
        motivo: pega(l, 'Driver da marca (Exp. Geral)'), motivo_outros: pega(l, 'Outros - Driver da marca (Exp. Geral)'),
        comentario: pega(l, 'Comentário - Marca (Exp. Geral)'), comentario_adicional: pega(l, 'Comentário adicional'),
        pretende_renovar: pega(l, 'Pretensão de Renovação (Exp. Geral)'),
        aceita_contato: pega(l, 'Aceitaria ser contatado'), contato_pref: pega(l, 'Telefone / email de preferência'),
        alerta_tipo: pega(l, 'Alert type'), alerta_status: pega(l, 'Status do alerta'),
        medallia_dor: pega(l, 'Quais foram as dores / problemas apontados pelo aluno?'),
        medallia_acao: pega(l, 'Qual foi a ação tomada / explicação dada para resolver a dor do aluno?'),
      };
      TEMAS.forEach(([k, t]) => {
        o['satisf_' + k] = pega(l, 'Satisfação - ' + t);
        o['driver_' + k] = [pega(l, 'Driver N1 - ' + t), pega(l, 'Driver N2 - ' + t), pega(l, 'Driver - ' + t), pega(l, 'Comentário - ' + t)].filter((x) => x && x !== '-').join(' · ');
      });
      Object.keys(o).forEach((k) => { if (typeof o[k] === 'string') o[k] = o[k].slice(0, 1500); });
      return o;
    });
  }


  window.SISTEMAS_ACOMP = {
    provas: {
      nome: 'Provas', icone: '📝', original: 'polo',
      subtitulo: 'Alunos com AV ou AVS no polo',
      elegivel: (r) => num(r.QTD_ELEGIVEL_AV_POLO) > 0 || num(r.QTD_ELEGIVEL_AVS_POLO) > 0,
      colunas: [
        { t: 'AV polo', v: (r) => num(r.QTD_ELEGIVEL_AV_POLO) || '' },
        { t: 'AVS polo', v: (r) => num(r.QTD_ELEGIVEL_AVS_POLO) || '' },
        { t: 'Falta agendar', v: (r) => [sim(r.FALTA_AGENDAR_AV) ? 'AV' : '', sim(r.FALTA_AGENDAR_AVS) ? 'AVS' : ''].filter(Boolean).join(' e ') },
        { t: 'Próxima prova', v: (r) => data(r.DT_PROXIMA_PROVA_AGENDADA) },
      ],
      filtros: [
        { id: 'falta', t: 'Falta agendar', f: (r) => sim(r.FALTA_AGENDAR_AV) || sim(r.FALTA_AGENDAR_AVS) },
        { id: 'av', t: 'Com AV no polo', f: (r) => num(r.QTD_ELEGIVEL_AV_POLO) > 0 },
        { id: 'avs', t: 'Com AVS no polo', f: (r) => num(r.QTD_ELEGIVEL_AVS_POLO) > 0 },
      ],
      indicadores: [
        { t: 'Falta agendar', v: (L) => L.filter((r) => sim(r.FALTA_AGENDAR_AV) || sim(r.FALTA_AGENDAR_AVS)).length },
        { t: 'Com AVS no polo', v: (L) => L.filter((r) => num(r.QTD_ELEGIVEL_AVS_POLO) > 0).length },
      ],
      resultados: ['Agendou', 'Vai agendar', 'Já fez a prova', 'Não vai fazer', 'Sem retorno', 'Número errado', 'Outro'],
    },

    estagio: {
      nome: 'Estágio', icone: '💼', original: 'estagio',
      subtitulo: 'Alunos elegíveis a estágio',
      elegivel: (r) => { const v = txt(r.QTD_ELEGIVEL_ESTAGIO || r.ELEGIVEL_ESTAGIO || r.IND_ESTAGIO).toUpperCase(); return !!v && ['0', 'N', 'NAO', 'NÃO'].indexOf(v) < 0; },
      colunas: [
        { t: 'Disciplinas de estágio', v: (r) => txt(r.QTD_ELEGIVEL_ESTAGIO) },
        { t: 'Período', v: (r) => txt(r.PERIODO || r.NUM_PERIODO || r.PERIODO_ATUAL) },
      ],
      filtros: [{ id: 'mais1', t: 'Mais de uma disciplina', f: (r) => num(r.QTD_ELEGIVEL_ESTAGIO) > 1 }],
      indicadores: [{ t: 'Mais de uma disciplina', v: (L) => L.filter((r) => num(r.QTD_ELEGIVEL_ESTAGIO) > 1).length }],
      resultados: ['Vai abrir TCE', 'TCE aberto', 'Documentos pendentes', 'Já estagia', 'Sem interesse', 'Sem retorno', 'Outro'],
    },

    financeiro: {
      nome: 'Financeiro', icone: '💰', original: 'financeiro',
      subtitulo: 'Alunos inadimplentes',
      elegivel: (r) => sim(r.INADIMPLENTE),
      colunas: [
        { t: 'Dívida', v: (r) => moeda(r.VAL_DIVIDA), ordem: (r) => num(r.VAL_DIVIDA) },
        { t: 'Faixa', v: (r) => txt(r.FAIXA_DIVIDA) },
        { t: 'Tipo', v: (r) => txt(r.TIPO_INADIMPLENCIA) },
        { t: 'Promessa', v: (r) => data(r.VENCIMENTO_PROMESSA) },
      ],
      filtros: [
        { id: 'alta', t: 'Dívida a partir de R$ 1.000', f: (r) => num(r.VAL_DIVIDA) >= 1000 },
        { id: 'promessa', t: 'Com promessa de pagamento', f: (r) => !!txt(r.VENCIMENTO_PROMESSA) },
      ],
      indicadores: [
        { t: 'Dívida total', v: (L) => moeda(L.reduce((s, r) => s + num(r.VAL_DIVIDA), 0)) },
        { t: 'Dívida a partir de R$ 1.000', v: (L) => L.filter((r) => num(r.VAL_DIVIDA) >= 1000).length },
      ],
      resultados: ['Prometeu pagar', 'Pagou', 'Quer negociar', 'Encaminhado ao financeiro', 'Sem retorno', 'Número errado', 'Outro'],
    },

    nps: {
      nome: 'NPS', icone: '⭐', original: '',
      subtitulo: 'Pesquisa Medallia: promotores (9 e 10), neutros (7 e 8) e detratores (0 a 6)',
      fonte: 'respostas', nomeFonte: 'respostas do Medallia', unidade: 'respostas', feminino: true,
      semDados: 'Nenhuma resposta importada ainda. Use "Importar arquivo do Medallia".',
      chave: (r) => r.id, matriculaVisivel: (r) => r.matricula,
      elegivel: (r) => nota(r) != null,
      ordenar: (a, b) => String(b.data_resposta).localeCompare(String(a.data_resposta)),
      importar: { rotulo: 'Importar arquivo do Medallia', converter: converterMedallia, erroFormato: 'Não encontrei a coluna "ID da Pesquisa". Use a exportação "Survey Export" do Medallia, sem alterar o arquivo.' },
      colunas: [
        { t: 'Resposta', v: (r) => data(r.data_resposta) },
        { t: 'Nota', v: (r) => nota(r) },
        { t: 'Grupo', v: grupoNps, alerta: (r) => grupoNps(r) === 'Detrator' },
        { t: 'Motivo', v: (r) => txt(r.motivo).slice(0, 45) },
        { t: 'Comentário', v: (r) => { const c = txt(r.comentario); return c.length > 60 ? c.slice(0, 60) + '…' : c; } },
        { t: 'Aceita contato', v: (r) => txt(r.aceita_contato) },
      ],
      filtroPrograma: mes, filtroProgramaRotulo: 'Todos os meses',
      filtros: [
        { id: 'det', t: 'Detratores (0 a 6)', f: (r) => grupoNps(r) === 'Detrator' },
        { id: 'neu', t: 'Neutros (7 e 8)', f: (r) => grupoNps(r) === 'Neutro' },
        { id: 'pro', t: 'Promotores (9 e 10)', f: (r) => grupoNps(r) === 'Promotor' },
        { id: 'insat', t: 'Insatisfeito em algum tema', f: (r) => insatisfeito(r).length > 0 },
        { id: 'naorenova', t: 'Não pretende renovar', f: (r) => txt(r.pretende_renovar) === 'Não' },
        { id: 'aceita', t: 'Aceita ser contatado', f: (r) => /^Sim/.test(txt(r.aceita_contato)) },
        { id: 'coment', t: 'Com comentário', f: (r) => txt(r.comentario).length > 2 },
      ],
      indicadores: [
        { t: 'NPS', v: (L) => fmtNps(calcNps(L)) + ' (meta ' + META_NPS.toLocaleString('pt-BR') + ')' },
        { t: 'Promotores · Neutros · Detratores', v: (L) => ['Promotor', 'Neutro', 'Detrator'].map((g) => L.filter((r) => grupoNps(r) === g).length).join(' · ') },
      ],
      dashboardExtra: (L, esc, barras) => {
        const meses = Array.from(new Set(L.map(mes).filter(Boolean))).sort();
        const linha = (rot, G) => { const v = calcNps(G); return `<tr><td>${esc(rot)}</td><td>${G.length}</td><td>${['Promotor', 'Neutro', 'Detrator'].map((g) => G.filter((r) => grupoNps(r) === g).length).join(' · ')}</td><td class="${v != null && v < META_NPS ? 'alerta' : ''}"><b>${fmtNps(v)}</b></td></tr>`; };
        const mods = Array.from(new Set(L.map((r) => txt(r.MODALIDADE_PP_PC)).filter(Boolean))).sort();
        const motivosDet = {}; L.filter((r) => grupoNps(r) === 'Detrator').forEach((r) => { const k = txt(r.motivo) || 'Não informado'; motivosDet[k] = (motivosDet[k] || 0) + 1; });
        const temas = {}; L.forEach((r) => insatisfeito(r).forEach((t) => { temas[t] = (temas[t] || 0) + 1; }));
        const cab = '<thead><tr><th></th><th>Respostas</th><th>P · N · D</th><th>NPS</th></tr></thead>';
        return `<div class="duas">
          <div class="painel"><h2>NPS por mês</h2><table class="tabela">${cab}<tbody>${meses.map((m) => linha(nomeMes(m), L.filter((r) => mes(r) === m))).join('')}${linha('Total', L)}</tbody></table></div>
          <div class="painel"><h2>NPS por modalidade</h2><table class="tabela">${cab}<tbody>${mods.map((m) => linha(m, L.filter((r) => txt(r.MODALIDADE_PP_PC) === m))).join('')}</tbody></table></div>
        </div>
        <div class="duas">
          <div class="painel"><h2>Motivos citados pelos detratores</h2>${barras(motivosDet)}</div>
          <div class="painel"><h2>Insatisfação por tema</h2>${barras(temas)}</div>
        </div>`;
      },
      detalhe: (r, esc) => {
        const blocos = [];
        blocos.push(`<div><span>Nota</span><b>${esc(nota(r))}</b> · ${esc(grupoNps(r))} · ${esc(data(r.data_resposta))}</div>`);
        if (txt(r.motivo)) blocos.push(`<div><span>Motivo principal</span>${esc(r.motivo)}${r.motivo_outros ? ' (' + esc(r.motivo_outros) + ')' : ''}</div>`);
        if (txt(r.comentario)) blocos.push(`<div><span>Comentário</span>${esc(r.comentario)}</div>`);
        TEMAS.forEach(([k, t]) => { if (txt(r['satisf_' + k])) blocos.push(`<div><span>${t}: ${r['satisf_' + k] === 'Sim' ? 'satisfeito' : 'insatisfeito'}</span>${esc(r['driver_' + k])}</div>`); });
        if (txt(r.pretende_renovar)) blocos.push(`<div><span>Pretende renovar</span>${esc(r.pretende_renovar)}</div>`);
        if (txt(r.comentario_adicional) && r.comentario_adicional !== '-') blocos.push(`<div><span>Comentário adicional</span>${esc(r.comentario_adicional)}</div>`);
        if (txt(r.aceita_contato)) blocos.push(`<div><span>Aceita contato</span>${esc(r.aceita_contato)} ${esc(r.contato_pref)}</div>`);
        if (txt(r.alerta_tipo)) blocos.push(`<div><span>Alerta Medallia</span>${esc(r.alerta_tipo)} (${esc(r.alerta_status)})</div>`);
        if (txt(r.medallia_acao)) blocos.push(`<div><span>Tratativa registrada no Medallia</span>${esc(r.medallia_dor)}<br>${esc(r.medallia_acao)}</div>`);
        return `<div class="secao">Resposta da pesquisa</div><div class="hist">${blocos.join('')}</div>`;
      },
      ficha: () => [
        { id: 'tema', t: 'Tema da dor', opcoes: ['', 'Ensino e professores', 'Infraestrutura', 'Financeiro', 'Comunicação', 'Atendimento', 'Plataformas digitais', 'Outro'] },
        { id: 'situacao', t: 'Situação do caso', opcoes: ['', 'Aberto', 'Em tratamento', 'Resolvido', 'Sem solução', 'Aluno não quis contato'] },
      ],
      resultados: ['Dor resolvida', 'Orientado, sem solução', 'Encaminhado à coordenação', 'Encaminhado ao financeiro', 'Agradecimento (promotor)', 'Convite para indicar ou depoimento', 'Sem retorno', 'Não quer contato', 'Outro'],
    },

    financiamentos: {
      nome: 'Financiamentos', icone: '🏦', original: '',
      subtitulo: 'ProUni, FIES, Pravaler, Ficou Fácil, PAR e Bolsista 100',
      elegivel: (r) => !!programa(r),
      colunas: [
        { t: 'Programa', v: (r) => programa(r) },
        { t: 'Aprovação sem. anterior', v: (r) => { const p = pct(r.PCT_APROVACAO_ANT); return p == null ? (comRegra(r) ? 'sem informação' : '') : p.toLocaleString('pt-BR') + '%'; },
          alerta: (r) => abaixoDoMinimo(r) },
        { t: 'Aproveitamento atual', v: (r) => txt(r.FAIXA_APROVEITAMENTO || r.APROVEITAMENTO_ACADEMICO_ATUAL) },
      ],
      filtroPrograma: programa,
      filtros: [
        { id: 'abaixo', t: `Abaixo de ${MINIMO_APROVEITAMENTO}% (ProUni e FIES)`, f: abaixoDoMinimo },
        { id: 'seminfo', t: 'ProUni e FIES sem informação de aprovação', f: (r) => comRegra(r) && pct(r.PCT_APROVACAO_ANT) == null },
        { id: 'pendente', t: 'Com termo pendente', f: (r, ficha) => Object.keys(ficha || {}).some((k) => k.indexOf('termo_') === 0 && ficha[k] === 'Pendente') },
      ],
      indicadores: [
        { t: `Abaixo de ${MINIMO_APROVEITAMENTO}%`, v: (L) => L.filter(abaixoDoMinimo).length },
        { t: 'Por programa', v: (L) => { const c = {}; L.forEach((r) => { const p = programa(r); c[p] = (c[p] || 0) + 1; }); return Object.keys(c).sort().map((k) => `${k}: ${c[k]}`).join(' · '); } },
      ],
      /* Ficha do aluno: o que o atendente marca (decisões de 20/11/2026) */
      ficha: (r) => {
        const p = programa(r), campos = [];
        if (['PROUNI', 'FIES', 'BOLSISTA 100'].indexOf(p) >= 0) campos.push({ id: 'bolsa', t: 'Tipo de bolsa', opcoes: ['', 'Integral', 'Parcial'] });
        if (p === 'FIES') {
          campos.push({ id: 'termo_aditamento', t: 'Aditamento do semestre', opcoes: OPC_TERMO });
          campos.push({ id: 'termo_suspensao', t: 'Suspensão do semestre', opcoes: OPC_TERMO });
        }
        if (p === 'PROUNI') {
          campos.push({ id: 'termo_atualizacao', t: 'Termo de atualização', opcoes: OPC_TERMO });
          campos.push({ id: 'termo_reconsideracao', t: 'Termo de reconsideração', opcoes: OPC_TERMO });
          campos.push({ id: 'termo_encerramento', t: 'Termo de encerramento', opcoes: OPC_TERMO });
        }
        if (p === 'PRAVALER' || p === 'FICOU FÁCIL') campos.push({ id: 'renovou_programa', t: 'Renovou com o programa', opcoes: ['Não informado', 'Sim', 'Não'] });
        return campos;
      },
      resultados: ['Orientado', 'Termo assinado', 'Pendência de documento', 'Renovou com o programa', 'Sem retorno', 'Outro'],
    },
  };
})();
