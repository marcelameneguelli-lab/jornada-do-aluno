/**
 * ALUNOS EM RISCO (painel consolidado)
 * Cruza, por matrícula e por período (Ímpar, Par e Técnico), os sinais que hoje ficam em sistemas diferentes:
 *   Cobrança (dívida, promessa quebrada, acordo atrasado), Evasão (indícios da base e intenção de saída),
 *   Provas (falta agendar ou faltou), Estágio (TCE vencido ou indeferido), Financiamentos (aproveitamento abaixo
 *   do mínimo), Renovação (pendente com o ciclo aberto) e a propensão de evasão da base.
 * Cada sinal tem um peso; a soma ordena a lista. Só lê: nada é gravado aqui.
 */

const RISCO_MINIMO_APROVEITAMENTO = 75;
const RISCO_SINAIS = {
  divida:        { peso: 3, sistema: 'financeiro', rotulo: 'Inadimplente' },
  divida_alta:   { peso: 1, sistema: 'financeiro', rotulo: 'Dívida acima de R$ 1.000' },
  prom_quebrada: { peso: 2, sistema: 'financeiro', rotulo: 'Promessa de pagamento quebrada' },
  acordo_atraso: { peso: 2, sistema: 'financeiro', rotulo: 'Parcela de acordo atrasada' },
  tranc_agend:   { peso: 4, sistema: 'evasao', rotulo: 'Trancamento agendado' },
  he:            { peso: 3, sistema: 'evasao', rotulo: 'Solicitou HE' },
  indicio:       { peso: 3, sistema: 'evasao', rotulo: 'Indício de evasão na base' },
  intencao:      { peso: 4, sistema: 'evasao', rotulo: 'Intenção de saída registrada' },
  propensao:     { peso: 2, sistema: 'engajamento', rotulo: 'Propensão de evasão alta' },
  prova:         { peso: 2, sistema: 'provas', rotulo: 'Prova: falta agendar ou faltou' },
  tce:           { peso: 2, sistema: 'estagio', rotulo: 'Estágio: TCE vencido ou indeferido' },
  aproveitamento:{ peso: 3, sistema: 'financiamentos', rotulo: 'Aproveitamento abaixo de 75% (ProUni/FIES)' },
  renovacao:     { peso: 2, sistema: 'renovacao', rotulo: 'Renovação pendente (ciclo aberto)' },
};

function riscoTxt_(v) { return String(v == null ? '' : v).trim(); }

/** Situação de prova (AV ou AVS) igual à da tela de Provas. */
function riscoProva_(r, t) {
  const st = riscoTxt_(r['STATUS_AGEND_' + t]).toUpperCase();
  if (st.indexOf('FEZ') >= 0 || st === 'COMPARECEU' || st === 'REALIZADO') return '';
  if (st.indexOf('FALTOU') === 0) return 'faltou';
  if (st.indexOf('FALTA AGENDAR') === 0 || cobSim_(r['FALTA_AGENDAR_' + t])) return 'falta';
  return '';
}

function riscoDataTs_(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const t = String(v);
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)).getTime();
  const n = Date.parse(t);
  return isNaN(n) ? (Number(v) > 1e12 ? Number(v) : 0) : n;
}

/** Último contato registrado na Jornada para cada matrícula (sistemas do motor, Evasão e Engajamento do período). */
function riscoContatos_(base) {
  const ult = {};
  const marca = (mat, ts, quem, onde, oque) => {
    mat = normMatEv_(mat);
    if (!mat || !ts) return;
    if (!ult[mat] || ts > ult[mat].ts) ult[mat] = { ts: ts, quem: String(quem || ''), onde: onde, oque: String(oque || '').slice(0, 60) };
  };
  ['provas', 'estagio', 'financeiro', 'financiamentos', 'nps'].forEach(sis => {
    try {
      linhasDe_(abaAcomp_(sis, 'acomp'), CAB_ACOMP.length).map(regDeLinha_).forEach(r => {
        if (r.base && r.base !== base) return;
        marca(r.matricula, Number(r.criado) || 0, r.atendente, NOMES_SISTEMA_RISCO_[sis], r.resultado || r.canal);
      });
    } catch (e) { /* sistema sem registros */ }
  });
  evLerRegistros_(base).forEach(e => { if (e && e.atend) marca(e.mat, e._ts, e.atend, 'Evasão', e.sit); });
  try {
    const h = JSON.parse(Engajamento_().storeGet('HistoryJSON_' + base) || '{}') || {};
    Object.keys(h).forEach(mat => (h[mat] || []).forEach(x => marca(mat, riscoDataTs_(x.datetime), x.atend, 'Engajamento', x.motivo || x.canal)));
  } catch (e) { /* sem histórico */ }
  return ult;
}
const NOMES_SISTEMA_RISCO_ = { provas: 'Provas', estagio: 'Estágio', financeiro: 'Cobrança', financiamentos: 'Financiamentos', nps: 'NPS' };

/** Alunos com Renovação pendente num ciclo aberto, por matrícula (só Ímpar e Par). */
function riscoRenovacao_(base, eu) {
  const mapa = {};
  if (base === 'ct') return mapa;
  try {
    const cc = evCiclosCfg_(eu);
    const ra = Renovacao_().processarAcao('carregar_alunos', { __sess: evSessao_(eu) }) || {};
    (ra.alunos || []).forEach(a => {
      if (evParidade_(a.ciclo) !== base || !evCicloAberto_(cc, String(a.ciclo))) return;
      const st = String(a.status || '').toLowerCase();
      if (st !== 'pendente' && st !== 'em negociação') return;
      const mat = normMatEv_(a.matricula);
      if (mat) mapa[mat] = { ciclo: String(a.ciclo), status: a.status };
    });
  } catch (e) { /* sem Renovação */ }
  return mapa;
}

