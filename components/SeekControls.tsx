import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface SeekControlsProps {
  value: number;
  fps: number;
  onChange: (newValue: number) => void;
}

const SeekControls: React.FC<SeekControlsProps> = ({ value, fps, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 justify-center">
      <button onClick={() => onChange(value - 10)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-10 Seconds">-10s</button>
      <button onClick={() => onChange(value - 5)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-5 Seconds">-5s</button>
      <button onClick={() => onChange(value - 1)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-1 Second">-1s</button>
      <button onClick={() => onChange(value - (10 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-10 Frames"><ChevronsLeft className="w-5 h-5" /></button>
      <button onClick={() => onChange(value - (1 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="Previous Frame (-1)"><ChevronLeft className="w-5 h-5" /></button>
      <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-mono text-white focus:outline-none focus:border-indigo-500 transition-all" />
      <span className="text-xs text-zinc-500 pointer-events-none font-bold">s</span>
      <button onClick={() => onChange(value + (1 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="Next Frame (+1)"><ChevronRight className="w-5 h-5" /></button>
      <button onClick={() => onChange(value + (10 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+10 Frames"><ChevronsRight className="w-5 h-5" /></button>
      <button onClick={() => onChange(value + 1)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+1 Second">+1s</button>
      <button onClick={() => onChange(value + 5)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+5 Seconds">+5s</button>
      <button onClick={() => onChange(value + 10)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+10 Seconds">+10s</button>
    </div>
  );
};

export default SeekControls;
