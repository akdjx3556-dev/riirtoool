import React from 'react';
import { TextProcessor } from '../services/textProcessor';

interface FileUploadProps {
    onFileProcessed: (content: string | Array<{ text: string; startTime: number; endTime: number; timestamp: string }>, file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed }) => {
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const content = await TextProcessor.processFromFile(file);
            onFileProcessed(content, file);
        } catch (err) {
            console.error((err as Error).message);
            alert(`Lỗi xử lý tệp: ${(err as Error).message}`);
        } finally {
            // Reset file input to allow uploading the same file again
            event.target.value = '';
        }
    };

    return (
        <div className="flex items-center">
            <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-full font-medium text-gray-400 hover:text-indigo-400 focus-within:outline-none p-2 hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".txt,.docx,.srt,.epub" />
            </label>
        </div>
    );
};