function riscoLista_(d, eu) {
  const base = cobBaseOk_(d.base) ? d.base : 'impar';
  const linhas = evLerBase_(base);
  const hoje = cobHoje_();
  // Cobrança: promessas quebradas e acordos atrasados
  const cart = cobProcessar_(base, linhas);
  const reg = cobLerJson_('CobAcordos_' + base, { promessas: [], acordos: [] });
  const quebrada = {}, atraso = {};
  (reg.promessas || []).forEach(p => { if (p.status === 'ativa' && cobAvaliarPromessa_(p, (cart.alunos || {})[p.mat], hoje) === 'quebrada') quebrada[p.mat] = p; });
  (reg.acordos || []).forEach(a => { if (a.status === 'ativo' && (a.parcelas || []).some(x => !x.paga && x.venc < hoje)) atraso[a.mat] = a; });
  // Evasão: intenção de saída registrada
  const intencao = {};
  evLerRegistros_(base).forEach(e => { if (e && e.sit === 'intencao') intencao[normMatEv_(e.mat)] = e; });
  // Estágio (BI): TCE vencido ou indeferido
  const tce = {};
  ((cobLerJson_('EstagioBI', { alunos: [] }) || {}).alunos || []).forEach(a => {
    if (a.tce === 'indeferido' || (a.tce !== 'deferido' && a.foraPrazo)) tce[a.COD_MATRICULA] = a.tce === 'indeferido' ? 'TCE indeferido' : 'TCE com prazo vencido';
  });
  const renov = riscoRenovacao_(base, eu);
  const formandos = cobFormandos_();
  const contatos = riscoContatos_(base);

  const alunos = [];
  linhas.forEach(r => {
    const mat = normMatEv_(r && (r.COD_MATRICULA || r.MATRICULA));
    if (!mat) return;
    const sit = riscoTxt_(r.NOM_SITUACAO_ALUNO || r.SITUACAO_ALUNO).toUpperCase();
    if (/CANCELAD|TRANCAD|FORMAD|CONCLU/.test(sit)) return; // já saiu: fica na Evasão
    const s = [];
    const add = (id, det) => s.push({ id: id, det: det || '' });
    const valor = cobValor_(r);
    if (cobInadimplente_(r)) { add('divida', cobMoeda_(valor)); if (valor > 1000) add('divida_alta'); }
    if (quebrada[mat]) add('prom_quebrada', cobMoeda_(quebrada[mat].valor) + ' até ' + quebrada[mat].data.split('-').reverse().join('/'));
    if (atraso[mat]) add('acordo_atraso');
    evIndicios_(r).forEach(i => add(i.tipo === 'tranc' ? 'tranc_agend' : i.tipo === 'he' ? 'he' : 'indicio', i.texto));
    if (intencao[mat]) add('intencao', intencao[mat].obj || '');
    if (/ALT/i.test(riscoTxt_(r.PROPENSAO_EVASAO))) add('propensao', riscoTxt_(r.PROPENSAO_EVASAO));
    const pv = ['AV', 'AVS'].map(t => { const x = riscoProva_(r, t); return x ? t + (x === 'faltou' ? ': faltou' : ': falta agendar') : ''; }).filter(Boolean);
    if (pv.length) add('prova', pv.join(' · '));
    if (tce[mat]) add('tce', tce[mat]);
    const classe = riscoTxt_(r.CLASSE_PAGANTE_SEMESTRE).toUpperCase();
    const ap = parseFloat(riscoTxt_(r.PCT_APROVACAO_ANT).replace(',', '.'));
    if ((classe === 'PROUNI' || classe === 'FIES') && !isNaN(ap) && ap < RISCO_MINIMO_APROVEITAMENTO) add('aproveitamento', classe + ' · ' + ap + '%');
    if (renov[mat]) add('renovacao', 'Ciclo ' + renov[mat].ciclo + ' · ' + renov[mat].status);
    if (!s.length) return;
    const pontos = s.reduce((t, x) => t + RISCO_SINAIS[x.id].peso, 0);
    alunos.push({
      mat: mat, nome: riscoTxt_(r.NOM_ALUNO), curso: riscoTxt_(r.NOM_CURSO), cel: riscoTxt_(r.NUM_TELEF_CELULAR || r.NUM_TELEFONE),
      email: riscoTxt_(r.END_EMAIL), formando: !!formandos[mat], sinais: s, pontos: pontos,
      areas: Array.from(new Set(s.map(x => RISCO_SINAIS[x.id].sistema))).length, contato: contatos[mat] || null,
    });
  });
  alunos.sort((a, b) => b.areas - a.areas || b.pontos - a.pontos);
  return { ok: true, base: base, periodo: NOME_PERIODO_EVASAO[base], alunos: alunos, sinais: RISCO_SINAIS, total: linhas.length };
}

function Modulo_risco() {
  return { acoes: { lista: (d, eu) => riscoLista_(d, eu) }, gestao: [], admin: [] };
}
