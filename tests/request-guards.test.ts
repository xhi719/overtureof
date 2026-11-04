import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {ProcessRateLimit,readBoundedJson} from '../lib/request-guards';

test('accepts valid JSON and rejects oversized declared or chunked bodies',async()=>{
 const json=new Request('http://localhost/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({value:'가'})});
 assert.deepEqual(await readBoundedJson(json,20),{ok:true,value:{value:'가'}});
 const declared=new Request('http://localhost/',{method:'POST',headers:{'content-type':'application/json','content-length':'200'},body:'{}'});
 assert.deepEqual(await readBoundedJson(declared,32),{ok:false,status:413});
 assert.equal(declared.bodyUsed,false);
 const chunks=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(16));c.enqueue(new Uint8Array(17));c.close();}});
 const chunked=new Request('http://localhost/',{method:'POST',headers:{'content-type':'application/json'},body:chunks,duplex:'half'} as RequestInit);
 assert.deepEqual(await readBoundedJson(chunked,32),{ok:false,status:413});
});

test('bounds UTF-8 bytes and rejects unsupported types and malformed JSON',async()=>{
 const body=JSON.stringify({a:'가나다'});
 const create=(type:string,content:string)=>new Request('http://localhost/',{method:'POST',headers:{'content-type':type},body:content});
 assert.deepEqual(await readBoundedJson(create('application/json',body),new TextEncoder().encode(body).length-1),{ok:false,status:413});
 assert.deepEqual(await readBoundedJson(create('text/plain','{}'),20),{ok:false,status:415});
 assert.deepEqual(await readBoundedJson(create('application/json','{'),20),{ok:false,status:400});
});

test('process limiter blocks bursts and allows later requests',()=>{
 const limiter=new ProcessRateLimit(2,1000);
 assert.equal(limiter.allow(100),true);assert.equal(limiter.allow(101),true);
 assert.equal(limiter.allow(102),false);assert.equal(limiter.allow(1100),true);
});
