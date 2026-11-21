/**
 * SISTEMA NPS (Medallia)
 * Base própria: a exportação "Survey Export" do Medallia (Experiência Geral), importada
 * pela tela do NPS (perfil com gestão). Cada RESPOSTA é uma linha (o mesmo aluno pode
 * responder mais de uma vez); a chave é o "ID da Pesquisa". Importar de novo atualiza
 * as respostas existentes e acrescenta as novas, sem apagar nada.
 * Acionamentos, follow-up, ficha, dashboard e produtividade: motor de acompanhamento.
 *
 * Aba (planilha PLANILHAS.nps, vazio = Central): nps_respostas: id | dados (json) | data_resposta | atualizado
 */

const CAB_NPS = ['id', 'dados', 'data_resposta', 'atualizado'];

function abaNps_() {
  const ss = planilhaDo_('nps');
  let sh = ss.getSheetByName('nps_respostas');
  if (!sh) {
    sh = ss.insertSheet('nps_respostas');
    sh.getRange(1, 1, 1, CAB_NPS.length).setValues([CAB_NPS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('C:C').setNumberFormat('@');
  }
  return sh;
}

function npsRespostas_() {
  const sh = abaNps_();
  const n = Math.max(sh.getLastRow() - 1, 0);
  const dados = [];
  if (n) sh.getRange(2, 1, n, 2).getValues().forEach(l => {
    try { const o = JSON.parse(l[1]); o.id = String(l[0]); dados.push(o); } catch (e) { /* linha corrompida */ }
  });
  return { ok: true, dados: dados };
}

/** Recebe um lote de respostas já resumidas pelo navegador e grava (atualiza pelo id). */
function npsImportar_(d, eu) {
  const lote = Array.isArray(d.respostas) ? d.respostas : [];
  if (!lote.length) return { ok: false, erro: 'Nenhuma resposta no arquivo.' };
  if (lote.length > 600) return { ok: false, erro: 'Lote grande demais (máx. 600 por envio).' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = abaNps_();
    const n = Math.max(sh.getLastRow() - 1, 0);
    const linhaDe = {};
    if (n) sh.getRange(2, 1, n, 1).getValues().forEach((l, i) => { linhaDe[String(l[0])] = i + 2; });
    const agora = Date.now();
    const novas = [];
    let atualizadas = 0;
    lote.forEach(r => {
      const id = String(r.id || '').replace(/\.0$/, '').trim();
      if (!id || !String(r.matricula || '').trim()) return;
      const o = Object.assign({}, r); delete o.id;
      const linha = [id, JSON.stringify(o).slice(0, 45000), String(r.data_resposta || ''), agora];
      if (linhaDe[id]) { sh.getRange(linhaDe[id], 1, 1, 4).setValues([linha]); atualizadas++; }
      else { novas.push(linha); linhaDe[id] = -1; }
    });
    if (novas.length) sh.getRange(sh.getLastRow() + 1, 1, novas.length, 4).setValues(novas);
    log_('NPS', eu.nome, 'importou ' + novas.length + ' nova(s) e atualizou ' + atualizadas);
    return { ok: true, novas: novas.length, atualizadas: atualizadas };
  } finally { lock.releaseLock(); }
}

function Modulo_nps() {
  const m = moduloAcompanhamento_('nps');
  m.acoes.respostas = () => npsRespostas_();
  m.acoes.importar = (d, eu) => npsImportar_(d, eu);
  m.gestao = ['importar'];
  return m;
}
