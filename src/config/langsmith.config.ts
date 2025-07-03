// LangSmith configuration for tracing and debugging
import { Client } from "langsmith";

// Initialize LangSmith client
export const langsmithClient = new Client({
    apiUrl: process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
    apiKey: process.env.LANGCHAIN_API_KEY,
});

// Project name for grouping traces
export const LANGSMITH_PROJECT = process.env.LANGCHAIN_PROJECT || "rhea-bot";

// Enable tracing by default in development
export const ENABLE_TRACING = process.env.LANGCHAIN_TRACING_V2 === "true"; 