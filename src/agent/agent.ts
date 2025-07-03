import {
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
} from "@langchain/core/messages";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { model } from "../config/config";
import { vectorStore, checkpointer } from "../db/pg";

const StateAnnotation = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<string>,
    answer: Annotation<AIMessage>,
    history: Annotation<BaseMessage[]>({
        reducer: (left, right) => left.concat(right),
        default: () => [],
    }),
});

const retrieve = async (state: typeof StateAnnotation.State) => {
    console.log(`🔍 Retrieving context for: "${state.question}"`);
    const relevantDocs = await vectorStore.similaritySearch(state.question, 2);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n");
    console.log(`📄 Retrieved ${relevantDocs.length} relevant documents`);
    return { context };
};

const generate = async (state: typeof StateAnnotation.State) => {
    console.log(`🧠 Generating response with context and history`);

    const systemMessage = new SystemMessage(
`You are Rhea, a helpful AI assistant. Based on the conversation context, provide a clear and helpful response to the user.

**Context from previous conversations:**
${state.context}`
    );
    
    const messages: BaseMessage[] = [
        systemMessage,
        ...state.history,
        new HumanMessage(state.question),
    ];

    const result = await model.invoke(messages);
    console.log(`✅ Generated final response`);
    return { answer: result };
};

export function getAgent() {
    const workflow = new StateGraph(StateAnnotation)
        .addNode("retrieve", retrieve)
        .addNode("generate", generate)
        .addEdge(START, "retrieve")
        .addEdge("retrieve", "generate")
        .addEdge("generate", END);

    const graph = workflow.compile({ checkpointer });

    return graph;
}
