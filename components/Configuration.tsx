
import React, { useState, memo, useCallback, useEffect, useMemo } from 'react';
import type { SpeakerGroup, Voice } from '../src/types';
import { FALLBACK_VOICES } from '../src/edgeVoices';
import { FileUpload } from './FileUpload';
import { Settings2, Wand2, Sparkles, Loader2, Languages, ArrowRight, AlertTriangle, CheckCircle2, Clipboard, Search, Check } from 'lucide-react';
import { aiService } from '../services/aiService';
import { TextProcessor } from '../services/textProcessor';
import { TranslationService, TranslationEngine } from '../services/translationService';
import { SrtValidator, SrtError, SrtBlock } from '../services/srtValidator';

interface ConfigurationProps {
    speaker: string;
    setSpeaker: (speakerId: string) => void;
    selectedCountry: string;
    onCountryChange: (country: string) => void;
    speakerGroups: SpeakerGroup[];
    isProcessing: boolean;
    onProcessQueue: () => void;
    onAddContent: (content: string | Array<{ text: string; startTime: number; endTime: number; timestamp: string }>) => void;
    pendingChunksCount: number;
    maxChars: number;
    setMaxChars: (value: number) => void;
    minCharsToMerge: number;
    setMinCharsToMerge: (value: number) => void;
    concurrentThreads: number;
    setConcurrentThreads: (value: number) => void;
    requestDelay: number;
    setRequestDelay: (value: number) => void;
    speed: number;
    setSpeed: (value: number) => void;
    isMerging: boolean;
    ttsService: 'capcut' | 'edgetts';
    setTtsService: (service: 'capcut' | 'edgetts') => void;
    edgeVoice: string;
    setEdgeVoice: (voice: string) => void;
}

const TARGET_LANGS = [
    { label: 'Tiếng Việt', value: 'Vietnamese', code: 'vi' },
    { label: 'Tiếng Anh', value: 'English', code: 'en' },
    { label: 'Tiếng Trung', value: 'Chinese', code: 'zh' },
    { label: 'Tiếng Nhật', value: 'Japanese', code: 'ja' },
    { label: 'Tiếng Hàn', value: 'Korean', code: 'ko' },
    { label: 'Tiếng Thái', value: 'Thai', code: 'th' },
];

