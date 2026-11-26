/**
 * BOLSA PERMANÊNCIA (Bolsa Direção)
 * Solicitações por período (26.3, 27.1...): carta, percentual anterior e atual, vigência, motivo (tipo) com a
 * justificativa padrão, status até o lançamento, requerimento e o consumo (valor da bolsa no semestre).
 * Pool por período e modalidade: valor disponível; saldo = pool − consumo das lançadas − consumo das deferidas
 * ainda não lançadas (comprometido).
 * Armazenamento: BolsaPermanencia (JSON no armazenamento do Engajamento).
 */

const BOLSA_MODALIDADES = ['PRESENCIAL', 'SEMIPRESENCIAL', 'EAD', 'FLEX'];
const BOLSA_STATUS = ['em_analise', 'deferido', 'em_processamento', 'lancada', 'indeferido', 'conflito', 'sem_saldo'];
const BOLSA_MOTIVOS = [
  { tipo: 'RENOVAÇÃO - Restrição financeira temporária', texto: 'Restrição financeira temporária, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'RENOVAÇÃO - Reorganização orçamentária familiar', texto: 'Reorganização orçamentária familiar, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'RENOVAÇÃO - Aumento pontual de despesas essenciais', texto: 'Aumento pontual de despesas essenciais, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'RENOVAÇÃO - Desemprego recente ou redução de renda', texto: 'Desemprego recente ou redução de renda, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'RENOVAÇÃO - Transição de vínculo empregatício', texto: 'Transição de vínculo empregatício, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'RENOVAÇÃO - Encerramento de benefício ou desconto anterior', texto: 'Encerramento de benefício ou desconto anterior, dificuldade financeira impactando a renovação da matrícula no período vigente; solicita-se bolsa permanência para garantir continuidade acadêmica.' },
  { tipo: 'ATAQUE CONCORRÊNCIA', texto: 'Proposta financeira inferior de instituição concorrente identificada, com risco de evasão; solicita-se bolsa permanência como medida de retenção financeira.', sub: 'IES e proposta ofertada pela concorrente' },
  { tipo: 'PERDA DE FINANCIAMENTO', texto: 'Financiamento educacional cancelado/interrompido, gerando impacto financeiro imediato; solicita-se bolsa permanência para viabilizar continuidade acadêmica.', sub: 'FIES, ProUni ou financiamento privado' },
  { tipo: 'RETENÇÃO COM AGENDAMENTO', texto: 'Risco de evasão identificado por restrição financeira temporária; solicita-se bolsa permanência para apoio à permanência do aluno.', sub: 'Data do agendamento de trancamento' },
  { tipo: 'RETENÇÃO SEM AGENDAMENTO', texto: 'Aluno procurou Secretaria/NAE sem efetivar atendimento de trancamento, sendo identificado risco de evasão; concede-se bolsa permanência como medida preventiva de retenção acadêmica.', sub: 'Atendimento espontâneo' },
  { tipo: 'RETENÇÃO', texto: '' }, { tipo: 'CAMPANHA RENOVAÇÃO', texto: '' }, { tipo: 'CAMPANHA CAPTAÇÃO', texto: '' },
  { tipo: 'PARCERIAS', texto: '' }, { tipo: 'INFLUENCER', texto: '' }, { tipo: 'ERRO OPERACIONAL', texto: '' },
];

function bolsaLer_() {
  const o = cobLerJson_('BolsaPermanencia', null) || {};
  return { periodos: o.periodos || {}, solicitacoes: o.solicitacoes || [] };
}
function bolsaGravar_(o) { Engajamento_().storeSet('BolsaPermanencia', JSON.stringify(o)); }
function bolsaPeriodoOk_(p) { return /^\d{2}\.\d$/.test(String(p || '')); }
function bolsaNum_(v) { const n = evNumero_(v); return Math.round(n * 100) / 100; }
function bolsaPct_(v) { const t = String(v == null ? '' : v).replace('%', '').replace(',', '.').trim(); if (t === '') return null; const n = parseFloat(t); return isNaN(n) ? null : Math.max(0, Math.min(100, n)); }
function bolsaData_(v) { const t = String(v || ''); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; }
function bolsaModalidade_(v) { const t = String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ''); return BOLSA_MODALIDADES.filter(m => m === t)[0] || (t.indexOf('SEMI') >= 0 ? 'SEMIPRESENCIAL' : t.indexOf('PRESEN') >= 0 ? 'PRESENCIAL' : t.indexOf('FLEX') >= 0 ? 'FLEX' : t.indexOf('EAD') >= 0 || t.indexOf('DIGITAL') >= 0 ? 'EAD' : ''); }

