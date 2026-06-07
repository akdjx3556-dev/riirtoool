
import * as mammoth from 'mammoth';
import JSZip from 'jszip';

export class TextProcessor {
    private maxChars: number;
    private minCharsToMerge: number;

    // Pre-compile regex for performance
    private static readonly LINE_BREAKS_REGEX = /\r\n|\r/g;
    private static readonly MULTI_NEWLINE_REGEX = /\n{2,}/g;
    private static readonly CONTROL_CHARS_REGEX = /[\x00-\x08\x0b-\x1f\x7f]/g;
    private static readonly MULTI_SPACE_REGEX = /[ \t]+/g;
    private static readonly VIETNAMESE_ABBR_REGEX = /(TP|P|Q|H|T|S|P\.S|V\.V|V\.N|T\.P|Q\.L|N\.X\.B|T\.S|K\.S|B\.S|T\.H|T\.C|C\.T|C\.P|U\.B|H\.Đ|N\.D|N\.N|T\.Ư|T\.T|P\.T|P\.V|C\.A|Q\.Đ|H\.Q|T\.C|T\.D|T\.L|K\.T|X\.H|V\.H|G\.D|Y\.T|K\.H|C\.N|M\.T|D\.V|T\.M|B\.L|H\.S|K\.L|T\.N|P\.L|Q\.T|H\.Đ|N\.Q|C\.Q|T\.B|H\.B|P\.B|T\.C|V\.P|B\.T|T\.G|T\.K|T\.P|T\.X|H\.T|X\.T|C\.T|N\.T|P\.T|D\.T|K\.T|V\.T|S\.T|B\.T|L\.T|M\.T|N\.T|P\.T|Q\.T|R\.T|S\.T|T\.T|U\.T|V\.T|W\.T|X\.T|Y\.T|Z\.T)\./gi;
    private static readonly SENTENCE_SPLIT_REGEX = /(?<=[.?!])\s+/;

    constructor(maxChars: number = 1500, minCharsToMerge: number = 30) {
        if (maxChars <= 0) {
            throw new Error("max_chars must be a positive number.");
        }
        this.maxChars = maxChars;
        this.minCharsToMerge = minCharsToMerge;
    }

    private cleanText(text: string): string {
        let cleaned = text.replace(TextProcessor.LINE_BREAKS_REGEX, '\n');
        cleaned = cleaned.replace(TextProcessor.MULTI_NEWLINE_REGEX, '\n');
        cleaned = cleaned.replace(TextProcessor.CONTROL_CHARS_REGEX, '');
        const lines = cleaned.split('\n');
        const cleanedLines = lines.map(line => line.replace(TextProcessor.MULTI_SPACE_REGEX, ' ').trim());
        return cleanedLines.join('\n').trim();
    }

    private splitLongSentence(sentence: string): string[] {
        const subSentences: string[] = [];
        let currentPart = sentence;
        const delimiters = ['. ', ', ', '! ', '? ', ': ', '; ', ' '];
        
        while (currentPart.length > this.maxChars) {
            let cutPos = -1;
            for (const delim of delimiters) {
                const foundPos = currentPart.lastIndexOf(delim, this.maxChars);
                if (foundPos !== -1) {
                    cutPos = foundPos + delim.length;
                    break;
                }
            }
            if (cutPos === -1) {
                cutPos = this.maxChars;
            }
            subSentences.push(currentPart.substring(0, cutPos).trim());
            currentPart = currentPart.substring(cutPos).trim();
        }
        if (currentPart) {
            subSentences.push(currentPart);
        }
        return subSentences;
    }

