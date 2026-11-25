/* Jornada do Aluno · configuração geral do aplicativo */
window.JORNADA = {
  nome: 'Jornada do Aluno',
  subtitulo: 'Secretaria Acadêmica VR',
  versao: '1.7.1',
  // URL da implantação do Apps Script (termina em /exec). Preencher depois de publicar o backend.
  gasUrl: 'https://script.google.com/macros/s/AKfycby-J1CZXGCFVRALueDrP_GS2cVaSN-KuZB5y5RI3llchFtcsPaiZcrE5yMxjEBCzdt1/exec',
  sistemas: [
    { id: 'renovacao',   nome: 'Renovação',   icone: '🔄', descricao: 'Renovação de matrícula, ciclos ímpar e par', etapa: 3, pronto: true },
    { id: 'engajamento', nome: 'Engajamento', icone: '🤝', descricao: 'Acompanhamento e engajamento dos alunos (bases Ímpar, Par e Técnico)', etapa: 4, pronto: true },
    { id: 'provas',      nome: 'Provas',      icone: '📝', descricao: 'AV e AVS no polo: agendamento e acompanhamento', etapa: 5, pronto: true, pagina: 'modulos/acompanhamento/index.html?sistema=provas' },
    { id: 'estagio',     nome: 'Estágio',     icone: '💼', descricao: 'Relatório do BI: TCE, prazos e documentação', etapa: 5, pronto: true, pagina: 'modulos/acompanhamento/index.html?sistema=estagio' },
    { id: 'financeiro',  nome: 'Cobrança',    icone: '💰', descricao: 'Régua de cobrança, promessas, acordos e evolução da inadimplência', etapa: 5, pronto: true, pagina: 'modulos/cobranca/index.html' },
    { id: 'financiamentos', nome: 'Financiamentos', icone: '🏦', descricao: 'ProUni, FIES, Pravaler e Ficou Fácil: aproveitamento e termos', etapa: 6, pronto: true, pagina: 'modulos/acompanhamento/index.html?sistema=financiamentos' },
    { id: 'nps',         nome: 'NPS',         icone: '⭐', descricao: 'Base do Medallia: promotores, neutros e detratores', etapa: 6, pronto: true, pagina: 'modulos/acompanhamento/index.html?sistema=nps' },
    { id: 'apoio',       nome: 'Apoio às Avaliações', icone: '🧩', descricao: 'Orientações do NAAP/NAE para avaliações e uso da plataforma', etapa: 8, pronto: true, pagina: 'modulos/apoio/index.html' },
    { id: 'risco',       nome: 'Alunos em risco', icone: '🚨', descricao: 'Quem acumula sinais em vários sistemas: dívida, evasão, provas, estágio, financiamento e renovação', etapa: 9, pronto: true, pagina: 'modulos/risco/index.html' },
    { id: 'evasao',      nome: 'Evasão',      icone: '🚪', descricao: 'Matriculados (cancelados, trancados, intenção de saída) e evadidos da Renovação, por período', etapa: 8, pronto: true, pagina: 'modulos/evasao/index.html' },
    { id: 'formandos',   nome: 'Formandos',   icone: '🎓', descricao: 'Prováveis formandos e colação de grau', etapa: 2, pronto: true },
  ],
  // Ferramentas da equipe: valem para todos os usuários, fora dos sistemas (decisão de 20/11/2026)
  ferramentas: [
    { id: 'calendario', nome: 'Calendário', icone: '🗓️', descricao: 'Eventos e datas importantes da equipe' },
    { id: 'tarefas',    nome: 'Tarefas',    icone: '✅', descricao: 'Tarefas atribuídas, prazos e andamento' },
    { id: 'tutoriais',  nome: 'Tutoriais',  icone: '📚', descricao: 'Materiais de apoio e modelos' },
    { id: 'respostas',  nome: 'Central de Respostas', icone: '💬', descricao: 'Modelos de mensagem para o WhatsApp, com busca pelo que o aluno escreveu', pagina: 'modulos/respostas/index.html' },
  ],
};
