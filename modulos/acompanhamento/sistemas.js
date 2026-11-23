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
  /* Datas do Medallia → "aaaa-mm-dd hh:mm". Aceita o número de data do Excel, texto ISO
     e o formato americano m/d/aa (como o leitor de planilhas mostrava antes da correção). */
  const p2 = (n) => String(n).padStart(2, '0');
  function isoDe(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
      const n = Number(v), dias = Math.floor(n), ms = Math.round((n - dias) * 86400000);
      const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000 + ms);
      return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
    }
    const t = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 16);
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) { const ano = m[3].length === 2 ? '20' + m[3] : m[3]; return `${ano}-${p2(m[1])}-${p2(m[2])}` + (m[4] ? ` ${p2(m[4])}:${m[5]}` : ''); }
    return t;
  }
  /* dd/mm/aa (NPS) */
  const dataAA = (v) => { const t = isoDe(v); const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : t.split(' ')[0]; };

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

  /* ── Estágio: relatório do BI (uma linha por aluno e disciplina) ── */
  const NOME_TCE = { nao_iniciado: 'Sem TCE', andamento: 'Em andamento', indeferido: 'Indeferido', deferido: 'Deferido' };
  const ORD_TCE = { nao_iniciado: 0, indeferido: 1, andamento: 2, deferido: 3 };
  const seloTce = (t) => `<span class="sit ${({ nao_iniciado: 'falta', andamento: 'agendou', indeferido: 'faltou', deferido: 'fez' })[t] || 'na'}">${NOME_TCE[t] || t || '—'}</span>`;
  function tceDe(v) {
    const t = txt(v).toUpperCase();
    if (t.indexOf('DEFERIDO') === 0) return 'deferido';
    if (t.indexOf('INDEFERIDO') >= 0) return 'indeferido';
    if (t.indexOf('ANDAMENTO') >= 0) return 'andamento';
    return 'nao_iniciado';
  }
  function converterEstagioBI(linhas) {
    const iCab = linhas.findIndex((l) => l.some((c) => String(c).trim() === 'Matrícula') && l.some((c) => String(c).trim() === 'Possui TCE?'));
    if (iCab < 0) return [];
    const cab = linhas[iCab].map((c) => String(c).trim());
    const pega = (l, nome) => { const i = cab.indexOf(nome); return i < 0 ? '' : String(l[i] == null ? '' : l[i]).replace(/\.0$/, '').trim(); };
    const dt = (l, nome) => { const i = cab.indexOf(nome); return i < 0 ? '' : isoDe(l[i]).slice(0, 10); };
    const alunos = {};
    linhas.slice(iCab + 1).forEach((l) => {
      const mat = pega(l, 'Matrícula');
      if (!/^\d{6,}$/.test(mat)) return; // ignora a linha "Filtros aplicados" do BI
      const d = { disc: pega(l, 'Disciplina'), cod: pega(l, 'Codigo_Disciplina'), curso: pega(l, 'Curso'), turma: pega(l, 'Turma'),
        tce: tceDe(pega(l, 'Possui TCE?')), tceTxt: pega(l, 'Possui TCE?'), prazo: pega(l, 'Prazo TCE vencido?'), protocolo: pega(l, 'Protocolo'),
        limTCE: dt(l, 'Data Limite Abertura TCE'), limCampo: dt(l, 'Data Limite Entrada Campo'), aula1: dt(l, 'Data Primeira Aula'),
        docs: pega(l, 'Entregou a Documentação?'), indevido: /^sim/i.test(pega(l, 'Matriculado Indevidamente')), vezes: pega(l, 'QTD_VEZES_MATRICULADO'),
        enade: /^sim/i.test(pega(l, 'Disciplina ENADE')), ch: pega(l, 'CH_TOTAL'), hEst: pega(l, 'QTD_HORAS_ESTAGIO'),
        professor: pega(l, 'Professor'), preceptor: pega(l, 'Preceptor'), status: pega(l, 'Status Final'), nota: pega(l, 'Nota Final'),
        entrada: pega(l, 'Entrada'), produto: pega(l, 'Produto'), alocacao: pega(l, 'Tempo Alocacao') };
      const a = alunos[mat] = alunos[mat] || { COD_MATRICULA: mat, NOM_CURSO: d.curso, MODALIDADE_PP_PC: d.produto, entrada: d.entrada, disciplinas: [] };
      a.disciplinas.push(d);
    });
    const hoje = hojeISO();
    return Object.values(alunos).map((a) => {
      const validas = a.disciplinas.filter((d) => !d.indevido);
      const base = validas.length ? validas : a.disciplinas;
      a.tce = base.reduce((m, d) => (ORD_TCE[d.tce] < ORD_TCE[m] ? d.tce : m), 'deferido');
      const pend = base.filter((d) => d.tce !== 'deferido');
      a.foraPrazo = pend.some((d) => d.prazo === 'Fora do Prazo' || (d.limTCE && d.limTCE < hoje));
      a.limite = pend.map((d) => d.limTCE).filter(Boolean).sort()[0] || '';
      a.docsPend = base.some((d) => d.tce === 'deferido' && /^n/i.test(d.docs));
      a.indevido = a.disciplinas.filter((d) => d.indevido).length;
      a.enade = a.disciplinas.some((d) => d.enade);
      a.recursando = a.disciplinas.some((d) => Number(d.vezes) > 1);
      a.importadoEm = hoje;
      return a;
    });
  }

  /* matrícula sem ".0" e só com números (chave dos registros do EngajaVR) */
  const mat9 = (r) => String(r.COD_MATRICULA == null ? '' : r.COD_MATRICULA).replace(/\.0$/, '').replace(/\D/g, '');
  /* vencimento da parcela, como no EngajaVR: DATA_VENCIMENTO, promessa ou dia de vencimento do mês atual */
  function vencimento(r) {
    const raw = txt(r.DATA_VENCIMENTO || r.VENCIMENTO_PROMESSA || r.DAT_LIMITE_RENOVACAO);
    if (!raw) { const dia = parseInt(r.NUM_DIA_VENCTO, 10); if (dia >= 1 && dia <= 31) { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(dia)}`; } return ''; }
    let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
  }

  /* ── Provas no polo (colunas da base líquida, como no EngajaVR) ── */
  const T = (t) => (t === 'avs' ? 'AVS' : 'AV');
  const ead = (r) => txt(r.MODALIDADE_PP_PC || r.MODALIDADE).toUpperCase() === 'EAD';
  const NOME_SIT = { falta: 'Falta agendar', faltou: 'Faltou', agendou: 'Agendou', fez: 'Fez as provas', na: 'Sem informação' };
  function sitProva(r, t) {
    const st = txt(r[`STATUS_AGEND_${T(t)}`]).toUpperCase();
    if (st.indexOf('FEZ') >= 0 || st === 'COMPARECEU' || st === 'REALIZADO') return 'fez';
    if (st.indexOf('FALTOU') === 0) return 'faltou'; // faltou à prova agendada: precisa reagendar
    if (st.indexOf('FALTA AGENDAR') === 0 || sim(r[`FALTA_AGENDAR_${T(t)}`])) return 'falta';
    if (st.indexOf('AGEND') >= 0 || st === 'CONFIRMADO') return 'agendou';
    return 'na';
  }
  /* Quantidade de disciplinas que falta agendar: vem do texto do status ("FALTA AGENDAR 2 DISCIPLINAS").
     "MAIS DE 3": se o aluno ainda não agendou nenhuma (adesão 0%), é o total de disciplinas no polo. */
  function faltaNum(r, t) {
    if (sitProva(r, t) !== 'falta') return 0;
    const st = txt(r[`STATUS_AGEND_${T(t)}`]).toUpperCase(), qtd = num(r[`QTD_ELEGIVEL_${T(t)}_POLO`]);
    const nada = txt(r[`ADESAO_${T(t)}_DISC_ONLINE_POLO`]) === '0%';
    if (st.indexOf('MAIS DE') >= 0) return nada && qtd > 3 ? qtd : 4;
    const m = st.match(/(\d+)\s+DISCIPLINA/);
    if (m) return Number(m[1]);
    return nada ? qtd : 1;
  }
  function faltaTexto(r, t) {
    if (sitProva(r, t) === 'faltou') { const m = txt(r[`STATUS_AGEND_${T(t)}`]).match(/(\d+)\s+DISCIPLINA/i); return m ? `faltou em ${m[1]} (reagendar)` : 'faltou (reagendar)'; }
    if (sitProva(r, t) !== 'falta') return '';
    const st = txt(r[`STATUS_AGEND_${T(t)}`]).toUpperCase(), n = faltaNum(r, t);
    if (st.indexOf('MAIS DE') >= 0 && txt(r[`ADESAO_${T(t)}_DISC_ONLINE_POLO`]) !== '0%') return 'mais de 3 disciplinas';
    return n + (n === 1 ? ' disciplina' : ' disciplinas');
  }
  const FAIXAS = ['1 disciplina', '2 disciplinas', '3 disciplinas', 'mais de 3 disciplinas'];
  const faltaFaixa = (r, t) => { const n = faltaNum(r, t); return n > 3 ? FAIXAS[3] : FAIXAS[Math.max(n, 1) - 1]; };
  /* DT_PROXIMA_PROVA_AGENDADA vem como dd-mm-aaaa (ou dd/mm/aaaa, ou aaaa-mm-dd) */
  function isoProva(r) {
    const t = txt(r.DT_PROXIMA_PROVA_AGENDADA).split(' ')[0].split('T')[0];
    let m = t.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/); if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
    m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/); if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}`;
    return '';
  }
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const emDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const contarPor = (L, fn) => { const c = {}; L.forEach((r) => { const k = fn(r); if (k) c[k] = (c[k] || 0) + 1; }); return c; };
  const ordenar = (c, ordem) => { const o = {}; ordem.forEach((k) => { if (c[k]) o[k] = c[k]; }); return o; };

  /* ── NPS (Medallia) ── */
  const META_NPS = 46.24; // meta de NPS Medallia do PEG 2026 (editável)
  const nota = (r) => { const n = parseFloat(String(r.nota == null ? '' : r.nota).replace(',', '.')); return isNaN(n) ? null : n; };
  const grupoNps = (r) => { const n = nota(r); return n == null ? '' : n >= 9 ? 'Promotor' : n >= 7 ? 'Neutro' : 'Detrator'; };
  const calcNps = (L) => { const v = L.map(nota).filter((n) => n != null); if (!v.length) return null; const p = v.filter((n) => n >= 9).length, d = v.filter((n) => n <= 6).length; return (p - d) / v.length * 100; };
  const fmtNps = (x) => x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const mes = (r) => isoDe(r.data_resposta).slice(0, 7);
  const nomeMes = (m) => { const [a, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1] + '/' + a; };
  const TEMAS = [['aprendizado', 'Aprendizado'], ['infraestrutura', 'Infraestrutura'], ['pagamento', 'Pagamento'], ['comunicacao', 'Comunicação']];
  const insatisfeito = (r) => TEMAS.filter(([k]) => txt(r['satisf_' + k]) === 'Não').map(([, t]) => t);

  /** Lê a exportação "Survey Export" do Medallia: acha a linha de cabeçalho e guarda só o que o sistema usa. */
  function converterMedallia(linhas) {
    const iCab = linhas.findIndex((l) => l.some((c) => String(c).trim() === 'ID da Pesquisa'));
    if (iCab < 0) return [];
    const cab = linhas[iCab].map((c) => String(c).trim());
    const col = (nome) => cab.indexOf(nome);
    const valor = (l, nome) => { const i = col(nome); return i < 0 ? '' : l[i]; };
    const pega = (l, nome) => { const v = valor(l, nome); return String(v == null ? '' : v).replace(/\.0$/, '').trim(); };
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
        programa: pega(l, 'Programa de Pesquisa'), data_resposta: isoDe(valor(l, 'Data de Resposta (Brasília)')),
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
      nome: 'Provas', icone: '📝', historicoEngajamento: true,
      subtitulo: 'Alunos com AV ou AVS no polo: agendamento e acompanhamento',
      elegivel: (r) => num(r.QTD_ELEGIVEL_AV_POLO) > 0 || num(r.QTD_ELEGIVEL_AVS_POLO) > 0,
      // como no sistema antigo: a tela mostra AV ou AVS (Tipo de prova)
      seletor: { rotulo: 'Prova', opcoes: [['av', 'AV no polo'], ['avs', 'AVS no polo']], filtra: (r, t) => num(r[`QTD_ELEGIVEL_${T(t)}_POLO`]) > 0 },
      rotuloTotal: 'Total elegíveis',
      colunas: [
        { t: 'Disciplinas no polo', v: (r, c) => { const p = num(r[`QTD_ELEGIVEL_${T(c.tipo)}_POLO`]), casa = num(r[`QTD_ELEGIVEL_${T(c.tipo)}_CASA`]); return (p || '') + (casa ? ` (+${casa} em casa)` : ''); } },
        { t: 'Situação', html: true, v: (r, c) => { const s = sitProva(r, c.tipo); return `<span class="sit ${s}">${NOME_SIT[s]}</span>`; } },
        { t: 'Falta agendar', v: (r, c) => faltaTexto(r, c.tipo) },
        { t: 'Adesão', v: (r, c) => txt(r[`ADESAO_${T(c.tipo)}_DISC_ONLINE_POLO`]).replace('N/A', '') },
        { t: 'Próxima prova', v: (r) => dataAA(isoProva(r)) },
        { t: 'Observação', v: (r, c) => c.extra(r).obs || '' },
      ],
      // observação por aluno e por prova (AV ou AVS), no mesmo lugar da tela antiga
      extras: {
        ler: 'loadPoloData', chave: (r, c) => `${mat9(r)}:${c.tipo || 'av'}`,
        titulo: (c) => `Acompanhamento da ${T(c.tipo)} no polo`,
        campos: [{ id: 'obs', t: 'Observação', tipo: 'texto', dica: 'Ex.: vai agendar na sexta; pediu outro polo' }],
      },
      lote: {
        assunto: 'Agendamento de provas no polo',
        resultado: 'Mensagem enviada (provas)',
        vars: (r, c) => ({ prova: T(c.tipo), disciplinas: String(faltaNum(r, c.tipo) || num(r[`QTD_ELEGIVEL_${T(c.tipo)}_POLO`]) || ''), data: dataAA(isoProva(r)) }),
        modelos: {
          WhatsApp: (c) => `Olá, {nome}! Aqui é {atendente}, da Secretaria Acadêmica da Estácio Volta Redonda.\nVocê ainda precisa agendar {disciplinas} disciplina(s) da ${T(c.tipo)} no polo. Agende pelo SIA o quanto antes para garantir data e horário.\nQualquer dúvida, é só responder esta mensagem.`,
          'E-mail': (c) => `Olá, {nome}!\n\nIdentificamos que você ainda precisa agendar {disciplinas} disciplina(s) da ${T(c.tipo)} no polo, no curso {curso}. Faça o agendamento pelo SIA o quanto antes para garantir data e horário.\n\nEstamos à disposição.\n{atendente}\nSecretaria Acadêmica · Estácio Volta Redonda`,
        },
      },
      filtros: [
        { id: 'falta', t: 'Falta agendar', card: true, cor: 'amarelo', f: (r, fi, c) => sitProva(r, c.tipo) === 'falta' },
        { id: 'faltou', t: 'Faltou', card: true, cor: 'vermelho', f: (r, fi, c) => sitProva(r, c.tipo) === 'faltou' },
        { id: 'agendou', t: 'Agendou', card: true, cor: 'azul', f: (r, fi, c) => sitProva(r, c.tipo) === 'agendou' },
        { id: 'fez', t: 'Fez as provas', card: true, cor: 'verde', f: (r, fi, c) => sitProva(r, c.tipo) === 'fez' },
        { id: 'ead', t: 'EAD', card: true, cor: 'cinza', f: (r) => ead(r) },
        { id: 'pres', t: 'Presencial/Semi', card: true, cor: 'laranja', f: (r) => !ead(r) },
        { id: 'mais3', t: 'Falta agendar mais de 3 disciplinas', f: (r, fi, c) => sitProva(r, c.tipo) === 'falta' && faltaNum(r, c.tipo) > 3 },
        { id: 'prox7', t: 'Prova nos próximos 7 dias', f: (r) => { const d = isoProva(r); return d && d >= hojeISO() && d <= emDias(7); } },
        { id: 'falta_sem_ac', t: 'Falta agendar e sem acionamento', f: (r, fi, c) => sitProva(r, c.tipo) === 'falta' && !c.ultimo(r) },
      ],
      filtroData: { t: 'Próxima prova', v: (r) => isoProva(r) },
      dashboardExtra: (L, esc, barras, c) => {
        const bloco = (t) => {
          const el = L.filter((r) => num(r[`QTD_ELEGIVEL_${T(t)}_POLO`]) > 0);
          const por = { falta: 0, faltou: 0, agendou: 0, fez: 0, na: 0 }; let disc = 0, semAc = 0;
          el.forEach((r) => { const s = sitProva(r, t); por[s]++; if (s === 'falta') { disc += faltaNum(r, t); if (!c.ultimo(r)) semAc++; } });
          const pctOk = el.length ? ((por.agendou + por.fez) / el.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0';
          return `<div class="painel"><h2>${T(t)} no polo · ${el.length.toLocaleString('pt-BR')} elegíveis</h2>
            <div class="kpis" style="margin-bottom:8px">
              <div class="kpi"><span>Falta agendar</span><b>${por.falta.toLocaleString('pt-BR')}</b><small>${disc.toLocaleString('pt-BR')} disciplina(s) a agendar</small></div>
              <div class="kpi"><span>Faltou (reagendar)</span><b>${por.faltou.toLocaleString('pt-BR')}</b></div>
              <div class="kpi"><span>Agendou</span><b>${por.agendou.toLocaleString('pt-BR')}</b></div>
              <div class="kpi"><span>Fez as provas</span><b>${por.fez.toLocaleString('pt-BR')}</b></div>
              <div class="kpi"><span>Agendou ou fez</span><b>${pctOk}%</b></div>
              <div class="kpi"><span>Falta agendar sem acionamento</span><b>${semAc.toLocaleString('pt-BR')}</b></div>
            </div>
            <h2>Falta agendar por quantidade de disciplinas</h2>${barras(ordenar(contarPor(el.filter((r) => sitProva(r, t) === 'falta'), (r) => faltaFaixa(r, t)), FAIXAS), true)}</div>`;
        };
        const dias = []; for (let i = 0; i < 14; i++) dias.push(emDias(i));
        const porDia = {}; dias.forEach((d) => { porDia[dataAA(d)] = 0; });
        L.forEach((r) => { const d = isoProva(r); if (d && porDia[dataAA(d)] != null) porDia[dataAA(d)]++; });
        const faltaTipo = L.filter((r) => c.tipo && num(r[`QTD_ELEGIVEL_${T(c.tipo)}_POLO`]) > 0 && sitProva(r, c.tipo) === 'falta');
        const topCursos = contarPor(faltaTipo, (r) => txt(r.NOM_CURSO));
        const top = {}; Object.keys(topCursos).sort((a, b) => topCursos[b] - topCursos[a]).slice(0, 10).forEach((k) => { top[k] = topCursos[k]; });
        return `<div class="duas">${bloco('av')}${bloco('avs')}</div>
          <div class="duas">
            <div class="painel"><h2>Provas agendadas nos próximos 14 dias</h2>${barras(porDia, true)}</div>
            <div class="painel"><h2>Cursos com mais alunos faltando agendar (${T(c.tipo)})</h2>${barras(top)}</div>
          </div>
          <div class="painel"><h2>Falta agendar ${T(c.tipo)} por modalidade</h2>${barras(contarPor(faltaTipo, (r) => txt(r.MODALIDADE_PP_PC) || 'Não informado'))}</div>`;
      },
      resultados: ['Agendou', 'Vai agendar', 'Já fez a prova', 'Não vai fazer', 'Sem retorno', 'Número errado', 'Outro'],
    },

    estagio: {
      nome: 'Estágio', icone: '💼',
      subtitulo: 'Relatório do BI: TCE, prazos e documentação das disciplinas de estágio',
      fonte: 'bi', nomeFonte: 'relatório do BI', unidade: 'alunos',
      semDados: 'Nenhum relatório do BI importado ainda. A coordenação importa na Central de Bases.',
      elegivel: () => true,
      rotuloTotal: 'Alunos em estágio',
      ordenar: (a, b) => (ORD_TCE[a.tce] - ORD_TCE[b.tce]) || String(a.limite || '9').localeCompare(String(b.limite || '9')),
      importar: { rotulo: 'Importar relatório do BI', converter: converterEstagioBI,
        ajuda: 'Use a exportação do BI de estágio (uma linha por aluno e disciplina), sem alterar o arquivo. A lista do sistema passa a ser a do arquivo; os acionamentos e follow-ups registrados são mantidos, e o sistema mostra quem mudou de situação no TCE desde a importação anterior.',
        erroFormato: 'Não encontrei as colunas "Matrícula" e "Possui TCE?". Use a exportação do BI de estágio, sem alterar o arquivo.',
        resumo: (r) => `Relatório importado: ${r.total} aluno(s), ${r.novas} novo(s), ${r.mudaram} com mudança no TCE${r.sairam ? ' e ' + r.sairam + ' que saíram da lista' : ''}.` },
      colunas: [
        { t: 'Disciplinas', v: (r) => (r.disciplinas || []).length },
        { t: 'TCE', html: true, v: (r) => seloTce(r.tce) + (r.mudou ? `<br><small class="origem">antes: ${NOME_TCE[r.mudou.de] || r.mudou.de}</small>` : '') },
        { t: 'Prazo do TCE', v: (r) => (r.tce === 'deferido' ? '' : (r.foraPrazo ? 'vencido ' : '') + data(r.limite)), alerta: (r) => r.tce !== 'deferido' && r.foraPrazo },
        { t: 'Documentação', v: (r) => (r.tce === 'deferido' ? (r.docsPend ? 'pendente' : 'entregue') : ''), alerta: (r) => r.tce === 'deferido' && r.docsPend },
        { t: 'Atenção', v: (r) => [r.indevido ? 'matrícula indevida' : '', r.enade ? 'ENADE' : '', r.recursando ? 'recursando' : ''].filter(Boolean).join(' · ') },
      ],
      filtroPrograma: (r) => txt(r.NOM_CURSO), filtroProgramaRotulo: 'Todos os cursos',
      filtros: [
        { id: 'nao_fora', t: 'Sem TCE · prazo vencido', card: true, cor: 'vermelho', f: (r) => r.tce === 'nao_iniciado' && r.foraPrazo },
        { id: 'nao_dentro', t: 'Sem TCE · no prazo', card: true, cor: 'amarelo', f: (r) => r.tce === 'nao_iniciado' && !r.foraPrazo },
        { id: 'andamento', t: 'TCE em andamento', card: true, cor: 'azul', f: (r) => r.tce === 'andamento' },
        { id: 'indeferido', t: 'TCE indeferido', card: true, cor: 'laranja', f: (r) => r.tce === 'indeferido' },
        { id: 'docs', t: 'Deferido · documentação pendente', card: true, cor: 'laranja', f: (r) => r.tce === 'deferido' && r.docsPend },
        { id: 'ok', t: 'Deferido · documentação entregue', card: true, cor: 'verde', f: (r) => r.tce === 'deferido' && !r.docsPend },
        { id: 'prazo7', t: 'Prazo do TCE nos próximos 7 dias', f: (r) => r.tce !== 'deferido' && !!r.limite && r.limite >= hojeISO() && r.limite <= emDias(7) },
        { id: 'indevido', t: 'Matrícula indevida em disciplina', card: true, cor: 'cinza', f: (r) => !!r.indevido },
        { id: 'mudou', t: 'TCE mudou na última importação', f: (r) => !!r.mudou && r.mudou.em === r.importadoEm },
        { id: 'enade', t: 'Disciplina de ENADE', f: (r) => !!r.enade },
        { id: 'recursando', t: 'Recursando a disciplina', f: (r) => !!r.recursando },
        { id: 'semnome', t: 'Sem nome (não está na base líquida)', f: (r) => !txt(r.NOM_ALUNO) },
      ],
      indicadores: [
        { t: 'TCE deferido', v: (L) => { const n = L.filter((r) => r.tce === 'deferido').length; return L.length ? `${n} (${Math.round(n / L.length * 100)}%)` : '0'; } },
        { t: 'Disciplinas de estágio', v: (L) => L.reduce((t, r) => t + (r.disciplinas || []).length, 0) },
      ],
      dashboardExtra: (L, esc, barras) => {
        const cursos = Array.from(new Set(L.map((r) => txt(r.NOM_CURSO)))).sort();
        const linha = (rot, G) => `<tr><td>${esc(rot)}</td><td>${G.length}</td>${['nao_iniciado', 'andamento', 'indeferido', 'deferido'].map((k) => `<td>${G.filter((r) => r.tce === k).length || ''}</td>`).join('')}<td class="${G.some((r) => r.tce === 'nao_iniciado' && r.foraPrazo) ? 'alerta' : ''}">${G.filter((r) => r.tce !== 'deferido' && r.foraPrazo).length || ''}</td><td>${G.filter((r) => r.tce === 'deferido' && r.docsPend).length || ''}</td></tr>`;
        const prod = {}; L.forEach((r) => { const k = txt(r.MODALIDADE_PP_PC) || 'Não informado'; prod[k] = (prod[k] || 0) + (r.tce === 'deferido' ? 0 : 1); });
        const mud = {}; L.filter((r) => r.mudou).forEach((r) => { const k = `${NOME_TCE[r.mudou.de] || r.mudou.de} → ${NOME_TCE[r.mudou.para] || r.mudou.para}`; mud[k] = (mud[k] || 0) + 1; });
        const prox = L.filter((r) => r.tce !== 'deferido' && r.limite && r.limite >= hojeISO()).sort((a, b) => a.limite.localeCompare(b.limite)).slice(0, 12);
        return `<div class="painel"><h2>Situação do TCE por curso</h2><table class="tabela"><thead><tr><th>Curso</th><th>Alunos</th><th>Sem TCE</th><th>Em andamento</th><th>Indeferido</th><th>Deferido</th><th>Prazo vencido</th><th>Documentação pendente</th></tr></thead>
          <tbody>${cursos.map((c) => linha(c, L.filter((r) => txt(r.NOM_CURSO) === c))).join('')}${linha('Total', L)}</tbody></table></div>
          <div class="duas">
            <div class="painel"><h2>Ainda sem TCE deferido, por modalidade</h2>${barras(prod)}</div>
            <div class="painel"><h2>Mudanças no TCE entre as importações</h2>${barras(mud)}</div>
          </div>
          <div class="painel"><h2>Próximos prazos de abertura do TCE</h2><table class="tabela"><thead><tr><th>Aluno</th><th>Curso</th><th>TCE</th><th>Prazo</th></tr></thead>
          <tbody>${prox.map((r) => `<tr><td>${esc(r.NOM_ALUNO || r.COD_MATRICULA)}</td><td>${esc(r.NOM_CURSO)}</td><td>${esc(NOME_TCE[r.tce])}</td><td>${esc(data(r.limite))}</td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhum prazo pela frente.</td></tr>'}</tbody></table></div>`;
      },
      detalhe: (r, esc) => `<div class="secao">Disciplinas de estágio (relatório do BI)</div>
        <table class="tabela"><thead><tr><th>Disciplina</th><th>TCE</th><th>Prazo TCE</th><th>Entrada em campo</th><th>Documentação</th><th>Horas</th><th>Professor</th></tr></thead><tbody>
        ${(r.disciplinas || []).map((d) => `<tr><td>${esc(d.disc)}<br><small class="origem">${esc(d.cod)} · turma ${esc(d.turma)}${d.indevido ? ' · <b>matrícula indevida</b>' : ''}${d.enade ? ' · ENADE' : ''}${Number(d.vezes) > 1 ? ' · ' + esc(d.vezes) + 'ª vez' : ''}</small></td>
          <td>${seloTce(d.tce)}${d.protocolo ? `<br><small class="origem">protocolo ${esc(d.protocolo)}</small>` : ''}</td><td>${esc(data(d.limTCE))}${d.tce !== 'deferido' && d.prazo === 'Fora do Prazo' ? '<br><small class="origem">vencido</small>' : ''}</td><td>${esc(data(d.limCampo))}</td>
          <td>${esc(d.docs)}</td><td>${esc(d.ch || '')}${d.hEst ? `<br><small class="origem">${esc(d.hEst)} h estágio</small>` : ''}</td><td>${esc(d.professor)}${d.preceptor ? `<br><small class="origem">preceptor: ${esc(d.preceptor)}</small>` : ''}</td></tr>`).join('')}
        </tbody></table>${r.mudou ? `<p class="dica">TCE mudou de <b>${esc(NOME_TCE[r.mudou.de] || r.mudou.de)}</b> para <b>${esc(NOME_TCE[r.mudou.para] || r.mudou.para)}</b> na importação de ${esc(data(r.mudou.em))}.</p>` : ''}`,
      lote: {
        assunto: 'Estágio: TCE e documentação',
        resultado: 'Mensagem enviada (estágio)',
        vars: (r) => ({ prazo: data(r.limite) || 'o prazo da disciplina', situacao: NOME_TCE[r.tce] || '' }),
        modelos: {
          WhatsApp: () => 'Olá, {nome}! 🎓 Aqui é {atendente}, da Secretaria Acadêmica da Estácio Volta Redonda.\nSobre o estágio do seu curso de {curso}: o seu TCE (Termo de Compromisso de Estágio) está como "{situacao}". O prazo para abertura é {prazo}. Posso te ajudar com as orientações?',
          'E-mail': () => 'Olá, {nome}!\n\nSobre o estágio do seu curso de {curso}: o seu TCE (Termo de Compromisso de Estágio) está como "{situacao}", e o prazo para abertura é {prazo}.\nCaso tenha dúvidas ou precise de orientações, estamos à disposição.\n\n{atendente}\nSecretaria Acadêmica · Estácio Volta Redonda',
        },
      },
      resultados: ['Orientado a abrir o TCE', 'TCE aberto', 'Documentação pendente', 'Documentação entregue', 'Já estagia', 'Matrícula indevida encaminhada', 'Sem interesse', 'Sem retorno', 'Outro'],
    },

    financeiro: {
      nome: 'Financeiro', icone: '💰',
      subtitulo: 'Alunos inadimplentes',
      rotuloTotal: 'Inadimplentes',
      elegivel: (r) => sim(r.INADIMPLENTE),
      colunas: [
        { t: 'Dívida', v: (r) => moeda(r.VAL_DIVIDA), ordem: (r) => num(r.VAL_DIVIDA) },
        { t: 'Faixa', v: (r) => txt(r.FAIXA_DIVIDA) },
        { t: 'Tipo', v: (r) => txt(r.TIPO_INADIMPLENCIA) },
        { t: 'Vencimento', v: (r) => dataAA(vencimento(r)), alerta: (r) => { const v = vencimento(r); return !!v && v < hojeISO(); } },
        { t: 'Promessa', v: (r) => data(r.VENCIMENTO_PROMESSA) },
      ],
      filtros: [
        { id: 'vencer', t: 'A vencer (5 dias)', card: true, cor: 'amarelo', f: (r) => { const v = vencimento(r); return v > hojeISO() && v <= emDias(5); } },
        { id: 'hoje', t: 'Vence hoje', card: true, cor: 'laranja', f: (r) => vencimento(r) === hojeISO() },
        { id: 'vencidas', t: 'Vencidas', card: true, cor: 'vermelho', f: (r) => { const v = vencimento(r); return !!v && v < hojeISO(); } },
        { id: 'alta', t: 'Dívida a partir de R$ 1.000', card: true, cor: 'azul', f: (r) => num(r.VAL_DIVIDA) >= 1000 },
        { id: 'promessa', t: 'Com promessa de pagamento', f: (r) => !!txt(r.VENCIMENTO_PROMESSA) },
      ],
      indicadores: [
        { t: 'Dívida total', v: (L) => moeda(L.reduce((s, r) => s + num(r.VAL_DIVIDA), 0)) },
        { t: 'Dívida a partir de R$ 1.000', v: (L) => L.filter((r) => num(r.VAL_DIVIDA) >= 1000).length },
      ],
      lote: {
        assunto: 'Regularização financeira',
        resultado: 'Mensagem enviada (financeiro)',
        vars: (r) => ({ divida: moeda(r.VAL_DIVIDA), prazo: dataAA(vencimento(r)) }),
        modelos: {
          WhatsApp: () => 'Olá, {nome}! Aqui é {atendente}, da Secretaria Acadêmica da Estácio Volta Redonda.\nIdentificamos uma pendência financeira de {divida} (vencimento {prazo}). Podemos ajudar você a regularizar e manter seus estudos em dia. Responda esta mensagem que eu te oriento.',
          'E-mail': () => 'Olá, {nome}!\n\nIdentificamos uma pendência financeira de {divida}, com vencimento em {prazo}, referente ao curso {curso}.\nEstamos à disposição para orientar a regularização e manter seus estudos em dia.\n\n{atendente}\nSecretaria Acadêmica · Estácio Volta Redonda',
        },
      },
      resultados: ['Prometeu pagar', 'Pagou', 'Quer negociar', 'Encaminhado ao financeiro', 'Sem retorno', 'Número errado', 'Outro'],
    },

    nps: {
      nome: 'NPS', icone: '⭐', original: '',
      subtitulo: 'Pesquisa Medallia: promotores (9 e 10), neutros (7 e 8) e detratores (0 a 6)',
      fonte: 'respostas', nomeFonte: 'respostas do Medallia', unidade: 'respostas', feminino: true, anoCurto: true,
      semDados: 'Nenhuma resposta importada ainda. A coordenação importa o arquivo do Medallia na Central de Bases.',
      chave: (r) => r.id, matriculaVisivel: (r) => r.matricula,
      elegivel: (r) => nota(r) != null,
      ordenar: (a, b) => isoDe(b.data_resposta).localeCompare(isoDe(a.data_resposta)), // mais recente primeiro
      dataDe: (r) => isoDe(r.data_resposta).slice(0, 10),
      importar: { rotulo: 'Importar arquivo do Medallia', converter: converterMedallia,
        ajuda: 'Use a exportação "Survey Export" do Medallia, sem alterar o arquivo. Respostas que já existem são atualizadas, as novas são incluídas, e os acionamentos registrados são mantidos.', erroFormato: 'Não encontrei a coluna "ID da Pesquisa". Use a exportação "Survey Export" do Medallia, sem alterar o arquivo.' },
      colunas: [
        { t: 'Resposta', v: (r) => dataAA(r.data_resposta) },
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
        blocos.push(`<div><span>Nota</span><b>${esc(nota(r))}</b> · ${esc(grupoNps(r))} · ${esc(dataAA(r.data_resposta))}</div>`);
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
