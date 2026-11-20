/**
 * APOIO: log e acesso às planilhas de cada sistema.
 */

function abaLog_() {
  const ss = planilhaCentral_();
  let sh = ss.getSheetByName('log');
  if (!sh) {
    sh = ss.insertSheet('log');
    sh.getRange(1, 1, 1, 4).setValues([['quando', 'tipo', 'quem/ação', 'detalhe']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function log_(tipo, quem, detalhe) {
  try { abaLog_().appendRow([new Date(), tipo, String(quem || ''), String(detalhe || '').slice(0, 500)]); }
  catch (e) { Logger.log(tipo + ' ' + quem + ' ' + detalhe); }
}

/** Planilha de um sistema. Provas, Estágio e Financeiro usam a do Engajamento. */
function planilhaDo_(sis) {
  const mapa = { provas: 'engajamento', estagio: 'engajamento', financeiro: 'engajamento' };
  const chave = mapa[sis] || sis;
  if (!(chave in PLANILHAS)) throw new Error('Planilha não configurada para ' + sis);
  const id = PLANILHAS[chave];
  return id ? SpreadsheetApp.openById(id) : planilhaCentral_();
}
