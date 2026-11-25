const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']);
sh.appendRow(['Felipe','felipe@estacio.br','atendente','bolsa','sim']);
sh.appendRow(['Alice','alice@estacio.br','atendente','provas','sim']);
g.gerarSenhas();
const login=(email,linha,nova)=>{ const p=sh.d[linha-1][6]; const e=post({acao:'nucleo.entrar',email,senha:p}); return post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova}).token; };
const tM=login('marques.marcela@estacio.br',2,'Senha2026a'), tF=login('felipe@estacio.br',3,'Senha2026b'), tA=login('alice@estacio.br',4,'Senha2026c');
g.renovacao_configurarPlanilha();
post({acao:'engajamento.salvarBase',token:tM,base:'impar',dados:[
  {COD_MATRICULA:'202501000001',NOM_ALUNO:'Ana Bolsista',NOM_CURSO:'Direito',NOM_SITUACAO_ALUNO:'MATRICULADO',PCT_BOLSA_PERMANENCIA_ATU:'20',NUM_CELULAR:'24999990000'},
  {COD_MATRICULA:'202501000002',NOM_ALUNO:'Beto Teste',NOM_CURSO:'Enfermagem',NOM_SITUACAO_ALUNO:'CANCELADO'}]});
const reg=(o)=>Object.assign({mat:'202501000001',modalidade:'PRESENCIAL',pct:'30',pctAnt:'20',tipo:'RETENÇÃO',status:'em_analise'},o);
t('sem o sistema não acessa', ()=>{ assert.equal(post({acao:'bolsa.dados',token:tA,periodo:'26.3'}).permissao,false); });
t('salva solicitação e cruza com a base líquida', ()=>{ const r=post({acao:'bolsa.salvar',token:tF,periodo:'26.3',registro:reg({})}); assert(r.ok,JSON.stringify(r)); const d=post({acao:'bolsa.dados',token:tF,periodo:'26.3'}); assert.equal(d.solicitacoes.length,1); const s=d.solicitacoes[0]; assert.equal(s.pct,30); assert.equal(s.base.nome,'Ana Bolsista'); assert.equal(Number(s.base.pctBase),20); assert.deepEqual(d.periodos,['26.3']); assert.equal(d.gestao,false); });
t('período inválido é recusado', ()=>{ assert.equal(post({acao:'bolsa.salvar',token:tF,periodo:'2026',registro:reg({})}).ok,false); });
t('uma solicitação por aluno no período', ()=>{ assert.equal(post({acao:'bolsa.salvar',token:tF,periodo:'26.3',registro:reg({})}).ok,false); });
t('mudar status guarda histórico e data de lançamento', ()=>{ const s=post({acao:'bolsa.dados',token:tF,periodo:'26.3'}).solicitacoes[0]; const r=post({acao:'bolsa.salvar',token:tF,periodo:'26.3',registro:Object.assign({},s,{status:'lancada',consumo:1500})}); assert(r.ok,JSON.stringify(r)); const n=post({acao:'bolsa.dados',token:tF,periodo:'26.3'}).solicitacoes[0]; assert.equal(n.status,'lancada'); assert(n.dataLanc); assert(n.historico.length>=1); });
t('atendente não mexe no pool nem exclui', ()=>{ assert.equal(post({acao:'bolsa.pool',token:tF,periodo:'26.3',pool:{PRESENCIAL:10000}}).ok,false); const s=post({acao:'bolsa.dados',token:tF,periodo:'26.3'}).solicitacoes[0]; assert.equal(post({acao:'bolsa.excluir',token:tF,id:s.id}).ok,false); });
t('coordenação define o pool', ()=>{ const r=post({acao:'bolsa.pool',token:tM,periodo:'26.3',pool:{PRESENCIAL:10000,EAD:''}}); assert(r.ok,JSON.stringify(r)); const d=post({acao:'bolsa.dados',token:tM,periodo:'26.3'}); assert.equal(d.pool.PRESENCIAL,10000); assert.equal(d.gestao,true); });
t('importar (atendente pela Central): cria, atualiza sem apagar o que a equipe preencheu', ()=>{ const r=post({acao:'bolsa.importar',token:tF,periodo:'26.3',respostas:[
  {mat:'202501000001',modalidade:'PRESENCIAL',pct:30,tipo:'RETENÇÃO',status:'lancada',consumo:'',pendencias:''},
  {mat:'202501000002',nome:'Beto Teste',modalidade:'EAD',pct:'50',tipo:'PERDA DE EMPREGO',status:'em_analise'}]});
  assert(r.ok,JSON.stringify(r)); assert.equal(r.novas,1); assert.equal(r.atualizadas,1);
  const d=post({acao:'bolsa.dados',token:tF,periodo:'26.3'}); assert.equal(d.solicitacoes.length,2); assert.equal(d.solicitacoes.find(s=>s.mat==='202501000001').consumo,1500); });
t('períodos ficam separados', ()=>{ assert.equal(post({acao:'bolsa.dados',token:tF,periodo:'27.1'}).solicitacoes.length,0); });
t('coordenação exclui', ()=>{ const s=post({acao:'bolsa.dados',token:tM,periodo:'26.3'}).solicitacoes.find(x=>x.mat==='202501000002'); assert(post({acao:'bolsa.excluir',token:tM,id:s.id}).ok); assert.equal(post({acao:'bolsa.dados',token:tM,periodo:'26.3'}).solicitacoes.length,1); });
t('Central de Bases mostra a bolsa', ()=>{ const r=post({acao:'nucleo.bases_resumo',token:tF}); assert(r.ok,JSON.stringify(r)); assert.equal(r.bolsa.total,1); assert.equal(r.bolsa.ultimo,'26.3'); });
t('buscar aluno', ()=>{ const r=post({acao:'bolsa.buscar_aluno',token:tF,matricula:'202501000001'}); assert(r.ok); assert.equal(r.nome,'Ana Bolsista'); });
console.log(ok+' testes da Bolsa Permanência passaram');
