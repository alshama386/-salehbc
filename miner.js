const W='bridge-enforced-identity';
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const bytes=h=>new Uint8Array(h.match(/../g)?.map(x=>parseInt(x,16))||[]);
const rev=h=>h.match(/../g).reverse().join('');
const swapWords=h=>h.match(/.{8}/g).map(w=>rev(w)).join('');
const dbl=async b=>new Uint8Array(await crypto.subtle.digest('SHA-256',await crypto.subtle.digest('SHA-256',b)));
const diff1=BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
function bitsTarget(bits){const n=parseInt(bits.slice(0,2),16),m=BigInt('0x'+bits.slice(2));return n<=3?m>>BigInt(8*(3-n)):m<<BigInt(8*(n-3))}
const leNum=(n,len)=>{let s='';for(let i=0;i<len;i++){s+=(n&255).toString(16).padStart(2,'0');n=Math.floor(n/256)}return s};
let running=false,job=null,extra1='',extra2Size=4,difficulty=10000,extra2=0n,hashes=0,best=0,activeTask=0,started=0,workerIndex=0,workerCount=1;
const notify=(type,data={})=>postMessage({type,...data});
async function mine(task){
 let localHashes=0, last=performance.now(),lastTick=performance.now();
 while(running&&job===task){
  const x2=extra2.toString(16).padStart(extra2Size*2,'0');extra2=(extra2+BigInt(workerCount))%(1n<<BigInt(extra2Size*8));
  let root=hex(await dbl(bytes(task.coinb1+extra1+x2+task.coinb2)));
  for(const branch of task.branches)root=hex(await dbl(bytes(root+branch)));
  const header=bytes(leNum(parseInt(task.version,16),4)+swapWords(task.prevhash)+rev(root)+leNum(parseInt(task.ntime,16),4)+leNum(parseInt(task.nbits,16),4)+'00000000');
  const dv=new DataView(header.buffer);const blockTarget=bitsTarget(task.nbits);
  let nonce=0;
  while(running&&job===task&&nonce<4294967295){
   dv.setUint32(76,nonce,true);
   const hash=await dbl(header);const hashLE=BigInt('0x'+hex(hash.slice().reverse()));
   hashes++;localHashes++;
   const zeroBits=hashLE===0n?256:256-hashLE.toString(2).length;
   if(zeroBits>best){best=zeroBits;notify('best',{bits:best,hash:hex(hash.slice().reverse())})}
   if(hashLE<=diff1/BigInt(Math.max(1,Math.floor(difficulty)))||hashLE<=blockTarget){
    notify('share',{params:[W,task.id,x2,task.ntime,nonce.toString(16).padStart(8,'0')],block:hashLE<=blockTarget,hash:hex(hash.slice().reverse())});
   }
   nonce++;
   if(performance.now()-lastTick>1200){const now=performance.now();notify('progress',{hashes,rate:Math.round(localHashes*1000/(now-last)),elapsed:Math.floor((now-started)/1000)});last=now;localHashes=0;lastTick=now;await new Promise(r=>setTimeout(r,0))}
  }
 }
}
onmessage=e=>{const m=e.data;
 if(m.type==='start'){running=true;workerIndex=Number(m.index)||0;workerCount=Math.max(1,Number(m.count)||1);extra2=BigInt(workerIndex);hashes=0;best=0;started=performance.now();notify('status',{text:'Waiting for live pool work'});if(job)mine(job).catch(err=>notify('error',{message:String(err)}))}
 if(m.type==='stop'){running=false;job=null;notify('status',{text:'Stopped'})}
 if(m.type==='extranonce'){extra1=m.extra1;extra2Size=m.size;}
 if(m.type==='difficulty'){difficulty=Number(m.value)||10000;notify('difficulty',{value:difficulty})}
 if(m.type==='job'){job=m.job;notify('status',{text:'Live Bitcoin job '+job.id});if(running)mine(job).catch(err=>notify('error',{message:String(err)}))}
};
