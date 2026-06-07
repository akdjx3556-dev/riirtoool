
import React, { useState } from 'react';
import type { ChunkJob, ProcessingState } from '../src/types';
import { ChunkCard } from './ChunkCard';
import { Download, Trash2, Layers, RefreshCcw } from 'lucide-react';

interface ResultsPanelProps {
    chunks: ChunkJob[];
    processingState: ProcessingState;
    mergedAudioUrls: string[];
    isMerging: boolean;
    mergeProgress: number;
    onCancel: () => void;
    removeChunk: (chunkId: string) => void;
    onClearQueue: () => void;
    onDownloadAll: () => void;
    onRetryChunk: (chunkId: string) => void;
    onUpdateChunkText: (chunkId: string, text: string) => void;
    onRetryAllFailed: () => void;
    successfulChunksCount: number;
    failedChunksCount: number;
    remainingChunksCount: number;
    totalChunksCount: number;
    onMergeAudio: () => void;
    onMergeFinalParts: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
    chunks, processingState, mergedAudioUrls, isMerging, mergeProgress, onCancel, removeChunk, onClearQueue, onDownloadAll,
    onRetryChunk, onUpdateChunkText, onRetryAllFailed, successfulChunksCount, failedChunksCount, remainingChunksCount, totalChunksCount,
    onMergeAudio, onMergeFinalParts
}) => {
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
                                <div className="flex items-center gap-x-3 text-[10px] font-bold mt-0.5 uppercase tracking-wider">
                                    <span className="text-gray-500">Tổng: {totalChunksCount}</span>
                                    <span className="text-emerald-400">Xong: {successfulChunksCount}</span>
                                    {failedChunksCount > 0 && <span className="text-red-400">Lỗi: {failedChunksCount}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {processingState === 'idle' && successfulChunksCount > 0 && !isMerging && (
                             <button
                                onClick={onMergeAudio}
                                className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold uppercase transition-all active:scale-95 shadow-lg ${
                                    mergedAudioUrls.length === 0 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20' 
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                }`}
                                title={mergedAudioUrls.length === 0 ? "Gộp các phần đã hoàn thành" : "Gộp lại tất cả audio"}
                            >
                                <Layers size={14} />
                                {mergedAudioUrls.length === 0 ? 'Gộp Audio' : 'Gộp Lại'}
                            </button>
                        )}
                        {processingState === 'idle' && failedChunksCount > 0 && (
                             <button
                                onClick={onRetryAllFailed}
                                className="flex items-center gap-2 py-1.5 px-4 bg-amber-900/20 text-amber-500 border border-amber-900/10 rounded-lg text-xs font-bold uppercase hover:bg-amber-600 hover:text-white transition-all active:scale-95"
                                title="Thử lại các phần bị lỗi"
                            >
                                <RefreshCcw size={14} />
                                Thử lại lỗi ({failedChunksCount})
                            </button>
                        )}
                        {processingState === 'idle' && chunks.length > 0 && mergedAudioUrls.length === 0 && (
                             <button
                                onClick={onClearQueue}
                                className="p-2 text-gray-500 hover:text-white hover:bg-[#262626] rounded-lg transition-all"
                                title="Xóa Hàng chờ"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        {processingState === 'processing' && (
                             <button
                                onClick={onCancel}
                                className="flex items-center gap-2 py-1.5 px-4 bg-red-900/20 text-red-400 border border-red-900/10 rounded-lg text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all active:scale-95"
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
                <div className="m-6 p-6 bg-indigo-900/20 rounded-2xl border border-indigo-900/30 flex justify-between items-center animate-in zoom-in duration-300">
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

             {mergedAudioUrls.length > 0 && !isMerging && (
                <div className="m-6 p-6 bg-blue-900/20 rounded-2xl border border-blue-900/20 relative overflow-hidden group animate-in zoom-in duration-300">
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                Sẵn sàng Sản xuất {mergedAudioUrls.length > 1 ? `(${mergedAudioUrls.length} Bản Master)` : '(Bản Master)'}
                            </h3>
                        </div>
                        <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                            {mergedAudioUrls.map((url, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    {mergedAudioUrls.length > 1 && <span className="text-[10px] text-blue-300/80 font-bold uppercase tracking-widest ml-1">Part {i + 1}</span>}
                                    <audio controls src={url} className="w-full h-10 invert brightness-200 hue-rotate-180">
                                        Trình duyệt không hỗ trợ.
                                    </audio>
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 pt-2">
                            {mergedAudioUrls.length > 1 && (
                                <button
                                    onClick={onMergeFinalParts}
                                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-[0.97] uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                                >
                                    <Layers size={16} />
                                    Gộp tất cả ({mergedAudioUrls.length} phần) thành 1 file
                                </button>
                            )}
                            <button
                                onClick={onDownloadAll}
                                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.97] uppercase tracking-widest"
                            >
                                <Download size={16} />
                                {mergedAudioUrls.length > 1 ? `Tải xuống tất cả (${mergedAudioUrls.length} file)` : 'Tải xuống Audio'}
                            </button>
                        </div>
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
                        <Layers className="w-16 h-16 opacity-20" />
                        <div className="space-y-1">
                             <p className="font-bold text-lg text-gray-600">Hàng chờ Trống</p>
                             <p className="text-[10px] uppercase tracking-widest font-medium">Thêm nội dung để bắt đầu tổng hợp</p>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};

