
import { GoogleGenAI } from "@google/genai";
import { keyManager } from "./keyManager";

class AIService {
    private getAIInstance(): GoogleGenAI {
        const apiKey = keyManager.getKey('translate');
        return new GoogleGenAI({ apiKey });
    }

    private getModel(): string {
        return keyManager.getSettings().geminiModel || "gemini-2.5-flash-lite";
    }

    public async optimizeTextForTTS(text: string): Promise<string> {
        const ai = this.getAIInstance();
        const modelName = this.getModel();

        const prompt = `
            Bạn là một chuyên gia biên tập nội dung cho Audio (TTS). 
            Nhiệm vụ: Sửa lỗi chính tả, ngữ pháp, các từ viết tắt và lỗi đánh máy trong văn bản dưới đây để khi đọc lên (TTS) sẽ mượt mà và tự nhiên nhất.
            
            Quy tắc:
            1. KHÔNG thay đổi nội dung, ý nghĩa của câu.
            2. Chuyển đổi các từ viết tắt thông dụng sang dạng đầy đủ (vd: "vn" -> "Việt Nam", "tp" -> "thành phố", "ko" -> "không").
            3. Đảm bảo các dấu câu được đặt đúng chỗ để bộ đọc TTS ngắt nghỉ tự nhiên.
            4. Trả về CHỈ văn bản đã được tối ưu, không kèm theo lời giải thích nào khác.

            Văn bản cần xử lý:
            "${text}"
        `;

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt
            });
            return response.text || text;
        } catch (error) {
            console.error("AI Optimization failed:", error);
            // Nếu lỗi do API Key, đánh dấu key lỗi
            keyManager.markKeyAsBad(keyManager.getKey('translate'));
            throw error;
        }
    }

    public async translateText(text: string, targetLang: string, sourceLang: string = "auto"): Promise<string> {
        const ai = this.getAIInstance();
        const modelName = this.getModel();

        const prompt = `
            Dịch đoạn văn bản sau sang ${targetLang}${sourceLang !== 'auto' ? ` từ ${sourceLang}` : ''}.
            Nếu là định dạng SRT, hãy giữ nguyên cấu trúc thời gian và số thứ tự, chỉ dịch nội dung văn bản.
            Đảm bảo giọng văn tự nhiên, phù hợp với văn hóa của ngôn ngữ đích.
            Trả về CHỈ văn bản đã dịch, không kèm giải thích.

            Văn bản:
            ${text}
        `;

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt
            });
            return response.text || text;
        } catch (error) {
            console.error("AI Translation failed:", error);
            keyManager.markKeyAsBad(keyManager.getKey('translate'));
            throw error;
        }
    }
}

export const aiService = new AIService();
