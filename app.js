'use strict';
const $=id=>document.getElementById(id);
let worker=null, runningJob=null, active=false, busy=false, lastError='';
let token=sessionStorage.getItem('salehbc_token')||'';
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n||0);
function time(seconds){let s=Math.max(0,seconds||0);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');}
async function api(path,body){
 const res=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Dashboard-Token':token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(res.status===401){token=prompt('أدخل رمز لوحة التحكم DASHBOARD_TOKEN')||'';sessionStorage.setItem('salehbc_token',token);throw Error('أعد المحاولة بعد إدخال الرمز');}
 const payload=await res.json();if(!res.ok)throw Error(payload.error||'Request failed');return payload;
}
function haltWorker(){if(worker){worker.postMessage({type:'stop'});worker.terminate();worker=null;}runningJob=null;}
function launchWorker(job){
 haltWorker();
 if(!job)return;
 worker=new Worker('/worker.js');runningJob=job.id;
 worker.onmessage=async event=>{
   const msg=event.data;
   try{
    if(msg.type==='stats')await api('stats',msg);
    else if(msg.type==='share'){
       const r=await api('share',msg);
       if(!r.ok)lastError=r.error;
    }else if(msg.type==='error'){lastError=msg.message;$('error').textContent=lastError;}
   }catch(e){lastError=e.message;$('error').textContent=lastError;}
 };
 worker.onerror=e=>{lastError='Worker: '+e.message;$('error').textContent=lastError;};
 worker.postMessage({type:'start',job});
}
const statuses={stopped:'متوقف',connecting:'جارٍ الاتصال...',authenticating:'جارٍ تسجيل العامل...',waiting_for_job:'بانتظار مهمة من المجمع',mining:'التعدين شغّال'};
async function refresh(){
 if(busy)return;busy=true;
 try{
  const s=await api('state');
  $('wallet').value=s.wallet;
  $('pool').textContent=(s.poolTls?'TLS · ':'TCP · ')+s.pool;
  $('hashrate').textContent=fmt(s.hashrate);
  $('totalHashes').textContent=fmt(s.totalHashes);
  $('miningTime').textContent=time(s.uptime);
  $('bestZeros').textContent=`${fmt(s.bestLeadingZeroBits)} bits`;
  $('difficulty').textContent=s.difficulty==null?'—':fmt(s.difficulty);
  $('accepted').textContent=fmt(s.accepted);
  $('rejected').textContent=fmt(s.rejected);
  $('connected').textContent=s.connected?'متصل':'غير متصل';
  $('authorized').textContent=s.authorized?'مقبول من المجمع':'غير معتمد بعد';
  $('status').textContent=statuses[s.status]||s.status;
  $('dot').className='dot'+(s.status==='mining'?' active':s.status==='connecting'||s.status==='authenticating'?' connecting':'');
  $('start').disabled=s.status!=='stopped';
  $('stop').disabled=s.status==='stopped';
  $('message').textContent=s.status==='mining'?'جاري حساب SHA-256d فعلياً في المتصفح — مو تجربة':
    s.status==='stopped'?'اضغط بدء التعدين للتوصيل بمجمع السولو':'انتظار الاتصال أو مهمة صالحة من المجمع';
  if(s.lastShare){$('lastShare').textContent=(s.lastShare.status==='accepted'?'ACCEPTED ✓':'REJECTED ✗')+' · '+s.lastShare.at+' · '+(s.lastShare.hash||s.lastShare.reason||'');}
  if(s.errors?.length){$('error').textContent='آخر خطأ: '+s.errors[0].message;}
  else if(lastError){$('error').textContent=lastError;}
  if(s.status==='mining'&&s.job){if(s.job.id!==runningJob)launchWorker(s.job);}
  else if(worker)haltWorker();
 }catch(e){lastError=e.message;$('error').textContent=lastError;haltWorker();}
 busy=false;
}
$('start').addEventListener('click',async()=>{lastError='';try{await api('start',{});await refresh();}catch(e){$('error').textContent=e.message;}});
$('stop').addEventListener('click',async()=>{haltWorker();try{await api('stop',{});await refresh();}catch(e){$('error').textContent=e.message;}});
$('copyWallet').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('wallet').value);$('copyWallet').textContent='تم النسخ ✓';setTimeout(()=>$('copyWallet').textContent='نسخ',1300);}catch{prompt('انسخ العنوان',$('wallet').value);}});
window.addEventListener('beforeunload',haltWorker);
document.addEventListener('visibilitychange',()=>{if(document.hidden){$('message').textContent='المتصفح بالخلفية: قد يتوقف التعدين بسبب سياسة النظام';}});
refresh();setInterval(refresh,1500);
