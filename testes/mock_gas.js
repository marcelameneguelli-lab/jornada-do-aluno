// Simulação mínima dos serviços do Apps Script para testar o backend.
const crypto = require('crypto'), vm = require('vm'), fs = require('fs');
function toBytes(buf){ return Array.from(buf).map(b=> b>127? b-256 : b); }
const NOOP = new Set(['setFontWeight','setNumberFormat','setBackground','setFontColor','setFontSize','setBackgrounds','setFontWeights','setHorizontalAlignment','setWrap','setBorder','clearFormat','setNote','setFontColors','setDataValidation','setNumberFormats','activate','setVerticalAlignment','merge','clearContent','setFontStyle']);
function encadeavel(obj){ return new Proxy(obj,{ get(t,k){ if(k in t) return t[k]; if(typeof k==='string' && (NOOP.has(k) || /^set|^clear|^insert|^auto|^hide|^show|^protect/.test(k))) return function(){ return this; }; return undefined; } }); }
class Range { constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr:nr||1,nc:nc||1}); return encadeavel(this);}
  getDisplayValues(){ return this.getValues().map(r=>r.map(v=> v instanceof Date ? v.toISOString() : String(v))); }
  getRow(){return this.r;} getColumn(){return this.c;} getNumRows(){return this.nr;} getNumColumns(){return this.nc;} getLastRow(){return this.r+this.nr-1;}
  getValue(){ return this.getValues()[0][0]; } getA1Notation(){return 'A1';}
  getValues(){ const o=[]; for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++){row.push((this.sh.d[this.r-1+i]||[])[this.c-1+j] ?? '');}o.push(row);} return o; }
  setValues(v){ v.forEach((row,i)=>row.forEach((x,j)=>{ const R=this.r-1+i; this.sh.d[R]=this.sh.d[R]||[]; this.sh.d[R][this.c-1+j]=x;})); return this; }
  setValue(x){ return this.setValues([[x]]); } setFontWeight(){return this;} setNumberFormat(){return this;} }
function a1(sh,ref){ // "A:A", "G:G", "A1:C3", "A2"
  const col=x=>x.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0);
  const m=String(ref).match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); if(!m) return new Range(sh,1,1,1,1);
  const c1=col(m[1]), r1=m[2]?+m[2]:1, c2=m[3]?col(m[3]):c1, r2=m[4]?+m[4]:Math.max(sh.d.length,1);
  return new Range(sh,r1,c1,r2-r1+1,c2-c1+1); }
class Sheet { constructor(n,ss){this.n=n;this.d=[];this.ss=ss; return encadeavel(this);}
  getName(){return this.n;} getLastColumn(){return this.d.reduce((m,r)=>Math.max(m,(r||[]).length),0);} getMaxRows(){return Math.max(this.d.length,1000);} getMaxColumns(){return Math.max(this.getLastColumn(),26);}
  getDataRange(){ return new Range(this,1,1,Math.max(this.d.length,1),Math.max(this.getLastColumn(),1)); }
  deleteRows(i,n){this.d.splice(i-1,n);} clear(){this.d=[]; return this;} clearContents(){this.d=[]; return this;} getSheetId(){return 1;} getParent(){return this.ss;}
  getFrozenRows(){return 1;} isSheetHidden(){return false;} copyTo(){return this;} setName(n){ delete this.ss.s[this.n]; this.n=n; this.ss.s[n]=this; return this;} getRange(r,c,nr,nc){return new Range(this,r,c,nr,nc);} getLastRow(){return this.d.length;}
  setFrozenRows(){} setColumnWidth(){} appendRow(r){this.d.push(r);} }
