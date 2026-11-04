import {createHash} from 'node:crypto';
import type {CoverageValues, ProxyArtifact} from '@/lib/scenario-coverage';
import {calculateReportTimers, type ReportTimerConfig, type ReportTimerJob, type ReportTimerValues} from '@/lib/scenario-timer-v9';

type Entry={fingerprint:string;value:Map<string,ReportTimerValues>};
const host=globalThis as typeof globalThis & {reportTimerCache?:WeakMap<Map<string,CoverageValues>,Entry>};

/** Cache only an identical v8 Map identity and complete timer input snapshot. */
export function cachedReportTimers(config:ReportTimerConfig,jobs:ReportTimerJob[],baseline:Map<string,CoverageValues>,artifact:ProxyArtifact):Map<string,ReportTimerValues>{
 const cache=host.reportTimerCache ??= new WeakMap();
 const sorted=[...jobs].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const base=[...baseline.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0);
 const fingerprint=createHash('sha256').update(JSON.stringify([config,sorted,base,artifact]),'utf8').digest('hex');
 const previous=cache.get(baseline);
 if(previous?.fingerprint===fingerprint)return previous.value;
 const value=calculateReportTimers(config,jobs,baseline,artifact);
 cache.set(baseline,{fingerprint,value});
 return value;
}