    public process(text: string): string[] {
        const cleanedText = this.cleanText(text);
        // Protect abbreviations from being split
        const protectedText = cleanedText.replace(TextProcessor.VIETNAMESE_ABBR_REGEX, (match) => match.replace(/\./g, '___DOT___'));
        
        const paragraphs = protectedText.split('\n').filter(p => p);
        const allSentences: string[] = [];

        for (const para of paragraphs) {
            const sentencesInPara = para.split(TextProcessor.SENTENCE_SPLIT_REGEX)
                                       .map(s => s.trim())
                                       .filter(s => s)
                                       .map(s => s.replace(/___DOT___/g, '.'));
            allSentences.push(...sentencesInPara);
        }
        
        const chunks: string[] = [];
        let currentChunk = "";

        for (const sentence of allSentences) {
            if (sentence.length > this.maxChars) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = "";
                chunks.push(...this.splitLongSentence(sentence));
                continue;
            }
            if (currentChunk.length + sentence.length + 1 > this.maxChars) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = sentence;
            } else {
                currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        if (chunks.length >= 2 && chunks[chunks.length - 1].length < this.minCharsToMerge) {
            const lastChunk = chunks.pop()!;
            const secondToLastChunk = chunks[chunks.length - 1];

            if (secondToLastChunk.length + lastChunk.length + 1 <= this.maxChars) {
                chunks[chunks.length - 1] += " " + lastChunk;
            } else {
                const sentencesInChunk = secondToLastChunk.split(TextProcessor.SENTENCE_SPLIT_REGEX);
                if (sentencesInChunk.length > 1) {
                    const sentenceToMove = sentencesInChunk.pop()!;
                    const newLastChunk = `${sentenceToMove} ${lastChunk}`;

                    if (newLastChunk.length <= this.maxChars) {
                        chunks[chunks.length - 1] = sentencesInChunk.join(" ");
                        chunks.push(newLastChunk);
                    } else {
                         chunks.push(lastChunk); 
                    }
                } else {
                    chunks.push(lastChunk);
                }
            }
        }
        return chunks.filter(c => c.length > 0);
    }
    
    public static parseTimestampToSeconds(timestamp: string): number {
        const parts = timestamp.split(/[:,]/);
        if (parts.length < 4) return 0;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        const ms = parseInt(parts[3], 10);
        return h * 3600 + m * 60 + s + ms / 1000;
    }

