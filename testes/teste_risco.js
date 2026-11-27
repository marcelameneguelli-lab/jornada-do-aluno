const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); g.renovacao_configurarPlanilha(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']);
sh.appendRow(['Felipe','felipe@estacio.br','atendente','risco,financeiro','sim']);
sh.appendRow(['Alice','alice@estacio.br','atendente','provas','sim']);
g.gerarSenhas();
const login=(email,linha,nova)=>{ const p=sh.d[linha-1][6]; const e=post({acao:'nucleo.entrar',email,senha:p}); return post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova}).token; };
const tM=login('marques.marcela@estacio.br',2,'Senha2026a'), tF=login('felipe@estacio.br',3,'Senha2026b'), tA=login('alice@estacio.br',4,'Senha2026c');
const b=(m,x)=>Object.assign({COD_MATRICULA:m,NOM_ALUNO:'Aluno '+m.slice(-1),NOM_CURSO:'Direito',NOM_SITUACAO_ALUNO:'MATRICULADO'},x);
post({acao:'engajamento.salvarBase',token:tM,base:'impar',parte:0,total:1,dados:[
  b('202601000001',{INADIMPLENTE:'S',VAL_DIVIDA:'1.500,00',SOLICITAR_HE:'1',STATUS_AGEND_AV:'FALTA AGENDAR 2 DISCIPLINAS',CLASSE_PAGANTE_SEMESTRE:'FIES',PCT_APROVACAO_ANT:'60'}),
  b('202601000002',{INADIMPLENTE:'S',VAL_DIVIDA:'300'}),
  b('202601000003',{PROPENSAO_EVASAO:'Alto',STATUS_AGEND_AVS:'FALTOU'}),
  b('202601000004',{}),
  b('202601000005',{INADIMPLENTE:'S',VAL_DIVIDA:'900',NOM_SITUACAO_ALUNO:'CANCELADO'}),
  b('202601000006',{DT_AGEND_TRANC:'2026-12-10',STATUS_AGEND_TRANC:'AGENDADO'})]});
post({acao:'estagio.importar',token:tM,respostas:[{COD_MATRICULA:'202601000002',tce:'nao_iniciado',foraPrazo:true,disciplinas:[]}],parte:0,total:1});
post({acao:'evasao.salvar',token:tM,base:'impar',registro:{mat:'202601000003',nome:'Aluno 3',sit:'intencao',obj:'Mudança de cidade'}});
post({acao:'financeiro.registrar',token:tF,reg:{matricula:'202601000002',base:'impar',aluno:'Aluno 2',canal:'WhatsApp',resultado:'Sem retorno',obs:'x'}});
post({acao:'renovacao.importar_alunos',token:tM,ciclo:'2026.1',alunos:[{id:'R6',nome:'Aluno 6',matricula:'202601000006',curso:'Direito',modalidade:'Presencial',ciclo:'2026.1',status:'pendente'}]});
let r;
t('só quem tem o sistema acessa', ()=>{ assert.equal(post({acao:'risco.lista',token:tA,base:'impar'}).permissao,false); });
t('cruza os sinais por aluno, marca a situação (quem saiu vem marcado) e ignora quem não tem sinal', ()=>{ r=post({acao:'risco.lista',token:tF,base:'impar'}); assert(r.ok,JSON.stringify(r)); const at=r.alunos.filter(a=>!/CANCELAD|TRANCAD|TRANSFER/.test(a.situacao)).map(a=>a.mat).sort(); assert.deepEqual(at,['202601000001','202601000002','202601000003','202601000006']); assert(r.alunos.every(a=>'situacao' in a)); });
t('aluno 1: cobrança, evasão (HE), provas e financiamento = 4 áreas, primeiro da lista', ()=>{ const a=r.alunos[0]; assert.equal(a.mat,'202601000001'); assert.equal(a.areas,4); assert.deepEqual(a.sinais.map(x=>x.id),['divida','divida_alta','he','prova','aproveitamento']); });
t('aluno 2: dívida + TCE vencido do BI, com o último contato da Cobrança', ()=>{ const a=r.alunos.find(x=>x.mat==='202601000002'); assert.deepEqual(a.sinais.map(x=>x.id),['divida','tce']); assert.equal(a.contato.quem,'Felipe'); assert.equal(a.contato.onde,'Cobrança'); });
t('aluno 3: intenção de saída, propensão alta e faltou à AVS', ()=>{ const a=r.alunos.find(x=>x.mat==='202601000003'); assert.deepEqual(a.sinais.map(x=>x.id).sort(),['intencao','propensao','prova']); assert.equal(a.contato.onde,'Evasão'); });
t('aluno 6: trancamento agendado + renovação pendente no ciclo aberto', ()=>{ const a=r.alunos.find(x=>x.mat==='202601000006'); assert.deepEqual(a.sinais.map(x=>x.id),['tranc_agend','renovacao']); });
t('Par não mistura o Ímpar', ()=>{ assert.equal(post({acao:'risco.lista',token:tF,base:'par'}).alunos.length,0); });
console.log(ok+' testes do painel de risco passaram');
