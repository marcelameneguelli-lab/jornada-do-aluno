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
  return { acoes: acoes, gestao: [], admin: [] };
}
