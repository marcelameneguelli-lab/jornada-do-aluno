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
