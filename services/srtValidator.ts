
export interface SrtBlock {
    index: number;
    startTime: string;
    endTime: string;
    text: string;
    raw: string;
    startMs: number;
    endMs: number;
}

export interface SrtError {
    type: 'sequence' | 'overlap' | 'duration' | 'format' | 'content';
    message: string;
    blockIndex: number;
}

export class SrtValidator {
    static timeToMs(timeStr: string): number {
        const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!match) return 0;
        const [_, h, m, s, ms] = match;
        return (parseInt(h) * 3600000) + (parseInt(m) * 60000) + (parseInt(s) * 1000) + parseInt(ms);
    }

    static msToTime(ms: number): string {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const mil = ms % 1000;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${mil.toString().padStart(3, '0')}`;
    }

    static parse(content: string): SrtBlock[] {
        const blocks: SrtBlock[] = [];
        const rawBlocks = content.trim().split(/\n\s*\n/);

        rawBlocks.forEach((raw, i) => {
            const lines = raw.trim().split('\n');
            if (lines.length < 2) return;

            let indexStr = lines[0].trim();
            let timeLine = lines[1].trim();
            let textLines = lines.slice(2);

            // Handle cases where index might be missing or merged
            if (!timeLine.includes('-->')) {
                // Try to find timeline in next line
                const foundIndex = lines.findIndex(l => l.includes('-->'));
                if (foundIndex !== -1) {
                    timeLine = lines[foundIndex].trim();
                    textLines = lines.slice(foundIndex + 1);
                }
            }

            const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
            if (timeMatch) {
                const startMs = this.timeToMs(timeMatch[1]);
                const endMs = this.timeToMs(timeMatch[2]);
                blocks.push({
                    index: parseInt(indexStr) || (blocks.length + 1),
                    startTime: timeMatch[1],
                    endTime: timeMatch[2],
                    text: textLines.join('\n').trim(),
                    raw,
                    startMs,
                    endMs
                });
            }
        });

        return blocks;
    }

    static validate(blocks: SrtBlock[]): SrtError[] {
        const errors: SrtError[] = [];
        let lastEndMs = -1;

        blocks.forEach((block, i) => {
            // 1. Sequence Check
            if (block.index !== i + 1) {
                errors.push({
                    type: 'sequence',
                    message: `Số thứ tự sai: Hiện tại là ${block.index}, nên là ${i + 1}`,
                    blockIndex: i
                });
            }

            // 2. Timeline Logic Check
            if (block.startMs >= block.endMs) {
                errors.push({
                    type: 'format',
                    message: `Thời gian bắt đầu (${block.startTime}) lớn hơn hoặc bằng thời gian kết thúc (${block.endTime})`,
                    blockIndex: i
                });
            }

            // 3. Overlap Check
            if (block.startMs < lastEndMs) {
                errors.push({
                    type: 'overlap',
                    message: `Bị đè thời gian với subtitle trước đó`,
                    blockIndex: i
                });
            }

            // 4. Excessive Duration Check (e.g. > 10s is usually weird for a single line)
            if (block.endMs - block.startMs > 15000) {
                errors.push({
                    type: 'duration',
                    message: `Độ dài sub quá lâu (${Math.round((block.endMs - block.startMs) / 1000)}s)`,
                    blockIndex: i
                });
            }

            // 5. Mixed Content Check (timeline in text)
            if (block.text.includes('-->') || block.text.match(/\d{2}:\d{2}:\d{2}/)) {
                errors.push({
                    type: 'content',
                    message: `Nội dung chứa lẫn ký tự thời gian hoặc timeline`,
                    blockIndex: i
                });
            }

            lastEndMs = block.endMs;
        });

        return errors;
    }

    static fix(blocks: SrtBlock[]): SrtBlock[] {
        const fixed: SrtBlock[] = [];
        let curTimeMs = 0;

        blocks.forEach((block, i) => {
            const duration = Math.max(500, Math.min(10000, block.endMs - block.startMs));
            
            // Re-sequence
            const index = i + 1;
            
            // Fix overlapping: Ensure start is at least lastEnd + 10ms
            let startMs = block.startMs;
            if (startMs < curTimeMs) {
                startMs = curTimeMs + 50;
            }

            // Clean text from timeline leaks
            let text = block.text.split('\n').filter(line => !line.includes('-->') && !line.match(/^\d{2}:\d{2}:\d{2},\d{3}/)).join('\n');

            const endMs = startMs + duration;
            fixed.push({
                ...block,
                index,
                startMs,
                endMs,
                startTime: this.msToTime(startMs),
                endTime: this.msToTime(endMs),
                text
            });

            curTimeMs = endMs;
        });

        return fixed;
    }

    static stringify(blocks: SrtBlock[]): string {
        return blocks.map(b => `${b.index}\n${b.startTime} --> ${b.endTime}\n${b.text}`).join('\n\n');
    }
}
