import type {ScenarioConfig} from '@/lib/scenario';
import type {ReportTimerValues} from '@/lib/scenario-timer-v9';

export type ProbabilityModelConfig = {id:string;version:string};
export type ProbabilityV10 = Omit<ReportTimerValues,'timerProbabilityAligned'> & {
 timerProbabilityAligned:true;
 probabilityModelId:string;
 probabilityModelVersion:string;
 originalProbability:number;
 originalProbabilities:{year:number;probability:number}[];
 adjustedAnnualBaseHazard:number;
 adjustedAnnualExposureHazard:number;
 probabilityHazardAdjustment:number;
};

/**
 * Align the illustrative probability with an already calculated v9 timer.
 * Source observations remain untouched. A timer's collision seconds are
 * deliberately reflected in the mathematical adjustment and are never
 * presented as measured differences between occupations.
 */
export function calculateConsistentProbability(model:ProbabilityModelConfig,config:ScenarioConfig,timer:ReportTimerValues):ProbabilityV10 {
 if (!model.id || !model.version || !timer || timer.timerProbabilityAligned !== false) throw new Error('invalid_probability_v10_input');
 const start=Date.parse(timer.baselineAt),target=Date.parse(timer.targetAt);
 const baseline=Date.parse(config.baselineAt);
 if(!Number.isFinite(start)||start!==baseline||!Number.isFinite(target)||target<=start)throw new Error('invalid_probability_v10_time');
 if(!Number.isFinite(config.daysPerYear)||config.daysPerYear<=0||!Number.isFinite(config.crossingProbability)||config.crossingProbability<=0||config.crossingProbability>=1||timer.threshold!==config.crossingProbability)throw new Error('invalid_probability_v10_threshold');
 if(!Number.isFinite(timer.effectiveExposure)||timer.effectiveExposure<0||timer.effectiveExposure>1||!Number.isFinite(timer.hazardMultiplier)||timer.hazardMultiplier<=0||!Number.isFinite(config.annualBaseHazard)||config.annualBaseHazard<=0||!Number.isFinite(config.annualExposureHazard)||config.annualExposureHazard<0)throw new Error('invalid_probability_v10_hazard');
 if(!Array.isArray(config.horizons)||config.horizons.length===0||config.horizons.some((year,index)=>!Number.isInteger(year)||year<new Date(start).getUTCFullYear()||year>9998||(index>0&&year<=config.horizons[index-1])))throw new Error('invalid_probability_v10_horizons');
 if(!Number.isFinite(timer.probability)||timer.probability<0||timer.probability>1||!Array.isArray(timer.probabilities))throw new Error('invalid_probability_v10_original');
 const yearMs=config.daysPerYear*86_400_000;
 const originalBase=config.annualBaseHazard*timer.hazardMultiplier;
 const originalSlope=config.annualExposureHazard*timer.hazardMultiplier;
 const originalHazard=originalBase+originalSlope*timer.effectiveExposure;
 const hazard=-Math.log1p(-config.crossingProbability)*yearMs/(target-start);
 const probabilityHazardAdjustment=hazard/originalHazard;
 const adjustedAnnualBaseHazard=originalBase*probabilityHazardAdjustment;
 const adjustedAnnualExposureHazard=originalSlope*probabilityHazardAdjustment;
 if(!Number.isFinite(hazard)||hazard<=0||!Number.isFinite(probabilityHazardAdjustment)||!Number.isFinite(adjustedAnnualBaseHazard)||!Number.isFinite(adjustedAnnualExposureHazard))throw new Error('invalid_probability_v10_result');
 const probabilities=config.horizons.map(year=>({year,probability:-Math.expm1(-hazard*Math.max(0,(Date.UTC(year+1,0,1)-start)/yearMs))}));
 return {...timer,originalProbability:timer.probability,originalProbabilities:timer.probabilities.map(row=>({...row})),probability:probabilities[probabilities.length-1].probability,probabilities,
  timerProbabilityAligned:true,probabilityModelId:model.id,probabilityModelVersion:model.version,adjustedAnnualBaseHazard,adjustedAnnualExposureHazard,probabilityHazardAdjustment};
}
