import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateBookQuestions(title: string, author: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 3 insightful questions about the book "${title}" by ${author} to verify someone has read it. Return them in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
          },
          required: ["question"],
        },
      },
    },
  });

  return JSON.parse(response.text);
}

export async function generateBookLessons(title: string, author: string, answers: { question: string, answer: string }[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the book "${title}" by ${author} and these reading reflections: ${JSON.stringify(answers)}, generate 5 short, impactful life lessons or wisdom nuggets from this book. Return them in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  return JSON.parse(response.text);
}
