const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']);
sh.appendRow(['Felipe','felipe@estacio.br','atendente','evasao','sim']);
sh.appendRow(['Alice','alice@estacio.br','atendente','provas','sim']);
g.gerarSenhas();
const login=(email,linha,nova)=>{ const p=sh.d[linha-1][6]; const e=post({acao:'nucleo.entrar',email,senha:p}); return post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova}).token; };
const tM=login('marques.marcela@estacio.br',2,'Senha2026a'), tF=login('felipe@estacio.br',3,'Senha2026b'), tA=login('alice@estacio.br',4,'Senha2026c');
g.renovacao_configurarPlanilha();
post({acao:'engajamento.salvarBase',token:tM,base:'impar',dados:[
  {COD_MATRICULA:'202501000001',NOM_ALUNO:'Ana Cancelada',NOM_CURSO:'Direito',NOM_SITUACAO_ALUNO:'CANCELADO',VLR_DIVIDA:'1.250,50'},
  {COD_MATRICULA:'202501000002',NOM_ALUNO:'Beto Trancado',NOM_CURSO:'Direito',NOM_SITUACAO_ALUNO:'TRANCADO'},
  {COD_MATRICULA:'202501000003',NOM_ALUNO:'Caio Ativo',NOM_CURSO:'Direito',NOM_SITUACAO_ALUNO:'MATRICULADO'}],parte:0,total:1});
