
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ChunkJob, ProcessingState } from '../src/types';
import { APP_KEY, SPEAKER_GROUPS } from '../src/constants';
import { TextProcessor } from '../services/textProcessor';
import { synthesizeChunk, synthesizeEdgeTTS } from '../services/ttsService';
import { Configuration } from './Configuration';
import { ResultsPanel } from './ResultsPanel';
import { keyManager } from '../services/keyManager';
import { v4 as uuidv4 } from 'uuid';

import { audioBufferToWav, stretchAudioBuffer } from '../src/lib/audioUtils';

// Sub-routine: Render merged audio buffers applying potential speed and preserving pitch
const renderMergedBuffer = async (
    buffers: Array<{ buffer: AudioBuffer; startTime: number }>,
    targetSpeed: number
): Promise<AudioBuffer> => {
    // 1. Calculate total duration in 1.0x timeline to merge flawlessly
    const totalDuration = buffers.reduce(
        (max, item) => Math.max(max, item.startTime + item.buffer.duration), 
        0
    );
    
    const targetSampleRate = 44100;
    const renderLength = Math.ceil((totalDuration + 0.1) * targetSampleRate);
    
    const offlineCtx = new OfflineAudioContext(
        buffers[0].buffer.numberOfChannels,
        renderLength,
        targetSampleRate
    );

    buffers.forEach(item => {
        const source = offlineCtx.createBufferSource();
        source.buffer = item.buffer;
        source.connect(offlineCtx.destination);
        source.start(item.startTime);
    });

    const mergedBuffer = await offlineCtx.startRendering();

    // 2. Apply high-quality pitch preserving time stretching if targetSpeed is not 1.0
    if (Math.abs(targetSpeed - 1.0) < 0.01) {
        return mergedBuffer;
    }

    return stretchAudioBuffer(mergedBuffer, targetSpeed);
};

