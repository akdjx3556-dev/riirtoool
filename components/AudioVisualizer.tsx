
import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface AudioVisualizerProps {
    audioUrl: string;
    height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioUrl, height = 40 }) => {
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!waveformRef.current) return;

        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#4b5563',
            progressColor: '#3b82f6',
            cursorColor: '#3b82f6',
            barWidth: 2,
            barRadius: 3,
            cursorWidth: 1,
            height: height,
            barGap: 3,
            interact: true,
            fillParent: true,
        });

        wavesurferRef.current.load(audioUrl);

        wavesurferRef.current.on('play', () => setIsPlaying(true));
        wavesurferRef.current.on('pause', () => setIsPlaying(false));
        wavesurferRef.current.on('finish', () => setIsPlaying(false));

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
        };
    }, [audioUrl, height]);

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
        }
    };

    return (
        <div className="flex items-center gap-3 w-full bg-[#1A1A1A] p-2 rounded-lg border border-[#262626]">
            <button 
                onClick={togglePlay}
                className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-all flex-shrink-0"
            >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <div ref={waveformRef} className="flex-grow cursor-pointer" />
        </div>
    );
};
