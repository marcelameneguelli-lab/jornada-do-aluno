const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']);
sh.appendRow(['Felipe','felipe@estacio.br','atendente','estagio','sim']);
g.gerarSenhas();
const login=(email,linha,nova)=>{ const p=sh.d[linha-1][6]; const e=post({acao:'nucleo.entrar',email,senha:p}); return post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova}).token; };
const tM=login('marques.marcela@estacio.br',2,'Senha2026a'), tF=login('felipe@estacio.br',3,'Senha2026b');
post({acao:'engajamento.salvarBase',token:tM,base:'par',dados:[{COD_MATRICULA:'202301000001',NOM_ALUNO:'Ana Estagio',NOM_CURSO:'Nutrição',NUM_TELEF_CELULAR:'24999990001',END_EMAIL:'ana@x.com'}],parte:0,total:1});
const al=(m,tce)=>({COD_MATRICULA:m,NOM_CURSO:'NUTRICAO',tce,disciplinas:[{disc:'ESTAGIO',tce}]});
t('atendente não importa', ()=>{ assert.equal(post({acao:'estagio.importar',token:tF,respostas:[al('202301000001','nao_iniciado')]}).permissao,false); });
t('importa em partes e completa nome e contato pela base líquida', ()=>{
  let r=post({acao:'estagio.importar',token:tM,respostas:[al('202301000001','nao_iniciado')],parte:0,total:2}); assert(r.ok&&r.parcial);
  r=post({acao:'estagio.importar',token:tM,respostas:[al('202301000002','deferido'),al('202301000003','andamento')],parte:1,total:2}); assert(r.ok,JSON.stringify(r)); assert.equal(r.total,3); assert.equal(r.novas,3);
  const l=post({acao:'estagio.bi',token:tF}).dados; assert.equal(l.length,3); const a=l.find(x=>x.COD_MATRICULA==='202301000001'); assert.equal(a.NOM_ALUNO,'Ana Estagio'); assert.equal(a.NUM_TELEF_CELULAR,'24999990001'); assert.equal(a.base_engajamento,'par'); });
t('nova importação substitui a lista e marca quem mudou de TCE', ()=>{
  const r=post({acao:'estagio.importar',token:tM,respostas:[al('202301000001','deferido'),al('202301000002','deferido')],parte:0,total:1}); assert.equal(r.mudaram,1); assert.equal(r.sairam,1); assert.equal(r.novas,0);
  const l=post({acao:'estagio.bi',token:tF}).dados; assert.equal(l.length,2); const a=l.find(x=>x.COD_MATRICULA==='202301000001'); assert.equal(a.mudou.de,'nao_iniciado'); assert.equal(a.mudou.para,'deferido'); });
t('acionamento do estágio grava pela matrícula', ()=>{ const r=post({acao:'estagio.registrar',token:tF,reg:{matricula:'202301000001',base:'par',aluno:'Ana',canal:'WhatsApp',resultado:'TCE aberto',obs:'ok'}}); assert(r.ok); assert.equal(post({acao:'estagio.listar',token:tF}).regs[0].atendente,'Felipe'); });
t('Central de Bases mostra o relatório do BI', ()=>{ const r=post({acao:'nucleo.bases_resumo',token:tM}); assert.equal(r.estagio.total,2); assert.equal(r.estagio.disciplinas,2); });
console.log(ok+' testes do Estágio (BI) passaram');
