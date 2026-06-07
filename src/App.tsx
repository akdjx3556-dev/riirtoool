
import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { Settings } from '../components/Settings';
import { TextToSpeech } from '../components/TextToSpeech';
import { TextFilter } from '../components/TextFilter';
import { VideoMerger } from '../components/VideoMerger';

const TabButton: React.FC<{ 
    name: string; 
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode;
}> = ({ name, active, onClick, icon }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                active 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:bg-[#1A1A1A] hover:text-gray-200'
            }`}
        >
            <span className={active ? 'text-white' : 'text-gray-500'}>{icon}</span>
            <span>{name}</span>
        </button>
    );
};

import { ChunkJob } from './types';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'tts' | 'filter' | 'settings' | 'video'>('tts');
    const [sharedAudioUrl, setSharedAudioUrl] = useState<string | null>(null);
    const [sharedChunks, setSharedChunks] = useState<ChunkJob[]>([]);
    const [sharedBgType, setSharedBgType] = useState<'image' | 'video' | 'color'>('color');
    const [sharedBgSources, setSharedBgSources] = useState<any[]>([]);
    
    return (
        <div className="min-h-screen flex flex-col bg-[#0A0A0A]">
            <header className="bg-[#0D0D0D] border-b border-[#262626] sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8 w-8 text-blue-500" />
                        <h1 className="text-xl font-bold tracking-tight text-white">Vocalis</h1>
                        <span className="hidden sm:inline-block px-2 py-0.5 bg-[#1A1A1A] text-gray-400 text-[10px] font-bold rounded uppercase tracking-wider">Pro Suite</span>
                    </div>

                    <nav className="flex items-center gap-1">
                        <TabButton 
                            name="Tổng hợp" 
                            active={activeTab === 'tts'} 
                            onClick={() => setActiveTab('tts')} 
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>}
                        />
                        <TabButton 
                            name="Lọc" 
                            active={activeTab === 'filter'} 
                            onClick={() => setActiveTab('filter')} 
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>}
                        />
                        <TabButton 
                            name="Video" 
                            active={activeTab === 'video'} 
                            onClick={() => setActiveTab('video')} 
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2-2 0 00-2 2v12a2 2 0 002 2z"></path></svg>}
                        />

                        <div className="w-px h-6 bg-[#262626] mx-2"></div>
                        <TabButton 
                            name="Cài đặt" 
                            active={activeTab === 'settings'} 
                            onClick={() => setActiveTab('settings')} 
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>}
                        />
                    </nav>
                </div>
            </header>

            <main className="flex-grow container mx-auto p-6 md:p-10">
                 {activeTab === 'tts' && <TextToSpeech onAudioMerged={setSharedAudioUrl} onChunksUpdated={setSharedChunks} />}
                 {activeTab === 'filter' && <TextFilter />}
                 {activeTab === 'video' && (
                     <div className="h-full flex flex-col gap-6">
                         {sharedAudioUrl ? (
                             <VideoMerger 
                                audioUrl={sharedAudioUrl} 
                                chunks={sharedChunks} 
                                initialBgType={sharedBgType}
                                initialBgSources={sharedBgSources}
                                onBgChange={(type, sources) => {
                                    setSharedBgType(type);
                                    setSharedBgSources(sources);
                                }}
                                onAudioChange={(url, chunks) => {
                                    setSharedAudioUrl(url);
                                    setSharedChunks(chunks);
                                }}
                             />
                         ) : (
                             <div className="flex flex-col items-center justify-center p-20 bg-[#121212] border border-[#262626] rounded-3xl text-center space-y-6">
                                 <div className="p-6 bg-blue-900/10 rounded-full border border-blue-900/10">
                                     <svg className="w-16 h-16 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                 </div>
                                 <div className="space-y-2">
                                     <h2 className="text-xl font-bold text-white">Chưa có Audio</h2>
                                     <p className="text-gray-500 max-w-sm mx-auto text-sm">Vui lòng quay lại tab "Tổng hợp" để tạo file âm thanh hoặc tải lên một file âm thanh từ thiết bị của bạn trước khi sản xuất video.</p>
                                 </div>
                                 <div className="flex flex-col sm:flex-row gap-4">
                                     <button 
                                        onClick={() => setActiveTab('tts')}
                                        className="px-8 py-3 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-600/30 transition-all active:scale-95"
                                     >
                                         Tới Tab Tổng hợp
                                     </button>
                                     <label className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20 cursor-pointer text-center">
                                         Tải Audio lên
                                         <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                                             const file = e.target.files?.[0];
                                             if (file) {
                                                const url = URL.createObjectURL(file);
                                                setSharedAudioUrl(url);
                                                setSharedChunks([]);
                                             }
                                         }} />
                                     </label>
                                 </div>
                             </div>
                         )}
                     </div>
                 )}

                 {activeTab === 'settings' && <Settings />}
            </main>

            <footer className="py-8 bg-[#0D0D0D] border-t border-[#262626]">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                        VOCALIS AUDIO ENGINE • v1.4.0
                    </p>
                    <div className="flex gap-6">
                        <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Tài liệu</a>
                        <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Hỗ trợ</a>
                        <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Bảo mật</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default App;
