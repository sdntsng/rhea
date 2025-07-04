import os
import logging
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import BaseTool
from langchain.tools.retriever import create_retriever_tool
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field
from app.db import get_retriever, add_document_from_text
from app.mcp_config import mcp_manager, call_mcp_tool, get_mcp_tools

logger = logging.getLogger(__name__)

class MCPToolInput(BaseModel):
    """Input schema for MCP tools."""
    service_name: str = Field(description="Name of the MCP service")
    tool_name: str = Field(description="Name of the tool to call")
    arguments: Dict[str, Any] = Field(description="Arguments for the tool")

class MCPTool(BaseTool):
    """A tool that can call MCP services."""
    
    name: str = "mcp_tool"
    description: str = "Call external services like Gmail, Notion, Google Sheets, etc. through MCP"
    args_schema: type = MCPToolInput
    
    async def _arun(self, service_name: str, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Execute the MCP tool call."""
        try:
            result = await call_mcp_tool(service_name, tool_name, arguments)
            return str(result)
        except Exception as e:
            logger.error(f"MCP tool call failed: {e}")
            return f"Error calling {service_name}.{tool_name}: {str(e)}"
    
    def _run(self, service_name: str, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Synchronous execution (not implemented for MCP)."""
        return "MCP tools require async execution"

class WeatherToolInput(BaseModel):
    """Input schema for weather tool."""
    city: str = Field(description="The city to get weather for")

class WeatherTool(BaseTool):
    """A simple weather tool for demonstration."""
    
    name: str = "get_weather"
    description: str = "Get current weather information for a city"
    args_schema: type = WeatherToolInput
    
    def _run(self, city: str) -> str:
        """Get weather for a city (mock implementation)."""
        # In a real implementation, you would call a weather API
        return f"The weather in {city} is sunny with 22°C temperature."
    
    async def _arun(self, city: str) -> str:
        """Async version of weather tool."""
        return self._run(city)

async def create_dynamic_tools() -> List[BaseTool]:
    """Create tools dynamically based on available MCP services."""
    tools = []
    
    # Add basic tools
    tools.append(WeatherTool())
    
    # Add memory/retrieval tool
    retriever = get_retriever(k_value=4)
    retriever_tool = create_retriever_tool(
        retriever,
        "search_conversation_history",
        "Search and retrieve relevant information from past conversations and stored knowledge.",
    )
    tools.append(retriever_tool)
    
    # Add MCP tool
    tools.append(MCPTool())
    
    return tools

async def create_agent_executor():
    """Create the agent executor with tools and memory."""
    
    # 1. Validate API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables")
    
    # 2. Define the LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-pro-latest",
        temperature=0.1,
        google_api_key=api_key,
        transport="rest",
        convert_system_message_to_human=True,
    )

    # 3. Create tools dynamically
    tools = await create_dynamic_tools()
    
    # 4. Get MCP service information for the system prompt
    try:
        available_services = mcp_manager.get_available_services()
    except Exception as e:
        logger.error(f"Failed to get MCP service info: {e}")
        available_services = []
    
    # 5. Create system prompt with MCP service information
    system_prompt = f"""You are Rhea, a helpful and intelligent assistant. You have access to various tools and services to help users with their tasks.

Available MCP Services: {', '.join(available_services) if available_services else 'None configured'}

Key capabilities:
- Search through conversation history and stored knowledge
- Get weather information
- Access external services like Gmail, Notion, Google Sheets, etc. through MCP
- Remember and learn from conversations

When using MCP services, you must use the specific tool for that service (e.g., 'mcp_gmail', 'mcp_notion'). The input for these tools requires an 'action' and a 'params' dictionary.

Always be helpful, accurate, and conversational. If you're unsure about something, ask for clarification."""

    # 6. Define the prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # 7. Create the Agent
    agent = create_tool_calling_agent(llm, tools, prompt)

    # 8. Create the Agent Executor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=3,
        memory=None,  # We manage memory manually
    )

    return agent_executor

async def handle_message(user_id: str, message_text: str, chat_history: list) -> str:
    """Handle an incoming message, invoke the agent, and manage memory."""
    
    try:
        # Create agent executor
        agent_executor = await create_agent_executor()

        # Invoke the agent with the current input and history
        response = await agent_executor.ainvoke({
            "input": message_text,
            "chat_history": chat_history
        })

        # Extract the agent's final response
        output_message = response.get("output", "I'm sorry, I encountered an error processing your request.")

        # Add the conversation to the vector store for long-term memory
        try:
            add_document_from_text(
                text=f"User: {message_text}",
                metadata={"user_id": user_id, "type": "human"}
            )
            add_document_from_text(
                text=f"Rhea: {output_message}",
                metadata={"user_id": user_id, "type": "ai"}
            )
        except Exception as e:
            logger.error(f"Failed to save conversation to memory: {e}")
            # Continue anyway, don't fail the entire request

        return output_message
        
    except Exception as e:
        logger.error(f"Error in handle_message: {e}", exc_info=True)
        return "I apologize, but I encountered an error while processing your request. Please try again."

if __name__ == "__main__":
    # Test the agent
    import asyncio
    
    async def test_agent():
        print("Testing agent...")
        
        # Test basic message
        response = await handle_message("test_user", "Hello, what can you help me with?", [])
        print(f"Response: {response}")
        
        # Test weather tool
        response = await handle_message("test_user", "What's the weather like in London?", [])
        print(f"Weather response: {response}")
        
        # Test MCP services info
        from app.mcp_config import get_mcp_service_info
        services = get_mcp_service_info()
        print(f"Configured MCP services: {list(services.keys())}")
    
    asyncio.run(test_agent())