/** Limpa um registro vindo da tela ou da importação. */
function bolsaLimpo_(r, periodo) {
  const mat = normMatEv_(r.mat);
  if (mat.length < 6) return null;
  const st = BOLSA_STATUS.indexOf(r.status) >= 0 ? r.status : 'em_analise';
  return {
    id: String(r.id || ('b' + periodo.replace('.', '') + '_' + mat)).slice(0, 60), periodo: periodo, mat: mat,
    nome: String(r.nome || '').slice(0, 150), curso: String(r.curso || '').slice(0, 150), tel: String(r.tel || '').slice(0, 30), email: String(r.email || '').slice(0, 120),
    modalidade: bolsaModalidade_(r.modalidade), data: bolsaData_(r.data), pctAnt: bolsaPct_(r.pctAnt), pagouRenov: /^s/i.test(String(r.pagouRenov || '')) ? 'SIM' : /^n/i.test(String(r.pagouRenov || '')) ? 'NÃO' : '',
    pct: bolsaPct_(r.pct), vigIni: bolsaData_(r.vigIni), vigFim: bolsaData_(r.vigFim), vigTxt: String(r.vigTxt || '').slice(0, 60),
    tipo: String(r.tipo || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), sub: String(r.sub || '').slice(0, 300), descricao: String(r.descricao || '').slice(0, 2000),
    status: st, dataLanc: bolsaData_(r.dataLanc), requerimento: String(r.requerimento || '').replace(/ /g, '').trim().slice(0, 40), recalculo: !!r.recalculo,
    consumo: r.consumo === '' || r.consumo == null ? null : bolsaNum_(r.consumo), pendencias: String(r.pendencias || '').slice(0, 1000), obs: String(r.obs || '').slice(0, 2000),
  };
}

function bolsaContatos_(mats) {
  const quer = {}; mats.forEach(m => { quer[m] = true; });
  const res = {};
  BASES_ENGAJAMENTO.forEach(b => evLerBase_(b).forEach(r => {
    const mat = normMatEv_(r && (r.COD_MATRICULA || r.MATRICULA));
    if (!mat || !quer[mat] || res[mat]) return;
    const pa = r.PCT_BOLSA_PERMANENCIA_ATU;
    res[mat] = { nome: String(r.NOM_ALUNO || ''), curso: String(r.NOM_CURSO || ''), tel: String(r.NUM_TELEF_CELULAR || r.NUM_TELEFONE || ''), email: String(r.END_EMAIL || ''),
      modalidade: bolsaModalidade_(r.MODALIDADE_PP_PC || r.MODALIDADE), base: b, situacao: String(r.NOM_SITUACAO_ALUNO || ''),
      inadimplente: cobInadimplente_(r), pctBase: pa === undefined || pa === null || pa === '' ? null : bolsaPct_(pa) };
  }));
  return res;
}

function bolsaDados_(d, eu) {
  const o = bolsaLer_();
  const periodos = Object.keys(o.periodos).concat(o.solicitacoes.map(s => s.periodo)).filter(bolsaPeriodoOk_);
  const lista = Array.from(new Set(periodos)).sort().reverse();
  const periodo = bolsaPeriodoOk_(d.periodo) ? d.periodo : (lista[0] || '');
  const sol = o.solicitacoes.filter(s => s.periodo === periodo);
  const base = bolsaContatos_(sol.map(s => s.mat));
  sol.forEach(s => { s.base = base[s.mat] || null; });
  return { ok: true, periodo: periodo, periodos: lista, pool: (o.periodos[periodo] || {}).pool || {}, solicitacoes: sol,
    motivos: BOLSA_MOTIVOS, modalidades: BOLSA_MODALIDADES, gestao: !!(PERFIS[eu.perfil] || {}).gestao };
}

