'use strict';
// SALEHBC DGB SOLO - local browser miner + Stratum V1 bridge (no third-party packages).
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const WALLET = process.env.DGB_WALLET || 'D88AHivqzm3tyrfyUmc8qhv5pKzG2S3eLN';
const POOL_HOST = process.env.POOL_HOST || 'digibyte.sololuck.io';
const POOL_PORT = Number(process.env.POOL_PORT || 3341); // Low-share-difficulty "nano" SHA256d endpoint
const POOL_TLS = process.env.POOL_TLS === '1';
const WORKER_NAME = process.env.WORKER_NAME || 'SALEHBC';
const HOST = process.env.HOST || '127.0.0.1'; // Opt-in LAN binding only
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.DASHBOARD_TOKEN || '';
const DIFF1 = BigInt('0x00000000FFFF0000000000000000000000000000000000000000000000000000');
const HEX = /^[0-9a-fA-F]+$/;
const now = () => Date.now();
const sha2 = b => crypto.createHash('sha256').update(crypto.createHash('sha256').update(b).digest()).digest();
const reverseBytes32 = hex => {
  const b = Buffer.from(hex, 'hex');
  if (b.length !== 4) throw Error('Expected 4 bytes');
  return Buffer.from(b).reverse();
};
const isHex = (s, length) => typeof s === 'string' && s.length === length && HEX.test(s);
function targetForDiff(difficulty){
  const d = Number(difficulty);
  if (!(d > 0) || !Number.isFinite(d)) throw Error('Invalid difficulty');
  const scale = 1000000n;
  const divisor = BigInt(Math.max(1, Math.round(d * 1e6)));
  return (DIFF1 * scale) / divisor;
}
function hashMeetsTarget(hash, difficulty){
  return BigInt('0x' + Buffer.from(hash).reverse().toString('hex')) <= targetForDiff(difficulty);
}
function parseDGBAddress(str){
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if(!/^[1-9A-HJ-NP-Za-km-z]{26,60}$/.test(str)) return false;
  let n=0n;
  for(const c of str) {let pos=alphabet.indexOf(c); if(pos < 0) return false; n=n*58n+BigInt(pos);}
  let hex=n.toString(16); if(hex.length%2)hex='0'+hex;
  const bytes = Buffer.concat([Buffer.alloc(str.match(/^1*/)[0].length), Buffer.from(hex,'hex')]);
  return bytes.length === 25 && bytes[0] === 30 && sha2(bytes.subarray(0,21)).subarray(0,4).equals(bytes.subarray(21));
}
if(!parseDGBAddress(WALLET)) throw Error('Invalid mainnet DGB legacy address.');
if(!/^[A-Za-z0-9_-]{1,32}$/.test(WORKER_NAME)) throw Error('Unsafe worker name');
if(!Number.isInteger(POOL_PORT)||POOL_PORT<1||POOL_PORT>65535) throw Error('Invalid pool port');
if(HOST !== '127.0.0.1' && HOST !== 'localhost' && !TOKEN) throw Error('DASHBOARD_TOKEN required for a non-localhost interface.');