export const Configuration: React.FC<ConfigurationProps> = memo(({
    speaker, setSpeaker, selectedCountry, onCountryChange, speakerGroups, isProcessing,
    onProcessQueue, onAddContent, pendingChunksCount,
    maxChars, setMaxChars, minCharsToMerge, setMinCharsToMerge,
    concurrentThreads, setConcurrentThreads, requestDelay, setRequestDelay,
    speed, setSpeed, isMerging,
    ttsService, setTtsService, edgeVoice, setEdgeVoice
}) => {
    const [textToAdd, setTextToAdd] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showTranslate, setShowTranslate] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translateProgress, setTranslateProgress] = useState(0);

    // Edge TTS Voice management and caching
    const [voices, setVoices] = useState<Voice[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [vietnameseOnly, setVietnameseOnly] = useState(true);
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (ttsService === 'edgetts' && voices.length === 0) {
            const fetchVoices = async () => {
                setIsLoadingVoices(true);
                try {
                    const response = await fetch("/api/voices");
                    const data = await response.json();
                    if (data.success && Array.isArray(data.voices)) {
                        setVoices(data.voices);
                    } else {
                        setVoices(FALLBACK_VOICES);
                    }
                } catch (e) {
                    setVoices(FALLBACK_VOICES);
                } finally {
                    setIsLoadingVoices(false);
                }
            };
            fetchVoices();
        }
    }, [ttsService, voices.length]);

    const activeVoicesList = useMemo(() => {
        return voices.length > 0 ? voices : FALLBACK_VOICES;
    }, [voices]);

    const filteredVoices = useMemo(() => {
        return activeVoicesList.filter(voice => {
            if (vietnameseOnly && !voice.Locale.toLowerCase().startsWith('vi')) {
                return false;
            }
            if (genderFilter !== 'all') {
                if (genderFilter === 'male' && voice.Gender?.toLowerCase() !== 'male') return false;
                if (genderFilter === 'female' && voice.Gender?.toLowerCase() !== 'female') return false;
            }
            if (searchTerm.trim() !== '') {
                const query = searchTerm.toLowerCase();
                const fName = (voice.FriendlyName || '').toLowerCase();
                const sName = (voice.ShortName || '').toLowerCase();
                const locale = (voice.Locale || '').toLowerCase();
                return fName.includes(query) || sName.includes(query) || locale.includes(query);
            }
            return true;
        });
    }, [activeVoicesList, vietnameseOnly, genderFilter, searchTerm]);

    useEffect(() => {
        if (ttsService === 'edgetts' && filteredVoices.length > 0 && !filteredVoices.some(v => v.ShortName === edgeVoice)) {
            setEdgeVoice(filteredVoices[0].ShortName);
        }
    }, [ttsService, filteredVoices, edgeVoice, setEdgeVoice]);

    // SRT states
    const [srtErrors, setSrtErrors] = useState<SrtError[]>([]);
    const [fixedSrtContent, setFixedSrtContent] = useState<string | null>(null);

    // Translation settings
    const [translationEngine, setTranslationEngine] = useState<TranslationEngine>(TranslationEngine.GEMINI);
    const [targetLang, setTargetLang] = useState('Vietnamese');

    const handleAddTextJob = () => {
        if (!textToAdd.trim()) return;
        onAddContent(textToAdd.trim());
        setTextToAdd('');
    };

    const handleOptimize = async () => {
        if (!textToAdd.trim() || isOptimizing) return;
        setIsOptimizing(true);
        try {
            const optimized = await aiService.optimizeTextForTTS(textToAdd);
            setTextToAdd(optimized);
        } catch (error) {
            alert("Tối ưu hóa AI thất bại. Vui lòng kiểm tra API Key.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const isSrtLike = useMemo(() => {
        return textToAdd.includes('-->') && textToAdd.split('\n').some(line => /\d{2}:\d{2}:\d{2}/.test(line));
    }, [textToAdd]);

    useEffect(() => {
        if (isSrtLike) {
            try {
                const blocks = SrtValidator.parse(textToAdd);
                const errors = SrtValidator.validate(blocks);
                setSrtErrors(errors);
                
                // Giai đoạn 1: Auto-scan & sửa nhẹ khi upload
                // Nếu chưa có fixed content, thử sửa các lỗi cơ bản ngay
                if (errors.length > 0 && !fixedSrtContent) {
                    const repaired = TextProcessor.fixSrtContent(textToAdd);
                    if (repaired !== textToAdd) {
                        // Chúng ta không tự ý thay đổi textToAdd ngay lập tức để tránh gây phiền hà
                        // Nhưng chúng ta có thể highlight nút "Sửa lỗi"
                    }
                }
            } catch (e) {
                setSrtErrors([]);
            }
        } else {
            setSrtErrors([]);
            setFixedSrtContent(null);
        }
    }, [textToAdd, isSrtLike, fixedSrtContent]);

    const handleFixSrt = () => {
        if (!textToAdd.trim()) return;
        const blocks = SrtValidator.parse(textToAdd);
        const fixedBlocks = SrtValidator.fix(blocks);
        const fixedContent = SrtValidator.stringify(fixedBlocks);
        setFixedSrtContent(fixedContent);
    };

    const handlePasteFixedSrt = () => {
        if (fixedSrtContent) {
            setTextToAdd(fixedSrtContent);
            setFixedSrtContent(null);
        }
    };

    const handleTranslate = async () => {
        if (!textToAdd.trim() || isTranslating) return;
        setIsTranslating(true);
        setTranslateProgress(0);
        
        try {
            if (isSrtLike) {
                const isAI = translationEngine === TranslationEngine.GEMINI || translationEngine === TranslationEngine.DEEPSEEK;
                const batchSize = isAI ? 30 : 8;
                const concurrency = isAI ? 5 : 2;

                const translated = await TextProcessor.translateSrtContent(
                    textToAdd,
                    async (chunk) => TranslationService.translate(chunk, {
                        engine: translationEngine,
                        targetLang: targetLang,
                        sourceLang: 'auto',
                    }),
                    {
                        batchSize,
                        concurrency,
                        onProgress: (progress) => setTranslateProgress(progress)
                    }
                );
                setTextToAdd(translated);
            } else {
                const translated = await TranslationService.translate(textToAdd, {
                    engine: translationEngine,
                    targetLang: targetLang,
                    sourceLang: 'auto',
                });
                setTextToAdd(translated);
            }
        } catch (error: any) {
            alert(error.message || "Dịch thuật thất bại.");
        } finally {
            setIsTranslating(false);
            setTranslateProgress(0);
        }
    };

    const handleFileAdded = (content: string | Array<{ text: string; startTime: number; endTime: number; timestamp: string }>) => {
        if (typeof content === 'string') {
            const isSrt = content.includes('-->') && content.split('\n').some(line => /\d{2}:\d{2}:\d{2}/.test(line));
            if (isSrt) {
                // Giai đoạn 1: Auto-scan & sửa nhẹ khi upload thành văn bản
                const repaired = TextProcessor.fixSrtContent(content);
                setTextToAdd(repaired);
            } else {
                setTextToAdd(content);
            }
        } else {
            onAddContent(content);
        }
    };
    
    const availableSpeakers = speakerGroups.find(g => g.country === selectedCountry)?.speakers || [];

    return (
        <div className="bg-[#121212] border border-[#262626] rounded-xl shadow-sm h-fit flex flex-col overflow-hidden">
            <div className="p-6 space-y-6">
                <div className="border-b border-[#262626] pb-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-900/20">
                                <Settings2 className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Cấu hình Tổng hợp</h2>
                                <p className="text-xs text-gray-500 font-medium">Tùy chỉnh các tham số giọng nói neural</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dịch vụ TTS Toggle Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wide ml-1">
                        Dịch vụ giọng đọc (TTS)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#1A1A1A] border border-[#262626] rounded-xl">
                        <button
                            type="button"
                            onClick={() => setTtsService('capcut')}
                            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsService === 'capcut' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-[#222222] hover:text-gray-200'}`}
                        >
                            <span>CapCut Cloud</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTtsService('edgetts')}
                            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsService === 'edgetts' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-[#222222] hover:text-gray-200'}`}
                        >
                            <span>Microsoft Edge (Free)</span>
                        </button>
                    </div>
                </div>

                {ttsService === 'capcut' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-400 ml-1">Ngôn ngữ</label>
                            <select
                                value={selectedCountry}
                                onChange={(e) => onCountryChange(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                            >
                                {speakerGroups.map(group => (
                                    <option key={group.country} value={group.country}>{group.country}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-400 ml-1">Hồ sơ Giọng nói</label>
                            <select
                                value={speaker}
                                onChange={(e) => setSpeaker(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50 cursor-pointer"
                                disabled={availableSpeakers.length === 0}
                            >
                                {availableSpeakers.map(spk => (
                                    <option key={spk.id} value={spk.id}>{spk.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Filters Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Search */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-400 ml-1 flex items-center gap-1">
                                    <Search size={12} />Tìm kiếm
                                </label>
                                <input
                                    type="text"
                                    placeholder="Tìm Edge voice (HoaiMy, NamMinh...)"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-xs text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-500"
                                />
                            </div>

                            {/* Gender selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-400 ml-1">Giới tính</label>
                                <div className="flex bg-[#1A1A1A] border border-[#262626] rounded-lg p-1 h-[42px] items-center">
                                    {(['all', 'male', 'female'] as const).map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGenderFilter(g)}
                                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${genderFilter === g ? 'bg-[#2D2D2D] text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                        >
                                            {g === 'all' ? 'Tất cả' : g === 'male' ? 'Nam' : 'Nữ'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dropdown list for voices */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-xs font-semibold text-gray-400">Giọng đọc Microsoft Edge ({filteredVoices.length})</label>
                                <label className="flex items-center gap-1.5 text-[11px] text-gray-500 select-none cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={vietnameseOnly}
                                        onChange={e => setVietnameseOnly(e.target.checked)}
                                        className="rounded border-[#262626] bg-[#0D0D0D] text-blue-500 accent-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Chỉ Tiếng Việt (vi-VN)</span>
                                </label>
                            </div>

                            <select
                                value={edgeVoice}
                                onChange={(e) => setEdgeVoice(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                            >
                                {filteredVoices.map(voice => (
                                    <option key={voice.ShortName} value={voice.ShortName}>
                                        {voice.FriendlyName ? voice.FriendlyName.replace("Microsoft ", "").replace("Neural", "") : voice.ShortName} ({voice.Gender === 'Female' ? 'Nữ' : 'Nam'} - {voice.Locale})
                                    </option>
                                ))}
                                {filteredVoices.length === 0 && (
                                    <option value="" disabled>Không tìm thấy giọng đọc nào...</option>
                                )}
                            </select>
                        </div>
                    </div>
                )}

                <div className={`bg-[#1A1A1A] border border-[#262626] p-4 rounded-xl space-y-3 transition-all duration-200 ${isMerging ? 'border-amber-500/20 bg-amber-500/[0.02]' : ''}`}>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tight">
                            Tốc độ giọng đọc: <span className="text-blue-400 font-mono text-sm">{speed.toFixed(1)}x</span>
                        </label>
                        {isMerging ? (
                            <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider animate-pulse">
                                Đang gộp audio
                            </span>
                        ) : (
                            <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                                Có thể chỉnh
                            </span>
                        )}
                    </div>
                    <input 
                        type="range" min="0.5" max="2.0" step="0.1" 
                        value={speed} onChange={e => !isMerging && setSpeed(parseFloat(e.target.value))}
                        disabled={isMerging}
                        className="w-full h-1.5 bg-[#0D0D0D] rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[8px] text-gray-600 font-bold uppercase tracking-widest px-1">
                        <span>Chậm</span>
                        <span>Bình thường</span>
                        <span>Nhanh</span>
                    </div>
                    {isMerging && (
                        <p className="text-[10px] text-amber-500 italic mt-1 leading-normal ml-0.5">
                            * Đang tiến hành gộp và đồng bộ hóa file âm thanh, vui lòng đợi.
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${showAdvanced ? 'bg-blue-900/20 border-blue-900/40 text-blue-400' : 'bg-[#1A1A1A] border-[#262626] text-gray-400 hover:bg-[#222222]'}`}
                    >
                        <span className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-wider">
                             <Settings2 size={14} className={showAdvanced ? 'text-blue-400' : 'text-gray-500'} />
                            Cấu hình
                        </span>
                    </button>

                    <button 
                        onClick={() => setShowTranslate(!showTranslate)} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${showTranslate ? 'bg-purple-900/20 border-purple-900/40 text-purple-400' : 'bg-[#1A1A1A] border-[#262626] text-gray-400 hover:bg-[#222222]'}`}
                    >
                        <span className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-wider">
                             <Languages size={14} className={showTranslate ? 'text-purple-400' : 'text-gray-500'} />
                            Dịch SRT
                        </span>
                    </button>
                </div>

                {(showAdvanced || showTranslate) && (
                    <div className="p-4 bg-[#1A1A1A] border border-[#262626] rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {showAdvanced && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Luồng</label>
                                    <input 
                                        type="number" value={isNaN(concurrentThreads) ? '' : concurrentThreads} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value, 10);
                                            setConcurrentThreads(isNaN(val) ? 0 : Math.min(500, Math.max(1, val)));
                                        }}
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Độ trễ (ms)</label>
                                    <input 
                                        type="number" value={isNaN(requestDelay) ? '' : requestDelay} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value, 10);
                                            setRequestDelay(isNaN(val) ? 0 : val);
                                        }}
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Ký tự tối đa</label>
                                    <input 
                                        type="number" value={isNaN(maxChars) ? '' : maxChars} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value, 10);
                                            setMaxChars(isNaN(val) ? 0 : val);
                                        }}
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Gộp tối thiểu</label>
                                    <input 
                                        type="number" value={isNaN(minCharsToMerge) ? '' : minCharsToMerge} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value, 10);
                                            setMinCharsToMerge(isNaN(val) ? 0 : val);
                                        }}
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        {showTranslate && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Engine Dịch</label>
                                        <select 
                                            value={translationEngine}
                                            onChange={(e) => setTranslationEngine(e.target.value as TranslationEngine)}
                                            className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-purple-500"
                                        >
                                            <option value={TranslationEngine.GEMINI}>Gemini AI (Mượt)</option>
                                            <option value={TranslationEngine.GOOGLE}>Google Translate</option>
                                            <option value={TranslationEngine.BING}>Bing Translate</option>
                                            <option value={TranslationEngine.DEEPSEEK}>Deepseek AI</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider ml-1">Dịch sang</label>
                                        <select 
                                            value={targetLang}
                                            onChange={(e) => setTargetLang(e.target.value)}
                                            className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-purple-500"
                                        >
                                            {TARGET_LANGS.map(lang => (
                                                <option key={lang.value} value={lang.value}>{lang.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleTranslate}
                                    disabled={isTranslating || !textToAdd.trim()}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50"
                                >
                                    {isTranslating ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Đang dịch ({translateProgress}%)
                                        </>
                                    ) : (
                                        <>
                                            <Languages size={14} />
                                            Bắt đầu Dịch
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-[#262626]">
                    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-hidden focus-within:border-blue-500/50 transition-all relative">
                        <textarea
                            value={textToAdd}
                            onChange={(e) => setTextToAdd(e.target.value)}
                            placeholder="Nhập hoặc dán nội dung văn bản tại đây..."
                            rows={6}
                            className="w-full border-0 resize-none p-4 text-sm bg-transparent text-gray-200 placeholder-gray-500 focus:ring-0 leading-relaxed font-medium"
                        />
                        
                        <div className="absolute right-4 top-4 flex gap-2">
                             {isSrtLike && (
                                <div className="flex gap-2">
                                    {fixedSrtContent ? (
                                        <button
                                            onClick={handlePasteFixedSrt}
                                            className="flex items-center gap-2 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 hover:bg-yellow-900/40 transition-all animate-pulse"
                                        >
                                            <Clipboard size={12} />
                                            Dán SRT Đã sửa
                                        </button>
                                    ) : (
                                        srtErrors.length > 0 && (
                                            <button
                                                onClick={handleFixSrt}
                                                className="flex items-center gap-2 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-900/20 border border-green-900/40 hover:bg-green-900/40 transition-all"
                                                title="Tự động sửa lỗi SRT (thời gian, thứ tự)"
                                            >
                                                <Wand2 size={12} />
                                                Sửa Lỗi ({srtErrors.length})
                                            </button>
                                        )
                                    )}
                                </div>
                             )}
                             <button
                                 onClick={handleOptimize}
                                 disabled={isOptimizing || !textToAdd.trim()}
                                 className="flex items-center gap-2 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-900/20 border border-blue-900/40 hover:bg-blue-900/40 transition-all disabled:opacity-50"
                                 title="Sửa lỗi & Tối ưu bằng AI"
                             >
                                 {isOptimizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                 {isOptimizing ? 'Đang tối ưu...' : 'Tối ưu AI'}
                             </button>
                         </div>

                        {/* SRT Validation Feedback */}
                        {isSrtLike && srtErrors.length > 0 && !fixedSrtContent && (
                            <div className="mx-4 mb-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-start gap-3">
                                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Cảnh báo lỗi SRT</p>
                                    <ul className="space-y-1">
                                        {srtErrors.slice(0, 3).map((err, i) => (
                                            <li key={i} className="text-[9px] text-gray-400 leading-tight">
                                                • {err.message} (Block {err.blockIndex + 1})
                                            </li>
                                        ))}
                                        {srtErrors.length > 3 && (
                                            <li className="text-[9px] text-gray-500 italic">...và {srtErrors.length - 3} lỗi khác</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {isSrtLike && srtErrors.length === 0 && (
                            <div className="mx-4 mb-4 p-2 bg-green-950/10 border border-green-900/20 rounded-lg flex items-center gap-2">
                                <CheckCircle2 size={12} className="text-green-500" />
                                <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">SRT Hợp lệ</p>
                            </div>
                        )}

                        {fixedSrtContent && (
                            <div className="mx-4 mb-4 p-3 bg-yellow-950/20 border border-yellow-900/30 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-yellow-500" />
                                    <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Đã sửa {srtErrors.length} lỗi!</p>
                                </div>
                                <p className="text-[9px] text-gray-500 italic">Nhấn "Dán SRT Đã sửa" để cập nhật</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-3 bg-[#121212] border-t border-[#262626]">
                            <FileUpload onFileProcessed={handleFileAdded} />
                            <button
                                onClick={handleAddTextJob}
                                disabled={!textToAdd.trim()}
                                className="flex items-center gap-2 py-2 px-6 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-20 active:scale-95"
                            >
                                Thêm vào Hàng chờ
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onProcessQueue}
                    disabled={isProcessing || pendingChunksCount === 0}
                    className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-10 shadow-lg shadow-blue-900/20"
                >
                    {isProcessing ? 'Đang xử lý...' : `Bắt đầu Tổng hợp (${pendingChunksCount})`}
                </button>
            </div>
        </div>
    );
});

Configuration.displayName = 'Configuration';
