import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, END, StateGraphArgs } from "@langchain/langgraph";
import { model } from "../config/config";
import { vectorStore, checkpointer } from "../db/pg";

interface AgentState {
    question: string;
    context: string;
    answer: string;
    history: BaseMessage[];
}

const graphState: StateGraphArgs<AgentState>['channels'] = {
    question: { value: (x, y) => y, default: () => "" },
    context: { value: (x, y) => y, default: () => "" },
    answer: { value: (x, y) => y, default: () => "" },
    history: { value: (x, y) => x.concat(y), default: () => [] }
};

const retrieve = async (state: AgentState) => {
    const relevantDocs = await vectorStore.similaritySearch(state.question, 2);
    const context = relevantDocs.map(doc => doc.pageContent).join('\n');
    return { ...state, context };
};

const generate = async (state: AgentState) => {
    const prompt = `
You are Rhea, a helpful AI assistant. Answer the user's question based on the provided context and conversation history.

Context:
${state.context}

History:
${state.history.map(msg => msg.content).join('\n')}

Question:
${state.question}
`;
    const result = await model.invoke(prompt);
    return { ...state, answer: result.content.toString() };
};

const graph = new StateGraph({ channels: graphState })
    .addNode("retrieve", retrieve)
    .addNode("generate", generate)
    .addEdge("retrieve", "generate")
    .addEdge("generate", END);

graph.setEntryPoint("retrieve");

export const getAgent = async () => {
    return graph.compile({ checkpointer });
}