let socket = null;
let incoming = '';
let rpcId = 1;
const pending = new Map();
const current = {
  mode:'real', status:'stopped', connected:false, authorized:false, subscribed:false,
  startedAt:null, pool: `${POOL_HOST}:${POOL_PORT}`, poolTls:POOL_TLS,
  wallet:WALLET, user:`${WALLET}.${WORKER_NAME}`, difficulty:null,
  accepted:0, rejected:0, submitted:0, errors:[], job:null,
  totalHashes:0, bestLeadingZeroBits:0, hashrate:0, lastShare:null, uptime:0
};
let extranonce1 = null, extranonce2Size = null;
let extranonceSeq = 0;
let notifyJob = null;
let activeJobId = 0;
let activeMiningJob = null;
let startedAt = 0;
let sentShareIds = new Set();
let lastRateAt=now(), lastRateCount=0;
let runId = 0;
function logError(s){
  const msg= String(s).slice(0,200);
  current.errors.unshift({at:new Date().toISOString(),message:msg});
  current.errors.length=Math.min(5,current.errors.length);
  console.error('[SALEHBC]',msg);
}
function snapshot(){
 return {...current, errors:current.errors.slice(),
   job: activeMiningJob ? {id:activeMiningJob.id, headerPrefix:activeMiningJob.headerPrefix.toString('hex'),
        ntime:activeMiningJob.ntime, extranonce2:activeMiningJob.extranonce2,
        difficulty:activeMiningJob.difficulty, notifyId:activeMiningJob.notifyId} : null,
   uptime: startedAt ? Math.floor((now()-startedAt)/1000) : 0};
}
function updateStatus(){
 if(!socket) current.status='stopped';
 else if(!current.connected) current.status='connecting';
 else if(!current.subscribed||!current.authorized) current.status='authenticating';
 else if(!activeMiningJob) current.status='waiting_for_job';
 else current.status='mining';
}
function clearJob(){activeMiningJob=null; current.job=null; activeJobId+=1; sentShareIds.clear(); updateStatus();}
function sendRpc(method,params,cb){
 if(!socket||socket.destroyed||!current.connected) throw Error('Stratum not connected');
 const id=rpcId++;
 if(cb) pending.set(id,cb);
 socket.write(JSON.stringify({id,method,params})+'\n');
 return id;
}
function stratumPrevhash(raw){
 // Stratum V1 prevhash is 4-byte word-swapped relative to the Bitcoin header encoding.
 if(!isHex(raw,64))throw Error('Invalid prevhash');
 const bytes=Buffer.from(raw,'hex');
 for(let i=0;i<32;i+=4) bytes.subarray(i,i+4).reverse();
 return bytes;
}
function constructMiningJob(){
  if(!notifyJob || !extranonce1 || !extranonce2Size || !current.authorized || !current.subscribed || !current.difficulty) return;
  const j=notifyJob;
  const seq=(extranonceSeq++).toString(16).padStart(extranonce2Size*2,'0').slice(-extranonce2Size*2);
  const coinbaseHex=j.coinb1+extranonce1+seq+j.coinb2;
  if(!HEX.test(coinbaseHex)||coinbaseHex.length%2)throw Error('Bad coinbase');
  let root = sha2(Buffer.from(coinbaseHex,'hex'));
  for(const branch of j.merkle) {
    if(!isHex(branch,64))throw Error('Bad merkle branch');
    root=sha2(Buffer.concat([root,Buffer.from(branch,'hex')]));
  }
  const headerPrefix=Buffer.concat([
    reverseBytes32(j.version),stratumPrevhash(j.prevhash),root,
    reverseBytes32(j.ntime),reverseBytes32(j.nbits)
  ]);
  if(headerPrefix.length!==76)throw Error('Malformed header prefix');
  activeMiningJob={id:String(++activeJobId),notifyId:j.id,headerPrefix,ntime:j.ntime,
    extranonce2:seq,difficulty:current.difficulty,created:now()};
  sentShareIds.clear(); updateStatus();
}
function handleLine(s){
 let data;
 try{data=JSON.parse(s);}catch{logError('Unparseable pool response');return;}
 if(data.id!==undefined&&data.id!==null){
   const cb=pending.get(data.id);pending.delete(data.id);
   if(cb)try{cb(data);}catch(e){logError('RPC callback: '+e.message);}
   return;
 }
 if(!data.method)return;
 try{
  switch(data.method){
   case 'mining.set_difficulty':
    current.difficulty=Number(data.params?.[0]);
    if(!(current.difficulty>0))throw Error('Invalid pool difficulty');
    constructMiningJob();break;
   case 'mining.set_extranonce':
    extranonce1=data.params?.[0];extranonce2Size=Number(data.params?.[1]);
    if(!isHex(extranonce1,extranonce1.length)||!Number.isInteger(extranonce2Size)||extranonce2Size<1||extranonce2Size>16) throw Error('Bad extranonce');
    constructMiningJob();break;
   case 'mining.notify':{
     const p=data.params || [];
     if(p.length<9) throw Error('Invalid mining.notify');
     const [id,prevhash,coinb1,coinb2,merkle,version,nbits,ntime,clean]=p;
     if(typeof id!=='string'||!isHex(prevhash,64)||!isHex(version,8)||!isHex(nbits,8)||!isHex(ntime,8)
        ||typeof coinb1!=='string'||typeof coinb2!=='string'||!Array.isArray(merkle)) throw Error('Bad mining.notify fields');
     notifyJob={id,prevhash,coinb1,coinb2,merkle,version,nbits,ntime,clean};
     // Clear previous work on all new notifications to avoid submitting stale shares.
     clearJob(); constructMiningJob();break;
   }
   case 'client.reconnect':
      logError('Pool requested reconnect; reconnect manually');stopMining();break;
   case 'client.show_message':
      console.log('[POOL]',data.params?.[0]);break;
  }
 }catch(e){logError('Pool protocol error: '+e.message);clearJob();}
}
function startMining(){
 if(socket) return;
 startedAt=now();current.startedAt=new Date(startedAt).toISOString();current.connected=false;
 current.authorized=false;current.subscribed=false;current.difficulty=null;
 extranonce1=null;extranonce2Size=null;notifyJob=null;clearJob();
 current.status='connecting'; const thisRun=++runId;
 let conn=POOL_TLS ? tls.connect({host:POOL_HOST,port:POOL_PORT,serverName:POOL_HOST}) :
    net.createConnection({host:POOL_HOST,port:POOL_PORT});
 socket=conn;incoming=''; pending.clear();
 const teardown=()=>{if(thisRun!==runId)return;
   if(socket===conn){socket=null;current.connected=false;current.authorized=false;
     current.subscribed=false;startedAt=0;current.hashrate=0;clearJob();current.status='stopped';}
 };
 conn.setTimeout(25000,()=>{logError('Pool connection timeout');conn.destroy();});
 conn.on(POOL_TLS ? 'secureConnect' : 'connect',()=>{
   if(thisRun!==runId)return;
   current.connected=true;current.status='authenticating';
   sendRpc('mining.subscribe',['SALEHBC-DGB/1.1'], r=>{
     if(r.error||!Array.isArray(r.result)||r.result.length<3){logError('Subscribe rejected: '+JSON.stringify(r.error||r.result));conn.destroy();return;}
     extranonce1=r.result[1];extranonce2Size=Number(r.result[2]);
     if(!isHex(extranonce1,extranonce1.length)||!Number.isInteger(extranonce2Size)||extranonce2Size<1||extranonce2Size>16){logError('Invalid subscription extranonce');conn.destroy();return;}
     current.subscribed=true;constructMiningJob();updateStatus();
   });
   sendRpc('mining.authorize',[current.user,'x'],r=>{
     if(r.error||r.result!==true){logError('Authorization rejected: '+JSON.stringify(r.error||r.result));conn.destroy();return;}
     current.authorized=true;constructMiningJob();updateStatus();
   });
 });
 conn.on('data',data=>{
   incoming+=data.toString('utf8');
   if(incoming.length>1000000){logError('Pool response exceeded size limit');conn.destroy();return;}
   while(incoming.includes('\n')){
      let ix=incoming.indexOf('\n');let line=incoming.slice(0,ix).trim();incoming=incoming.slice(ix+1);
      if(line)handleLine(line);
   }
 });
 conn.on('error',e=>logError('Pool: '+e.message));conn.on('close',teardown);
}
function stopMining(){
 runId++; if(socket){socket.destroy();socket=null;}
 pending.clear(); current.connected=false;current.authorized=false;current.subscribed=false;
 startedAt=0;current.hashrate=0;clearJob();current.status='stopped';
}
function countBits(hash){
 const bytes=Buffer.from(hash).reverse();let c=0;
 for(const n of bytes){if(!n){c+=8;continue;}for(let i=7;i>=0;i--){if(n&(1<<i))return c;c++;}}
 return c;
}
function submitShare({jobId,nonce,hashes,elapsedMs,bestLeadingZeroBits}){
 if(!activeMiningJob||!socket||!current.authorized||jobId!==activeMiningJob.id)
   return {ok:false,error:'stale or inactive job'};
 if(!isHex(nonce,8))return {ok:false,error:'invalid nonce'};
 const job=activeMiningJob;
 if(sentShareIds.has(nonce))return {ok:false,error:'duplicate nonce'};
 const header=Buffer.concat([job.headerPrefix,Buffer.from(nonce,'hex').reverse()]);
 if(header.length!==80)return {ok:false,error:'invalid header'};
 const hash=sha2(header);
 if(!hashMeetsTarget(hash,job.difficulty))return {ok:false,error:'hash below share difficulty'};
 sentShareIds.add(nonce);
 if(sentShareIds.size>3000)sentShareIds=new Set([nonce]);
 const params=[current.user,job.notifyId,job.extranonce2,job.ntime,nonce];
 current.submitted++;
 sendRpc('mining.submit',params,r=>{
   if(r.result===true&&!r.error){current.accepted++;current.lastShare={status:'accepted',at:new Date().toISOString(),hash:Buffer.from(hash).reverse().toString('hex')};}
   else{current.rejected++;current.lastShare={status:'rejected',at:new Date().toISOString(),reason:JSON.stringify(r.error||r.result).slice(0,150)};}
 });
 return {ok:true,status:'submitted_to_pool'};
}
function updateStats({hashes,bestLeadingZeroBits,elapsedMs}){
 const h=Number(hashes);const elapsed=Number(elapsedMs);const best=Number(bestLeadingZeroBits);
 if(!Number.isInteger(h)||h<0||h>50000||!Number.isFinite(elapsed)||elapsed<0||elapsed>60000)
   return {ok:false,error:'invalid statistics'};
 current.totalHashes+=h;current.bestLeadingZeroBits=Math.max(current.bestLeadingZeroBits,Math.min(256,Math.max(0,best||0)));
 const t=now();
 if(t-lastRateAt>=1000){const delta=t-lastRateAt;current.hashrate=Math.round((current.totalHashes-lastRateCount)*1000/delta);lastRateCount=current.totalHashes;lastRateAt=t;}
 return {ok:true};
}
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.ico':'image/x-icon'};
function reply(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function tokenAllowed(req){if(!TOKEN)return true;return req.headers['x-dashboard-token'] === TOKEN;}
function handleBody(req,res,callback){let raw='';req.on('data',chunk=>{raw+=chunk.toString();if(raw.length>10000){req.destroy();}});req.on('end',()=>{try{callback(JSON.parse(raw||'{}'));}catch(e){reply(res,400,{ok:false,error:'invalid JSON'});}});}
// Flat repository: HTML, assets, server, and tests are all in one root directory.
const root=__dirname;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
   if(!tokenAllowed(req)){reply(res,401,{ok:false,error:'dashboard token required'});return;}
   if(req.method==='GET'&&url.pathname==='/api/state'){reply(res,200,snapshot());return;}
   if(req.method==='POST')return handleBody(req,res,body=>{
     try{
      let result;
      switch(url.pathname){
       case '/api/start':startMining();result={ok:true};break;
       case '/api/stop':stopMining();result={ok:true};break;
       case '/api/stats':result=updateStats(body);break;
       case '/api/share':result=submitShare(body);break;
       default:reply(res,404,{ok:false,error:'not found'});return;
      }
      reply(res,result.ok?200:400,result);
     }catch(e){logError(e.message);reply(res,400,{ok:false,error:e.message});}
   });
   reply(res,405,{ok:false,error:'method not allowed'});return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'method not allowed'});return;}
 const target=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');
 if(!/^(index\.html|app\.js|worker\.js|style\.css)$/.test(target)){reply(res,404,{error:'not found'});return;}
 const p=path.join(root,target);
 fs.readFile(p,(err,b)=>{if(err){reply(res,404,{error:'not found'});return;}
   res.writeHead(200,{'Content-Type':MIME[path.extname(p)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
   res.end(req.method==='HEAD'?undefined:b);
 });
});
if(require.main===module){server.listen(PORT,HOST,()=>console.log(`SALEHBC DGB SOLO at http://${HOST}:${PORT} \nPool: ${POOL_HOST}:${POOL_PORT} \nWallet: ${WALLET}`));
 process.on('SIGINT',()=>{stopMining();server.close();});
}
module.exports={server,parseDGBAddress,sha2,targetForDiff,hashMeetsTarget,stratumPrevhash};
