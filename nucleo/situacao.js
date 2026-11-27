/* Situação do aluno na base líquida (NOM_SITUACAO_ALUNO / SITUACAO_ALUNO).
   Quem trancou, cancelou, transferiu, desistiu ou se formou não entra nas ações de engajamento:
   as listas mostram só os ativos por padrão e deixam ver os demais pelo filtro. */
(function () {
  const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  const RE = /CANCELAD|CANCELAMENTO|TRANCAD|TRANCAMENTO|TRANSFER|DESIST|ABANDON|JUBILAD|FALECID|EVADID|INATIV|FORMADO|CONCLUID|CONCLUSAO/;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const saiu = (s) => RE.test(norm(s));
  /** filtro: 'ativos' (padrão) | 'saiu' | 'todos' | uma situação exata */
  function passa(s, f) {
    if (!f || f === 'ativos') return !saiu(s);
    if (f === 'todos') return true;
    if (f === 'saiu') return saiu(s);
    return norm(s) === norm(f);
  }
  /** <select> com os grupos e as situações exatas encontradas na lista */
  function select(id, valores, atual) {
    const vs = Array.from(new Set((valores || []).map((v) => String(v || '').trim()).filter(Boolean))).sort();
    const sel = (v) => ((atual || 'ativos') === v ? 'selected' : '');
    return `<select id="${id}" title="Situação do aluno na base líquida">
      <option value="ativos" ${sel('ativos')}>Situação: só ativos</option>
      <option value="saiu" ${sel('saiu')}>Trancados, cancelados, transferidos e formados</option>
      <option value="todos" ${sel('todos')}>Situação: todas</option>
      ${vs.length ? `<optgroup label="Situação exata">${vs.map((v) => `<option value="${esc(v)}" ${sel(v)}>${esc(v)}</option>`).join('')}</optgroup>` : ''}</select>`;
  }
  /** selo para quem saiu (ativo não ganha selo) */
  const selo = (s) => (saiu(s) ? ` <span class="selo-sit" style="display:inline-block;background:#fde8e8;color:#b42318;border-radius:9px;padding:1px 7px;font-size:10.5px;font-weight:700;vertical-align:middle">${esc(String(s).trim())}</span>` : '');
  /** aviso de quantos ficaram de fora pela situação */
  function ocultos(lista, sitDe, f) {
    if (f && f !== 'ativos') return '';
    const n = lista.filter((x) => saiu(sitDe(x))).length;
    return n ? `<span class="dica" style="font-size:12px">${n} trancado(s), cancelado(s), transferido(s) ou formado(s) fora da lista</span>` : '';
  }
  window.Situacao = { saiu, passa, select, selo, ocultos, norm };
})();
