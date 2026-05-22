import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const chequeSchema = {
    type: Type.OBJECT,
    properties: {
      payeeName: {
        type: Type.STRING,
        description: "The name of the person or organization being paid (Pay to the order of).",
      },
      amountNumber: {
        type: Type.STRING,
        description: "The amount in numbers (e.g., 1000.00).",
      },
      amountWords: {
        type: Type.STRING,
        description: "The amount written in words.",
      },
      date: {
        type: Type.STRING,
        description: "The date written on the cheque. MUST be in DD/MM/YYYY format, converting it if necessary.",
      },
      accountNumber: {
        type: Type.STRING,
        description: "The account number printed on the cheque.",
      },
      chequeNumber: {
        type: Type.STRING,
        description: "The cheque number usually printed at the bottom of the cheque.",
      },
      confidenceScore: {
        type: Type.INTEGER,
        description: "The confidence score of the extraction from 0 to 100.",
      }
    },
    required: ["payeeName", "amountNumber", "amountWords", "date", "accountNumber", "chequeNumber", "confidenceScore"],
  };

  app.post("/api/extract", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      
      const imagePart = {
        inlineData: {
           data: imageBase64,
           mimeType: mimeType || "image/jpeg"
        }
      };

      const prompt = "Analyze this cheque image and extract the requested fields strictly in JSON format. IMPORTANT: The extracted date MUST be converted and formatted exactly as DD/MM/YYYY.";

      // Run both models in parallel for A/B testing
      const runModel = async (model: string) => {
        const startTime = Date.now();
        try {
           const response = await ai.models.generateContent({
             model: model,
             contents: { parts: [imagePart, { text: prompt }] },
             config: {
               responseMimeType: "application/json",
               responseSchema: chequeSchema,
               // Lower topP and temp for deterministic extraction
               temperature: 0.1,
               topP: 0.1
             }
           });
           const latency = Date.now() - startTime;
           return {
             success: true,
             data: JSON.parse(response.text || "{}"),
             latency,
             model
           };
        } catch (e: any) {
           return {
             success: false,
             error: e.message,
             latency: Date.now() - startTime,
             model
           };
        }
      };

      const liteResult = await runModel("gemini-3.1-flash-lite");

      let flashResult = null;
      let confidence = 0;
      
      if (liteResult.success && liteResult.data && typeof liteResult.data.confidenceScore === "number") {
         confidence = liteResult.data.confidenceScore;
      }

      // If confidence score is below 90, or extraction failed entirely, fallback to flash
      if (!liteResult.success || confidence < 90) {
         flashResult = await runModel("gemini-2.5-flash");
      }

      res.json({ liteResult, flashResult });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
