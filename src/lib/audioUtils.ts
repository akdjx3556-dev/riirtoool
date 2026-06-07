
/**
 * Utility to convert AudioBuffer to WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const numSamples = buffer.length * numOfChan;
    const bufferArray = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(bufferArray);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + numSamples * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numOfChan * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numOfChan * 2, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, numSamples * 2, true);

    // write interleaved data
    const channels = [];
    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            let sample = channels[channel][i];
            // clamp
            sample = Math.max(-1, Math.min(1, sample));
            // scale to 16-bit signed integer
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
}

/**
 * Speech-optimized Overlap-Add (OLA) time stretching algorithm with energy normalization.
 * It speeds up or slows down the AudioBuffer while maintaining pitch preservation.
 */
export function stretchAudioBuffer(buffer: AudioBuffer, speed: number): AudioBuffer {
    if (Math.abs(speed - 1.0) < 0.01) {
        return buffer;
    }

    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const targetLength = Math.max(10, Math.floor(buffer.length / speed));
    
    // Create new audio buffer for stretched audio
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const outputBuffer = ctx.createBuffer(numOfChan, targetLength, sampleRate);
    
    const frameSize = 1024; // standard window size for speech analysis
    const synthHop = 256;  // synthesis hop size (fixed stride)
    const analHop = Math.round(synthHop * speed); // analysis hop size (dynamic based on speed)

    // Pre-calculate Hann window function to minimize spectral leakage
    const windowFunc = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
        windowFunc[i] = 0.5 * (1.0 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }

    // Process each channel independently
    for (let channel = 0; channel < numOfChan; channel++) {
        const inputData = buffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Weight accumulator to normalize overlapping windows
        const weightAccum = new Float32Array(targetLength);

        let inputPtr = 0;
        let outputPtr = 0;

        while (inputPtr + frameSize <= inputData.length && outputPtr + frameSize <= targetLength) {
            for (let i = 0; i < frameSize; i++) {
                const sampleVal = inputData[inputPtr + i] * windowFunc[i];
                outputData[outputPtr + i] += sampleVal;
                // Add square of window function to record overall accumulated energy
                weightAccum[outputPtr + i] += windowFunc[i] * windowFunc[i];
            }
            
            inputPtr += analHop;
            outputPtr += synthHop;
        }

        // Normalize weight to prevent amplitude modulation and maintain voice consistency
        for (let i = 0; i < targetLength; i++) {
            if (weightAccum[i] > 1e-4) {
                outputData[i] /= weightAccum[i];
            }
            // Strict amplitude clamping to prevent clipping/distortion
            if (outputData[i] > 1.0) outputData[i] = 1.0;
            if (outputData[i] < -1.0) outputData[i] = -1.0;
        }
    }

    try {
        ctx.close();
    } catch (e) {}

    return outputBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
