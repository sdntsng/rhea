import os
import requests
import json
from mcp_config import mcp_config

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

def execute_gemini_request(contents, tools=None):
    """Executes a request to the Gemini API."""
    payload = {"contents": contents}
    if tools:
        payload["tools"] = tools
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error calling Gemini API: {e}")
        # It's useful to see the response body if the request fails
        if e.response:
            print(f"Response body: {e.response.text}")
        return None

async def process_message(user_message: str) -> str:
    """Processes the user's message, detects the service, and returns a response."""
    user_message_lower = user_message.lower()
    print(f"Processing user message: {user_message}")

    selected_service = None
    service_keywords = {
        'rhea-gmail': ['email', 'send', 'mail', 'gmail', 'message', 'compose'],
        'rhea-notion': ['notion', 'note', 'page', 'create', 'document', 'database']
    }

    for service_key, keywords in service_keywords.items():
        for keyword in keywords:
            if keyword in user_message_lower:
                selected_service = service_key
                print(f"Service detected: {service_key} (matched keyword: {keyword})")
                break
        if selected_service:
            break

    if not selected_service:
        print(f"No service detected for message: {user_message}")
        # Use Gemini for a conversational response if no tool is detected
        contents = [{"parts": [{"text": user_message}]}]
        gemini_response = execute_gemini_request(contents)
        if gemini_response:
            # Assuming the response format has a 'text' part in the first candidate's content
            try:
                return gemini_response['candidates'][0]['content']['parts'][0]['text']
            except (KeyError, IndexError) as e:
                print(f"Error parsing Gemini response: {e}")
                return "I'm sorry, I couldn't process that. Could you try rephrasing?"
        else:
            return "I am having trouble connecting to my brain right now. Please try again later."


    print(f"Selected service: {selected_service}")

    try:
        endpoint = mcp_config[selected_service]["endpoint"]
        print(f"Fetching tools from: {endpoint}")

        response = requests.post(
            endpoint,
            json={"jsonrpc": "2.0", "method": "list_tools", "id": 1},
            headers={'Accept': 'application/json, text/event-stream'}
        )
        response.raise_for_status()
        data = response.json()
        print(f"MCP response: {data}")

        if not data.get("result") or not data["result"].get("tools"):
            print("No tools available from MCP server")
            return f"I found the {selected_service} service but no tools are available."

        mcp_tools = data["result"]["tools"]
        # Reformat tools for Gemini API
        gemini_tools = [{"function_declarations": mcp_tools}]

        print(f"Found {len(mcp_tools)} tools: {[t.get('name') for t in mcp_tools]}")

        print("Calling model with tools...")
        contents = [{"parts": [{"text": user_message}]}]
        
        gemini_response = execute_gemini_request(contents, tools=gemini_tools)

        if not gemini_response:
            return "I had an issue calling the AI model. Please try again."

        # Check for function call in response
        response_part = gemini_response.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0]
        if 'function_call' in response_part:
            function_call = response_part['function_call']
            tool_name = function_call['name']
            tool_args = function_call['args']

            print(f"Executing tool {tool_name} with args: {tool_args}")
            tool_response_data = requests.post(
                endpoint,
                json={
                    "jsonrpc": "2.0",
                    "method": "execute_tool",
                    "params": {"tool_name": tool_name, "parameters": tool_args},
                    "id": 1
                },
                headers={'Accept': 'application/json, text/event-stream'}
            ).json()
            
            tool_output = tool_response_data.get('result', {})
            
            # Send the tool output back to Gemini
            contents = [
                {"parts": [{"text": user_message}]},
                {"parts": [{"function_call": function_call}]},
                {"parts": [{"function_response": {"name": tool_name, "response": tool_output}}]}
            ]
            
            final_response = execute_gemini_request(contents)
            if final_response:
                try:
                    return final_response['candidates'][0]['content']['parts'][0]['text']
                except (KeyError, IndexError):
                    return "I executed the tool, but I'm having trouble summarizing the result."
            else:
                 return "I executed the tool but ran into an error getting the final response."
        else:
            # It's a direct text response
            try:
                return response_part['text']
            except KeyError:
                return "I received an unexpected response from the model. Please try again."


    except requests.RequestException as e:
        print(f"Error with {selected_service}: {e}")
        return f"I encountered an error accessing {selected_service}. Please try again later."
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return "An unexpected error occurred. Please try again later." 