import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    },
  },
  required: [
    "payeeName",
    "amountNumber",
    "amountWords",
    "date",
    "accountNumber",
    "chequeNumber",
    "confidenceScore",
  ],
};

const prompt =
  "Analyze this cheque image and extract the requested fields strictly in JSON format. IMPORTANT: The extracted date MUST be converted and formatted exactly as DD/MM/YYYY.";

type ModelResult = {
  success: boolean;
  data?: any;
  error?: string;
  latency: number;
  model: string;
};

async function runModel(model: string, imagePart: any): Promise<ModelResult> {
  const startTime = Date.now();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: chequeSchema,
        temperature: 0.1,
        topP: 0.1,
      },
    });
    return {
      success: true,
      data: JSON.parse(response.text || "{}"),
      latency: Date.now() - startTime,
      model,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
      latency: Date.now() - startTime,
      model,
    };
  }
}

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 });
    }

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || "image/jpeg",
      },
    };

    const liteResult = await runModel("gemini-3.1-flash-lite", imagePart);

    let flashResult: ModelResult | null = null;
    let confidence = 0;
    if (liteResult.success && liteResult.data && typeof liteResult.data.confidenceScore === "number") {
      confidence = liteResult.data.confidenceScore;
    }

    if (!liteResult.success || confidence < 90) {
      flashResult = await runModel("gemini-2.5-flash", imagePart);
    }

    return NextResponse.json({ liteResult, flashResult });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
