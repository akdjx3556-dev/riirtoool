
import React, { useState, useEffect } from 'react';
import { keyManager } from '../services/keyManager';
import { Settings2, Key, Cpu, Save, RefreshCw, AlertCircle, Info } from 'lucide-react';

const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Nhanh & Tiết kiệm)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ổn định, Đa năng)' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Mới nhất)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
];

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState(keyManager.getSettings());
    const [saved, setSaved] = useState(false);
    const [showRaw, setShowRaw] = useState(false);

    const handleSave = () => {
        keyManager.saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleRegenerate = () => {
        keyManager.regenerateKey();
        setSettings({ ...settings, rawKeys: keyManager.getKeysRaw() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-[#121212] p-8 rounded-3xl border border-[#262626] flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 bg-blue-900/30 rounded-2xl border border-blue-900/20 text-blue-400">
                    <Settings2 size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Cấu hình Hệ thống</h2>
                    <p className="text-sm font-medium text-gray-400 mt-1">Quản lý API & Cài đặt AI Services</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: AI Settings */}
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="bg-[#1A1A1A] p-6 rounded-3xl border border-[#262626] space-y-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <Cpu size={14} className="text-blue-400" />
                            <span>Cấu hình Gemini AI</span>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Model Gemini</label>
                                <select 
                                    value={settings.geminiModel}
                                    onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 text-sm text-gray-200 outline-none focus:border-blue-500 transition-all"
                                >
                                    {GEMINI_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Gemini API Key (Riêng)</label>
                                <div className="relative">
                                    <input 
                                        type="password"
                                        value={settings.geminiKey}
                                        onChange={(e) => setSettings({ ...settings, geminiKey: e.target.value })}
                                        placeholder="Nhập Key để thay thế Key hệ thống..."
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 pl-10 text-sm text-gray-200 outline-none focus:border-blue-500 transition-all font-mono"
                                    />
                                    <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#262626]">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                                <RefreshCw size={14} className="text-purple-400" />
                                <span>Cấu hình Deepseek AI</span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Deepseek API Key</label>
                                <div className="relative">
                                    <input 
                                        type="password"
                                        value={settings.deepseekKey}
                                        onChange={(e) => setSettings({ ...settings, deepseekKey: e.target.value })}
                                        placeholder="Sử dụng cho Engine dịch Deepseek..."
                                        className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 pl-10 text-sm text-gray-200 outline-none focus:border-blue-500 transition-all font-mono"
                                    />
                                    <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-900/20 p-4 rounded-2xl flex gap-3">
                        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-400/80 leading-relaxed">
                            Cài đặt này sẽ được lưu cục bộ trên trình duyệt của bạn. Các API Key riêng sẽ được ưu tiên hơn so với Key mặc định của hệ thống.
                        </p>
                    </div>
                </div>

                {/* Right Column: Key Management & Raw */}
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <div className="bg-[#1A1A1A] p-6 rounded-3xl border border-[#262626] space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                <Settings2 size={14} className="text-emerald-400" />
                                <span>Vocalis Engine Auth</span>
                            </div>
                            <button 
                                onClick={handleRegenerate}
                                className="group p-2 hover:bg-[#262626] rounded-lg transition-all text-gray-500 hover:text-white flex items-center gap-2"
                                title="Làm mới mã định danh"
                            >
                                <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">REGEN</span>
                                <RefreshCw size={14} className="group-active:rotate-180 transition-transform duration-500" />
                            </button>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-[#0D0D0D] to-[#141414] border border-[#262626] rounded-2xl text-center space-y-2">
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Mã định danh thiết bị</p>
                            <p className="text-2xl font-mono text-blue-400 font-black tracking-[0.2em]">
                                {settings.rawKeys.split('\n')[0]?.substring(0, 4)}
                                <span className="text-gray-800">****</span>
                                {settings.rawKeys.split('\n')[0]?.substring(8)}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <button 
                                onClick={() => setShowRaw(!showRaw)}
                                className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[#262626] text-gray-500 hover:bg-[#222222] transition-all"
                            >
                                {showRaw ? 'Ẩn Cấu hình Nâng cao' : 'Hiện Cấu hình Nâng cao (Raw)'}
                            </button>

                            {showRaw && (
                                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                                    <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl overflow-hidden">
                                        <textarea 
                                            value={settings.rawKeys}
                                            onChange={(e) => setSettings({ ...settings, rawKeys: e.target.value })}
                                            className="w-full h-32 bg-transparent p-4 text-xs font-mono text-blue-400/80 outline-none resize-none"
                                            placeholder="Line 1: Auth Token...&#10;Line 2: Fallback..."
                                        />
                                    </div>
                                    <div className="flex gap-2 p-3 bg-red-900/10 border border-red-900/20 rounded-xl">
                                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                                        <p className="text-[10px] text-red-400/70">Thay đổi thủ công các giá trị ở đây có thể làm Engine ngừng hoạt động.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        className={`w-full py-5 rounded-3xl text-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                            saved 
                            ? 'bg-emerald-600 text-white translate-y-0.5' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-[0.98]'
                        }`}
                    >
                        {saved ? (
                            <>
                                <Save size={18} />
                                Đã Lưu Thành Công
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Lưu Toàn bộ Cấu hình
                            </>
                        )}
                    </button>

                    <div className="flex justify-center items-center gap-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest pt-4">
                         <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-500"></span> Vocalis v1.5.0</span>
                         <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-500"></span> AI Integrated</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
