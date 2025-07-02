import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, END, StateGraphArgs } from "@langchain/langgraph";
import { model } from "../config/config";
import { vectorStore, checkpointer } from "../db/pg";
import { Composio } from "composio-core";

const composio = new Composio();

interface AgentState {
    question: string;
    context: string;
    answer: string;
    history: BaseMessage[];
    tools: any[];
}

const graphState: StateGraphArgs<AgentState>['channels'] = {
    question: { value: (x, y) => y, default: () => "" },
    context: { value: (x, y) => y, default: () => "" },
    answer: { value: (x, y) => y, default: () => "" },
    history: { value: (x, y) => x.concat(y), default: () => [] },
    tools: { value: (x, y) => y, default: () => [] }
};

const retrieve = async (state: AgentState) => {
    const relevantDocs = await vectorStore.similaritySearch(state.question, 2);
    const context = relevantDocs.map(doc => doc.pageContent).join('\n');
    return { ...state, context };
};

const generate = async (state: AgentState) => {
    const tools = await composio.getTools();
    const modelWithTools = model.bindTools(tools);

    const prompt = `
You are Rhea, a helpful AI assistant. Answer the user's question based on the provided context and conversation history. You have access to the following tools:

{tools}

Context:
${state.context}

History:
${state.history.map(msg => msg.content).join('\n')}

Question:
${state.question}
`;
    const result = await modelWithTools.invoke(prompt);
    return { ...state, answer: result.content.toString(), tools: result.tool_calls };
};

const toolNode = async (state: AgentState) => {
    const toolCalls = state.tools;
    const toolResponses = await composio.executeTools(toolCalls);
    
    return { ...state, answer: toolResponses.join('\n'), tools: [] };
}

const shouldContinue = (state: AgentState) => {
    if (state.tools && state.tools.length > 0) {
        return "toolNode";
    }
    return END;
};

const graph = new StateGraph({ channels: graphState })
    .addNode("retrieve", retrieve)
    .addNode("generate", generate)
    .addNode("toolNode", toolNode)
    .addEdge("retrieve", "generate")
    .addConditionalEdges("generate", shouldContinue, {
        [END]: END,
        toolNode: "toolNode",
    })
    .addEdge("toolNode", "generate");

graph.setEntryPoint("retrieve");

export const getAgent = async () => {
    return graph.compile({ checkpointer });
}
