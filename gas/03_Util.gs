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

/** Planilha de um sistema (vazio em PLANILHAS = Central). */
function planilhaDo_(sis) {
  // Provas, Estágio e Financeiro leem a base do Engajamento, mas gravam os acionamentos na própria
  // planilha (PLANILHAS[sis], vazio = Central): a planilha do Engajamento chegou ao limite de células.
  const chave = sis;
  if (!(chave in PLANILHAS)) throw new Error('Planilha não configurada para ' + sis);
  const id = PLANILHAS[chave];
  return id ? SpreadsheetApp.openById(id) : planilhaCentral_();
}

/** Nomes da equipe (usuários ativos da Jornada), em ordem alfabética: é a lista de atendentes de todos os sistemas. */
function nomesEquipe_() {
  return listaUsuarios_().filter(u => u.ativo).map(u => u.nome)
    .filter((n, i, a) => n && a.indexOf(n) === i).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
