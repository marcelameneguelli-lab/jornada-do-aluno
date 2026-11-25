/**
 * FERRAMENTAS DA EQUIPE: Calendário, Tarefas e Tutoriais.
 * Saíram de dentro do Engajamento (decisão de 20/11/2026) e ficam disponíveis
 * para todos os usuários logados, independente dos sistemas liberados.
 * Os dados e as regras são os do EngajaVR (mesmo armazenamento), então nada se perde.
 */

const ACOES_FERRAMENTAS = ['getEventos', 'saveEventos', 'getTarefas', 'saveTarefas', 'getTutoriais', 'saveTutoriais', 'getAtendentes'];

function Modulo_ferramentas() {
  const E = Engajamento_();
  const acoes = {};
  ACOES_FERRAMENTAS.forEach(nome => { acoes[nome] = (d) => E.acoes[nome](d); });
  acoes.getAtendentes = () => ({ ok: true, data: nomesEquipe_() }); // a equipe é a dos usuários da Jornada
  Object.assign(acoes, acoesRespostas_()); // Central de Respostas
  return { acoes: acoes, gestao: [], admin: [] };
}

/**
 * CENTRAL DE RESPOSTAS: modelos de WhatsApp da equipe.
 * Os modelos padrão ficam na página; aqui ficam só o que a equipe mudou (novos, editados, excluídos)
 * e a contagem de envios, compartilhados por todos os usuários. Chave: CentralRespostas.
 */
const CATEGORIAS_RESPOSTAS = ['renovacao', 'trancamento', 'bolsa', 'financeiro', 'estagio', 'engajamento', 'atendimento', 'contatos', 'documentos', 'academico', 'objecoes'];

function respLer_() {
  const o = cobLerJson_('CentralRespostas', null) || {};
  return { custom: o.custom || [], editados: o.editados || {}, removidos: o.removidos || [], usos: o.usos || {}, usosPor: o.usosPor || {}, log: o.log || [] };
}
function respSaida_(o, eu) {
  return { custom: o.custom, editados: o.editados, removidos: o.removidos, usos: o.usos, meusUsos: (o.usosPor || {})[eu.nome] || 0 };
}
function respAlterar_(eu, fn) {
  const lock = bloqueio_(20000);
  try {
    const o = respLer_();
    const r = fn(o);
    if (r && r.ok === false) return r;
    o.log = (o.log || []).concat(r && r.log ? [{ quem: eu.nome, ts: Date.now(), o: r.log }] : []).slice(-300);
    Engajamento_().storeSet('CentralRespostas', JSON.stringify(o));
    return { ok: true, dados: respSaida_(o, eu) };
  } finally { lock.releaseLock(); }
}
function respLimpo_(m) {
  const titulo = String(m.titulo || '').trim().slice(0, 150), texto = String(m.texto || '').trim().slice(0, 6000);
  if (!titulo || !texto) return null;
  const categoria = CATEGORIAS_RESPOSTAS.indexOf(m.categoria) >= 0 ? m.categoria : 'atendimento';
  const tags = (Array.isArray(m.tags) ? m.tags : []).map(t => String(t).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  return { categoria: categoria, titulo: titulo, tags: tags, texto: texto };
}

function acoesRespostas_() {
  return {
    respostas_dados: (d, eu) => ({ ok: true, dados: respSaida_(respLer_(), eu) }),
    respostas_salvar: (d, eu) => respAlterar_(eu, o => {
      const m = d.modelo || {}, limpo = respLimpo_(m);
      if (!limpo) return { ok: false, erro: 'Preencha pelo menos o título e o texto.' };
      const id = String(m.id || '');
      if (!id) { // novo modelo da equipe
        o.custom.push(Object.assign({ id: 'custom_' + Date.now(), autor: eu.nome, criado: Date.now() }, limpo));
        return { log: 'criou "' + limpo.titulo + '"' };
      }
      const i = o.custom.findIndex(x => x.id === id);
      if (i >= 0) { o.custom[i] = Object.assign({}, o.custom[i], limpo, { editadoPor: eu.nome, editado: Date.now() }); return { log: 'editou "' + limpo.titulo + '"' }; }
      o.editados[id] = Object.assign({}, limpo, { editadoPor: eu.nome, editado: Date.now() }); // modelo padrão: versão da equipe
      return { log: 'editou o modelo padrão "' + limpo.titulo + '"' };
    }),
    respostas_restaurar: (d, eu) => respAlterar_(eu, o => { delete o.editados[String(d.id)]; return { log: 'restaurou o original de ' + d.id }; }),
    respostas_excluir: (d, eu) => respAlterar_(eu, o => {
      const id = String(d.id || '');
      if (!id) return { ok: false, erro: 'Modelo não informado.' };
      const i = o.custom.findIndex(x => x.id === id);
      if (i >= 0) o.custom.splice(i, 1);
      else { if (o.removidos.indexOf(id) < 0) o.removidos.push(id); delete o.editados[id]; }
      return { log: 'excluiu ' + id };
    }),
    respostas_uso: (d, eu) => respAlterar_(eu, o => {
      const id = String(d.id || '').slice(0, 80);
      if (!id) return { ok: false, erro: 'Modelo não informado.' };
      o.usos[id] = (o.usos[id] || 0) + 1;
      o.usosPor = o.usosPor || {}; o.usosPor[eu.nome] = (o.usosPor[eu.nome] || 0) + 1;
      return {};
    }),
  };
}
