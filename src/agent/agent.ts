import {
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { model } from "../config/config";
import { vectorStore, checkpointer } from "../db/pg";
import { LangchainToolSet } from "composio-core";
import { type DynamicStructuredTool } from "@langchain/core/tools";

const toolset = new LangchainToolSet({ apiKey: process.env.COMPOSIO_API_KEY });

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
    
    // Get available tools
    const availableTools = await toolset.getTools();
    const modelWithTools = model.bindTools(availableTools);

    const systemMessage = new SystemMessage(
        `You are Rhea, a helpful AI assistant with access to powerful tools. You can:

🔧 **Available Tools:**
- **Email**: Check, send, and manage Gmail
- **Calendar**: Schedule, view, and manage Google Calendar events
- **Documents**: Create, edit, and manage Google Docs and Sheets
- **File Management**: Access and organize Google Drive files
- **Communication**: Send messages via Discord
- **Project Management**: Manage tasks and projects in Notion and Linear
- **Development**: Interact with GitHub repositories

📋 **Instructions:**
- Answer questions based on the provided context and conversation history
- Use tools when the user requests actions (checking email, scheduling, file management, etc.)
- Be proactive about suggesting tool usage when relevant
- Always be helpful and informative

🔍 **Context from previous conversations:**
${state.context}

Remember: You have access to the user's connected accounts through Composio tools. Use them when requested!`
    );
    
    const messages: BaseMessage[] = [
        systemMessage,
        ...state.history,
        new HumanMessage(state.question),
    ];

    console.log(`📨 Sending ${messages.length} messages to model (including system prompt and history)`);
    const result = await modelWithTools.invoke(messages);
    console.log(`✅ Generated response. Has tool calls: ${(result.tool_calls?.length || 0) > 0}`);
    return { answer: result };
};

const shouldContinue = (state: typeof StateAnnotation.State) => {
    const toolCalls = state.answer?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
        console.log(`🔧 Tool calls detected: ${toolCalls.map(tc => tc.name).join(', ')}`);
        return "tools";
    }
    console.log(`✨ No tool calls, ending conversation`);
    return END;
};

const toolNode = async (state: typeof StateAnnotation.State) => {
    console.log(`🛠️ Executing tools...`);
    const toolCalls = state.answer?.tool_calls || [];
    const availableTools = await toolset.getTools();
    const toolMap: Record<string, DynamicStructuredTool> = availableTools.reduce((acc: Record<string, DynamicStructuredTool>, tool: DynamicStructuredTool) => {
        acc[tool.name] = tool;
        return acc;
    }, {});

    const toolMessages: ToolMessage[] = [];
    for (const toolCall of toolCalls) {
        const tool = toolMap[toolCall.name];
        if (tool && toolCall.id) {
            try {
                console.log(`🔧 Executing tool: ${toolCall.name} with args:`, toolCall.args);
                const output = await tool.invoke(toolCall.args);
                console.log(`✅ Tool ${toolCall.name} completed successfully`);
                toolMessages.push(new ToolMessage({
                    content: typeof output === 'string' ? output : JSON.stringify(output),
                    tool_call_id: toolCall.id,
                }));
            } catch (error) {
                console.error(`❌ Tool ${toolCall.name} failed:`, error);
                toolMessages.push(new ToolMessage({
                    content: `Error executing ${toolCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    tool_call_id: toolCall.id,
                }));
            }
        } else {
            console.warn(`⚠️ Tool not found or missing ID: ${toolCall.name}`);
        }
    }

    return { history: toolMessages };
};

const generateAfterTools = async (state: typeof StateAnnotation.State) => {
    console.log(`🧠 Generating final response after tool execution`);
    
    const systemMessage = new SystemMessage(
        `You are Rhea, a helpful AI assistant. Based on the tool outputs and conversation context, provide a clear and helpful response to the user.

🔍 **Context from previous conversations:**
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
        .addNode("tools", toolNode)
        .addNode("generate_after_tools", generateAfterTools)
        .addEdge(START, "retrieve")
        .addEdge("retrieve", "generate")
        .addConditionalEdges("generate", shouldContinue, {
            "tools": "tools",
            [END]: END,
        })
        .addEdge("tools", "generate_after_tools")
        .addEdge("generate_after_tools", END)
        .compile({ checkpointer });

    return workflow;
}
