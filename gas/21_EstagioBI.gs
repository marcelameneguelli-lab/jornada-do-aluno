/**
 * ESTÁGIO: acompanhamento em cima do relatório do BI (uma linha por aluno e disciplina de estágio).
 *
 * A coordenação importa o arquivo na Central de Bases. O navegador junta as disciplinas de cada
 * aluno e envia; aqui a lista anterior é substituída pela nova (a extração do BI é sempre a foto atual),
 * guardando o que mudou no TCE de cada aluno desde a importação anterior.
 * Nome, celular e e-mail vêm da base líquida do Engajamento (o BI não traz).
 *
 * Armazenamento: EstagioBI (lista atual) e EstagioBI_temp (envio em partes).
 * Acionamentos, follow-ups e produtividade: os do motor (acomp_estagio), pela matrícula.
 */

const ORDEM_TCE_BI = { nao_iniciado: 0, indeferido: 1, andamento: 2, deferido: 3 };

function estagioBiDados_(d) {
  const o = cobLerJson_('EstagioBI', null);
  if (!o) return { ok: true, dados: [], ts: 0 };
  return { ok: true, dados: o.alunos || [], ts: o.ts || 0, quem: o.quem || '', arquivo: o.arquivo || '' };
}

/** Nome e contatos pela base líquida (Ímpar, Par e Técnico). */
function estagioContatos_() {
  const mapa = {};
  BASES_ENGAJAMENTO.forEach(b => {
    evLerBase_(b).forEach(r => {
      const mat = normMatEv_(r && (r.COD_MATRICULA || r.MATRICULA));
      if (!mat || mapa[mat]) return;
      mapa[mat] = { NOM_ALUNO: String(r.NOM_ALUNO || ''), NUM_TELEF_CELULAR: String(r.NUM_TELEF_CELULAR || r.NUM_TELEFONE || ''),
        END_EMAIL: String(r.END_EMAIL || ''), base: b };
    });
  });
  return mapa;
}

function estagioBiImportar_(d, eu) {
  const lote = Array.isArray(d.respostas) ? d.respostas : [];
  const parte = Number(d.parte) || 0, total = Math.max(1, Number(d.total) || 1);
  if (!lote.length) return { ok: false, erro: 'Nenhum aluno no arquivo.' };
  if (lote.length > 600) return { ok: false, erro: 'Lote grande demais (máx. 600 por envio).' };
  const E = Engajamento_();
  const lock = bloqueio_(30000);
  try {
    let acum = parte === 0 ? [] : (cobLerJson_('EstagioBI_temp', []) || []);
    lote.forEach(a => {
      const mat = normMatEv_(a.COD_MATRICULA);
      if (!mat) return;
      const disc = (Array.isArray(a.disciplinas) ? a.disciplinas : []).slice(0, 30);
      acum.push(Object.assign({}, a, { COD_MATRICULA: mat, disciplinas: disc }));
    });
    if (parte < total - 1) { E.storeSet('EstagioBI_temp', JSON.stringify(acum)); return { ok: true, parcial: true, novas: 0, atualizadas: 0 }; }

    const antes = cobLerJson_('EstagioBI', { alunos: [] }) || { alunos: [] };
    const anterior = {};
    (antes.alunos || []).forEach(a => { anterior[a.COD_MATRICULA] = a; });
    const contatos = estagioContatos_();
    const hoje = cobHoje_();
    let novas = 0, atualizadas = 0, mudaram = 0;
    const vistos = {};
    acum.forEach(a => {
      const c = contatos[a.COD_MATRICULA] || {};
      ['NOM_ALUNO', 'NUM_TELEF_CELULAR', 'END_EMAIL'].forEach(k => { if (!a[k] && c[k]) a[k] = c[k]; });
      if (c.base) a.base_engajamento = c.base;
      const p = anterior[a.COD_MATRICULA];
      if (p) {
        atualizadas++;
        if (p.tce !== a.tce) { a.mudou = { de: p.tce, para: a.tce, em: hoje }; mudaram++; }
        else if (p.mudou) a.mudou = p.mudou;
        a.desde = p.desde || hoje;
      } else { novas++; a.desde = hoje; }
      vistos[a.COD_MATRICULA] = true;
    });
    const sairam = Object.keys(anterior).filter(m => !vistos[m]).length;
    E.storeSet('EstagioBI', JSON.stringify({ ts: Date.now(), quem: eu.nome, alunos: acum, sairam: sairam }));
    if (parte > 0) E.storeSet('EstagioBI_temp', '[]');
    log_('ESTAGIO', eu.nome, 'importou o relatório do BI: ' + acum.length + ' aluno(s), ' + novas + ' novo(s), ' + mudaram + ' com TCE alterado, ' + sairam + ' saíram');
    return { ok: true, novas: novas, atualizadas: atualizadas, mudaram: mudaram, sairam: sairam, total: acum.length };
  } finally { lock.releaseLock(); }
}

function acoesEstagioBI_() {
  return {
    bi: (d) => estagioBiDados_(d),
    importar: (d, eu) => estagioBiImportar_(d, eu),
  };
}
