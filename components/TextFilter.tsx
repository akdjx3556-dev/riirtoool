import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './FileUpload';
import { Filter, Trash2, Copy, Check, Plus, X, Type, FileText, Settings2, Sparkles, Hash, Eraser, Languages } from 'lucide-react';
import { TextFilterService, PhoneticEntry, FilterOptions } from '../services/textFilterService';

export const TextFilter: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [junkKeywords, setJunkKeywords] = useState('comment, 0 comment, Vote, SEND GIFT, bình luận, 0 bình luận, bỏ phiếu, gửi quà tặng, gửI quà tặng, P@treon, PinkSnake, chương phía trước, vui lòng theo dõi tôi, p@treon.com/PinkSnake, nhận xét, còn lại, SUY NGHĨ CỦA NGƯỜI SÁNG TẠO, Rắn hồng, discord.gg, https://discord.gg/7mNvAaTtkf, Power Stones, Đánh giá, Bonus, 1 left, 2 left, 3 left, 4 left, 5 left, 6 left, 7 left, 8 left, 9 left, discord.com/invite');
    const [phoneticDict, setPhoneticDict] = useState<PhoneticEntry[]>(() => {
        const saved = localStorage.getItem('puch_phonetic_dict');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to load phonetic dict", e);
            }
        }
        return [
            { id: '1', original: 'pokemon master', phonetic: 'pô kê mon mát tơ' },
            { id: '2', original: 'ronaldo', phonetic: 'rô nan đô' },
            { id: '3', original: 'madrid', phonetic: 'ma rít' },
            { id: '4', original: 'tottenham', phonetic: 'tốt ten ham' }
        ];
    });
    const [newOriginal, setNewOriginal] = useState('');
    const [newPhonetic, setNewPhonetic] = useState('');
    const [options, setOptions] = useState<FilterOptions>({
        removeJunkBlocks: true,
        removeChapterHeader: true,
        removeEndNumbers: true,
        convertLargeNumbers: true,
        removeNumbers: false,
        removeWhitespace: true,
        manualPhonetic: true,
        removeDuplicateBlocks: true,
        removeWebAddresses: true
    });

    useEffect(() => {
        localStorage.setItem('puch_phonetic_dict', JSON.stringify(phoneticDict));
    }, [phoneticDict]);

    const handleFileProcessed = useCallback((content: string) => {
        setInputText(content);
    }, []);

    const addPhoneticEntry = useCallback(() => {
        if (!newOriginal.trim() || !newPhonetic.trim()) return;
        const newEntry: PhoneticEntry = {
            id: Date.now().toString(),
            original: newOriginal.trim(),
            phonetic: newPhonetic.trim()
        };
        setPhoneticDict(prev => [...prev, newEntry]);
        setNewOriginal('');
        setNewPhonetic('');
    }, [newOriginal, newPhonetic]);

    const removePhoneticEntry = useCallback((id: string) => {
        setPhoneticDict(prev => prev.filter(item => item.id !== id));
    }, []);

    const handleProcess = useCallback(() => {
        if (!inputText.trim()) return;
        setIsProcessing(true);
        
        setTimeout(() => {
            try {
                const result = TextFilterService.process(inputText, options, junkKeywords, phoneticDict);
                setOutputText(result);
            } catch (error) {
                console.error("Lỗi xử lý văn bản:", error);
                alert("Đã xảy ra lỗi khi xử lý văn bản.");
            } finally {
                setIsProcessing(false);
            }
        }, 100);
    }, [inputText, options, junkKeywords, phoneticDict]);

    const handleCopy = useCallback(() => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [outputText]);

    const handleClear = useCallback(() => {
        setInputText('');
        setOutputText('');
    }, []);

    const handleOptionChange = useCallback((key: keyof FilterOptions) => {
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Input & Options */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-[#121212] rounded-2xl shadow-sm border border-[#262626] overflow-hidden">
                        <div className="p-4 border-b border-[#262626] bg-[#1A1A1A] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                                    <FileText size={18} />
                                </div>
                                <h2 className="font-semibold text-gray-100">Văn bản Nguồn</h2>
                            </div>
                            <FileUpload onFileProcessed={handleFileProcessed} />
                        </div>
                        <div className="p-4">
                            <textarea
                                className="w-full h-80 p-4 bg-[#171717] border border-[#262626] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-gray-200 leading-relaxed"
                                placeholder="Dán văn bản của bạn tại đây hoặc tải lên tệp (.docx, .txt)..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <div className="mt-4 flex justify-between items-center">
                                <span className="text-xs text-gray-500 font-medium">
                                    {inputText.length.toLocaleString()} ký tự
                                </span>
                                <button
                                    onClick={handleClear}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Xóa Tất cả
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121212] rounded-2xl shadow-sm border border-[#262626] overflow-hidden">
                        <div className="p-4 border-b border-[#262626] bg-[#1A1A1A] flex items-center gap-2">
                            <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                                <Settings2 size={18} />
                            </div>
                            <h2 className="font-semibold text-gray-100">Cài đặt Lọc & Chuyển đổi</h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeJunkBlocks ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Sparkles size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Bộ lọc Rác Thông minh</div>
                                            <div className="text-xs text-gray-500">Tự động xóa quảng cáo và bình luận rác</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeJunkBlocks}
                                            onChange={() => handleOptionChange('removeJunkBlocks')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeChapterHeader ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Type size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Xóa Tiêu đề Chương</div>
                                            <div className="text-xs text-gray-500">Xóa "Chapter X", "Chương X"</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeChapterHeader}
                                            onChange={() => handleOptionChange('removeChapterHeader')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeEndNumbers ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Hash size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Xóa Số ở Cuối dòng</div>
                                            <div className="text-xs text-gray-500">Xóa các số thứ tự ở cuối mỗi dòng</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeEndNumbers}
                                            onChange={() => handleOptionChange('removeEndNumbers')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.convertLargeNumbers ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Languages size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Số thành Chữ</div>
                                            <div className="text-xs text-gray-500">Chuyển 1000 &rarr; một nghìn (Tốt hơn cho TTS)</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.convertLargeNumbers}
                                            onChange={() => handleOptionChange('convertLargeNumbers')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeNumbers ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Eraser size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Xóa Tất cả Số</div>
                                            <div className="text-xs text-gray-500">Loại bỏ hoàn toàn các ký tự số</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeNumbers}
                                            onChange={() => handleOptionChange('removeNumbers')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeWhitespace ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Type size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Chuẩn hóa Khoảng trắng</div>
                                            <div className="text-xs text-gray-500">Xóa các dòng trống và khoảng cách thừa</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeWhitespace}
                                            onChange={() => handleOptionChange('removeWhitespace')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-[#262626]">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeDuplicateBlocks ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Eraser size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Xóa Lặp Cụm Câu</div>
                                            <div className="text-xs text-gray-500">Tìm & xóa các cụm từ, đoạn dòng lặp liền kề/xuyên suốt</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeDuplicateBlocks}
                                            onChange={() => handleOptionChange('removeDuplicateBlocks')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#262626] hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                                        <div className={`p-2 rounded-lg transition-colors ${options.removeWebAddresses ? 'bg-blue-900/30 text-blue-400' : 'bg-[#262626] text-gray-500'}`}>
                                            <Sparkles size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-200">Xóa Địa chỉ Web (Link)</div>
                                            <div className="text-xs text-gray-500">Xóa các URL, youtube.com, http...</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={options.removeWebAddresses}
                                            onChange={() => handleOptionChange('removeWebAddresses')}
                                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-[#262626]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter size={16} className="text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-300">Từ khóa Rác (phân cách bằng dấu phẩy)</span>
                                </div>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-[#171717] border border-[#262626] rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-200"
                                    value={junkKeywords}
                                    onChange={(e) => setJunkKeywords(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Phonetic & Output */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-[#121212] rounded-2xl shadow-sm border border-[#262626] overflow-hidden">
                        <div className="p-4 border-b border-[#262626] bg-[#1A1A1A] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                                    <Languages size={18} />
                                </div>
                                <h2 className="font-semibold text-gray-100">Từ điển Phiên âm</h2>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs font-medium text-gray-500">Kích hoạt</span>
                                <input
                                    type="checkbox"
                                    checked={options.manualPhonetic}
                                    onChange={() => handleOptionChange('manualPhonetic')}
                                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                />
                            </label>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {phoneticDict.map((entry) => (
                                    <div key={entry.id} className="flex gap-2 items-center animate-in slide-in-from-right-2 duration-200">
                                        <input
                                            type="text"
                                            placeholder="Gốc"
                                            className="flex-1 p-2 text-sm bg-[#171717] border border-[#262626] rounded-lg outline-none focus:border-blue-400 text-gray-200"
                                            value={entry.original}
                                            onChange={(e) => {
                                                const newDict = phoneticDict.map(item => 
                                                    item.id === entry.id ? { ...item, original: e.target.value } : item
                                                );
                                                setPhoneticDict(newDict);
                                            }}
                                        />
                                        <div className="text-gray-600">→</div>
                                        <input
                                            type="text"
                                            placeholder="Phiên âm"
                                            className="flex-1 p-2 text-sm bg-[#171717] border border-[#262626] rounded-lg outline-none focus:border-blue-400 text-gray-200"
                                            value={entry.phonetic}
                                            onChange={(e) => {
                                                const newDict = phoneticDict.map(item => 
                                                    item.id === entry.id ? { ...item, phonetic: e.target.value } : item
                                                );
                                                setPhoneticDict(newDict);
                                            }}
                                        />
                                        <button
                                            onClick={() => removePhoneticEntry(entry.id)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {phoneticDict.length === 0 && (
                                    <div className="text-center py-8 text-gray-600 text-sm italic">
                                        Chưa có mục phiên âm nào
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Gốc (VD: Ronaldo)"
                                    className="flex-1 p-2 text-sm bg-[#171717] border border-[#262626] rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-200"
                                    value={newOriginal}
                                    onChange={(e) => setNewOriginal(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Phiên âm (VD: Rô-nan-đô)"
                                    className="flex-1 p-2 text-sm bg-[#171717] border border-[#262626] rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-200"
                                    value={newPhonetic}
                                    onChange={(e) => setNewPhonetic(e.target.value)}
                                />
                                <button
                                    onClick={addPhoneticEntry}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-900/20"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121212] rounded-2xl shadow-sm border border-[#262626] overflow-hidden">
                        <div className="p-4 border-b border-[#262626] bg-[#1A1A1A] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-900/30 rounded-lg text-emerald-400">
                                    <Check size={18} />
                                </div>
                                <h2 className="font-semibold text-gray-100">Kết quả đã Xử lý</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopy}
                                    disabled={!outputText}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        copied 
                                        ? 'bg-emerald-900/30 text-emerald-400' 
                                        : 'bg-[#1F1F1F] border border-[#262626] text-gray-300 hover:bg-[#2D2D2D] disabled:opacity-50'
                                    }`}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Đã sao chép' : 'Sao chép'}
                                </button>
                            </div>
                        </div>
                        <div className="p-4">
                            <textarea
                                readOnly
                                className="w-full h-80 p-4 bg-[#0D0D0D] border border-[#262626] rounded-xl outline-none text-gray-300 leading-relaxed resize-none"
                                value={outputText}
                                placeholder="Kết quả xử lý sẽ xuất hiện tại đây..."
                            />
                            <div className="mt-4">
                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing || !inputText.trim()}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-[#262626] disabled:text-gray-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group"
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Filter size={20} className="group-hover:rotate-12 transition-transform" />
                                    )}
                                    {isProcessing ? 'Đang xử lý...' : 'Chạy Trình lọc'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