t('sem o sistema não acessa', ()=>{ assert.equal(post({acao:'evasao.matriculados',token:tA,base:'impar'}).permissao,false); });
t('cancelados e trancados da base aparecem sozinhos, sem objeção', ()=>{ const r=post({acao:'evasao.matriculados',token:tF,base:'impar'}); assert(r.ok,JSON.stringify(r)); assert.equal(r.dados.length,2); assert.equal(r.daBase,2); const a=r.dados.find(x=>x.mat==='202501000001'); assert.equal(a.sit,'cancelado'); assert.equal(a.divida,'1250,50'); assert.equal(a.obj,''); });
t('períodos separados: Par não mostra o Ímpar', ()=>{ assert.equal(post({acao:'evasao.matriculados',token:tF,base:'par'}).dados.length,0); });
t('objeção fora da lista é recusada', ()=>{ const r=post({acao:'evasao.salvar',token:tF,base:'impar',registro:{mat:'202501000001',sit:'cancelado',obj:'Qualquer coisa'}}); assert.equal(r.ok,false); });
t('"Outro" exige descrever o motivo', ()=>{ const r=post({acao:'evasao.salvar',token:tF,base:'impar',registro:{mat:'202501000001',sit:'cancelado',obj:'Outro'}}); assert.equal(r.ok,false); assert(/descreva/i.test(r.erro)); });
t('salva com "Outro" e o motivo, no nome de quem está logado', ()=>{ const r=post({acao:'evasao.salvar',token:tF,base:'impar',registro:{mat:'202501000001',nome:'Ana Cancelada',sit:'cancelado',obj:'Outro',obj_outro:'Vai morar fora do país',atend:'Fulano'}}); assert(r.ok,JSON.stringify(r)); const l=post({acao:'evasao.matriculados',token:tF,base:'impar'}).dados; assert.equal(l.length,2); const a=l.find(x=>x.mat==='202501000001'); assert.equal(a.obj_outro,'Vai morar fora do país'); assert.equal(a.atend,'Felipe'); assert(!a._importado); assert.equal(a.id,'ev_202501000001'); });
t('reverter guarda o histórico da situação anterior', ()=>{ const r=post({acao:'evasao.salvar',token:tF,base:'impar',registro:{mat:'202501000001',nome:'Ana Cancelada',sit:'revertido',obj:'Financeiro: não consegue pagar a mensalidade'}}); assert(r.ok); const a=post({acao:'evasao.matriculados',token:tF,base:'impar'}).dados.find(x=>x.mat==='202501000001'); assert.equal(a.sit,'revertido'); assert.equal(a.historico[0].sit,'cancelado'); });
t('excluir só para gestão', ()=>{ assert.equal(post({acao:'evasao.excluir',token:tF,base:'impar',id:'ev_202501000001'}).permissao,false); assert(post({acao:'evasao.excluir',token:tM,base:'impar',id:'ev_202501000001'}).ok); });
// Renovação: dois ciclos, um aberto e um encerrado
const al=(id,c,st)=>({id, nome:'Aluno '+id, matricula:'2024'+id, curso:'Direito', modalidade:'Presencial', ciclo:c, status:st});
post({acao:'renovacao.importar_alunos',token:tM,alunos:[al('R1','2026.1','pendente'),al('R2','2026.1','pendente')],ciclo:'2026.1'});
post({acao:'renovacao.importar_alunos',token:tM,alunos:[al('R3','2025.2','pendente')],ciclo:'2025.2'});
post({acao:'renovacao.salvar_acionamento',token:tM,acionamento:{id:'x1',alunoId:'R1',nomeAluno:'Aluno R1',tipo:'WhatsApp',obs:'Não vai seguir [Objeção: Mudança de cidade | foi para SP]',stAl:'Evadido',ciclo:'2026.1'}});
post({acao:'renovacao.salvar_acionamento',token:tM,acionamento:{id:'x2',alunoId:'R2',nomeAluno:'Aluno R2',tipo:'Ligação',obs:'Pediu trancamento',stAl:'Trancamento',ciclo:'2026.1'}});
post({acao:'renovacao.salvar_acionamento',token:tM,acionamento:{id:'x3',alunoId:'R3',nomeAluno:'Aluno R3',tipo:'WhatsApp',obs:'[Objeção: Trabalho / falta de tempo]',stAl:'Evadido',ciclo:'2025.2'}});
const futuro=new Date(Date.now()+20*864e5), pass=new Date(Date.now()-40*864e5); const br=d=>('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
post({acao:'renovacao.salvar_config',token:tM,chave:'ciclo_cfg',valor:JSON.stringify({'2026.1':{prazo:br(futuro)},'2025.2':{prazo:br(pass)}})});
t('Renovação lista evadidos e trancados com a objeção, por ciclo', ()=>{ const r=post({acao:'evasao.renovacao',token:tF}); assert(r.ok,JSON.stringify(r)); assert.equal(r.ciclos.length,2); const c1=r.ciclos.find(c=>c.ciclo==='2026.1'); assert.equal(c1.alunos.length,2); assert(c1.aberto); const a=c1.alunos.find(x=>x.id==='R1'); assert.equal(a.obj,'Mudança de cidade'); assert.equal(a.detalhe,'foi para SP'); assert.equal(a.colab,'Marcela'); const c2=r.ciclos.find(c=>c.ciclo==='2025.2'); assert.equal(c2.aberto,false); assert.equal(c2.paridade,'par'); });
t('filtro por período (ímpar)', ()=>{ const r=post({acao:'evasao.renovacao',token:tF,paridade:'impar'}); assert.deepEqual(r.ciclos.map(c=>c.ciclo),['2026.1']); });
t('ciclo encerrado não reverte: vai para recaptura', ()=>{ const r=post({acao:'evasao.reverter',token:tF,alunoId:'R3',ciclo:'2025.2',status:'Renovado',obs:'voltou'}); assert.equal(r.ok,false); assert(/recaptura/.test(r.erro)); });
t('reverter exige descrever', ()=>{ assert.equal(post({acao:'evasao.reverter',token:tF,alunoId:'R1',ciclo:'2026.1',status:'Em negociação',obs:''}).ok,false); });
t('ciclo aberto reverte o status e registra o acionamento', ()=>{ const r=post({acao:'evasao.reverter',token:tF,alunoId:'R1',nomeAluno:'Aluno R1',ciclo:'2026.1',status:'Em negociação',obs:'Aceitou negociar'}); assert(r.ok,JSON.stringify(r)); const c1=post({acao:'evasao.renovacao',token:tF}).ciclos.find(c=>c.ciclo==='2026.1'); assert.equal(c1.alunos.length,1); const ac=g._ss.getSheetByName('Acionamentos').d.find(l=>String(l[4])==='Reversão de evasão'); assert(ac && ac[3]==='Felipe'); });
post({acao:'engajamento.salvarBase',token:tM,base:'ct',dados:[
  {COD_MATRICULA:'202503000001',NOM_ALUNO:'He Sim',NOM_CURSO:'Enfermagem',NOM_SITUACAO_ALUNO:'MATRICULADO',SOLICITAR_HE:'1',INDICIO_EVASAO:'',DT_AGEND_TRANC:'',STATUS_AGEND_TRANC:''},
  {COD_MATRICULA:'202503000002',NOM_ALUNO:'Indicio Alto',NOM_CURSO:'Enfermagem',NOM_SITUACAO_ALUNO:'MATRICULADO',SOLICITAR_HE:'0',INDICIO_EVASAO:'ALTO',DT_AGEND_TRANC:'2026-12-10',STATUS_AGEND_TRANC:'AGENDADO'},
  {COD_MATRICULA:'202503000003',NOM_ALUNO:'Sem Sinal',NOM_CURSO:'Enfermagem',NOM_SITUACAO_ALUNO:'MATRICULADO',SOLICITAR_HE:'0',INDICIO_EVASAO:'NÃO',DT_AGEND_TRANC:'',STATUS_AGEND_TRANC:'-'},
  {COD_MATRICULA:'202503000004',NOM_ALUNO:'Trancou Com HE',NOM_CURSO:'Enfermagem',NOM_SITUACAO_ALUNO:'TRANCADO',SOLICITAR_HE:'1'}],parte:0,total:1});
t('indícios da base: HE = 1, INDICIO_EVASAO e trancamento agendado', ()=>{ const r=post({acao:'evasao.matriculados',token:tF,base:'ct'}); assert.equal(r.dados.length,3,JSON.stringify(r.dados.map(x=>x.nome))); assert.equal(r.comIndicio,2);
  const a=r.dados.find(x=>x.mat==='202503000001'); assert.equal(a.sit,'indicio'); assert.deepEqual(a.indicios.map(i=>i.texto),['Solicitou HE']);
  const b=r.dados.find(x=>x.mat==='202503000002'); assert.deepEqual(b.indicios.map(i=>i.texto),['Indício: ALTO','Trancamento agendado 10/12/2026 (AGENDADO)']);
  const c=r.dados.find(x=>x.mat==='202503000004'); assert.equal(c.sit,'trancado'); assert.equal(c.indicios[0].tipo,'he'); });
t('indício pode ser salvo sem objeção e continua mostrando os sinais', ()=>{ const s=post({acao:'evasao.salvar',token:tF,base:'ct',registro:{mat:'202503000001',nome:'He Sim',sit:'indicio',obs:'Liguei, vai pensar'}}); assert(s.ok,JSON.stringify(s)); const a=post({acao:'evasao.matriculados',token:tF,base:'ct'}).dados.find(x=>x.mat==='202503000001'); assert(!a._importado); assert.equal(a.atend,'Felipe'); assert.equal(a.indicios[0].texto,'Solicitou HE'); });
t('config traz a lista de objeções com "Outro"', ()=>{ const r=post({acao:'evasao.config',token:tF}); assert(r.objecoes.includes('Outro') && r.objecoes.length===13); });
console.log(ok+' testes da Evasão passaram');
