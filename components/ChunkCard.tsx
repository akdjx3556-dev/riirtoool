
import React, { useState, useRef, useEffect } from 'react';
import type { ChunkJob } from '../src/types';
import { AudioVisualizer } from './AudioVisualizer';
import { RefreshCcw, Trash2, Download, Edit2, Check, X } from 'lucide-react';

interface ChunkCardProps {
    chunk: ChunkJob;
    index: number;
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
    onUpdateText: (id: string, text: string) => void;
}

export const ChunkCard: React.FC<ChunkCardProps> = ({ chunk, index, onRemove, onRetry, onUpdateText }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(chunk.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editText.trim() !== chunk.text) {
            onUpdateText(chunk.id, editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(chunk.text);
        setIsEditing(false);
    };

    const getStatusStyles = () => {
        switch (chunk.status) {
            case 'finished': return 'border-emerald-900/20 bg-emerald-900/10';
            case 'error': return 'border-red-900/20 bg-red-900/10';
            case 'processing': return 'border-blue-900/20 bg-blue-900/10';
            default: return 'border-gray-800 bg-gray-800/10';
        }
    };

    const getStatusIconColor = () => {
        switch (chunk.status) {
            case 'finished': return 'text-emerald-500';
            case 'error': return 'text-red-500';
            case 'processing': return 'text-blue-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className={`p-4 rounded-xl border transition-all duration-200 group relative ${getStatusStyles()}`}>
            <div className="flex justify-between items-start gap-4 mb-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusIconColor()}`}>
                        {chunk.status === 'finished' ? 'Hoàn thành' : 
                         chunk.status === 'error' ? 'Lỗi' : 
                         chunk.status === 'processing' ? 'Đang xử lý' : 'Chờ'}
                    </span>
                    {chunk.timestamp && (
                        <span className="text-[10px] font-medium text-gray-400">
                            • {chunk.timestamp}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isEditing && chunk.status !== 'processing' && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg transition-colors"
                            title="Sửa nội dung"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
                    {chunk.status === 'error' && (
                        <button 
                            onClick={() => onRetry(chunk.id)}
                            className="p-1.5 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Thử lại"
                        >
                            <RefreshCcw size={14} />
                        </button>
                    )}
                    <button 
                        onClick={() => onRemove(chunk.id)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-[#262626] rounded-lg transition-colors"
                        title="Xóa"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            
            {isEditing ? (
                <div className="mb-3 space-y-2">
                    <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[80px] resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={handleCancel}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors"
                        >
                            <X size={12} /> Hủy
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-colors"
                        >
                            <Check size={12} /> Lưu
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-gray-200 leading-relaxed font-medium line-clamp-2 group-hover:line-clamp-none transition-all duration-300 mb-3">
                    {chunk.text}
                </p>
            )}

            {chunk.status === 'finished' && chunk.audioUrl && (
                <div className="flex flex-col gap-2">
                    <AudioVisualizer audioUrl={chunk.audioUrl} height={32} />
                    <div className="flex justify-end">
                        <a 
                            href={chunk.audioUrl} 
                            download={`chunk_${index + 1}.mp3`}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-emerald-400 transition-all uppercase tracking-wider"
                        >
                            <Download size={12} />
                            Tải xuống MP3
                        </a>
                    </div>
                </div>
            )}

            {chunk.status === 'error' && chunk.error && (
                <div className="mt-2 text-[10px] font-bold text-red-400 bg-red-900/20 p-2 rounded-lg border border-red-900/10">
                    Lỗi: {chunk.error}
                </div>
            )}

            {chunk.status === 'processing' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                    </div>
                </div>
            )}
        </div>
    );
};

