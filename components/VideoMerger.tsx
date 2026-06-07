
import React, { useState, useRef, useEffect } from 'react';
import { Video, Image as ImageIcon, Download, Loader2, X, Play, Pause, Film, Settings, Maximize2, Type, Camera, ChevronUp, ChevronDown, Trash2, AlertCircle, CheckCircle2, Wand2, Music, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SrtError {
    index: number;
    type: 'order' | 'overlap' | 'duration' | 'text_contains_timeline' | 'duplicate' | 'garbage';
    message: string;
}

interface BlurConfig {
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    amount: number;
}

interface SubtitleConfig {
    fontSize: number;
    bottomMargin: number;
    color: string;
    shadow: boolean;
    enabled: boolean;
    fontFamily?: string;
    uppercase?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
    fontWeight?: string;
}

interface LogoConfig {
    enabled: boolean;
    scale: number;
    x: number;
    y: number;
    opacity: number;
}

interface WatermarkConfig {
    enabled: boolean;
    text: string;
    fontSize: number;
    x: number;
    y: number;
    color: string;
    opacity: number;
    floating: boolean;
}

import { ChunkJob } from '../src/types';

interface SourceItem {
    id: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    name: string;
    duration?: number;
}

interface VideoMergerProps {
    audioUrl: string;
    chunks?: ChunkJob[];
    onClose?: () => void;
    initialBgType?: 'image' | 'video' | 'color';
    initialBgSources?: SourceItem[];
    onBgChange?: (type: 'image' | 'video' | 'color', sources: SourceItem[]) => void;
    onAudioChange?: (url: string, chunks: ChunkJob[]) => void;
}

const STORAGE_KEY_BLUR = 'vocalis_blur_config';
const STORAGE_KEY_SUBTITLE = 'vocalis_subtitle_config';
const STORAGE_KEY_LOGO = 'vocalis_logo_config';
const STORAGE_KEY_WATERMARK = 'vocalis_watermark_config';

export const VideoMerger: React.FC<VideoMergerProps> = ({ 
    audioUrl, chunks, onClose, 
    initialBgType = 'color', 
    initialBgSources = [],
    onBgChange,
    onAudioChange
}) => {
    const [bgType, setBgType] = useState<'image' | 'video' | 'color'>(initialBgType);
    const [bgSources, setBgSources] = useState<SourceItem[]>(initialBgSources);
    const [audioSources, setAudioSources] = useState<SourceItem[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'blur_subs' | 'branding'>('blur_subs');
    const [customChunks, setCustomChunks] = useState<ChunkJob[] | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [srtErrors, setSrtErrors] = useState<SrtError[]>([]);
    const [lastUploadedSrt, setLastUploadedSrt] = useState<string | null>(null);
    const [renderResolution, setRenderResolution] = useState<'720p' | '540p' | '480p'>('720p');

    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewTime, setPreviewTime] = useState(0);
    const [previewDuration, setPreviewDuration] = useState(0);

    const formatTime = (secs: number) => {
        if (isNaN(secs) || !isFinite(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const validateSrt = (chunks: ChunkJob[]) => {
        const errors: SrtError[] = [];
        const timecodeRegex = /\d{2}:\d{2}:\d{2}[.,]\d{3}/;
        const garbageRegex = /[@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]{4,}/; // 4+ special chars in a row

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startTime = chunk.startTime || 0;
            const endTime = chunk.endTime || 0;
            const cleanText = chunk.text.trim().toLowerCase();

            // 1. Durations or overlaps
            if (endTime < startTime) {
                errors.push({
                    index: i,
                    type: 'duration',
                    message: `Dòng #${i + 1}: Thời gian kết thúc trước thời gian bắt đầu.`
                });
            }

            if (i > 0) {
                const prevChunk = chunks[i-1];
                const prevCleanText = prevChunk.text.trim().toLowerCase();

                if (startTime < (prevChunk.endTime || 0)) {
                    errors.push({
                        index: i,
                        type: 'overlap',
                        message: `Dòng #${i + 1}: Thời gian bắt đầu chồng chéo với dòng trước.`
                    });
                }

                // Duplicate check
                if (cleanText.length > 0 && cleanText === prevCleanText) {
                    errors.push({
                        index: i,
                        type: 'duplicate',
                        message: `Dòng #${i + 1}: Nội dung lặp lại hoàn toàn dòng trước.`
                    });
                }
            }

            // 2. Timeline inside text
            if (timecodeRegex.test(chunk.text)) {
                errors.push({
                    index: i,
                    type: 'text_contains_timeline',
                    message: `Dòng #${i + 1}: Nội dung chứa ký tự giống timeline.`
                });
            }

            // 3. Garbage or empty check
            const isJustNumbers = /^\d+$/.test(chunk.text.trim());
            if (garbageRegex.test(chunk.text) || isJustNumbers) {
                errors.push({
                    index: i,
                    type: 'garbage',
                    message: isJustNumbers 
                        ? `Dòng #${i + 1}: Nội dung chỉ chứa số (có thể là index bị sót).` 
                        : `Dòng #${i + 1}: Chứa ký tự rác hoặc chuỗi đặc biệt.`
                });
            }

            if (!chunk.text.trim()) {
                errors.push({
                    index: i,
                    type: 'garbage',
                    message: `Dòng #${i + 1}: Nội dung trống.`
                });
            }
        }
        return errors;
    };

    const repairSrt = () => {
        if (!customChunks) return;
        
        let repaired: ChunkJob[] = [];
        const timecodeRegex = /\d{2}:\d{2}:\d{2}[.,]\d{3}/g;
        const fullTimelineRegex = /\d+\s+\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g;
        const indexLineRegex = /^\d+$/;
        const garbageRegex = /[@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]{3,}/g;

        const source = [...customChunks].map(c => ({...c}));

        for (let i = 0; i < source.length; i++) {
            let chunk = source[i];
            
            // 1. Clean full timeline blocks inside text
            chunk.text = chunk.text.replace(fullTimelineRegex, '').trim();
            
            // 2. Clean standalone timecodes
            chunk.text = chunk.text.replace(timecodeRegex, '').trim();
            
            // 3. Process every line to remove indices and repeat words
            const cleanedLines = chunk.text.split('\n').map(line => {
                let l = line.trim();
                // Remove leading indices (e.g. "123 text" -> "text")
                l = l.replace(/^\d+[\s.-]*/, '');
                // Skip if the line is now just a number or empty
                if (indexLineRegex.test(l)) return '';
                
                // Remove repeated words in the same line (e.g. "hello hello" -> "hello")
                const words = l.split(/\s+/);
                const uniqueWords: string[] = [];
                for (let w = 0; w < words.length; w++) {
                    if (w === 0 || words[w].toLowerCase() !== words[w-1].toLowerCase()) {
                        uniqueWords.push(words[w]);
                    }
                }
                return uniqueWords.join(' ');
            }).filter(line => line.length > 0);

            chunk.text = cleanedLines.join('\n').trim();
            
            // 4. Clean garbage characters and excessive symbols
            chunk.text = chunk.text.replace(garbageRegex, '').trim();
            chunk.text = chunk.text.replace(/^[.\-\s]+/, '').trim();

            if (!chunk.text || chunk.text.length < 1) continue;

            // 5. Deduplicate and merge identical consecutive chunks
            if (repaired.length > 0) {
                const prev = repaired[repaired.length - 1];
                if (chunk.text.toLowerCase().replace(/\s+/g, '') === prev.text.toLowerCase().replace(/\s+/g, '')) {
                    prev.endTime = Math.max(prev.endTime || 0, chunk.endTime || 0);
                    continue;
                }
            }

            // 6. Fix timing
            if ((chunk.endTime || 0) <= (chunk.startTime || 0)) {
                chunk.endTime = (chunk.startTime || 0) + 2;
            }

            if (repaired.length > 0) {
                const prev = repaired[repaired.length - 1];
                if ((chunk.startTime || 0) < (prev.endTime || 0)) {
                    chunk.startTime = (prev.endTime || 0) + 0.05;
                    if ((chunk.endTime || 0) <= (chunk.startTime || 0)) {
                        chunk.endTime = (chunk.startTime || 0) + 1.5;
                    }
                }
            }

            repaired.push(chunk);
        }

        setCustomChunks(repaired);
        setSrtErrors([]);
    };
    // Handle audio graph reset when background changes
    useEffect(() => {
        // Reset audio context cache if bgType changes to/from video
        // This ensures the next render/preview setup will recreate the nodes with correct connections
        audioNodesRef.current = null;
    }, [bgType]);

    const [bgAudioVolume, setBgAudioVolume] = useState(() => {
        const saved = localStorage.getItem('vocalis_bg_audio_volume');
        return saved ? parseFloat(saved) : 0.5; // Increased default to 50%
    });

    useEffect(() => {
        localStorage.setItem('vocalis_bg_audio_volume', bgAudioVolume.toString());
        if (audioNodesRef.current?.videoGain) {
            audioNodesRef.current.videoGain.gain.value = bgAudioVolume;
        }
    }, [bgAudioVolume]);

    const [audioVolume, setAudioVolume] = useState(() => {
        const saved = localStorage.getItem('vocalis_voice_audio_volume');
        return saved ? parseFloat(saved) : 1.0;
    });

    const [bgmUrl, setBgmUrl] = useState<string | null>(() => {
        return localStorage.getItem('vocalis_bgm_url') || null;
    });

    const [bgmFileName, setBgmFileName] = useState<string | null>(() => {
        return localStorage.getItem('vocalis_bgm_file_name') || null;
    });

    const [bgmVolume, setBgmVolume] = useState(() => {
        const saved = localStorage.getItem('vocalis_bgm_volume');
        return saved ? parseFloat(saved) : 0.3;
    });

    const [cssOverlayEnabled, setCssOverlayEnabled] = useState(() => {
        const saved = localStorage.getItem('vocalis_css_overlay_enabled');
        return saved !== 'false';
    });

    const bgmRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        localStorage.setItem('vocalis_voice_audio_volume', audioVolume.toString());
        if (audioNodesRef.current?.mainGain) {
            audioNodesRef.current.mainGain.gain.value = audioVolume;
        }
        if (audioRef.current) {
            audioRef.current.volume = audioVolume;
        }
    }, [audioVolume]);

    useEffect(() => {
        if (bgmUrl) {
            localStorage.setItem('vocalis_bgm_url', bgmUrl);
        } else {
            localStorage.removeItem('vocalis_bgm_url');
        }
    }, [bgmUrl]);

    useEffect(() => {
        if (bgmFileName) {
            localStorage.setItem('vocalis_bgm_file_name', bgmFileName);
        } else {
            localStorage.removeItem('vocalis_bgm_file_name');
        }
    }, [bgmFileName]);

    useEffect(() => {
        localStorage.setItem('vocalis_bgm_volume', bgmVolume.toString());
        if (audioNodesRef.current?.bgmGain) {
            audioNodesRef.current.bgmGain.gain.value = bgmVolume;
        }
        if (bgmRef.current) {
            bgmRef.current.volume = bgmVolume;
        }
    }, [bgmVolume]);

    useEffect(() => {
        localStorage.setItem('vocalis_css_overlay_enabled', cssOverlayEnabled.toString());
    }, [cssOverlayEnabled]);

    const parseSrtToChunks = (srtText: string): ChunkJob[] => {
        const srtChunks: ChunkJob[] = [];
        const lines = srtText.replace(/\r\n/g, '\n').split('\n');
        
        let currentChunk: any = null;
        let pendingId = '';
        
        const parseTime = (timeStr: string) => {
            const parts = timeStr.replace(',', '.').trim().split(':');
            if (parts.length === 3) {
                const hours = parseFloat(parts[0]);
                const minutes = parseFloat(parts[1]);
                const seconds = parseFloat(parts[2]);
                return hours * 3600 + minutes * 60 + seconds;
            }
            return 0;
        };

        // Improved regex to handle optional leading index on same line
        const timecodeRegex = /(?:(\d+)\s+)?(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const timeMatch = line.match(timecodeRegex);
            if (timeMatch) {
                // If a timeline is found, the previous chunk is complete
                if (currentChunk) {
                    const textLines = currentChunk.text.split('\n');
                    // Check if the last text line was just an ID (number)
                    if (textLines.length > 0 && /^\d+$/.test(textLines[textLines.length - 1].trim())) {
                        pendingId = textLines.pop()!.trim();
                        currentChunk.text = textLines.join('\n').trim();
                    }
                    srtChunks.push(currentChunk);
                }
                
                // timeMatch[1] is the optional index, timeMatch[2] is start, timeMatch[3] is end
                const capturedId = timeMatch[1] || '';
                
                if (!capturedId && !pendingId && i > 0) {
                    const prevLine = lines[i-1].trim();
                    if (/^\d+$/.test(prevLine)) {
                        pendingId = prevLine;
                    }
                }

                currentChunk = {
                    id: capturedId || pendingId || Math.random().toString(36).substring(2, 9),
                    text: '',
                    status: 'finished',
                    startTime: parseTime(timeMatch[2]),
                    endTime: parseTime(timeMatch[3])
                };
                pendingId = '';
            } else if (currentChunk) {
                // Not a timecode line, so it's text (or index of next chunk)
                currentChunk.text += (currentChunk.text ? '\n' : '') + line;
            }
        }
        
        if (currentChunk) {
            const textLines = currentChunk.text.split('\n');
            // Remove trailing index if present
            if (textLines.length > 0 && /^\d+$/.test(textLines[textLines.length - 1].trim())) {
                textLines.pop();
            }
            // Also clean leading indices from each line
            currentChunk.text = textLines.map(line => line.replace(/^\d+[\s.-]+/, '').trim())
                                        .filter(l => l.length > 0)
                                        .join('\n').trim();
            srtChunks.push(currentChunk);
        }

        return srtChunks;
    };
    
    // Blur Settings
    const [blurConfig, setBlurConfig] = useState<BlurConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_BLUR);
        return saved ? JSON.parse(saved) : { enabled: false, x: 10, y: 10, width: 20, height: 10, amount: 15 };
    });

    // Subtitle Settings
    const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_SUBTITLE);
        const defaults = { 
            fontSize: 46, 
            bottomMargin: 100, 
            color: '#facc15', 
            shadow: true, 
            enabled: true,
            fontFamily: 'Montserrat',
            uppercase: true,
            strokeColor: '#000000',
            strokeWidth: 6,
            fontWeight: '900'
        };
        if (saved) {
            try {
                return { ...defaults, ...JSON.parse(saved) };
            } catch (e) {
                return defaults;
            }
        }
        return defaults;
    });

    // Logo Settings
    const [logoSource, setLogoSource] = useState<string | null>(() => localStorage.getItem('vocalis_logo_source'));
    const [logoConfig, setLogoConfig] = useState<LogoConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_LOGO);
        return saved ? JSON.parse(saved) : { enabled: false, scale: 20, x: 5, y: 5, opacity: 1 };
    });

    // Watermark Settings
    const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_WATERMARK);
        return saved ? JSON.parse(saved) : { enabled: false, text: '', fontSize: 24, x: 95, y: 95, color: '#ffffff', opacity: 0.5, floating: false };
    });

    const displayChunks = customChunks || chunks || [];

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const requestRef = useRef<number>();
    const isLoopingRef = useRef(false);

    const audioNodesRef = useRef<{ ctx: AudioContext, source: MediaElementAudioSourceNode, dest: MediaStreamAudioDestinationNode, videoGain?: GainNode, bgmGain?: GainNode, mainGain?: GainNode } | null>(null);
    const logoImageRef = useRef<HTMLImageElement | null>(null);
    const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Refs to track state specifically for unmount cleanup (preventing memory leaks of blob URLs)
    const bgSourcesRef = useRef(bgSources);
    const logoSourceRef = useRef(logoSource);

    useEffect(() => {
        bgSourcesRef.current = bgSources;
    }, [bgSources]);

    useEffect(() => {
        logoSourceRef.current = logoSource;
    }, [logoSource]);

    useEffect(() => {
        return () => {
            // Unmount memory leak cleanup: revoke active ObjectURLs
            bgSourcesRef.current.forEach(s => {
                if (s.url && s.url.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(s.url);
                    } catch (e) {
                        console.warn("Could not revoke bgSource object URL on unmount:", e);
                    }
                }
            });
            if (logoSourceRef.current && logoSourceRef.current.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(logoSourceRef.current);
                } catch (e) {
                    console.warn("Could not revoke logoSource object URL on unmount:", e);
                }
            }
            if (audioNodesRef.current) {
                try {
                    audioNodesRef.current.ctx.close();
                } catch (e) {
                    console.warn("Could not close audio context on unmount:", e);
                }
            }
        };
    }, []);

    const canvasWidth = renderResolution === '720p' ? 1280 : (renderResolution === '540p' ? 960 : 854);
    const canvasHeight = renderResolution === '720p' ? 720 : (renderResolution === '540p' ? 540 : 480);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_BLUR, JSON.stringify(blurConfig));
    }, [blurConfig]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SUBTITLE, JSON.stringify(subtitleConfig));
    }, [subtitleConfig]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_LOGO, JSON.stringify(logoConfig));
    }, [logoConfig]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_WATERMARK, JSON.stringify(watermarkConfig));
    }, [watermarkConfig]);

    useEffect(() => {
        if (logoSource) {
            localStorage.setItem('vocalis_logo_source', logoSource);
            const img = new Image();
            img.onload = () => {
                logoImageRef.current = img;
            };
            img.src = logoSource;
        } else {
            localStorage.removeItem('vocalis_logo_source');
            logoImageRef.current = null;
        }
    }, [logoSource]);

    useEffect(() => {
        onBgChange?.(bgType, bgSources);
    }, [bgType, bgSources]);

    const activeAudioUrl = audioSources.length > 0 && audioSources[currentAudioIndex] 
        ? audioSources[currentAudioIndex].url 
        : audioUrl;

    const activeSource = bgSources[currentSourceIndex];

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.src = activeAudioUrl;
            audioRef.current.load();
        }
    }, [activeAudioUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => {
            setIsPreviewPlaying(true);
            if (videoRef.current && bgType === 'video' && videoRef.current.paused && !isRendering) {
                videoRef.current.play().catch(console.error);
            }
            if (bgmRef.current && bgmUrl && bgmRef.current.paused && !isRendering) {
                bgmRef.current.play().catch(console.error);
            }
        };
        const handlePause = () => {
            setIsPreviewPlaying(false);
            if (videoRef.current && bgType === 'video' && !videoRef.current.paused) {
                videoRef.current.pause();
            }
            if (bgmRef.current && !bgmRef.current.paused) {
                bgmRef.current.pause();
            }
        };
        const handleTimeUpdate = () => setPreviewTime(audio.currentTime);
        const handleDurationChange = () => setPreviewDuration(audio.duration || 0);
        const handleEnded = () => {
            setIsPreviewPlaying(false);
            setPreviewTime(0);
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
            if (bgmRef.current) {
                bgmRef.current.pause();
                bgmRef.current.currentTime = 0;
            }
        };

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [bgType, isRendering, bgmUrl]);

    const handleSeek = (newTime: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = newTime;
            setPreviewTime(newTime);
            if (videoRef.current && bgType === 'video') {
                const vid = videoRef.current;
                if (vid.duration) {
                    vid.currentTime = newTime % vid.duration;
                } else {
                    vid.currentTime = newTime;
                }
            }
            if (bgmRef.current && bgmUrl) {
                const bgm = bgmRef.current;
                if (bgm.duration) {
                    bgm.currentTime = newTime % bgm.duration;
                } else {
                    bgm.currentTime = newTime;
                }
            }
        }
    };

    useEffect(() => {
        if (bgType === 'image' && activeSource?.url) {
            const img = new Image();
            img.onload = () => {
                bgImageRef.current = img;
                setImageLoaded(true);
            };
            img.onerror = () => {
                console.error("Image failed to load:", activeSource.url);
                setImageLoaded(false);
            };
            img.src = activeSource.url;
        } else {
            setImageLoaded(false);
        }
    }, [activeSource?.url, bgType]);

    useEffect(() => {
        if (bgType === 'video' && activeSource?.url && videoRef.current) {
            videoRef.current.src = activeSource.url;
            videoRef.current.load();
            
            videoRef.current.onloadedmetadata = () => {
                if (videoRef.current && (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0)) {
                    alert("Video có thể sử dụng định dạng mà trình duyệt không hỗ trợ (ví dụ: HEVC/H.265). Khung hình có thể sẽ bị đen hoặc không hiển thị. Vui lòng thử dùng file MP4 chuẩn (H.264).");
                }
            };

            videoRef.current.currentTime = 0; 
        }
    }, [activeSource?.url, bgType]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newSources: SourceItem[] = [];
        const isVideo = e.target.accept?.includes('video');
        const isImage = e.target.accept?.includes('image');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const url = URL.createObjectURL(file);
            let type: 'image' | 'video' | 'audio' = isVideo ? 'video' : 'image';
            
            if (!isVideo && !isImage) {
                const name = file.name.toLowerCase();
                const mime = file.type || '';
                if (mime.startsWith('video/') || name.match(/\.(mp4|webm|ogg|mov)$/)) {
                    type = 'video';
                } else if (mime.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
                    type = 'audio';
                } else {
                    type = 'image';
                }
            }

            let duration = 0;
            if (type === 'video' || type === 'audio') {
                try {
                    duration = await new Promise((resolve) => {
                        const temp = document.createElement(type);
                        temp.src = url;
                        temp.onloadedmetadata = () => resolve(temp.duration);
                        temp.onerror = () => resolve(0);
                    });
                } catch(e) { console.warn("Could not get duration", e); }
            }

            newSources.push({
                id: Math.random().toString(36).substring(2, 9),
                type,
                url,
                name: file.name,
                duration
            });
        }

        if (newSources.length > 0) {
            setBgType(newSources[0].type === 'audio' ? 'video' : newSources[0].type as any);
            setBgSources(prev => [...prev, ...newSources.filter(s => s.type !== 'audio')]);
        }
    };

    const removeSource = (id: string) => {
        setBgSources(prev => {
            const filtered = prev.filter(s => s.id !== id);
            // Cleanup URLs
            const removed = prev.find(s => s.id === id);
            if (removed?.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
            return filtered;
        });
        if (currentSourceIndex >= bgSources.length - 1 && currentSourceIndex > 0) {
            setCurrentSourceIndex(prev => prev - 1);
        }
    };

    const moveSource = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === bgSources.length - 1) return;

        const newSources = [...bgSources];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSources[index], newSources[targetIndex]] = [newSources[targetIndex], newSources[index]];
        setBgSources(newSources);
    };

    const layoutRef = useRef<{ 
        drawWidth: number, 
        drawHeight: number, 
        offsetX: number, 
        offsetY: number,
        bgWidth: number,
        bgHeight: number
    } | null>(null);

    const updateLayout = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let bgWidth = 0;
        let bgHeight = 0;

        if (bgType === 'image' && bgImageRef.current) {
            bgWidth = bgImageRef.current.naturalWidth;
            bgHeight = bgImageRef.current.naturalHeight;
        } else if (bgType === 'video' && videoRef.current) {
            bgWidth = videoRef.current.videoWidth;
            bgHeight = videoRef.current.videoHeight;
        }

        if (!bgWidth || !bgHeight) {
            layoutRef.current = null;
            return;
        }

        const canvasRatio = canvas.width / canvas.height;
        const bgRatio = bgWidth / bgHeight;
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (bgType === 'image') {
            // object-cover behavior
            if (bgRatio > canvasRatio) {
                drawHeight = canvas.height;
                drawWidth = canvas.height * bgRatio;
                offsetX = (canvas.width - drawWidth) / 2;
            } else {
                drawWidth = canvas.width;
                drawHeight = canvas.width / bgRatio;
                offsetY = (canvas.height - drawHeight) / 2;
            }
        } else {
            // object-contain behavior
            if (bgRatio > canvasRatio) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / bgRatio;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * bgRatio;
                offsetX = (canvas.width - drawWidth) / 2;
            }
        }

        layoutRef.current = { drawWidth, drawHeight, offsetX, offsetY, bgWidth, bgHeight };
    };

    useEffect(() => {
        if (bgType === 'image' && imageLoaded) {
            updateLayout();
        }
    }, [imageLoaded, bgType]);

    useEffect(() => {
        if (bgType === 'video' && activeSource?.url) {
            const vid = videoRef.current;
            if (vid) {
                const checkMetadata = () => {
                    if (vid.videoWidth > 0) {
                        updateLayout();
                        vid.removeEventListener('loadedmetadata', checkMetadata);
                    }
                };
                vid.addEventListener('loadedmetadata', checkMetadata);
            }
        }
    }, [activeSource?.url, bgType]);

    const lastChunkIndexRef = useRef(0);

    const render = () => {
        if (!isLoopingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false }); // Optimization: no alpha
        if (!canvas || !ctx) return;

        const scaleFactor = canvas.width / 1280;

        // Draw Background
        const source = bgType === 'image' ? bgImageRef.current : videoRef.current;
        let layout = layoutRef.current;
        
        // Try to update layout if it's missing but we have source metadata
        if (!layout && source) {
            const sw = bgType === 'image' ? (source as HTMLImageElement).naturalWidth : (source as HTMLVideoElement).videoWidth;
            const sh = bgType === 'image' ? (source as HTMLImageElement).naturalHeight : (source as HTMLVideoElement).videoHeight;
            if (sw > 0 && sh > 0) {
                updateLayout();
                layout = layoutRef.current;
            }
        }

        if (layout && source) {
            ctx.drawImage(source as CanvasImageSource, layout.offsetX, layout.offsetY, layout.drawWidth, layout.drawHeight);
        } else if (bgType === 'color') {
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            // During transitions, don't clear! Let the previous frame stay to avoid flickering to black
            //ctx.fillStyle = '#0a0a0a';
            //ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Blur feature disabled as requested
        if (false && blurConfig.enabled && blurConfig.amount > 0 && layout) {
            const bx = (blurConfig.x / 100) * canvas.width;
            const by = (blurConfig.y / 100) * canvas.height;
            const bw = (blurConfig.width / 100) * canvas.width;
            const bh = (blurConfig.height / 100) * canvas.height;

            if (bw > 0 && bh > 0) {
                const downsampleFactor = 4;
                if (!blurCanvasRef.current) {
                    blurCanvasRef.current = document.createElement('canvas');
                }
                const blurCanvas = blurCanvasRef.current;
                const blurCtx = blurCanvas.getContext('2d');
                if (blurCtx) {
                    const targetW = Math.max(1, Math.round(bw / downsampleFactor));
                    const targetH = Math.max(1, Math.round(bh / downsampleFactor));
                    if (blurCanvas.width !== targetW || blurCanvas.height !== targetH) {
                        blurCanvas.width = targetW;
                        blurCanvas.height = targetH;
                    }

                    // Apply scaled-down filter to match the downscaled coordinate space
                    blurCtx.filter = `blur(${Math.max(1, blurConfig.amount / downsampleFactor)}px)`;
                    
                    // Draw cropped portion from the main canvas onto downsized offscreen canvas
                    blurCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, targetW, targetH);
                    
                    // Draw back onto the main canvas, automatically scaled back up with linear interpolation
                    ctx.save();
                    ctx.drawImage(blurCanvas, bx, by, bw, bh);
                    ctx.restore();
                }
            }
        }

        // Draw Logo
        if (logoConfig.enabled && logoImageRef.current) {
            const img = logoImageRef.current;
            const targetWidth = (logoConfig.scale / 100) * canvas.width;
            const targetHeight = (img.naturalHeight / img.naturalWidth) * targetWidth;
            
            const lx = (logoConfig.x / 100) * canvas.width;
            const ly = (logoConfig.y / 100) * canvas.height;
            
            ctx.save();
            ctx.globalAlpha = logoConfig.opacity;
            ctx.drawImage(img, lx, ly, targetWidth, targetHeight);
            ctx.restore();
        }

        const audio = audioRef.current;

        // Audio source switching logic
        if (audioSources.length > 0 && audio && !audio.paused && audio.ended) {
            if (currentAudioIndex < audioSources.length - 1) {
                const nextAudioIndex = currentAudioIndex + 1;
                setCurrentAudioIndex(nextAudioIndex);
                if (isRendering) {
                    audio.src = audioSources[nextAudioIndex].url;
                    audio.load();
                    audio.play().catch(console.error);
                }
            }
        }

        // Draw Watermark Text
        if (watermarkConfig.enabled && watermarkConfig.text) {
            let wx = (watermarkConfig.x / 100) * canvas.width;
            let wy = (watermarkConfig.y / 100) * canvas.height;
            
            if (watermarkConfig.floating) {
                const time = audio ? audio.currentTime : (performance.now() / 1000);
                // Create a bouncing movement pattern
                const periodX = 7; // seconds for a full horizontal cycle
                const periodY = 11; // seconds for a full vertical cycle
                
                // Using sine for smooth bounce
                const moveX = (Math.sin(time * (Math.PI * 2 / periodX)) + 1) / 2; // 0 to 1
                const moveY = (Math.sin(time * (Math.PI * 2 / periodY)) + 1) / 2; // 0 to 1
                
                // Margin to keep it inside screen (roughly)
                const margin = 10; 
                wx = (margin + moveX * (100 - margin * 2)) / 100 * canvas.width;
                wy = (margin + moveY * (100 - margin * 2)) / 100 * canvas.height;
            }

            ctx.save();
            ctx.globalAlpha = watermarkConfig.opacity;
            ctx.fillStyle = watermarkConfig.color;
            ctx.font = `${watermarkConfig.fontSize * scaleFactor}px Inter`;
            
            // If floating, align center to avoid going off screen edges partially
            if (watermarkConfig.floating) {
                ctx.textAlign = 'center';
            } else {
                ctx.textAlign = watermarkConfig.x > 50 ? 'right' : (watermarkConfig.x < 30 ? 'left' : 'center');
            }
            
            ctx.textBaseline = 'middle';
            ctx.fillText(watermarkConfig.text, wx, wy);
            ctx.restore();
        }

        // Draw Subtitles
        if (subtitleConfig.enabled && audio && (isRendering || !cssOverlayEnabled)) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            const fontFamily = subtitleConfig.fontFamily || 'Inter';
            const fontWeight = subtitleConfig.fontWeight || 'bold';
            ctx.font = `${fontWeight} ${subtitleConfig.fontSize * scaleFactor}px "${fontFamily}"`;
            
            if (subtitleConfig.shadow) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 10 * scaleFactor;
                ctx.shadowOffsetX = 2 * scaleFactor;
                ctx.shadowOffsetY = 2 * scaleFactor;
            }
            
            ctx.fillStyle = subtitleConfig.color;
            
            const currentTime = audio.currentTime;
            
            // Optimized subtitle lookup: Since time usually moves forward, start from last index
            let activeChunk = null;
            
            // Check if last chunk is still active
            const lastChunk = displayChunks[lastChunkIndexRef.current];
            if (lastChunk && lastChunk.startTime !== undefined && lastChunk.endTime !== undefined && 
                currentTime >= lastChunk.startTime && currentTime <= lastChunk.endTime) {
                activeChunk = lastChunk;
            } else {
                // If not, find the new one, starting from current index
                for (let i = 0; i < displayChunks.length; i++) {
                    const c = displayChunks[i];
                    if (c.startTime !== undefined && c.endTime !== undefined && 
                        currentTime >= c.startTime && currentTime <= c.endTime) {
                        activeChunk = c;
                        lastChunkIndexRef.current = i;
                        break;
                    }
                }
            }

            let textToDraw = '';
            if (activeChunk) {
                textToDraw = activeChunk.text;
            } else if (bgSources.length === 0 && !audio.paused) {
                textToDraw = 'Vui lòng chọn ảnh/video nền...';
            }

            if (textToDraw) {
                if (subtitleConfig.uppercase) {
                    textToDraw = textToDraw.toUpperCase();
                }

                const fontY = canvas.height - (subtitleConfig.bottomMargin * scaleFactor);

                // Auto-wrap subtitles if they exceed 85% of the video canvas width
                const words = textToDraw.split(/\s+/);
                const lines: string[] = [];
                let currentLine = '';
                const maxTextWidth = canvas.width * 0.85;

                for (let i = 0; i < words.length; i++) {
                    const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
                    const testWidth = ctx.measureText(testLine).width;
                    if (testWidth > maxTextWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = words[i];
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) {
                    lines.push(currentLine);
                }

                // Standard optimal line spacing for typography
                const subtitleFontSize = subtitleConfig.fontSize * scaleFactor;
                const lineHeight = subtitleFontSize * 1.25;

                // Render lines bottom-up aligned with the baseline anchor to maintain margin integrity
                lines.forEach((line, index) => {
                    const lineY = fontY - (lines.length - 1 - index) * lineHeight;
                    const strokeWidth = subtitleConfig.strokeWidth !== undefined ? subtitleConfig.strokeWidth : 6;
                    
                    if (strokeWidth > 0) {
                        ctx.save();
                        ctx.strokeStyle = subtitleConfig.strokeColor || '#000000';
                        ctx.lineWidth = strokeWidth * scaleFactor;
                        ctx.lineJoin = 'round';
                        ctx.miterLimit = 2;
                        ctx.strokeText(line, canvas.width / 2, lineY);
                        ctx.restore();
                    }

                    ctx.fillText(line, canvas.width / 2, lineY);
                });
            }
            ctx.restore();
        }

        // Sequential background logic or repeating background videos to fill the audio duration
        if (bgType === 'video' && videoRef.current && (videoRef.current.ended || (videoRef.current.duration > 0 && videoRef.current.currentTime >= videoRef.current.duration - 0.2))) {
            const isPlaying = isRendering || isPreviewPlaying || (audio && !audio.paused);
            if (isPlaying && bgSources.length > 0) {
                if (bgSources.length === 1) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(console.error);
                } else if (currentSourceIndex < bgSources.length - 1) {
                    const nextIndex = currentSourceIndex + 1;
                    setCurrentSourceIndex(nextIndex);
                    const nextUrl = bgSources[nextIndex].url;
                    videoRef.current.src = nextUrl;
                    videoRef.current.load();
                    videoRef.current.play().catch(console.error);
                } else {
                    // Loop back to start if it's the last video
                    setCurrentSourceIndex(0);
                    const nextUrl = bgSources[0].url;
                    videoRef.current.src = nextUrl;
                    videoRef.current.load();
                    videoRef.current.play().catch(console.error);
                }
            }
        }
    };

    const startRendering = async () => {
        const canvas = canvasRef.current;
        const audio = audioRef.current;
        if (!canvas || !audio) return;

        setIsRendering(true);
        setProgress(0);

        // Lower FPS to 30 for faster and more stable encoding on more devices
        const stream = canvas.captureStream(30);
        
        // Dynamic cleanup/rebuild of audio context to prevent overlapping/frozen streams
        if (audioNodesRef.current) {
            try {
                await audioNodesRef.current.ctx.close();
            } catch (e) {
                console.warn("Could not close previous audio context:", e);
            }
            audioNodesRef.current = null;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
        const dest = audioContext.createMediaStreamDestination();
        
        // Subtitle Audio (Foreground)
        const source = audioContext.createMediaElementSource(audio);
        const mainGain = audioContext.createGain();
        mainGain.gain.value = audioVolume;
        source.connect(mainGain);
        mainGain.connect(dest);
        mainGain.connect(audioContext.destination);

        // Background Video Audio (Low Volume)
        let createdVideoGain: GainNode | undefined;
        if (videoRef.current && bgType === 'video') {
            try {
                const videoSource = audioContext.createMediaElementSource(videoRef.current);
                const videoGain = audioContext.createGain();
                videoGain.gain.value = bgAudioVolume;
                videoSource.connect(videoGain);
                videoGain.connect(dest);
                videoGain.connect(audioContext.destination);
                createdVideoGain = videoGain;
            } catch (e) {
                console.warn("Could not connect video audio: ", e);
            }
        }

        // Background Music (BGM)
        let createdBgmGain: GainNode | undefined;
        if (bgmRef.current && bgmUrl) {
            try {
                const bgmSource = audioContext.createMediaElementSource(bgmRef.current);
                const bgmGain = audioContext.createGain();
                bgmGain.gain.value = bgmVolume;
                bgmSource.connect(bgmGain);
                bgmGain.connect(dest);
                bgmGain.connect(audioContext.destination);
                createdBgmGain = bgmGain;
            } catch (e) {
                console.warn("Could not connect bgm audio: ", e);
            }
        }

        audioNodesRef.current = { ctx: audioContext, source, dest, videoGain: createdVideoGain, bgmGain: createdBgmGain, mainGain };
        const destNode = audioNodesRef.current.dest;
        
        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...destNode.stream.getAudioTracks()
        ]);

        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/mp4';
                }
            }
        }

        const recorder = new MediaRecorder(combinedStream, { 
            mimeType,
            videoBitsPerSecond: 8000000, // 8 Mbps
            audioBitsPerSecond: 128000   // 128 kbps
        });
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        
        recorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            a.download = `vocalis_video_${Date.now()}.${ext}`;
            a.click();
            setIsRendering(false);
        };

        if (audioNodesRef.current?.ctx.state === 'suspended') {
            await audioNodesRef.current.ctx.resume();
        }

        audio.currentTime = 0;
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.muted = false; // Ensure unmuted for capture
        }

        const playPromises: Promise<void>[] = [];
        playPromises.push(audio.play().catch(e => console.warn(e)));
        if (videoRef.current) {
            playPromises.push(videoRef.current.play().catch(e => console.warn(e)));
        }
        if (bgmRef.current && bgmUrl) {
            bgmRef.current.currentTime = 0;
            bgmRef.current.volume = bgmVolume;
            playPromises.push(bgmRef.current.play().catch(e => console.warn(e)));
        }
        await Promise.all(playPromises);

        // Start recorder ONLY AFTER media is confirmed playing
        recorder.start();

        // Calculate total audio duration with strict loading assurance
        let totalAudioDuration = 0;
        if (audioSources.length > 0) {
            totalAudioDuration = audioSources.reduce((acc, s) => acc + (s.duration || 0), 0);
        } else {
            totalAudioDuration = audio.duration;
            if (isNaN(totalAudioDuration) || !isFinite(totalAudioDuration) || totalAudioDuration <= 0) {
                // Wait for audio metadata to load
                await new Promise<void>((resolve) => {
                    if (audio.readyState >= 1) { // HAVE_METADATA or higher
                        resolve();
                    } else {
                        audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
                        setTimeout(resolve, 3000); // 3 seconds safety timeout
                    }
                });
                totalAudioDuration = audio.duration || 0;
            }
        }

        // Final fallback if duration is still invalid
        if (isNaN(totalAudioDuration) || !isFinite(totalAudioDuration) || totalAudioDuration <= 0) {
            if (displayChunks.length > 0) {
                totalAudioDuration = displayChunks[displayChunks.length - 1].endTime || 10;
            } else {
                totalAudioDuration = 10;
            }
        }

        const updateProgress = () => {
            if (totalAudioDuration > 0) {
                let playedDuration = 0;
                if (audioSources.length > 0) {
                    for (let i = 0; i < currentAudioIndex; i++) {
                        playedDuration += audioSources[i].duration || 0;
                    }
                    playedDuration += audio.currentTime;
                } else {
                    playedDuration = audio.currentTime;
                }
                
                const p = (playedDuration / totalAudioDuration) * 100;
                setProgress(Math.min(p, 99.9)); // Keep at 99.9 until done
                
                if (audio.ended) {
                    if (audioSources.length > 0 && currentAudioIndex < audioSources.length - 1) {
                        // Switching is now handled by the render loop switching logic
                    } else {
                        recorder.stop();
                        if (videoRef.current) videoRef.current.pause();
                        if (bgmRef.current) bgmRef.current.pause();
                        setProgress(100);
                        return;
                    }
                }
            }
            if (isRendering) requestAnimationFrame(updateProgress);
        };
        updateProgress();
    };

    const renderRef = useRef(render);
    useEffect(() => {
        renderRef.current = render;
    }, [render]);

    useEffect(() => {
        isLoopingRef.current = true;
        const loop = () => {
            if (isLoopingRef.current) {
                renderRef.current();
                requestRef.current = requestAnimationFrame(loop);
            }
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            isLoopingRef.current = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div className={onClose ? "fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4" : "w-full"}>
            <div className={`bg-[#0F0F0F] border border-[#262626] rounded-3xl w-full max-w-6xl overflow-hidden flex flex-col shadow-3xl mx-auto ${onClose ? "max-h-[95vh]" : ""}`}>
                <div className="px-8 py-6 border-b border-[#262626] flex justify-between items-center bg-[#0a0a0a]">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-900/20 rounded-xl border border-blue-900/20">
                            <Film className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Sản xuất Video Pro</h2>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em]">Cấu hình nâng cao • Tích hợp Phụ đề & Nhạc nền</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {onClose && (
                            <button onClick={onClose} className="p-2 hover:bg-[#262626] rounded-full transition-colors text-gray-500">
                                <X size={24} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-10 grid grid-cols-1 xl:grid-cols-12 gap-12">
                    <div className="xl:col-span-4 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">1. Tài nguyên đầu vào</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className="cursor-pointer group relative overflow-hidden h-32 bg-[#141414] border border-[#262626] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-500/50 hover:bg-[#1A1A1A] transition-all">
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                    <div className="p-3 bg-blue-950/20 rounded-full group-hover:scale-110 transition-transform">
                                        <ImageIcon size={28} className="text-gray-600 group-hover:text-blue-400" />
                                    </div>
                                    <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-widest">Ảnh Nền</span>
                                    {bgType === 'image' && bgSources.length > 0 && <div className="absolute right-4 top-4 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                                </label>
                                <label className="cursor-pointer group relative overflow-hidden h-32 bg-[#141414] border border-[#262626] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-500/50 hover:bg-[#1A1A1A] transition-all">
                                    <input type="file" multiple accept="video/*" className="hidden" onChange={handleFileChange} />
                                    <div className="p-3 bg-purple-950/20 rounded-full group-hover:scale-110 transition-transform">
                                        <Video size={28} className="text-gray-600 group-hover:text-purple-400" />
                                    </div>
                                    <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-widest">Video Nền</span>
                                    {bgType === 'video' && bgSources.length > 0 && <div className="absolute right-4 top-4 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>}
                                </label>
                                <label className="cursor-pointer group relative overflow-hidden h-32 bg-[#141414] border border-[#262626] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-500/50 hover:bg-[#1A1A1A] transition-all">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const url = URL.createObjectURL(file);
                                                setLogoSource(url);
                                                setLogoConfig(prev => ({ ...prev, enabled: true }));
                                            }
                                        }} 
                                    />
                                    <div className="p-3 bg-amber-950/20 rounded-full group-hover:scale-110 transition-transform">
                                        <Camera size={28} className="text-gray-600 group-hover:text-amber-400" />
                                    </div>
                                    <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-widest">Logo</span>
                                    {logoSource && <div className="absolute right-4 top-4 w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>}
                                </label>
                            </div>

                            {bgType === 'video' && bgSources.length > 0 && (
                                <div className="p-4 bg-[#141414] border border-[#262626] rounded-2xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Âm thanh Video gốc: {Math.round(bgAudioVolume * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={bgAudioVolume * 100} 
                                        onChange={(e) => setBgAudioVolume(parseInt(e.target.value) / 100)}
                                        className="w-full h-1 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            )}

                            {bgSources.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center justify-between">
                                        <span>Danh sách tài nguyên ({bgSources.length})</span>
                                        <button 
                                            onClick={() => {
                                                bgSources.forEach(s => { if(s.url.startsWith('blob:')) URL.revokeObjectURL(s.url); });
                                                setBgSources([]);
                                            }}
                                            className="text-red-500 hover:text-red-400 transition-colors"
                                        >
                                            Xóa hết
                                        </button>
                                    </label>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {bgSources.map((source, index) => (
                                            <div 
                                                key={source.id} 
                                                className={`p-3 rounded-xl border flex items-center gap-3 group transition-all cursor-pointer ${
                                                    currentSourceIndex === index 
                                                    ? 'bg-blue-600/10 border-blue-500/50 active-glow' 
                                                    : 'bg-[#141414] border-[#262626] hover:border-gray-600'
                                                }`}
                                                onClick={() => setCurrentSourceIndex(index)}
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-[#222] flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                    #{index + 1}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-[11px] font-bold text-white truncate">{source.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] text-gray-500 uppercase font-black">{source.type}</span>
                                                        {currentSourceIndex === index && <span className="text-[9px] text-blue-400 font-bold uppercase animate-pulse">Đang dùng</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveSource(index, 'up'); }}
                                                        disabled={index === 0}
                                                        className="p-1 hover:bg-[#262626] rounded disabled:opacity-20"
                                                    >
                                                        <ChevronUp size={14} className="text-gray-400" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveSource(index, 'down'); }}
                                                        disabled={index === bgSources.length - 1}
                                                        className="p-1 hover:bg-[#262626] rounded disabled:opacity-20"
                                                    >
                                                        <ChevronDown size={14} className="text-gray-400" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); removeSource(source.id); }}
                                                        className="p-1 hover:bg-red-900/20 rounded group/del"
                                                    >
                                                        <Trash2 size={14} className="text-gray-500 group-hover/del:text-red-500 transition-colors" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="md:col-span-1 cursor-pointer group relative overflow-hidden h-16 bg-[#141414] border border-[#262626] rounded-2xl flex items-center justify-center gap-3 hover:border-blue-500/50 hover:bg-[#1A1A1A] transition-all">
                                        <input type="file" multiple accept="audio/*" className="hidden" onChange={async (e) => {
                                            const files = e.target.files;
                                            if (!files) return;
                                            const newSources: SourceItem[] = [];
                                            for (let i = 0; i < files.length; i++) {
                                                const file = files[i];
                                                const url = URL.createObjectURL(file);
                                                
                                                let duration = 0;
                                                try {
                                                    duration = await new Promise((resolve) => {
                                                        const temp = new Audio();
                                                        temp.src = url;
                                                        temp.onloadedmetadata = () => resolve(temp.duration);
                                                        temp.onerror = () => resolve(0);
                                                    });
                                                } catch(e) { console.warn("Could not get duration", e); }

                                                newSources.push({
                                                    id: Math.random().toString(36).substring(2, 9),
                                                    type: 'audio',
                                                    url,
                                                    name: file.name,
                                                    duration
                                                });
                                            }
                                            setAudioSources(prev => [...prev, ...newSources]);
                                        }} />
                                        <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-widest flex items-center gap-2">
                                            {audioSources.length > 0 ? `Thêm Âm Thanh (${audioSources.length})` : 'Tải Âm Thanh'}
                                        </span>
                                    </label>

                                    {audioSources.length > 0 && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center justify-between">
                                                <span>Playlist Âm thanh ({audioSources.length})</span>
                                                <button 
                                                    onClick={() => {
                                                        audioSources.forEach(s => { if(s.url.startsWith('blob:')) URL.revokeObjectURL(s.url); });
                                                        setAudioSources([]);
                                                        setCurrentAudioIndex(0);
                                                    }}
                                                    className="text-red-500 hover:text-red-400 transition-colors"
                                                >
                                                    Xóa hết
                                                </button>
                                            </label>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                {audioSources.map((source, index) => (
                                                    <div 
                                                        key={source.id} 
                                                        className={`p-2 rounded-xl border flex items-center gap-3 group transition-all cursor-pointer ${
                                                            currentAudioIndex === index 
                                                            ? 'bg-purple-600/10 border-purple-500/50' 
                                                            : 'bg-[#141414] border-[#262626]'
                                                        }`}
                                                        onClick={() => setCurrentAudioIndex(index)}
                                                    >
                                                        <div className="flex-grow min-w-0">
                                                            <p className="text-[10px] font-bold text-white truncate">{source.name}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (index > 0) {
                                                                        const newSources = [...audioSources];
                                                                        [newSources[index], newSources[index-1]] = [newSources[index-1], newSources[index]];
                                                                        setAudioSources(newSources);
                                                                    }
                                                                }}
                                                                disabled={index === 0}
                                                                className="p-1 hover:bg-[#262626] rounded disabled:opacity-20"
                                                            >
                                                                <ChevronUp size={12} className="text-gray-400" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (index < audioSources.length - 1) {
                                                                        const newSources = [...audioSources];
                                                                        [newSources[index], newSources[index+1]] = [newSources[index+1], newSources[index]];
                                                                        setAudioSources(newSources);
                                                                    }
                                                                }}
                                                                disabled={index === audioSources.length - 1}
                                                                className="p-1 hover:bg-[#262626] rounded disabled:opacity-20"
                                                            >
                                                                <ChevronDown size={12} className="text-gray-400" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAudioSources(prev => prev.filter(s => s.id !== source.id));
                                                                    if (currentAudioIndex >= audioSources.length - 1 && currentAudioIndex > 0) {
                                                                        setCurrentAudioIndex(prev => prev - 1);
                                                                    }
                                                                }}
                                                                className="p-1 hover:bg-red-900/20 rounded"
                                                            >
                                                                <Trash2 size={12} className="text-gray-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                <div className="space-y-4">
                                    <label className="md:col-span-1 cursor-pointer group relative overflow-hidden h-16 bg-[#141414] border border-[#262626] rounded-2xl flex items-center justify-center gap-3 hover:border-blue-500/50 hover:bg-[#1A1A1A] transition-all">
                                        <input type="file" accept=".srt" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (re) => {
                                                    const text = re.target?.result as string;
                                                    setLastUploadedSrt(text);
                                                    const parsed = parseSrtToChunks(text);
                                                    
                                                    // Giai đoạn 1: Auto-scan & sửa nhẹ khi upload
                                                    // Loại bỏ các dòng chỉ có số (STT bị sót) hoặc dòng chứa timeline lạc vào
                                                    const cleaned = parsed.map(c => {
                                                        const textLines = c.text.split('\n')
                                                            .filter(l => !/^\d+$/.test(l.trim()))
                                                            .filter(l => !/\d{2}:\d{2}:\d{2}/.test(l));
                                                        return {
                                                            ...c,
                                                            text: textLines.join('\n').trim()
                                                        };
                                                    }).filter(c => c.text.length > 0);
                                                    
                                                    setCustomChunks(cleaned);
                                                    setSrtErrors(validateSrt(cleaned));
                                                };
                                                reader.readAsText(file);
                                            }
                                        }} />
                                        <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-widest flex items-center gap-2">
                                            Tải Phụ Đề SRT
                                        </span>
                                        {customChunks && srtErrors.length === 0 && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full"></div>}
                                        {srtErrors.length > 0 && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                                    </label>

                                    {customChunks && srtErrors.length === 0 && (
                                        <button 
                                            onClick={repairSrt}
                                            className="w-full py-3 bg-purple-600/10 border border-dashed border-purple-500/40 rounded-xl text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-purple-600/20 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <Wand2 size={14} className="group-hover:rotate-12 transition-transform" />
                                            Sửa lỗi nâng cao (Dọn rác & Lặp từ)
                                        </button>
                                    )}

                                    {srtErrors.length > 0 && (
                                        <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-red-400">
                                                    <AlertCircle size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Phát hiện {srtErrors.length} lỗi SRT</span>
                                                </div>
                                                <button 
                                                    onClick={repairSrt}
                                                    className="px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-500 transition-colors flex items-center gap-1.5"
                                                >
                                                    <Wand2 size={12} />
                                                    Sửa lỗi Tự động
                                                </button>
                                            </div>
                                            <div className="max-h-24 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                                {srtErrors.map((err, i) => (
                                                    <p key={i} className="text-[9px] text-gray-400">• {err.message}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowSettings(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[#1A1A1A] hover:bg-[#262626] text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-[#333] transition-all hover:border-blue-500/30"
                            >
                                <Settings size={16} className="text-blue-400" />
                                Cấu hình Phụ đề & Nhạc nền
                            </button>
                        </div>

                        <div className="p-6 bg-blue-900/5 border border-blue-900/10 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                                    ⚡ Tối ưu hóa & Tốc độ Render
                                </h4>
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono font-bold text-blue-400 animate-pulse">Bộ xuất Ultra-Fast</span>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">Chọn Độ phân giải & Tốc độ xuất:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['720p', '540p', '480p'] as const).map((resolution) => {
                                        const label = resolution === '720p' ? 'HD 720p' : (resolution === '540p' ? 'QHD 540p' : 'SD 480p');
                                        const speed = resolution === '720p' ? 'Mặc định' : (resolution === '540p' ? 'Nhanh 1.7x' : 'Cực nhanh 2.5x');
                                        const isActive = renderResolution === resolution;
                                        return (
                                            <button
                                                key={resolution}
                                                type="button"
                                                onClick={() => setRenderResolution(resolution)}
                                                disabled={isRendering}
                                                className={`py-2.5 px-2 text-center rounded-xl border flex flex-col justify-center items-center transition-all ${
                                                    isActive 
                                                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                                                        : 'bg-[#181818]/60 border-[#262626] text-gray-400 hover:text-white hover:border-[#333]'
                                                } disabled:opacity-50 cursor-pointer`}
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
                                                <span className="text-[8px] font-medium opacity-80 mt-0.5">{speed}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    💡 <strong className="text-gray-300">Gợi ý:</strong> Chọn <span className="text-blue-400 font-bold">SD 480p (Cực nhanh 2.5x)</span> giúp giảm tải CPU/RAM, tăng tốc render phim lên 2.5 lần và nén dung lượng, vô cùng sắc nét trên màn hình điện thoại!
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={() => {
                                    if (canvasRef.current) {
                                        setPreviewImage(canvasRef.current.toDataURL('image/jpeg', 0.9));
                                    }
                                }}
                                disabled={isRendering || bgSources.length === 0}
                                className="w-full py-5 bg-[#141414] border border-[#262626] hover:bg-[#1a1a1a] hover:border-blue-500/50 disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-4"
                            >
                                <Camera size={18} />
                                Xem trước 1 khung
                            </button>
                            <button 
                                onClick={startRendering}
                                disabled={isRendering || bgSources.length === 0}
                                className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] flex flex-col items-center justify-center gap-1"
                            >
                                <div className="flex items-center gap-4">
                                    {isRendering ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                    <span>{isRendering ? `Đang xuất video (${Math.round(progress)}%)...` : 'Bàn giao Render'}</span>
                                </div>
                                {isRendering && (
                                    <span className="text-[9px] text-blue-200 uppercase tracking-widest font-normal opacity-80 mt-1">
                                        ⚠️ Không thu nhỏ tab này để tránh lệch Audio
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="xl:col-span-8 space-y-6">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Xem trước Preview (Real-time)</label>
                            <div className="flex gap-4">
                                {subtitleConfig.enabled && <span className="px-2 py-0.5 bg-blue-900/20 text-blue-500 text-[10px] font-bold rounded uppercase tracking-tighter border border-blue-900/30 self-center">Subs Active</span>}
                            </div>
                        </div>
                        <div className="aspect-video w-full bg-black rounded-[2.5rem] border border-[#222] overflow-hidden relative shadow-inner group">
                            {bgType === 'video' && (
                                <video 
                                    ref={videoRef} 
                                    src={activeSource?.url || ''} 
                                    playsInline 
                                    loop={bgSources.length === 1}
                                    className="absolute inset-0 w-full h-full object-contain opacity-[0.002] pointer-events-none -z-10" 
                                />
                            )}
                            <canvas 
                                ref={canvasRef} 
                                width={canvasWidth} 
                                height={canvasHeight} 
                                className="w-full h-full object-contain relative z-10"
                            />

                            {/* CSS Subtitle Overlay for Preview */}
                            {subtitleConfig.enabled && cssOverlayEnabled && !isRendering && (
                                <div 
                                    className="absolute inset-x-4 pointer-events-none z-30 flex flex-col items-center justify-end text-center"
                                    style={{
                                        bottom: `${(subtitleConfig.bottomMargin / canvasHeight) * 100}%`,
                                        height: '50%'
                                    }}
                                >
                                    {(() => {
                                        const currentTime = previewTime;
                                        let activeChunk = null;
                                        
                                        for (let i = 0; i < displayChunks.length; i++) {
                                            const c = displayChunks[i];
                                            if (c.startTime !== undefined && c.endTime !== undefined && 
                                                currentTime >= c.startTime && currentTime <= c.endTime) {
                                                activeChunk = c;
                                                break;
                                            }
                                        }

                                        let text = '';
                                        if (activeChunk) {
                                            text = activeChunk.text;
                                        }
                                        
                                        if (!text) return null;
                                        if (subtitleConfig.uppercase) {
                                            text = text.toUpperCase();
                                        }

                                        const fontFamily = subtitleConfig.fontFamily || 'Inter';
                                        const fontWeight = subtitleConfig.fontWeight || 'bold';
                                        const color = subtitleConfig.color || '#ffffff';
                                        const strokeColor = subtitleConfig.strokeColor || '#000000';
                                        const strokeWidth = subtitleConfig.strokeWidth !== undefined ? subtitleConfig.strokeWidth : 6;
                                        
                                        return (
                                            <span 
                                                className="px-4 py-2 select-none"
                                                style={{
                                                    fontFamily: `"${fontFamily}", sans-serif`,
                                                    fontWeight: fontWeight === 'normal' ? '400' : (fontWeight === 'bold' ? '700' : '900'),
                                                    fontSize: `calc(${subtitleConfig.fontSize}px * 0.75)`,
                                                    color: color,
                                                    WebkitTextStroke: `${strokeWidth * 0.4}px ${strokeColor}`,
                                                    textShadow: subtitleConfig.shadow 
                                                        ? `2px 2px 4px rgba(0,0,0,0.8)`
                                                        : `none`
                                                }}
                                            >
                                                {text}
                                            </span>
                                        );
                                    })()}
                                </div>
                            )}
                            
                            {isRendering && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center animate-in fade-in duration-500 z-20">
                                    <div className="relative h-24 w-24 mb-6">
                                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-black text-xs">
                                            {Math.round(progress)}%
                                        </div>
                                    </div>
                                    <p className="text-white font-black text-[10px] tracking-[0.3em] uppercase">Sản xuất nội dung...</p>
                                    <p className="text-gray-400 text-[10px] mt-2">Đang sử dụng: {activeSource?.name || 'Nền'}</p>
                                    <p className="text-gray-500 text-[10px] mt-1 underline cursor-not-allowed">Vui lòng không đóng trình duyệt</p>
                                </div>
                            )}
                        </div>

                        {/* Thanh điều khiển video & phụ đề trực tiếp block */}
                        <div className="flex items-center gap-4 p-4 bg-[#141414] border border-[#262626] rounded-2xl">
                            <button
                                type="button"
                                onClick={() => {
                                    const audio = audioRef.current;
                                    if (audio) {
                                        if (audio.paused) {
                                            audio.play().catch(console.error);
                                        } else {
                                            audio.pause();
                                        }
                                    }
                                }}
                                disabled={isRendering || bgSources.length === 0}
                                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-xl transition-all text-white flex items-center justify-center shrink-0"
                                title={isPreviewPlaying ? 'Tạm dừng thử' : 'Chạy thử xem trực tiếp phụ đề'}
                            >
                                {isPreviewPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSeek(0)}
                                disabled={isRendering || bgSources.length === 0}
                                className="px-3 py-2 bg-[#222] hover:bg-[#333] disabled:opacity-30 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all shrink-0"
                            >
                                Tua đầu
                            </button>

                            <input
                                type="range"
                                min="0"
                                max={previewDuration || 100}
                                step="0.05"
                                value={previewTime}
                                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                disabled={isRendering || bgSources.length === 0}
                                className="flex-grow h-1.5 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30"
                            />

                            <span className="text-xs font-mono text-gray-400 select-none min-w-[80px] text-right shrink-0">
                                {formatTime(previewTime)} / {formatTime(previewDuration)}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[#141414] border border-[#262626] rounded-2xl">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">Trạng thái Audio</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase">Sẵn sàng</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">Bộ nhớ đệm</span>
                                <span className="text-[10px] font-bold text-gray-300 uppercase">128MB Global</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">Độ phân giải</span>
                                <span className="text-[10px] font-bold text-gray-300 uppercase">{canvasWidth}x{canvasHeight} {renderResolution === '720p' ? 'HD' : (renderResolution === '540p' ? 'QHD' : 'SD')}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">Mã hóa</span>
                                <span className="text-[10px] font-bold text-gray-300 uppercase">Hardware Accel</span>
                            </div>
                        </div>

                        <div className="absolute opacity-0 pointer-events-none w-[1px] h-[1px] overflow-hidden -z-10">
                             <audio ref={audioRef} src={audioUrl} />
                             <audio ref={bgmRef} src={bgmUrl || ''} loop />
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPreviewImage(null)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                        ></motion.div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-[#121212] border border-[#333] rounded-[2rem] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-[#262626] flex justify-between items-center bg-[#0d0d0d]">
                                <div className="flex items-center gap-3">
                                    <Camera className="w-5 h-5 text-blue-500" />
                                    <h3 className="font-black text-white uppercase tracking-widest text-sm">Xem trước khung hình</h3>
                                </div>
                                <button onClick={() => setPreviewImage(null)} className="p-2 hover:bg-[#262626] rounded-full text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 bg-black flex justify-center items-center max-h-[80vh]">
                                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl border border-[#333]" />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSettings(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        ></motion.div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-[#121212] border border-[#333] rounded-[2rem] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-[#262626] flex justify-between items-center bg-[#0d0d0d]">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-5 h-5 text-blue-500" />
                                        <h3 className="font-black text-white uppercase tracking-widest text-sm">Cấu hình Nâng cao</h3>
                                    </div>
                                    <div className="h-6 w-[1px] bg-[#333]"></div>
                                    <div className="flex gap-2">
                                        {['blur_subs', 'branding'].map(tab => (
                                            <button 
                                                key={tab}
                                                onClick={() => setSettingsTab(tab as any)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                {tab === 'blur_subs' ? 'Phụ đề & Âm lượng' : 'Logo & Watermark'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-[#262626] rounded-full text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto min-h-[500px]">
                                {settingsTab === 'blur_subs' ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                        {/* Left: Background Asset Preview */}
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Xem trước Nền Video/Ảnh</h4>
                                                <p className="text-[10px] text-gray-500">Hiển thị nền hiện tại đang được sử dụng làm video clip gốc.</p>
                                            </div>
                                            
                                            <div className="aspect-video bg-[#0D0D0D] rounded-2xl overflow-hidden relative border border-[#333] group select-none">
                                                {/* Video/Image Preview in settings */}
                                                {bgType === 'image' && activeSource && <img src={activeSource.url} className="w-full h-full object-cover shadow-2xl" />}
                                                {bgType === 'video' && activeSource && <video src={activeSource.url} className="w-full h-full object-contain" muted playsInline autoPlay loop />}
                                                {bgSources.length === 0 && <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 font-bold uppercase text-[10px] tracking-widest gap-2 bg-[#080808]">
                                                    <ImageIcon size={24} className="opacity-20" />
                                                    <span>Chưa chọn ảnh/video nền</span>
                                                </div>}
                                            </div>
                                            
                                            <div className="space-y-6 pt-6 border-t border-[#262626]">
                                                <div className="flex items-center gap-2">
                                                    <Music size={16} className="text-blue-400" />
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Âm lượng & Nhạc nền (BGM)</h4>
                                                </div>

                                                <div className="p-6 bg-[#1A1A1A] rounded-2xl border border-[#262626] space-y-6">
                                                    {/* Nhạc nền file upload container */}
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Tệp nhạc nền (.mp3, .wav)</span>
                                                        {bgmUrl ? (
                                                            <div className="flex items-center justify-between p-3 bg-[#121212] rounded-xl border border-blue-900/40">
                                                                <div className="flex items-center gap-2 overflow-hidden truncate">
                                                                    <Music size={14} className="text-blue-400 shrink-0" />
                                                                    <span className="text-xs font-bold text-gray-200 truncate">{bgmFileName || 'bgm.mp3'}</span>
                                                                </div>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setBgmUrl(null);
                                                                        setBgmFileName(null);
                                                                        if (bgmRef.current) bgmRef.current.src = '';
                                                                    }}
                                                                    className="p-1 text-red-500 hover:bg-red-950/40 rounded-lg transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label className="cursor-pointer h-12 bg-[#121212] border border-[#333] hover:border-[#444] transition-all rounded-xl flex items-center justify-center gap-2 p-3">
                                                                <input 
                                                                    type="file" 
                                                                    accept="audio/*" 
                                                                    className="hidden" 
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const url = URL.createObjectURL(file);
                                                                            setBgmUrl(url);
                                                                            setBgmFileName(file.name);
                                                                        }
                                                                    }} 
                                                                />
                                                                <Upload size={14} className="text-gray-400" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Tải Nhạc Nền</span>
                                                            </label>
                                                        )}
                                                    </div>

                                                    {/* Nhạc nền Volume Slider */}
                                                    {bgmUrl && (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Volume BGM: {Math.round(bgmVolume * 100)}%</span>
                                                            </div>
                                                            <input 
                                                                type="range" min="0" max="100" 
                                                                value={bgmVolume * 100} 
                                                                onChange={(e) => setBgmVolume(parseInt(e.target.value) / 100)}
                                                                className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                            <p className="text-[9px] text-[#555] italic">Nhạc nền tự động lặp lại (loop) khớp theo toàn bộ chiều dài giọng đọc.</p>
                                                        </div>
                                                    )}

                                                    {/* Giọng Đọc (Audio) Volume Slider */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Volume Giọng Đọc: {Math.round(audioVolume * 100)}%</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="0" max="100" 
                                                            value={audioVolume * 100} 
                                                            onChange={(e) => setAudioVolume(parseInt(e.target.value) / 100)}
                                                            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>

                                                    {/* Video Nền (Background Video) Volume Slider */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Volume Video Gốc: {Math.round(bgAudioVolume * 100)}%</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="0" max="100" 
                                                            value={bgAudioVolume * 100} 
                                                            onChange={(e) => setBgAudioVolume(parseInt(e.target.value) / 100)}
                                                            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Subtitle Settings */}
                                        <div className="space-y-8">
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-2">
                                                    <Type size={16} className="text-blue-400" />
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Cấu hình chữ & Phụ đề</h4>
                                                </div>

                                                <div className="p-6 bg-[#1A1A1A] rounded-2xl border border-[#262626] space-y-5">
                                                    {/* Font Selection */}
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Phông chữ (Font Family)</span>
                                                        <select 
                                                            value={subtitleConfig.fontFamily || 'Montserrat'} 
                                                            onChange={(e) => setSubtitleConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                                                            className="w-full bg-[#121212] border border-[#333] text-gray-200 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider focus:outline-none focus:border-blue-500 cursor-pointer"
                                                        >
                                                            <option value="Inter">Inter (Cơ bản)</option>
                                                            <option value="Montserrat">Montserrat (Hiện đại, Đậm)</option>
                                                            <option value="Oswald">Oswald (Chuyên nghiệp, Hẹp)</option>
                                                            <option value="Roboto">Roboto (Sạch sẽ, Tối giản)</option>
                                                            <option value="JetBrains Mono">JetBrains Mono (Công nghệ)</option>
                                                            <option value="Playfair Display">Playfair Display (Nghệ thuật, Serif)</option>
                                                        </select>
                                                    </div>

                                                    {/* Font Weight & Text Transform Grid */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Độ dày chữ</span>
                                                            <select 
                                                                value={subtitleConfig.fontWeight || '900'} 
                                                                onChange={(e) => setSubtitleConfig(prev => ({ ...prev, fontWeight: e.target.value }))}
                                                                className="w-full bg-[#121212] border border-[#333] text-gray-200 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider focus:outline-none focus:border-blue-500 cursor-pointer"
                                                            >
                                                                <option value="normal">Thường</option>
                                                                <option value="bold">Đậm (Bold)</option>
                                                                <option value="900">Siêu Đậm (Black)</option>
                                                            </select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Chữ viết hoa</span>
                                                            <label className="flex items-center gap-3 bg-[#121212] border border-[#333] hover:border-[#444] transition-all rounded-xl p-2.5 cursor-pointer h-[38px]">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={subtitleConfig.uppercase || false} 
                                                                    onChange={(e) => setSubtitleConfig(prev => ({ ...prev, uppercase: e.target.checked }))}
                                                                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                                />
                                                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider select-none">UPPERCASE</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* Subtitle Font Size Slider */}
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cỡ chữ (Px): {subtitleConfig.fontSize}</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="12" max="120" 
                                                            value={subtitleConfig.fontSize} 
                                                            onChange={(e) => setSubtitleConfig(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                                                            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>

                                                    {/* Bottom Position Slider */}
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Vị trí lề dưới: {subtitleConfig.bottomMargin}px</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="20" max="400" 
                                                            value={subtitleConfig.bottomMargin} 
                                                            onChange={(e) => setSubtitleConfig(prev => ({ ...prev, bottomMargin: parseInt(e.target.value) }))}
                                                            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>

                                                    {/* Color Option Grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#262626]">
                                                         {/* Text Color */}
                                                         <div className="space-y-2">
                                                             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Màu chữ:</span>
                                                             <div className="flex flex-wrap gap-2 items-center">
                                                                 {['#ffffff', '#facc15', '#ef4444', '#3b82f6', '#4ade80'].map(color => (
                                                                     <button 
                                                                         key={color}
                                                                         type="button"
                                                                         onClick={() => setSubtitleConfig(prev => ({ ...prev, color }))}
                                                                         className={`w-6 h-6 rounded-full border-2 transition-all ${subtitleConfig.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'} cursor-pointer`}
                                                                         style={{ backgroundColor: color }}
                                                                         title={color}
                                                                     />
                                                                 ))}
                                                                 <input 
                                                                     type="color" 
                                                                     value={subtitleConfig.color}
                                                                     onChange={(e) => setSubtitleConfig(prev => ({ ...prev, color: e.target.value }))}
                                                                     className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer p-0"
                                                                     title="Chọn màu tự do"
                                                                 />
                                                             </div>
                                                         </div>

                                                         {/* Stroke/Outline Color */}
                                                         <div className="space-y-2">
                                                             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Màu viền chữ:</span>
                                                             <div className="flex flex-wrap gap-2 items-center">
                                                                 {['#000000', '#ffffff', '#ef4444', '#38bdf8'].map(color => (
                                                                     <button 
                                                                         key={color}
                                                                         type="button"
                                                                         onClick={() => setSubtitleConfig(prev => ({ ...prev, strokeColor: color }))}
                                                                         className={`w-6 h-6 rounded-full border border-gray-600 transition-all ${subtitleConfig.strokeColor === color ? 'ring-2 ring-blue-500 scale-110 shadow-lg' : 'opacity-50 hover:opacity-100'} cursor-pointer`}
                                                                         style={{ backgroundColor: color }}
                                                                         title={color}
                                                                     />
                                                                 ))}
                                                                 <input 
                                                                     type="color" 
                                                                     value={subtitleConfig.strokeColor || '#000000'}
                                                                     onChange={(e) => setSubtitleConfig(prev => ({ ...prev, strokeColor: e.target.value }))}
                                                                     className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer p-0"
                                                                     title="Chọn màu viền"
                                                                 />
                                                             </div>
                                                         </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 items-center pt-2">
                                                         {/* Line Outline Width */}
                                                         <div className="space-y-2">
                                                             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Độ dày viền: {subtitleConfig.strokeWidth !== undefined ? subtitleConfig.strokeWidth : 6}px</span>
                                                             <input 
                                                                 type="range" min="0" max="16" 
                                                                 value={subtitleConfig.strokeWidth !== undefined ? subtitleConfig.strokeWidth : 6} 
                                                                 onChange={(e) => setSubtitleConfig(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                                                                 className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                             />
                                                         </div>

                                                         {/* Text Shadow Checkbox */}
                                                         <div className="space-y-2">
                                                             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block opacity-0">Đổ bóng</span>
                                                             <label className="flex items-center justify-between cursor-pointer bg-[#121212] border border-[#333] hover:border-[#444] rounded-xl p-2.5 h-[38px] transition-all">
                                                                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider select-none">Đổ bóng chữ</span>
                                                                 <input 
                                                                     type="checkbox" 
                                                                     checked={subtitleConfig.shadow} 
                                                                     onChange={(e) => setSubtitleConfig(prev => ({ ...prev, shadow: e.target.checked }))}
                                                                     className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                                 />
                                                             </label>
                                                         </div>
                                                     </div>
                                                     
                                                     {/* Subtitle CSS Overlay Toggle */}
                                                     <div className="pt-3 border-t border-[#262626]">
                                                          <label className="flex items-center justify-between cursor-pointer bg-[#121212]/50 border border-blue-900/10 hover:border-blue-500/30 rounded-xl p-3 transition-all">
                                                              <div className="space-y-0.5">
                                                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Subtitle CSS Overlay</span>
                                                                  <span className="text-[9px] text-[#555] block">Xem trước phụ đề vector siêu nét, mượt mà</span>
                                                              </div>
                                                              <input 
                                                                  type="checkbox" 
                                                                  checked={cssOverlayEnabled} 
                                                                  onChange={(e) => setCssOverlayEnabled(e.target.checked)}
                                                                  className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                              />
                                                          </label>
                                                     </div>
                                                </div>

                                                <button 
                                                    onClick={() => setShowSettings(false)}
                                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
                                                >
                                                    Lưu thay đổi & Quay lại
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-10">
                                        {/* Unified Branding Preview Area */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Xem trước Logo & Watermark</h4>
                                                <p className="text-[10px] text-gray-500">Giúp căn chỉnh chính xác vị trí hiển thị thương hiệu.</p>
                                            </div>
                                            <div className="aspect-video bg-[#0D0D0D] rounded-2xl overflow-hidden relative border border-[#333] shadow-2xl">
                                                {/* Background Preview */}
                                                {bgType === 'image' && activeSource && <img src={activeSource.url} className="w-full h-full object-cover opacity-50" />}
                                                {bgType === 'video' && activeSource && <video src={activeSource.url} className="w-full h-full object-contain opacity-50" muted playsInline autoPlay loop />}
                                                
                                                {/* Logo Overlay */}
                                                {logoSource && logoConfig.enabled && (
                                                    <div 
                                                        className="absolute transition-all duration-100"
                                                        style={{
                                                            left: `${logoConfig.x}%`,
                                                            top: `${logoConfig.y}%`,
                                                            width: `${logoConfig.scale}%`,
                                                            opacity: logoConfig.opacity,
                                                        }}
                                                    >
                                                        <img src={logoSource} className="w-full h-auto" />
                                                    </div>
                                                )}

                                                {/* Watermark Overlay */}
                                                {watermarkConfig.enabled && watermarkConfig.text && (
                                                    <div 
                                                        className="absolute transition-all duration-100 whitespace-nowrap pointer-events-none"
                                                        style={{
                                                            left: `${watermarkConfig.x}%`,
                                                            top: `${watermarkConfig.y}%`,
                                                            color: watermarkConfig.color,
                                                            fontSize: `${watermarkConfig.fontSize / 2}px`, // Scaled for preview
                                                            opacity: watermarkConfig.opacity,
                                                            transform: watermarkConfig.x > 50 ? 'translateX(-100%)' : (watermarkConfig.x < 30 ? 'none' : 'translateX(-50%)'),
                                                            fontFamily: 'Inter, sans-serif',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {watermarkConfig.text}
                                                    </div>
                                                )}

                                                {bgSources.length === 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                                                        Chưa chọn nền để xem trước
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            {/* Logo Column */}
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-2">
                                                    <Camera size={16} className="text-blue-400" />
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Cấu hình Logo</h4>
                                                </div>
                                                
                                                <div className="p-6 bg-[#1A1A1A] rounded-2xl border border-[#262626] space-y-6">
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {!logoSource ? (
                                                            <label className="cursor-pointer py-4 border-2 border-dashed border-[#333] rounded-xl flex flex-col items-center gap-2 hover:border-blue-500/50 transition-colors">
                                                                <input 
                                                                    type="file" accept="image/*" className="hidden" 
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const url = URL.createObjectURL(file);
                                                                            setLogoSource(url);
                                                                            setLogoConfig(prev => ({ ...prev, enabled: true }));
                                                                        }
                                                                    }} 
                                                                />
                                                                <ImageIcon size={20} className="text-gray-600" />
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Tải Logo</span>
                                                            </label>
                                                        ) : (
                                                            <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-xl border border-[#262626]">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] p-1 flex-shrink-0">
                                                                        <img src={logoSource} className="w-full h-full object-contain" />
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500 truncate">logo_selected.png</span>
                                                                </div>
                                                                <button onClick={() => setLogoSource(null)} className="p-2 hover:bg-[#262626] rounded-lg text-red-500">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hiển thị Logo</span>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={logoConfig.enabled} 
                                                            onChange={(e) => setLogoConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600"
                                                        />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block">Kích thước: {logoConfig.scale}%</span>
                                                        <input 
                                                            type="range" min="1" max="100" 
                                                            value={logoConfig.scale} 
                                                            onChange={(e) => setLogoConfig(prev => ({ ...prev, scale: parseInt(e.target.value) }))}
                                                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Vị trí X: {logoConfig.x}%</span>
                                                            <input 
                                                                type="range" min="0" max="100" 
                                                                value={logoConfig.x} 
                                                                onChange={(e) => setLogoConfig(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Vị trí Y: {logoConfig.y}%</span>
                                                            <input 
                                                                type="range" min="0" max="100" 
                                                                value={logoConfig.y} 
                                                                onChange={(e) => setLogoConfig(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block">Độ trong suốt: {Math.round(logoConfig.opacity * 100)}%</span>
                                                        <input 
                                                            type="range" min="0" max="100" 
                                                            value={logoConfig.opacity * 100} 
                                                            onChange={(e) => setLogoConfig(prev => ({ ...prev, opacity: parseInt(e.target.value) / 100 }))}
                                                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Watermark Column */}
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-2">
                                                    <Type size={16} className="text-purple-400" />
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Chữ Watermark</h4>
                                                </div>

                                                <div className="p-6 bg-[#1A1A1A] rounded-2xl border border-[#262626] space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Nội dung Watermark</label>
                                                        <input 
                                                            type="text"
                                                            value={watermarkConfig.text}
                                                            onChange={(e) => setWatermarkConfig(prev => ({ ...prev, text: e.target.value }))}
                                                            placeholder="Nhập tên thương hiệu, SĐT..."
                                                            className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 text-sm text-gray-200 outline-none focus:border-blue-500"
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kích hoạt Watermark</span>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={watermarkConfig.enabled} 
                                                            onChange={(e) => setWatermarkConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-purple-600"
                                                        />
                                                    </div>

                                                    <div className="p-4 bg-purple-950/10 rounded-xl border border-purple-900/20">
                                                        <label className="flex items-center justify-between cursor-pointer">
                                                            <div className="space-y-0.5">
                                                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Chế độ Chạy khắp màn hình</span>
                                                                <p className="text-[9px] text-gray-500 leading-tight">Văn bản sẽ di chuyển liên tục để chống các phần mềm xóa logo.</p>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={watermarkConfig.floating} 
                                                                onChange={(e) => setWatermarkConfig(prev => ({ ...prev, floating: e.target.checked }))}
                                                                className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-purple-600"
                                                            />
                                                        </label>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block">Cỡ chữ: {watermarkConfig.fontSize}px</span>
                                                        <input 
                                                            type="range" min="10" max="100" 
                                                            value={watermarkConfig.fontSize} 
                                                            onChange={(e) => setWatermarkConfig(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                                                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                    </div>

                                                    {!watermarkConfig.floating && (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Vị trí X: {watermarkConfig.x}%</span>
                                                                <input 
                                                                    type="range" min="0" max="100" 
                                                                    value={watermarkConfig.x} 
                                                                    onChange={(e) => setWatermarkConfig(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Vị trí Y: {watermarkConfig.y}%</span>
                                                                <input 
                                                                    type="range" min="0" max="100" 
                                                                    value={watermarkConfig.y} 
                                                                    onChange={(e) => setWatermarkConfig(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Màu sắc</span>
                                                        <div className="flex gap-2">
                                                            {['#ffffff', '#facc15', '#ef4444', '#3b82f6'].map(color => (
                                                                <button 
                                                                    key={color}
                                                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, color }))}
                                                                    className={`w-6 h-6 rounded-full border-2 transition-all ${watermarkConfig.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block">Độ trong suốt: {Math.round(watermarkConfig.opacity * 100)}%</span>
                                                        <input 
                                                            type="range" min="0" max="100" 
                                                            value={watermarkConfig.opacity * 100} 
                                                            onChange={(e) => setWatermarkConfig(prev => ({ ...prev, opacity: parseInt(e.target.value) / 100 }))}
                                                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => setShowSettings(false)}
                                                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-900/20"
                                                >
                                                    Xác nhận & Quay lại
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
