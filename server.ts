import express from "express";
import path from "path";
import { Communicate, listVoices } from "edge-tts-ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set request payload size limits
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Get Voices
  app.get("/api/voices", async (req, res) => {
    try {
      const voices = await listVoices();
      res.json({ success: true, voices });
    } catch (error: any) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to load voices" });
    }
  });

  // Resilient TTS synthesis with automatic retries and exponential backoff
  async function synthesizeWithRetry(
    text: string,
    options: { voice: string; rate: string; volume: string; pitch: string },
    maxRetries = 3
  ): Promise<{ audioBuffer: Buffer }> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const communicate = new Communicate(text, {
          voice: options.voice,
          rate: options.rate,
          volume: options.volume,
          pitch: options.pitch,
        });

        const chunks: Uint8Array[] = [];

        for await (const chunk of communicate.stream()) {
          if (chunk.type === "audio") {
            chunks.push(chunk.data);
          }
        }

        if (chunks.length === 0) {
          throw new Error("No audio chunks generated from the stream");
        }

        return {
          audioBuffer: Buffer.concat(chunks),
        };
      } catch (err: any) {
        attempt++;
        const errorMsg = err?.message || String(err);
        console.warn(`[EdgeTTS API Attempt ${attempt}/${maxRetries} failed] Text: "${text.substring(0, 40)}...". Error: ${errorMsg}`);
        
        if (attempt >= maxRetries) {
          throw err;
        }

        const backoffDelay = Math.pow(2, attempt) * 500 + Math.random() * 400;
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    throw new Error("Synthesis failed after maximum retries");
  }

  // Semaphore to enforce sequential execution of EdgeTTS requests
  class Semaphore {
    private active = 0;
    private queue: (() => void)[] = [];

    constructor(private maxConcurrency: number) {}

    async acquire(): Promise<void> {
      if (this.active < this.maxConcurrency) {
        this.active++;
        return;
      }
      return new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    release() {
      this.active--;
      if (this.queue.length > 0) {
        this.active++;
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  const edgeTtsSemaphore = new Semaphore(1);

  // API Route: Synthesize Text
  app.post("/api/tts", async (req, res) => {
    await edgeTtsSemaphore.acquire();
    try {
      const { text, voice, rate, volume, pitch } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ success: false, error: "Text is required" });
      }

      const speakText = text.trim();
      const result = await synthesizeWithRetry(speakText, {
        voice: voice || "vi-VN-HoaiMyNeural",
        rate: rate || "+0%",
        volume: volume || "+0%",
        pitch: pitch || "+0Hz"
      });

      // Spacer delay to buffer successive WebSocket negotiations smoothly
      await new Promise(resolve => setTimeout(resolve, 150));

      res.json({
        success: true,
        audioBase64: result.audioBuffer.toString("base64")
      });
    } catch (error: any) {
      console.error("Error in synthesis:", error);
      res.status(500).json({ success: false, error: error.message || "Internal synthesis error" });
    } finally {
      edgeTtsSemaphore.release();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