    public static secondsToTimestamp(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    public static fixSrtContent(content: string): string {
        // Robust SRT parser that can handle slightly broken formats
        // Split by pattern that looks like start of a block (index followed by timing)
        const timingRegex = /(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/;
        const blocks = content.trim().split(/\n\s*\n/);
        const items: Array<{ index: number; start: number; end: number; text: string }> = [];

        blocks.forEach((block) => {
            const lines = block.trim().split(/\n/);
            if (lines.length < 2) return;

            // Find timing line
            let timingLineIdx = -1;
            for (let i = 0; i < Math.min(3, lines.length); i++) {
                if (timingRegex.test(lines[i])) {
                    timingLineIdx = i;
                    break;
                }
            }

            if (timingLineIdx === -1) return;

            const match = lines[timingLineIdx].match(timingRegex);
            if (!match) return;

            const startStr = match[1].replace('.', ',');
            const endStr = match[2].replace('.', ',');
            const start = this.parseTimestampToSeconds(startStr);
            const end = this.parseTimestampToSeconds(endStr);
            
            // Text is everything after the timing line
            let text = lines.slice(timingLineIdx + 1).join('\n').trim();
            
            // Sửa lỗi: Loại bỏ timeline lạc vào trong text
            text = text.replace(timingRegex, '').trim();
            // Loại bỏ các dòng chỉ có số (STT bị lạc)
            text = text.split('\n').filter(line => !/^\d+$/.test(line.trim())).join('\n').trim();

            if (text && text.length > 0) {
                items.push({ index: 0, start, end, text });
            }
        });

        if (items.length === 0) return content;

        // 1. Sort by start time
        items.sort((a, b) => a.start - b.start);

        // 2. Fix overlaps and durations
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Ensure end >= start
            if (item.end <= item.start) {
                item.end = item.start + 2.0; 
            }

            // Check overlap with next item
            if (i < items.length - 1) {
                const nextItem = items[i + 1];
                if (item.end > nextItem.start) {
                    item.end = Math.max(item.start + 0.1, nextItem.start - 0.05);
                }
            }
        }

        // 3. Re-build SRT string
        return items.map((item, idx) => {
            return `${idx + 1}\n${this.secondsToTimestamp(item.start)} --> ${this.secondsToTimestamp(item.end)}\n${item.text}`;
        }).join('\n\n');
    }
    
    public static async translateSrtContent(
        content: string, 
        translator: (text: string) => Promise<string>,
        options: { batchSize?: number; concurrency?: number; onProgress?: (progress: number) => void } = {}
    ): Promise<string> {
        const { batchSize = 5, concurrency = 3, onProgress } = options;
        const blocks = content.trim().split(/\n\s*\n/);
        const translatedBlocks: string[] = new Array(Math.ceil(blocks.length / batchSize));
        
        const batches: string[][] = [];
        for (let i = 0; i < blocks.length; i += batchSize) {
            batches.push(blocks.slice(i, i + batchSize));
        }

        let completedBatches = 0;

        // Process batches with limited concurrency
        const processBatch = async (batchIdx: number) => {
            const batch = batches[batchIdx];
            const batchContent = batch.join('\n\n');
            
            try {
                const translatedBatch = await translator(batchContent);
                translatedBlocks[batchIdx] = translatedBatch;
            } catch (error) {
                console.error(`Dịch batch ${batchIdx} thất bại:`, error);
                translatedBlocks[batchIdx] = batchContent; // Giữ nguyên nếu lỗi
            }
            
            completedBatches++;
            if (onProgress) {
                onProgress(Math.floor((completedBatches / batches.length) * 100));
            }
        };

        // Run batches in parallel batches
        for (let i = 0; i < batches.length; i += concurrency) {
            const currentBatchGroup = [];
            for (let j = 0; j < concurrency && (i + j) < batches.length; j++) {
                currentBatchGroup.push(processBatch(i + j));
            }
            await Promise.all(currentBatchGroup);
        }
        
        return translatedBlocks.join('\n\n');
    }

    public static parseSrt(content: string): Array<{ text: string; startTime: number; endTime: number; timestamp: string }> {
        // SRT Parser: Sequence (optional, can be on same line), Timing, Text, empty line
        // Improved regex to handle index on same line and more flexible spacing
        const srtRegex = /(?:(\d+)\s+)?(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\r?\n([\s\S]*?)(?=\r?\n\s*\r?\n|\r?\n?$)/g;
        const items: Array<{ text: string; startTime: number; endTime: number; timestamp: string }> = [];
        let match;
        
        while ((match = srtRegex.exec(content)) !== null) {
            const start = match[2].replace('.', ',');
            const end = match[3].replace('.', ',');
            let text = match[4].replace(/<[^>]*>/g, '').trim();
            
            // Post-cleaning: remove timeline artifacts if they somehow leaked into text
            text = text.replace(/\d{1,2}:\d{2}:\d{2}[.,]\d{3}.*-->.*\d{1,2}:\d{2}:\d{2}[.,]\d{3}/g, '');
            text = text.replace(/\d{1,2}:\d{2}:\d{2}[.,]\d{3}/g, '');
            
            // Clean leading indices from each line
            text = text.split('\n').map(line => line.replace(/^\d+[\s.-]+/, '').trim())
                       .filter(l => l.length > 0)
                       .join('\n').trim();

            text = text.replace(/\r?\n/g, ' ').trim();

            if (text && text.length > 0) {
                items.push({ 
                    text, 
                    startTime: this.parseTimestampToSeconds(start),
                    endTime: this.parseTimestampToSeconds(end),
                    timestamp: start 
                });
            }
        }
        
        if (items.length === 0) {
            // Fallback: try simple split if regex fails
            const lines = content.split(/\r?\n\r?\n/);
            lines.forEach(block => {
                const blockContent = block.trim();
                if (!blockContent) return;
                
                const timingRegex = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/;
                const timingMatch = blockContent.match(timingRegex);
                if (timingMatch) {
                    const startTimeStr = timingMatch[1];
                    const endTimeStr = timingMatch[2];
                    
                    const linesInBlock = blockContent.split(/\r?\n/);
                    const timingLineIdx = linesInBlock.findIndex(line => timingRegex.test(line));
                    
                    if (timingLineIdx !== -1 && timingLineIdx + 1 < linesInBlock.length) {
                        const text = linesInBlock.slice(timingLineIdx + 1).join(' ').replace(/<[^>]*>/g, '').trim();
                        if (text) {
                            items.push({ 
                                text, 
                                startTime: this.parseTimestampToSeconds(startTimeStr),
                                endTime: this.parseTimestampToSeconds(endTimeStr),
                                timestamp: startTimeStr 
                            });
                        }
                    }
                }
            });
        }
        return items;
    }

    public static async processFromFile(file: File): Promise<string> {
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onerror = () => reject(new Error(`Đọc file .${extension} thất bại`));

            if (extension === 'txt') {
                 reader.onload = (e) => {
                    resolve(e.target?.result as string);
                };
                reader.readAsText(file);
            } else if (extension === 'srt') {
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    resolve(content);
                };
                reader.readAsText(file);
            } else if (extension === 'docx') {
                if (typeof mammoth === 'undefined') {
                    return reject(new Error('Thư viện xử lý DOCX (mammoth.js) chưa được tải.'));
                }
                reader.onload = async (e) => {
                    try {
                        const arrayBuffer = e.target?.result as ArrayBuffer;
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        resolve(result.value);
                    } catch (err) {
                        reject(new Error('Phân tích file .docx thất bại.'));
                    }
                };
                reader.readAsArrayBuffer(file);
            } else if (extension === 'epub') {
                reader.onload = async (e) => {
                    try {
                        const arrayBuffer = e.target?.result as ArrayBuffer;
                        const zip = await JSZip.loadAsync(arrayBuffer);
                        
                        // 1. Find the rootfile in container.xml
                        const containerXml = await zip.file('META-INF/container.xml')?.async('string');
                        if (!containerXml) throw new Error('Không tìm thấy container.xml');
                        
                        const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
                        if (!rootfileMatch) throw new Error('Không xác định được root file');
                        
                        const opfPath = rootfileMatch[1];
                        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
                        const opfXml = await zip.file(opfPath)?.async('string');
                        if (!opfXml) throw new Error('Không thể đọc file .opf');
                        
                        // 2. Parse OPF to get manifest and spine
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(opfXml, "text/xml");
                        
                        const items: { [id: string]: string } = {};
                        const manifestItems = xmlDoc.getElementsByTagName('item');
                        for (let i = 0; i < manifestItems.length; i++) {
                            const item = manifestItems[i];
                            const id = item.getAttribute('id');
                            const href = item.getAttribute('href');
                            if (id && href) items[id] = href;
                        }
                        
                        const spineItems = xmlDoc.getElementsByTagName('itemref');
                        let fullText = '';
                        
                        for (let i = 0; i < spineItems.length; i++) {
                            const idref = spineItems[i].getAttribute('idref');
                            if (idref && items[idref]) {
                                const filePath = opfDir + items[idref];
                                const htmlContent = await zip.file(filePath)?.async('string');
                                if (htmlContent) {
                                    // Basic HTML to TXT conversion
                                    const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
                                    // Remove scripts and styles
                                    const scripts = htmlDoc.getElementsByTagName('script');
                                    const styles = htmlDoc.getElementsByTagName('style');
                                    while (scripts.length > 0) scripts[0].parentNode?.removeChild(scripts[0]);
                                    while (styles.length > 0) styles[0].parentNode?.removeChild(styles[0]);
                                    
                                    fullText += (htmlDoc.body.textContent || htmlDoc.body.innerText || '') + '\n\n';
                                }
                            }
                        }
                        
                        resolve(fullText.trim());
                    } catch (err) {
                        reject(new Error(`Phân tích file .epub thất bại: ${(err as Error).message}`));
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error(`Định dạng tệp không được hỗ trợ: .${extension}`));
            }
        });
    }
}
