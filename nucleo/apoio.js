/* Jornada do Aluno · orientações de apoio às avaliações (NAAP/NAE)
 * Lista padronizada de recursos e o selo/quadro que aparece nos sistemas.
 * Nunca há diagnóstico ou condição: só o que fazer na avaliação e na plataforma. */
(function () {
  const AVALIACAO = [
    'Tempo adicional', 'Sala separada ou com menos estímulos', 'Ledor', 'Transcritor',
    'Prova ampliada ou fonte maior', 'Intérprete de Libras', 'Pausas durante a prova',
    'Enunciados objetivos ou prova adaptada', 'Prova no computador com leitor de tela', 'Avaliação oral',
    'Lembrete da data da prova com antecedência',
  ];
  const PLATAFORMA = [
    'Orientação passo a passo no primeiro acesso', 'Prazos estendidos nas atividades', 'Material em formato acessível',
    'Vídeos com legenda ou transcrição', 'Leitor de tela', 'Contato preferencial por escrito',
    'Acompanhamento periódico do uso da plataforma',
  ];
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (m) => String(m == null ? '' : m).replace(/\.0$/, '').replace(/\D/g, '');
  let cache = null;

  /** Orientações ativas, por matrícula (uma chamada por tela; leitura liberada para todos os logados). */
  function carregar() {
    if (cache) return cache;
    cache = Api.chamar('apoio.orientacoes').then((r) => {
      const mapa = {};
      ((r && r.dados) || []).forEach((o) => { mapa[norm(o.matricula)] = o; });
      return mapa;
    }).catch(() => ({}));
    return cache;
  }

  const itens = (o) => (o.avaliacao || []).map((x) => x === 'Tempo adicional' && o.tempo_adicional ? x + ' (' + o.tempo_adicional + ')' : x);

  /** Selo discreto para listas. */
  function selo(o) {
    if (!o) return '';
    const t = itens(o).concat(o.plataforma || []).join(' · ');
    return `<span class="selo-apoio" title="Orientações de apoio: ${esc(t)}">🧩 Apoio</span>`;
  }

  /** Quadro com as orientações, para a ficha do aluno. */
  function quadro(o) {
    if (!o) return '';
    const lista = (arr) => arr.length ? '<ul>' + arr.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>' : '';
    const av = itens(o), pl = o.plataforma || [];
    return `<div class="quadro-apoio"><b>🧩 Orientações de apoio (NAAP/NAE)</b>
      ${av.length ? '<div><span>Nas avaliações</span>' + lista(av) + '</div>' : ''}
      ${pl.length ? '<div><span>Na plataforma</span>' + lista(pl) + '</div>' : ''}
      ${o.orientacoes ? `<p>${esc(o.orientacoes)}</p>` : ''}</div>`;
  }

  const CSS = `.selo-apoio{display:inline-block;background:#e8f3ff;color:#003B71;border:1px solid #b9d6f2;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px;white-space:nowrap;cursor:help}
  .quadro-apoio{background:#f0f7ff;border:1px solid #b9d6f2;border-left:4px solid #003B71;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-size:13px}
  .quadro-apoio>b{color:#003B71;display:block;margin-bottom:4px}.quadro-apoio span{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#5b6676}
  .quadro-apoio ul{margin:2px 0 6px 18px;padding:0}.quadro-apoio p{margin:4px 0 0;white-space:pre-wrap}`;
  const st = document.createElement('style'); st.textContent = CSS; (document.head || document.documentElement).appendChild(st);

  window.Apoio = { AVALIACAO, PLATAFORMA, carregar, selo, quadro, norm, esc, itens };
})();
