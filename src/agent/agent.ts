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
    const relevantDocs = await vectorStore.similaritySearch(state.question, 2);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n");
    return { context };
};

const generate = async (state: typeof StateAnnotation.State) => {
    const systemMessage = new SystemMessage(
        `You are Rhea, a helpful AI assistant. Answer the user's question based on the provided context and conversation history.\n\nContext:\n${state.context}`
    );
    
    const messages: BaseMessage[] = [
        systemMessage,
        ...state.history,
        new HumanMessage(state.question),
    ];

    const result = await model.invoke(messages);
    return { answer: result };
};

export function getAgent() {
    const workflow = new StateGraph(StateAnnotation)
        .addNode("retrieve", retrieve)
        .addNode("generate", generate)
        .addEdge(START, "retrieve")
        .addEdge("retrieve", "generate")
        .addEdge("generate", END)
        .compile({ checkpointer });

    return workflow;
}