export const TextToSpeech: React.FC<{ 
    onAudioMerged?: (url: string | null) => void,
    onChunksUpdated?: (chunks: ChunkJob[]) => void 
}> = ({ onAudioMerged, onChunksUpdated }) => {
    const [chunks, setChunks] = useState<ChunkJob[]>([]);
    
    useEffect(() => {
        onChunksUpdated?.(chunks);
    }, [chunks, onChunksUpdated]);
    const [speaker, setSpeaker] = useState<string>("BV074_streaming");
    const [selectedCountry, setSelectedCountry] = useState<string>(SPEAKER_GROUPS[0].country);
    const [processingState, setProcessingState] = useState<ProcessingState>('idle');
    const [ttsService, setTtsService] = useState<'capcut' | 'edgetts'>('capcut');
    const [edgeVoice, setEdgeVoice] = useState<string>('vi-VN-HoaiMyNeural');
    const [isMerging, setIsMerging] = useState(false);
    const [mergeProgress, setMergeProgress] = useState(0);
    const [maxChars, setMaxChars] = useState(1500);
    const [minCharsToMerge, setMinCharsToMerge] = useState(30);
    const [concurrentThreads, setConcurrentThreads] = useState(10);
    const [requestDelay, setRequestDelay] = useState(100);
    const [speed, setSpeed] = useState(1.1);
    const [debouncedSpeed, setDebouncedSpeed] = useState(1.1);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSpeed(speed);
        }, 300);
        return () => clearTimeout(handler);
    }, [speed]);

    const [mergedOriginalUrl, setMergedOriginalUrl] = useState<string | null>(null);
    const [mergedSpedUpUrl, setMergedSpedUpUrl] = useState<string | null>(null);
    const [isSpedUpRendering, setIsSpedUpRendering] = useState(false);
    const [shouldProcess, setShouldProcess] = useState(false);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const masterAudioBuffersRef = useRef<Array<{ buffer: AudioBuffer, startTime: number }> | null>(null);

    // Background process: Whenever speed shifts, if audio was already merged, regenerate the SpedUp master smoothly in background
    useEffect(() => {
        if (!masterAudioBuffersRef.current || masterAudioBuffersRef.current.length === 0) return;
        
        let isActive = true;
        
        const updateSpedUpMaster = async () => {
            try {
                setIsSpedUpRendering(true);
                const spedUpBuffer = await renderMergedBuffer(masterAudioBuffersRef.current!, debouncedSpeed);
                if (!isActive) return;
                
                const wavBlob = audioBufferToWav(spedUpBuffer);
                const url = URL.createObjectURL(wavBlob);
                
                setMergedSpedUpUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
            } catch (err) {
                console.error("Lỗi cập nhật âm thanh tăng tốc nền:", err);
            } finally {
                if (isActive) setIsSpedUpRendering(false);
            }
        };

        updateSpedUpMaster();

        return () => {
            isActive = false;
        };
    }, [debouncedSpeed]);

    const mergeAudio = useCallback(async () => {
        let audioContext: AudioContext | null = null;
        try {
            setIsMerging(true);
            setMergeProgress(0);
            const finishedChunks = chunks.filter(c => c.status === 'finished' && c.audioUrl);
            if (finishedChunks.length === 0) {
                setIsMerging(false);
                return;
            }

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioContextClass();

            const isTimedMerge = chunks.some(c => c.startTime !== undefined);
            const audioBuffers: Array<{ buffer: AudioBuffer, startTime: number }> = [];
            
            const batchSize = 15;
            let currentOffset = 0;
            const PAUSE_DURATION = 0.3; // 300ms pause in sequential mode

            for (let i = 0; i < finishedChunks.length; i += batchSize) {
                const batch = finishedChunks.slice(i, i + batchSize);
                const batchResult = await Promise.all(
                    batch.map(async (chunk, batchIdx) => {
                        try {
                            const response = await fetch(chunk.audioUrl!);
                            const arrayBuffer = await response.arrayBuffer();
                            const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
                                try {
                                    const promise = audioContext!.decodeAudioData(arrayBuffer, resolve, reject);
                                    if (promise) promise.catch(reject);
                                } catch (err) { reject(err); }
                            });
                            return {
                                buffer: audioBuffer,
                                chunkIndex: i + batchIdx,
                                chunkStartTime: chunk.startTime,
                            };
                        } catch (e) {
                            return null;
                        }
                    })
                );

                const validBatchResults = batchResult.filter(Boolean) as any[];
                validBatchResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

                for (const item of validBatchResults) {
                    if (isTimedMerge) {
                        const startTime = item.chunkStartTime !== undefined ? item.chunkStartTime : 0;
                        audioBuffers.push({
                            buffer: item.buffer,
                            startTime,
                        });
                    } else {
                        audioBuffers.push({
                            buffer: item.buffer,
                            startTime: currentOffset,
                        });
                        currentOffset += item.buffer.duration + PAUSE_DURATION;
                    }
                }

                setMergeProgress(Math.min(95, Math.floor(((i + batch.length) / finishedChunks.length) * 100)));
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (audioBuffers.length === 0) {
                setIsMerging(false);
                return;
            }

            // Save basic 1.0x buffers securely inside ref
            masterAudioBuffersRef.current = audioBuffers;

            // 1. Generate normal 1x Original Master (Path 1)
            const originalBuffer = await renderMergedBuffer(audioBuffers, 1.0);
            const originalWavBlob = audioBufferToWav(originalBuffer);
            const originalUrl = URL.createObjectURL(originalWavBlob);
            setMergedOriginalUrl(originalUrl);
            onAudioMerged?.(originalUrl);

            // 2. Generate Sped-Up Master (Path 2)
            const spedUpBuffer = await renderMergedBuffer(audioBuffers, speed);
            const spedUpWavBlob = audioBufferToWav(spedUpBuffer);
            const spedUpUrl = URL.createObjectURL(spedUpWavBlob);
            setMergedSpedUpUrl(spedUpUrl);

            setMergeProgress(100);
        } catch (error) {
            console.error("Gộp file âm thanh thất bại:", error);
        } finally {
            setIsMerging(false);
            if (audioContext && typeof audioContext.close === 'function') {
                try {
                    await audioContext.close();
                } catch (e) {}
            }
        }
    }, [chunks, onAudioMerged, speed]);

    const successfulChunksCount = useMemo(() => chunks.filter(c => c.status === 'finished').length, [chunks]);
    const failedChunksCount = useMemo(() => chunks.filter(c => c.status === 'error').length, [chunks]);
    const totalChunksCount = chunks.length;
    const remainingChunksCount = useMemo(() => chunks.filter(c => c.status === 'pending' || c.status === 'processing').length, [chunks]);
    const pendingChunksCount = useMemo(() => chunks.filter(c => c.status === 'pending').length, [chunks]);
    
    useEffect(() => {
        const areAllJobsDone = totalChunksCount > 0 && chunks.every(c => c.status === 'finished' || c.status === 'error');
        const hasFinishedChunks = chunks.some(c => c.status === 'finished');

        if (processingState === 'idle' && areAllJobsDone && hasFinishedChunks && failedChunksCount === 0) {
            mergeAudio();
        } else if (processingState === 'processing' || totalChunksCount === 0) {
            if (mergedOriginalUrl || mergedSpedUpUrl) {
                if (mergedOriginalUrl) URL.revokeObjectURL(mergedOriginalUrl);
                if (mergedSpedUpUrl) URL.revokeObjectURL(mergedSpedUpUrl);
                setMergedOriginalUrl(null);
                setMergedSpedUpUrl(null);
                masterAudioBuffersRef.current = null;
                onAudioMerged?.(null);
            }
        }
    }, [processingState, totalChunksCount, failedChunksCount, chunks, mergeAudio]);

    const addContent = useCallback((content: string | Array<{ text: string; startTime: number; endTime: number; timestamp: string }>) => {
        let newChunkJobs: ChunkJob[];

        if (typeof content === 'string') {
            const isSrt = content.includes('-->') && content.split('\n').some(line => /\d{2}:\d{2}:\d{2}/.test(line));
            
            if (isSrt) {
                const srtItems = TextProcessor.parseSrt(content);
                newChunkJobs = srtItems.map(item => ({
                    id: uuidv4(),
                    text: item.text,
                    timestamp: item.timestamp,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    status: 'pending',
                }));
            } else {
                const textProcessor = new TextProcessor(maxChars, minCharsToMerge);
                const textChunks = textProcessor.process(content);
                newChunkJobs = textChunks.map(text => ({
                    id: uuidv4(),
                    text,
                    status: 'pending',
                }));
            }
        } else {
            newChunkJobs = content.map(chunk => ({
                id: uuidv4(),
                text: chunk.text,
                timestamp: chunk.timestamp,
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                status: 'pending',
            }));
        }
        
        setChunks(prevChunks => [...prevChunks, ...newChunkJobs]);
    }, [maxChars, minCharsToMerge]);

    const removeChunk = useCallback((chunkId: string) => {
        setChunks(prevChunks => prevChunks.filter(chunk => chunk.id !== chunkId));
    }, []);

    const clearQueue = useCallback(() => {
        setChunks([]);
    }, []);

    const updateChunk = useCallback((chunkId: string, updates: Partial<ChunkJob>) => {
        setChunks(prevChunks => 
            prevChunks.map(chunk => 
                chunk.id === chunkId ? { ...chunk, ...updates } : chunk
            )
        );
    }, []);
    
    const retryChunk = useCallback((chunkId: string) => {
        setChunks(prev => 
            prev.map(c => c.id === chunkId ? { ...c, status: 'pending', error: null } : c)
        );
        setShouldProcess(true);
    }, []);

    const updateChunkText = useCallback((chunkId: string, newText: string) => {
        setChunks(prev => 
            prev.map(c => c.id === chunkId ? { ...c, text: newText, status: 'pending', error: null, audioUrl: undefined } : c)
        );
        // Only trigger auto-process if we were already in processing state or if user specifically wants it?
        // Let's assume if they edit, they want it to re-queue.
    }, []);

    const retryAllFailed = useCallback(() => {
        setChunks(prev => 
            prev.map(c => c.status === 'error' ? { ...c, status: 'pending', error: null } : c)
        );
        setShouldProcess(true);
    }, []);

    const processQueue = useCallback(async () => {
        let token = "";
        
        if (ttsService === 'capcut') {
            const fetchedToken = keyManager.getKey('tts');
            if (!fetchedToken) {
                alert("Vui lòng nhập API Key trong phần Cài đặt (Dòng 1) trước khi bắt đầu.");
                return;
            }
            token = fetchedToken;
        }

        setProcessingState('processing');
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        const chunksToProcess = chunks.filter(c => c.status === 'pending');
        if (chunksToProcess.length === 0) {
            setProcessingState('idle');
            return;
        }

        const processSingleChunk = async (chunk: ChunkJob) => {
            if (signal.aborted) return;
            
            updateChunk(chunk.id, { status: 'processing', error: null });
            
            try {
                let audioUrl = "";
                if (ttsService === 'capcut') {
                    audioUrl = await synthesizeChunk({
                        text: chunk.text,
                        speaker,
                        token,
                        appkey: APP_KEY,
                        speed: 1.0,
                    }, signal);
                } else {
                    audioUrl = await synthesizeEdgeTTS({
                        text: chunk.text,
                        voice: edgeVoice,
                        speed: 1.0,
                    }, signal);
                }

                if (!signal.aborted) {
                    updateChunk(chunk.id, { status: 'finished', audioUrl });
                }
            } catch (err: any) {
                const isAbort = signal.aborted || 
                                err.name === 'AbortError' || 
                                err.message?.includes('Aborted') || 
                                err.message?.includes('aborted') ||
                                err.message?.includes('without reason');

                if (isAbort) return;
                
                if (ttsService === 'capcut' && (err.message?.includes('token') || err.message?.includes('401') || err.message?.includes('429'))) {
                    keyManager.markKeyAsBad(token);
                }

                 if (!signal.aborted) {
                    updateChunk(chunk.id, { status: 'error', error: (err as Error).message });
                }
            }
        };
        
        const queue = [...chunksToProcess];
        
        const actualConcurrency = concurrentThreads;
        const actualDelay = requestDelay;

        const workerPromises = Array(actualConcurrency).fill(null).map(async () => {
            while (queue.length > 0) {
                if (signal.aborted) break;
                const chunk = queue.shift();
                if (chunk) {
                    await processSingleChunk(chunk);
                    if (actualDelay > 0 && !signal.aborted) {
                        await new Promise(resolve => setTimeout(resolve, actualDelay));
                    }
                }
            }
        });

        await Promise.all(workerPromises);
        
        if (!signal.aborted) {
            setProcessingState('idle');
        }

    }, [chunks, speaker, concurrentThreads, requestDelay, updateChunk, speed, ttsService, edgeVoice]);

    useEffect(() => {
        if (shouldProcess) {
            const timer = setTimeout(() => {
                processQueue();
                setShouldProcess(false);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [shouldProcess, processQueue]);


    const handleCancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort("Người dùng đã hủy");
            setChunks(prev => prev.map(c => c.status === 'processing' ? { ...c, status: 'pending' } : c));
            setProcessingState('idle');
        }
    }, []);

    const handleDownloadOriginal = useCallback(() => {
        if (!mergedOriginalUrl) return;
        const isTimedMerge = chunks.some(c => c.startTime !== undefined);
        const baseName = isTimedMerge ? 'audio_master_goc_timed' : 'audio_master_goc';
        const a = document.createElement('a');
        a.href = mergedOriginalUrl;
        a.download = `${baseName}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }, [mergedOriginalUrl, chunks]);

    const handleDownloadSpedUp = useCallback(() => {
        if (!mergedSpedUpUrl) return;
        const isTimedMerge = chunks.some(c => c.startTime !== undefined);
        const baseName = isTimedMerge ? `audio_master_tang_toc_${speed.toFixed(1)}x_timed` : `audio_master_tang_toc_${speed.toFixed(1)}x`;
        const a = document.createElement('a');
        a.href = mergedSpedUpUrl;
        a.download = `${baseName}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }, [mergedSpedUpUrl, chunks, speed]);
    
    const handleCountryChange = useCallback((newCountry: string) => {
        setSelectedCountry(newCountry);
        const newSpeakerGroup = SPEAKER_GROUPS.find(g => g.country === newCountry);
        if (newSpeakerGroup && newSpeakerGroup.speakers.length > 0) {
            setSpeaker(newSpeakerGroup.speakers[0].id);
        }
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Configuration
                speaker={speaker}
                setSpeaker={setSpeaker}
                selectedCountry={selectedCountry}
                onCountryChange={handleCountryChange}
                speakerGroups={SPEAKER_GROUPS}
                isProcessing={processingState === 'processing'}
                onProcessQueue={processQueue}
                onAddContent={addContent}
                pendingChunksCount={pendingChunksCount}
                maxChars={maxChars}
                setMaxChars={setMaxChars}
                minCharsToMerge={minCharsToMerge}
                setMinCharsToMerge={setMinCharsToMerge}
                concurrentThreads={concurrentThreads}
                setConcurrentThreads={setConcurrentThreads}
                requestDelay={requestDelay}
                setRequestDelay={setRequestDelay}
                speed={speed}
                setSpeed={setSpeed}
                isMerging={isMerging}
                ttsService={ttsService}
                setTtsService={setTtsService}
                edgeVoice={edgeVoice}
                setEdgeVoice={setEdgeVoice}
            />
            <ResultsPanel
                chunks={chunks}
                processingState={processingState}
                mergedOriginalUrl={mergedOriginalUrl}
                mergedSpedUpUrl={mergedSpedUpUrl}
                speed={speed}
                isMerging={isMerging}
                isSpedUpRendering={isSpedUpRendering}
                mergeProgress={mergeProgress}
                onCancel={handleCancel}
                removeChunk={removeChunk}
                onClearQueue={clearQueue}
                onDownloadOriginal={handleDownloadOriginal}
                onDownloadSpedUp={handleDownloadSpedUp}
                onMergeAudio={mergeAudio}
                onRetryChunk={retryChunk}
                onUpdateChunkText={updateChunkText}
                onRetryAllFailed={retryAllFailed}
                successfulChunksCount={successfulChunksCount}
                failedChunksCount={failedChunksCount}
                remainingChunksCount={remainingChunksCount}
                totalChunksCount={totalChunksCount}
            />
        </div>
    );
};
