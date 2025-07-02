import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-exp-03-07",
    apiKey: process.env.GEMINI_API_KEY,
});
