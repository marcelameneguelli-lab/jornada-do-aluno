// Base grande → base menor (errada) → base grande de novo: o servidor tem que devolver sempre a última
const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,2).join(' ')); process.exitCode=1; } };
g.configurar(); const sh=g._ss.getSheetByName('usuarios'); sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']); g.gerarSenhas();
const p=sh.d[1][6]; const e=post({acao:'nucleo.entrar',email:'marques.marcela@estacio.br',senha:p}); const tk=post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova:'Senha2026a'}).token;
const base=(n,pref)=>Array.from({length:n},(_,i)=>({COD_MATRICULA:String(202600000000+i),NOM_ALUNO:pref+i,QTD_ELEGIVEL_AV_POLO:'1'}));
const enviar=(dados)=>{ const C=400, P=Math.ceil(dados.length/C); let r; for(let i=0;i<P;i++){ r=post({acao:'engajamento.salvarBase',token:tk,base:'impar',dados:dados.slice(i*C,(i+1)*C),parte:i,total:P}); assert(r.ok,JSON.stringify(r)); } return r; };
const ler=()=>post({acao:'provas.carregarBase',token:tk,base:'impar'}).dados;
t('base grande (2.309)', ()=>{ enviar(base(2309,'A')); assert.equal(ler().length,2309); });
t('base menor por engano (1.794)', ()=>{ enviar(base(1794,'B')); const d=ler(); assert.equal(d.length,1794); assert.equal(d[0].NOM_ALUNO,'B0'); });
t('base certa de novo (2.309): Provas pega a nova, não a da lixeira', ()=>{ enviar(base(2309,'C')); const d=ler(); assert.equal(d.length,2309); assert.equal(d[0].NOM_ALUNO,'C0'); });
t('Central de Bases mostra o total certo', ()=>{ assert.equal(post({acao:'nucleo.bases_resumo',token:tk}).engajamento.impar.total,2309); });
console.log(ok+' testes de reenvio da base passaram');
