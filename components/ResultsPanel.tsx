import React, { useRef, useEffect } from 'react';
import type { ChunkJob, ProcessingState } from '../src/types';
import { ChunkCard } from './ChunkCard';
import { Download, Trash2, Layers, RefreshCcw, Zap, HelpCircle } from 'lucide-react';

interface ResultsPanelProps {
    chunks: ChunkJob[];
    processingState: ProcessingState;
    mergedOriginalUrl: string | null;
    mergedSpedUpUrl: string | null;
    speed: number;
    isMerging: boolean;
    isSpedUpRendering: boolean;
    mergeProgress: number;
    onCancel: () => void;
    removeChunk: (chunkId: string) => void;
    onClearQueue: () => void;
    onDownloadOriginal: () => void;
    onDownloadSpedUp: () => void;
    onRetryChunk: (chunkId: string) => void;
    onUpdateChunkText: (chunkId: string, text: string) => void;
    onRetryAllFailed: () => void;
    successfulChunksCount: number;
    failedChunksCount: number;
    remainingChunksCount: number;
    totalChunksCount: number;
    onMergeAudio: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
    chunks, processingState, mergedOriginalUrl, mergedSpedUpUrl, speed, isMerging, isSpedUpRendering, mergeProgress, onCancel, removeChunk, onClearQueue, 
    onDownloadOriginal, onDownloadSpedUp, onRetryChunk, onUpdateChunkText, onRetryAllFailed, successfulChunksCount, failedChunksCount, remainingChunksCount, totalChunksCount,
    onMergeAudio
}) => {
    const spedUpAudioRef = useRef<HTMLAudioElement | null>(null);

    // Keep HTML playback rate strictly aligned with user-selected speed slider flawlessly
    useEffect(() => {
        if (spedUpAudioRef.current) {
            spedUpAudioRef.current.playbackRate = mergedSpedUpUrl ? 1.0 : speed;
            (spedUpAudioRef.current as any).preservesPitch = true;
        }
    }, [speed, mergedOriginalUrl, mergedSpedUpUrl]);

    return (
        <div className="bg-[#121212] border border-[#262626] rounded-xl shadow-sm h-full flex flex-col overflow-hidden text-gray-200">
             <div className="p-6 border-b border-[#262626] bg-[#0d0d0d]">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-900/30 rounded-lg border border-indigo-900/20">
                            <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Hàng chờ & Phân đoạn</h2>
                            {totalChunksCount > 0 && (
                                <div className="flex items-center gap-x-3 text-[10px] font-bold mt-0.5 uppercase tracking-wider text-gray-500">
                                    <span>Tổng: <b className="text-gray-300 font-mono">{totalChunksCount}</b></span>
                                    <span>Xong: <b className="text-emerald-400 font-mono">{successfulChunksCount}</b></span>
                                    {failedChunksCount > 0 && <span>Lỗi: <b className="text-red-400 font-mono">{failedChunksCount}</b></span>}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {processingState === 'idle' && successfulChunksCount > 0 && !isMerging && (
                             <button
                                onClick={onMergeAudio}
                                className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold uppercase transition-all active:scale-95 shadow-lg cursor-pointer ${
                                    !mergedOriginalUrl 
                                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20' 
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                }`}
                                title={!mergedOriginalUrl ? "Gộp các phần đã hoàn thành" : "Gộp lại tất cả audio"}
                            >
                                <Layers size={14} />
                                {!mergedOriginalUrl ? 'Gộp Audio' : 'Gộp Lại'}
                             </button>
                        )}
                        {processingState === 'idle' && failedChunksCount > 0 && (
                             <button
                                onClick={onRetryAllFailed}
                                className="flex items-center gap-2 py-1.5 px-4 bg-amber-950/40 text-amber-500 border border-amber-900/20 rounded-lg text-xs font-bold uppercase hover:bg-amber-600 hover:text-white transition-all active:scale-95 cursor-pointer"
                                title="Thử lại các phần bị lỗi"
                            >
                                <RefreshCcw size={14} />
                                Thử lại lỗi ({failedChunksCount})
                            </button>
                        )}
                        {processingState === 'idle' && chunks.length > 0 && !mergedOriginalUrl && (
                             <button
                                onClick={onClearQueue}
                                className="p-2 text-gray-500 hover:text-white hover:bg-[#262626] rounded-lg transition-all cursor-pointer"
                                title="Xóa Hàng chờ"
                            >
                                <Trash2 size={20} />
                             </button>
                        )}
                        {processingState === 'processing' && (
                             <button
                                onClick={onCancel}
                                className="flex items-center gap-2 py-1.5 px-4 bg-red-950/40 text-red-400 border border-red-950/20 rounded-lg text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all active:scale-95 cursor-pointer"
                            >
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                Hủy bỏ
                            </button>
                        )}
                    </div>
                 </div>
             </div>
            
             {isMerging && (
                <div className="m-6 p-6 bg-indigo-950/40 rounded-2xl border border-indigo-900/20 flex justify-between items-center animate-in zoom-in duration-300">
                    <div className="flex-grow mr-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Đang gộp âm thanh...
                            </h3>
                            <span className="text-xs font-bold text-indigo-300">{mergeProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-indigo-950 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${mergeProgress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

             {mergedOriginalUrl && !isMerging && (
                <div className="m-6 p-6 bg-gradient-to-b from-[#10141D] to-[#0A0D14] rounded-2xl border border-blue-900/20 shadow-xl relative overflow-hidden animate-in zoom-in duration-300">
                    <div className="relative z-10 space-y-5">
                        <div className="flex justify-between items-center border-b border-[#232936]/60 pb-3">
                            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Bản Master Sẵn sàng (Chia 2 đường)
                            </h3>
                            {isSpedUpRendering && (
                                <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md animate-pulse uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-ping"></span>
                                    Đang gộp tốc độ mới...
                                </span>
                            )}
                        </div>

                        {/* Đường phát thứ 1: Bản gốc 1.0x */}
                        <div className="space-y-3 bg-[#0A0E17]/80 p-4 border border-[#232936]/50 rounded-xl hover:border-blue-500/10 transition-all">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-extrabold text-slate-300 flex items-center gap-2 tracking-wide uppercase">
                                    <span className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">ĐƯỜNG 1:</span> Bản Master gốc (1.0x)
                                </span>
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Giọng Thô Gốc</span>
                            </div>
                            
                            <audio controls src={mergedOriginalUrl} className="w-full h-8 invert brightness-125 hue-rotate-180 outline-none">
                                Trình duyệt không hỗ trợ.
                            </audio>
                            
                            <button
                                onClick={onDownloadOriginal}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold text-emerald-400 hover:text-white bg-emerald-950/20 border border-emerald-900/20 hover:bg-emerald-600 transition-all active:scale-[0.98] uppercase tracking-wider cursor-pointer"
                            >
                                <Download size={14} />
                                Tải bản gốc (1.0x)
                            </button>
                        </div>

                        {/* Đường phát thứ 2: Bản tăng tốc */}
                        {mergedOriginalUrl && (
                            <div className="space-y-3 bg-[#0C0B1B]/80 p-4 border border-[#211E3B]/50 rounded-xl hover:border-indigo-500/10 transition-all">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-2 tracking-wide uppercase">
                                        <span className="text-indigo-400 font-mono text-[11px] bg-indigo-500/10 px-1.5 py-0.5 rounded">ĐƯỜNG 2:</span> Bản Master tăng tốc ({speed.toFixed(1)}x)
                                    </span>
                                    <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Bảo toàn Độ cao</span>
                                </div>
                                
                                <audio 
                                    ref={spedUpAudioRef}
                                    controls 
                                    src={mergedSpedUpUrl || mergedOriginalUrl} 
                                    className="w-full h-8 invert brightness-125 hue-rotate-180 outline-none"
                                    onPlay={() => {
                                        if (spedUpAudioRef.current) {
                                            spedUpAudioRef.current.playbackRate = mergedSpedUpUrl ? 1.0 : speed;
                                        }
                                    }}
                                    onLoadedMetadata={() => {
                                        if (spedUpAudioRef.current) {
                                            spedUpAudioRef.current.playbackRate = mergedSpedUpUrl ? 1.0 : speed;
                                        }
                                    }}
                                >
                                    Trình duyệt không hỗ trợ.
                                </audio>
                                
                                <button
                                    onClick={onDownloadSpedUp}
                                    disabled={isSpedUpRendering}
                                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all active:scale-[0.98] uppercase tracking-wider cursor-pointer ${
                                        isSpedUpRendering 
                                        ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-55' 
                                        : 'text-indigo-400 hover:text-white bg-indigo-950/20 border border-indigo-900/20 hover:bg-indigo-600'
                                    }`}
                                >
                                    {isSpedUpRendering ? (
                                        <span className="flex items-center gap-2 justify-center">
                                            <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                                            Đang cập nhật file tốc độ...
                                        </span>
                                    ) : (
                                        <>
                                            <Download size={14} />
                                            <span>Tải bản tăng tốc ({speed.toFixed(1)}x)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

             <div className="flex-grow overflow-y-auto p-6 pt-0 space-y-3">
                {chunks.map((chunk, index) => (
                    <ChunkCard 
                        key={chunk.id} 
                        chunk={chunk} 
                        index={index} 
                        onRemove={removeChunk}
                        onRetry={onRetryChunk}
                        onUpdateText={onUpdateChunkText}
                    />
                ))}
                
                {chunks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-700 space-y-4 py-20">
                        <Layers className="w-16 h-16 opacity-20 animate-pulse text-indigo-400" />
                        <div className="space-y-1.5">
                             <p className="font-bold text-lg text-gray-400">Hàng chờ Trống</p>
                             <p className="text-[10px] uppercase tracking-widest font-extrabold text-gray-600 flex items-center justify-center gap-1">
                                <Zap size={11} className="text-amber-500" /> Nhập nội dung để bắt đầu phát triển
                             </p>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};
