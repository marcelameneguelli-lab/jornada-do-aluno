const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']); g.gerarSenhas();
const p0=sh.d[1][6]; const e=post({acao:'nucleo.entrar',email:'marques.marcela@estacio.br',senha:p0}); const tM=post({acao:'nucleo.trocar_senha',token:e.token,atual:p0,nova:'Senha2026a'}).token;
const ac=(id,mat,base)=>({id,matricula:mat,atend:'Felipe',canal:'WhatsApp',motivo:'Engajamento',base});
t('acionamento da Par fica só na Par', ()=>{
  assert(post({acao:'engajamento.saveAction',token:tM,...ac('a1','111','impar')}).ok);
  assert(post({acao:'engajamento.saveAction',token:tM,...ac('a2','222','par')}).ok);
  const hi=post({acao:'engajamento.getHistory',token:tM,base:'impar'}).data, hp=post({acao:'engajamento.getHistory',token:tM,base:'par'}).data;
  assert(hi['111'] && !hi['222']); assert(hp['222'] && !hp['111']); });
t('histórico completo da Par não aceita acionamento da Ímpar e não apaga as linhas da Ímpar na planilha', ()=>{
  const r=post({acao:'engajamento.saveHistoryFull',token:tM,base:'par',history:{'111':[ac('a1','111','impar')],'222':[ac('a2','222','par'),ac('a3','222','par')]}}); assert(r.ok,JSON.stringify(r));
  const hp=post({acao:'engajamento.getHistory',token:tM,base:'par'}).data; assert(!hp['111'],'ímpar vazou para a par'); assert.equal(hp['222'].length,2);
  const hi=post({acao:'engajamento.getHistory',token:tM,base:'impar'}).data; assert(hi['111'],'a ímpar perdeu o acionamento');
  const linhas=g._ss.getSheetByName('Acionamentos').d.slice(1).filter(l=>l[1]); assert.equal(linhas.filter(l=>l[6]==='impar').length,1); assert.equal(linhas.filter(l=>l[6]==='par').length,2); });
t('aba antiga "historico" só aparece na base dela', ()=>{
  const h=g._ss.insertSheet ? (g._ss.getSheetByName('historico')||g._ss.insertSheet('historico')) : null; if(!h) return;
  h.appendRow(['id','datetime','matricula','atend','canal','motivo','obs','base']); h.appendRow(['h1','01/01/2026 10:00','333','Ana','Ligação','x','','impar']);
  assert(!post({acao:'engajamento.getHistory',token:tM,base:'par'}).data['333']); assert(post({acao:'engajamento.getHistory',token:tM,base:'impar'}).data['333']); });
console.log(ok+' testes de bases separadas passaram');