function bolsaSalvar_(d, eu) {
  const periodo = String(d.periodo || '');
  if (!bolsaPeriodoOk_(periodo)) return { ok: false, erro: 'Informe o período no formato 26.3.' };
  const reg = bolsaLimpo_(d.registro || {}, periodo);
  if (!reg) return { ok: false, erro: 'Informe a matrícula do aluno.' };
  if (!reg.modalidade) return { ok: false, erro: 'Escolha a modalidade.' };
  if (reg.pct == null) return { ok: false, erro: 'Informe o percentual da bolsa.' };
  if (!reg.tipo) return { ok: false, erro: 'Escolha o motivo (tipo) da solicitação.' };
  if (reg.status === 'lancada' && !reg.dataLanc) reg.dataLanc = cobHoje_();
  const lock = bloqueio_(20000);
  try {
    const o = bolsaLer_();
    const i = o.solicitacoes.findIndex(s => s.id === reg.id || (s.periodo === periodo && s.mat === reg.mat && !d.registro.id));
    const antes = i >= 0 ? o.solicitacoes[i] : null;
    if (antes && !d.registro.id) return { ok: false, erro: 'Este aluno já tem solicitação no período ' + periodo + '. Abra a solicitação existente.' };
    reg.id = antes ? antes.id : reg.id;
    reg.criado = antes ? antes.criado : Date.now(); reg.quem = antes ? antes.quem : eu.nome;
    reg.historico = (antes && antes.historico) || [];
    if (!antes || antes.status !== reg.status) reg.historico = reg.historico.concat([{ status: reg.status, quem: eu.nome, ts: Date.now() }]).slice(-30);
    reg.alteradoPor = eu.nome; reg._ts = Date.now();
    if (i >= 0) o.solicitacoes[i] = reg; else o.solicitacoes.push(reg);
    bolsaGravar_(o);
    log_('BOLSA', eu.nome, (antes ? 'atualizou' : 'registrou') + ' a bolsa de ' + reg.mat + ' (' + periodo + '): ' + reg.pct + '% · ' + reg.status);
    return { ok: true, registro: reg };
  } finally { lock.releaseLock(); }
}

function bolsaExcluir_(d, eu) {
  const lock = bloqueio_(20000);
  try {
    const o = bolsaLer_();
    const n = o.solicitacoes.length;
    o.solicitacoes = o.solicitacoes.filter(s => s.id !== d.id);
    if (o.solicitacoes.length === n) return { ok: false, erro: 'Solicitação não encontrada.' };
    bolsaGravar_(o);
    log_('BOLSA', eu.nome, 'excluiu a solicitação ' + d.id);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function bolsaPool_(d, eu) {
  const periodo = String(d.periodo || '');
  if (!bolsaPeriodoOk_(periodo)) return { ok: false, erro: 'Informe o período no formato 26.3.' };
  const pool = {};
  BOLSA_MODALIDADES.forEach(m => { const v = (d.pool || {})[m]; if (v !== '' && v != null) pool[m] = bolsaNum_(v); });
  const lock = bloqueio_(20000);
  try {
    const o = bolsaLer_();
    o.periodos[periodo] = Object.assign({}, o.periodos[periodo] || {}, { pool: pool, quem: eu.nome, ts: Date.now() });
    bolsaGravar_(o);
    log_('BOLSA', eu.nome, 'definiu o pool de ' + periodo + ': ' + JSON.stringify(pool));
    return { ok: true, pool: pool };
  } finally { lock.releaseLock(); }
}

function bolsaBuscar_(d) {
  const mat = normMatEv_(d.matricula);
  if (mat.length < 6) return { ok: false, erro: 'Matrícula incompleta.' };
  const r = bolsaContatos_([mat])[mat];
  return r ? Object.assign({ ok: true }, r) : { ok: true, naoEncontrado: true };
}

function Modulo_bolsa() {
  return {
    acoes: {
      dados: (d, eu) => bolsaDados_(d, eu),
      salvar: (d, eu) => bolsaSalvar_(d, eu),
      excluir: (d, eu) => bolsaExcluir_(d, eu),
      pool: (d, eu) => bolsaPool_(d, eu),
      buscar_aluno: (d) => bolsaBuscar_(d),
    },
    gestao: ['excluir', 'pool'],
    admin: [],
  };
}
