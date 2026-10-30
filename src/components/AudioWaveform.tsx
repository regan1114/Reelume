import { useMemo } from 'react';
import { waveformPath } from '../../shared/waveform';

type Props={peaks:number[];duration:number;sourceStart:number;secondsPerPixel:number;width:number};
export default function AudioWaveform({peaks,duration,sourceStart,secondsPerPixel,width}:Props){
  const path=useMemo(()=>waveformPath(peaks,duration,sourceStart,secondsPerPixel,width),[peaks,duration,sourceStart,secondsPerPixel,width]);
  return <svg className="waveform" viewBox={`0 0 ${Math.max(1,width)} 20`} preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke"/></svg>;
}
