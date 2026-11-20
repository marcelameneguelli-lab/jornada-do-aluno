/* Jornada do Aluno · configuração geral do aplicativo */
window.JORNADA = {
  nome: 'Jornada do Aluno',
  subtitulo: 'Secretaria Acadêmica VR',
  versao: '1.0.0',
  // URL da implantação do Apps Script (termina em /exec). Preencher depois de publicar o backend.
  gasUrl: 'https://script.google.com/macros/s/AKfycby-J1CZXGCFVRALueDrP_GS2cVaSN-KuZB5y5RI3llchFtcsPaiZcrE5yMxjEBCzdt1/exec',
  sistemas: [
    { id: 'renovacao',   nome: 'Renovação',   icone: '🔄', descricao: 'Renovação de matrícula, ciclos ímpar e par', etapa: 3, pronto: true },
    { id: 'engajamento', nome: 'Engajamento', icone: '🤝', descricao: 'Acompanhamento e engajamento dos alunos (bases Ímpar, Par e Técnico)', etapa: 4, pronto: true },
    { id: 'provas',      nome: 'Provas',      icone: '📝', descricao: 'AV, AVS, SM e simulados', etapa: 5 },
    { id: 'estagio',     nome: 'Estágio',     icone: '💼', descricao: 'Elegíveis, TCE e documentos', etapa: 5 },
    { id: 'financeiro',  nome: 'Financeiro',  icone: '💰', descricao: 'Vencimentos e inadimplência', etapa: 5 },
    { id: 'financiamentos', nome: 'Financiamentos', icone: '🏦', descricao: 'ProUni, FIES, Pravaler e Ficou Fácil: aproveitamento e termos', etapa: 6 },
    { id: 'nps',         nome: 'NPS',         icone: '⭐', descricao: 'Base do Medallia: promotores, neutros e detratores', etapa: 6 },
    { id: 'formandos',   nome: 'Formandos',   icone: '🎓', descricao: 'Prováveis formandos e colação de grau', etapa: 2, pronto: true },
  ],
  // Ferramentas da equipe: valem para todos os usuários, fora dos sistemas (decisão de 20/11/2026)
  ferramentas: [
    { id: 'calendario', nome: 'Calendário', icone: '🗓️', descricao: 'Eventos e datas importantes da equipe' },
    { id: 'tarefas',    nome: 'Tarefas',    icone: '✅', descricao: 'Tarefas atribuídas, prazos e andamento' },
    { id: 'tutoriais',  nome: 'Tutoriais',  icone: '📚', descricao: 'Materiais de apoio e modelos' },
  ],
};
