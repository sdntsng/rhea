import os
import httpx
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class MCPToolInput(BaseModel):
    service: str = Field(..., description="The name of the MCP service to call (e.g., 'gmail', 'notion').")
    action: str = Field(..., description="The action to perform on the service.")
    params: Dict[str, Any] = Field({}, description="The parameters for the action.")

class MCPService:
    def __init__(self, name: str, url: str):
        self.name = name
        self.url = url
        self.client = httpx.AsyncClient()

    async def call(self, action: str, params: Dict[str, Any]) -> Any:
        try:
            response = await self.client.post(
                self.url,
                json={"action": action, "params": params},
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling MCP service {self.name}: {e.response.status_code} - {e.response.text}")
            return {"error": f"Failed to call MCP service: {e.response.status_code}"}
        except Exception as e:
            logger.error(f"Error calling MCP service {self.name}: {e}")
            return {"error": "An unexpected error occurred while calling the MCP service."}

class MCPManager:
    def __init__(self):
        self.services: Dict[str, MCPService] = {}
        self._discover_services()

    def _discover_services(self):
        logger.info("Discovering MCP services from environment variables...")
        for key, value in os.environ.items():
            if key.lower().startswith("rhea_") and key.lower().endswith("_mcp_url") and value:
                service_name = key.lower().replace("rhea_", "").replace("_mcp_url", "")
                self.services[service_name] = MCPService(name=service_name, url=value)
                logger.info(f"Discovered and registered MCP service: {service_name}")

    def get_service(self, name: str) -> Optional[MCPService]:
        return self.services.get(name)

    def get_available_services(self) -> List[str]:
        return list(self.services.keys())

# Global instance of the MCP Manager
mcp_manager = MCPManager()

async def call_mcp_tool(service: str, action: str, params: Dict[str, Any]) -> str:
    """
    Wrapper function to be used by the LangChain agent to call an MCP service.
    """
    mcp_service = mcp_manager.get_service(service)
    if not mcp_service:
        return f"Error: MCP service '{service}' not found or configured."
    
    result = await mcp_service.call(action, params)
    return str(result)

def get_mcp_tools() -> List:
    """
    Generates a list of LangChain tools for each discovered MCP service.
    """
    tools = []
    for service_name in mcp_manager.get_available_services():
        tool_name = f"mcp_{service_name}"
        tool_description = f"Calls the {service_name} MCP service. Provide the 'action' and 'params' to use this tool."
        
        # This function will be the implementation of the tool
        async def _run_tool(action: str, params: Dict[str, Any]) -> str:
            return await call_mcp_tool(service_name, action, params)

        tools.append({
            "name": tool_name,
            "description": tool_description,
            "func": _run_tool,
            "args_schema": MCPToolInput
        })
    return tools

if __name__ == '__main__':
    # For testing purposes
    print("MCP Services discovered:")
    for service in mcp_manager.get_available_services():
        print(f"- {service}") 