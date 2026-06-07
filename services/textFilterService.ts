export interface PhoneticEntry {
    id: string;
    original: string;
    phonetic: string;
}

export interface FilterOptions {
    removeJunkBlocks: boolean;
    removeChapterHeader: boolean;
    removeEndNumbers: boolean;
    convertLargeNumbers: boolean;
    removeNumbers: boolean;
    removeWhitespace: boolean;
    manualPhonetic: boolean;
    removeDuplicateBlocks: boolean;
    removeWebAddresses: boolean;
}

export class TextFilterService {
    private static readonly UNITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    private static readonly GROUPS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];
    
    private static readonly DYNAMIC_JUNK_PATTERNS = [
        /^\d+\s+nhận\s+xét$/i,
        /^\d+\s+còn\s+lại$/i,
        /^\d+\s+left$/i,
        /^bỏ\s+phiếu$/i,
        /^\d+\s+bình\s+luận$/i,
        /^bình\s+luận$/i, 
        /^thêm\s+bình\s+luận$/i,
        /^\d+\s+comment(s)?$/i,
        /^suy\s+nghĩ\s+của\s+người\s+sáng\s+tạo$/i,
        /^rắn\s+hồng$/i,
        /(?:https?:\/\/)?discord\.(?:gg|com\/invite)\/\S+/i,
        /\d+\s+power\s+stones\s*=\s*\d+\s+chương\s+bônus/i, 
        /\d+\s+đánh\s+giá\s*=\s*\d+\s+chương\s+bônus/i,   
        /\d+\s+stones\s*=\s*\d+\s+bonus/i                  
    ];

    private static readonly CHAPTER_PATTERNS = [
        /^\s*(chapter|volume|vol|ch\b|chương|quyển|tập|tiết|phần|bài|glava|глава)\s+(\d+|[ivxldcm]+)/i,
        /^\s*di\s+\d+\s*(zhang|juan)/i, 
        /^\s*第\s*[0-9一二三四五六七八九十百千万]\s*[章卷]/i, 
        /^\s*第\s*\d+\s*(章|卷|回|集|节)/i,
        /^\s*\d+\s*[章卷]\s*$/i
    ];

    private static readonly END_NUMBERS_PATTERN = /\s+\d+(\+)?\s*$/;
    private static readonly NUMBER_REGEX = /\d{1,3}(?:\.\d{3})+|\d{4,}/g;
    private static readonly WHITESPACE_REGEX = /[^\S\r\n]+/g;
    private static readonly EMPTY_LINE_REGEX = /^\s*[\r\n]/gm;
    private static readonly URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|mil|biz|info|mobi|name|aero|jobs|museum|us|ca|uk|vn|cn|tw|ru|io|co|me|cc|tv|xyz|html|htm|net\.vn|com\.vn|edu\.vn)(?:\/[^\s]*)?\b)/gi;

    public static numberToVietnamese(numStr: string): string {
        let cleanNum = numStr.replace(/\./g, "");
        if (isNaN(parseInt(cleanNum))) return numStr;
        if (parseInt(cleanNum) === 0) return "không";
        
        let pos = cleanNum.length;
        let chunks: string[] = [];
        while (pos > 0) {
            let start = Math.max(0, pos - 3);
            chunks.push(cleanNum.substring(start, pos).padStart(3, '0'));
            pos = start;
        }
        
        let result = "";
        let hasStarted = false;
        for (let i = chunks.length - 1; i >= 0; i--) {
            let n = chunks[i];
            let v = parseInt(n);
            if (v === 0) continue;
            
            let a = parseInt(n[0]);
            let b = parseInt(n[1]);
            let c = parseInt(n[2]);
            let chunkText = "";
            
            if (hasStarted) {
                if (a !== 0) chunkText += this.UNITS[a] + " trăm ";
                else {
                    if (b !== 0) chunkText += "không trăm ";
                    else chunkText += "lẻ ";
                }
            } else {
                if (a !== 0) chunkText += this.UNITS[a] + " trăm ";
            }
            
            if (b !== 0 && b !== 1) chunkText += this.UNITS[b] + " mươi ";
            else if (b === 1) chunkText += "mười ";
            
            if (c !== 0) {
                if (c === 1 && b > 1) chunkText += "mốt";
                else if (c === 5 && b > 0) chunkText += "lăm";
                else chunkText += this.UNITS[c];
            }
            result += chunkText.trim() + " " + this.GROUPS[i] + " ";
            hasStarted = true;
        }
        return result.trim().replace(/\s+/g, ' ');
    }

    public static isChapterLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed) return false;
        
        const isChapter = this.CHAPTER_PATTERNS.some(pattern => pattern.test(trimmed));
        if (isChapter) return true;
        
        const lower = trimmed.toLowerCase();
        const keywords = ['chapter', 'chương', 'volume', 'quyển', 'tập', 'vol ', 'ch ', 'tiết ', 'глава', '第'];
        if (trimmed.length < 60) {
            if (keywords.some(k => lower.startsWith(k))) {
                return true;
            }
        }
        return false;
    }

    public static removeDuplicateBlocks(lines: string[]): string[] {
        let n = lines.length;
        let isRemoved = new Array(n).fill(false);
        const cleanLines = lines.map(line => line.trim().toLowerCase().replace(/\s+/g, ''));

        for (let size = 10; size >= 1; size--) {
            const sequenceMap = new Map<string, number>();

            for (let i = 0; i <= n - size; i++) {
                let windowAlreadyRemoved = false;
                for (let w = 0; w < size; w++) {
                    if (isRemoved[i + w]) {
                        windowAlreadyRemoved = true;
                        break;
                    }
                }
                if (windowAlreadyRemoved) continue;

                const windowLines = [];
                let totalLength = 0;
                for (let w = 0; w < size; w++) {
                    const cl = cleanLines[i + w];
                    if (cl) {
                        windowLines.push(cl);
                        totalLength += cl.length;
                    }
                }

                if (windowLines.length < size || totalLength < (size === 1 ? 8 : 4 * size)) {
                    continue;
                }

                const hash = windowLines.join('\n');
                
                if (sequenceMap.has(hash)) {
                    const firstOccurIdx = sequenceMap.get(hash)!;
                    if (i >= firstOccurIdx + size) {
                        for (let w = 0; w < size; w++) {
                            isRemoved[i + w] = true;
                        }
                    }
                } else {
                    sequenceMap.set(hash, i);
                }
            }
        }

        return lines.filter((_, idx) => !isRemoved[idx]);
    }

    public static process(text: string, options: FilterOptions, junkKeywords: string, phoneticDict: PhoneticEntry[]): string {
        if (!text.trim()) return '';

        let lines = text.split(/\r?\n/);
        const keywords = junkKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k !== "");
        
        let finalLines: string[] = [];
        let i = 0;

        while (i < lines.length) {
            let line = lines[i];
            let lineTrimmed = line.trim();
            let lineLower = lineTrimmed.toLowerCase();

            if (!lineTrimmed) {
                finalLines.push("");
                i++;
                continue;
            }

            // Web address removal (if entire line is just a link or link with surrounding, remove it or clean it)
            if (options.removeWebAddresses) {
                line = line.replace(this.URL_REGEX, '').trim();
                lineTrimmed = line.trim();
                lineLower = lineTrimmed.toLowerCase();
                if (!lineTrimmed) {
                    i++;
                    continue;
                }
            }

            // Multi-language Chapters
            if (options.removeChapterHeader && this.isChapterLine(lineTrimmed)) {
                i++;
                continue;
            }

            const isDynamicJunk = this.DYNAMIC_JUNK_PATTERNS.some(pattern => pattern.test(lineTrimmed));
            if (isDynamicJunk) {
                i++;
                continue;
            }

            if (options.removeJunkBlocks) {
                let isCurrentJunk = keywords.some(k => lineLower.includes(k));
                if (isCurrentJunk) {
                    let nextJunkIdx = -1;
                    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                        let nextLineTrimmed = lines[j].trim();
                        let nextLineLower = nextLineTrimmed.toLowerCase();
                        if (nextLineLower === "") continue; 
                        const isNextDynamicJunk = this.DYNAMIC_JUNK_PATTERNS.some(pattern => pattern.test(nextLineTrimmed));
                        if (isNextDynamicJunk || keywords.some(k => nextLineLower.includes(k))) {
                            nextJunkIdx = j;
                            break;
                        }
                    }

                    if (nextJunkIdx !== -1 || lineLower.includes('discord.gg') || lineLower.includes('send gift') || lineLower.includes('left') || lineLower.includes('power stones')) {
                        while (i < lines.length) {
                            let checkLineTrimmed = lines[i].trim();
                            let checkLineLower = checkLineTrimmed.toLowerCase();
                            const isCheckDynamicJunk = this.DYNAMIC_JUNK_PATTERNS.some(pattern => pattern.test(checkLineTrimmed));
                            if (checkLineLower === "" || isCheckDynamicJunk || keywords.some(k => checkLineLower.includes(k))) {
                                i++;
                            } else {
                                break; 
                            }
                        }
                        continue;
                    }
                }
            }

            if (options.removeEndNumbers) {
                line = line.replace(this.END_NUMBERS_PATTERN, '');
            }

            finalLines.push(line);
            i++;
        }

        // Duplicate adjacent blocks filter
        if (options.removeDuplicateBlocks) {
            finalLines = this.removeDuplicateBlocks(finalLines);
        }

        let result = finalLines.join('\n');
        
        if (options.manualPhonetic) {
            const sortedDict = [...phoneticDict].sort((a, b) => b.original.length - a.original.length);
            sortedDict.forEach(entry => {
                if (!entry.original.trim()) return;
                try {
                    const escaped = entry.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
                    result = result.replace(regex, entry.phonetic);
                } catch (e) {
                    console.error("Phonetic replacement error", e);
                }
            });
        }

        if (options.convertLargeNumbers) {
            result = result.replace(this.NUMBER_REGEX, (match) => {
                const clean = match.replace(/\./g, "");
                const val = parseInt(clean);
                if (val >= 1000 && val % 1000 === 0) {
                    if (val >= 1000000000 && val % 1000000000 === 0) return (val / 1000000000) + " tỷ";
                    if (val >= 1000000 && val % 1000000 === 0) return (val / 1000000) + " triệu";
                    if (val >= 1000 && val % 1000 === 0) return (val / 1000) + " nghìn";
                }
                return this.numberToVietnamese(match);
            });
        }

        if (options.removeNumbers) {
            result = result.replace(/[0-9]/g, '');
        }
        
        if (options.removeWhitespace) {
            result = result.replace(this.WHITESPACE_REGEX, ' ') 
                           .replace(this.EMPTY_LINE_REGEX, '') 
                           .trim();
        }

        return result;
    }
}
