/** Bound the bytes actually read, including chunked requests without Content-Length. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<{ok:true;value:unknown}|{ok:false;status:400|413|415}> {
 const type=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
 if(type!=='application/json')return {ok:false,status:415};
 const declared=request.headers.get('content-length');
 if(declared!==null){
  if(!/^\d+$/.test(declared))return {ok:false,status:400};
  if(Number(declared)>maxBytes)return {ok:false,status:413};
 }
 if(!request.body)return {ok:false,status:400};
 const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>maxBytes){void reader.cancel().catch(()=>{});return {ok:false,status:413};}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  try{return {ok:true,value:JSON.parse(text) as unknown};}catch{return {ok:false,status:400};}
 }catch{return {ok:false,status:400};}finally{reader.releaseLock();}
}

/** A conservative process-local circuit breaker; a shared edge limiter is required in production. */
export class ProcessRateLimit {
 private startedAt=0;
 private count=0;
 constructor(private readonly limit:number,private readonly intervalMs:number){}
 allow(now=Date.now()):boolean{
  if(now < this.startedAt || now-this.startedAt>=this.intervalMs){this.startedAt=now;this.count=0;}
  if(this.count>=this.limit)return false;
  this.count++;return true;
 }
}

const host=globalThis as typeof globalThis & {surveyRequestLimiter?:ProcessRateLimit;surveyDeleteLimiter?:ProcessRateLimit};
export const surveyRequestLimiter=host.surveyRequestLimiter ??= new ProcessRateLimit(60,60_000);
export const surveyDeleteLimiter=host.surveyDeleteLimiter ??= new ProcessRateLimit(60,60_000);