class SS { constructor(){this.s={};} getSheetByName(n){return this.s[n]||null;} insertSheet(n){return this.s[n]=new Sheet(n,this);} getSheets(){return Object.values(this.s);} getId(){return 'id-teste';} getName(){return 'Planilha teste';} getUrl(){return 'https://planilha-teste';} setSpreadsheetLocale(){} getSpreadsheetTimeZone(){return 'America/Sao_Paulo';} deleteSheet(sh){ delete this.s[sh.n]; } toast(){} }
function criar(arquivos){
  const ss = new SS(); const cache={}; const props={};
  const ctx = {
    console, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, Boolean, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent, globalThis:null,
    SpreadsheetApp:{ getActiveSpreadsheet:()=>ss, openById:()=>ss, flush(){}, getUi:()=>({alert(){}, createMenu(){return{addItem(){return this},addToUi(){}}}}) },
    CacheService:{ getScriptCache:()=>({ get:k=>cache[k]??null, put:(k,v)=>{cache[k]=v}, remove:k=>{delete cache[k]} }) },
    PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]??null, setProperty:(k,v)=>{props[k]=String(v)}, deleteProperty:k=>{delete props[k]}, getProperties:()=>Object.assign({},props), deleteAllProperties:()=>{Object.keys(props).forEach(k=>delete props[k])} }) },
    LockService:{ getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock(){return true},hasLock(){return true}}) },
    Logger:{ log(){} },
    Session:{ getScriptTimeZone:()=>'America/Sao_Paulo', getActiveUser:()=>({getEmail:()=>'teste@estacio.br'}), getEffectiveUser:()=>({getEmail:()=>'teste@estacio.br'}) },
    MailApp:{ sendEmail(o){ ctx._emails=(ctx._emails||0)+1; ctx._ultimoEmail=o; }, getRemainingDailyQuota:()=>100 }, GmailApp:{ sendEmail(){ ctx._emails=(ctx._emails||0)+1; } },
    UrlFetchApp:{ fetch(){ throw new Error('sem rede no teste'); } }, DriveApp:(function(){ const pastas={}; let seq=0;
      function iter(a){ let i=0; return {hasNext:()=>i<a.length, next:()=>a[i++]}; }
      function Pasta(nome){ const id='pasta'+(++seq); const arqs=[]; const p={ id, nome, arqs, getId:()=>id, getName:()=>nome,
        getFilesByName:(n)=>iter(arqs.filter(f=>f.nome===n)),
        createFile:(n,c)=>{ const f={nome:n,c:String(c),lixo:false,criado:(globalThis.__relogio=(globalThis.__relogio||1e12)+1000),isTrashed(){return this.lixo;},getLastUpdated(){return new Date(this.criado);},setTrashed(v){this.lixo=v;},getBlob(){const f2=this;return{getDataAsString:()=>f2.c};},getName(){return this.nome;},setContent(c){this.c=c;}}; arqs.push(f); return f; } };
        pastas[id]=p; return p; }
      return { createFolder:(n)=>Pasta(n), getFolderById:(id)=>{ if(!pastas[id]) throw new Error('não achou'); return pastas[id]; }, getFoldersByName:(n)=>iter(Object.values(pastas).filter(p=>p.nome===n)), getFilesByName:()=>iter([]), _pastas:pastas }; })(),
    ScriptApp:{ getProjectTriggers:()=>[], newTrigger(){ const b={timeBased(){return b},onWeekDay(){return b},atHour(h){b.h=h;return b},nearMinute(){return b},inTimezone(){return b},everyMinutes(){return b},everyDays(){return b},create(){ (ctx._gatilhos=ctx._gatilhos||[]).push(b.h); return {}; }}; return b; }, deleteTrigger(){}, WeekDay:{MONDAY:1,TUESDAY:2,WEDNESDAY:3,THURSDAY:4,FRIDAY:5,SATURDAY:6,SUNDAY:7} },
    Utilities:{
      DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf8'},
      computeDigest:(a,s)=>toBytes(crypto.createHash('sha256').update(s,'utf8').digest()),
      computeHmacSha256Signature:(t,k)=>toBytes(crypto.createHmac('sha256',k).update(t).digest()),
      base64EncodeWebSafe:(x)=> (Array.isArray(x)? Buffer.from(x.map(b=>b&255)) : Buffer.from(x,'utf8')).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
      base64DecodeWebSafe:(b)=> toBytes(Buffer.from(b.replace(/-/g,'+').replace(/_/g,'/'),'base64')),
      newBlob:(bytes)=>({getDataAsString:()=>Buffer.from(bytes.map(b=>b&255)).toString('utf8')}),
      getUuid:()=>crypto.randomUUID(), sleep(){},
      formatDate:(d,tz,f)=>{ const p=n=>String(n).padStart(2,'0'); const x=new Date(d.getTime()-3*3600000); return f.replace('yyyy',x.getUTCFullYear()).replace('MM',p(x.getUTCMonth()+1)).replace('dd',p(x.getUTCDate())).replace('HH',p(x.getUTCHours())).replace('mm',p(x.getUTCMinutes())).replace('ss',p(x.getUTCSeconds())); },
      parseCsv:(t,sep)=>t.split(/\r?\n/).filter(Boolean).map(l=>l.split(sep||',')),
    },
    ContentService:{ MimeType:{JSON:'json',JAVASCRIPT:'js',TEXT:'txt'}, createTextOutput:(t)=>({t, setMimeType(m){this.m=m;return this;}}) },
  };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(arquivos.map(f=>fs.readFileSync(f,'utf8')).join('\n'), ctx);
  ctx._ss = ss; ctx._cache = cache;
  return ctx;
}
module.exports = { criar };
