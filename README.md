# 🤖 Rhea - A Conversational AI with Memory

A production-ready Telegram bot with long-term memory capabilities using Python, LangChain, and `pgvector` for vector storage.

### Features
- **🧠 Long-term Memory**: Utilizes `pgvector` for robust similarity search across the entire conversation history.
- **🗣️ Conversational Context**: Maintains short-term memory for each user to keep track of the immediate conversational flow.
- **🛠️ Tool-Based Architecture**: Built with a modern LangChain agent that can use tools, starting with a powerful memory retrieval tool.
- **🐳 Dockerized**: Comes with `docker-compose` for easy, one-command, and reproducible deployments.
- **⚡️ Python Backend**: A fully asynchronous backend built with Python's `asyncio` and `python-telegram-bot`.

### Technology Stack
- **Backend**: Python
- **AI Framework**: LangChain
- **LLM**: Google Gemini (`gemini-1.5-pro-latest`)
- **Embeddings**: Google Gemini (`models/embedding-001`)
- **Vector Store**: PostgreSQL with `pgvector`
- **Containerization**: Docker, Docker Compose

---

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd rhea
    ```

2.  **Set up environment:**
    Copy the example `.env` file and fill in your API keys.
    ```bash
    cp .env.example .env
    ```

3.  **Start the services:**
    This command builds the Docker images and starts the bot and database containers.
    ```bash
    docker-compose up --build -d
    ```

### Configuration

Your `.env` file should contain the following keys for the bot to run:

| Environment Variable  | Description                                        |
| --------------------- | -------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | Your token from Telegram's @BotFather.             |
| `GOOGLE_API_KEY`      | Your Google AI API key for Gemini.                 |
| `POSTGRES_HOST`       | The hostname of the PostgreSQL database (e.g., `postgres`). |
| `POSTGRES_PORT`       | The port for the PostgreSQL database (e.g., `5432`). |
| `POSTGRES_DB`         | The name of the database (e.g., `rhea`).           |
| `POSTGRES_USER`       | The username for the database.                     |
| `POSTGRES_PASSWORD`   | The password for the database.                     |

---

## 🧠 How Memory and Intelligence Works

Rhea uses a dual-memory system to provide intelligent, context-aware responses. This architecture allows the bot to recall relevant information from distant conversations while keeping track of the current one.

### 📊 Architecture Overview

```mermaid
graph TD
    A[User Message] --> B["main.py: Handles Telegram Message"];
    B --> C["agent.py: Manages Short-Term History (In-Memory)"];
    C --> D["agent.py: Invokes Agent Executor"];
    D --> E{"LLM with Retriever Tool"};
    E -- "Needs Past Context?" --> F["db.py: Search pgvector"];
    F -- "Relevant History" --> E;
    E --> G["LLM Generates Final Response"];
    G --> H["db.py: Save User/Bot Messages to pgvector"];
    G --> I["main.py: Send Response to User"];
```

### 💾 Memory Systems

#### **1. Long-term Memory (`pgvector`)**

The core of Rhea's memory is its vector database, managed by `app/db.py`.

- **Storage**: After every interaction, both the user's message and the bot's final response are individually embedded into vectors and stored in a PostgreSQL table powered by the `pgvector` extension.
- **Retrieval**: The agent is equipped with a `retriever_tool`. When invoked, this tool embeds the user's current query and performs a similarity search against the vector database to find the most relevant pieces of conversation history, no matter how old.
- **Parameter**: The retriever is configured to fetch the **top 4** most relevant documents (`k=4`).

#### **2. Short-term Memory (In-memory)**

To maintain the flow of the current conversation, Rhea uses a simple in-memory cache, managed in `app/main.py`.

- **Storage**: A Python dictionary holds the last 10 turns of conversation history for each unique user ID.
- **Functionality**: This complete, ordered history is passed to the agent on every turn, ensuring it has the immediate context needed to handle multi-turn questions and follow-ups.
- **Lifecycle**: This memory is ephemeral and is cleared when the bot restarts.

### 🎯 System Prompting

The agent's behavior is guided by a central prompt in `app/agent.py`:

```python
# The core instruction given to the Gemini model
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant named Rhea. You have access to tools and a memory of past conversations. Your goal is to be as helpful as possible to the user."),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])
```
The `chat_history` placeholder is filled by the short-term memory cache, while the retriever tool provides access to the long-term memory on demand.

---

### Project Structure

The project is organized into a simple Python application structure.

```
rhea/
├── app/
│   ├── __init__.py    # Makes 'app' a Python package
│   ├── agent.py       # Core agent logic, tools, and prompting
│   ├── db.py          # pgvector connection, storage, and retrieval
│   └── main.py        # Telegram bot entrypoint and message handling
├── .env.example     # Environment variable template
├── docker-compose.yml # Docker service definitions for bot and postgres
├── Dockerfile       # Instructions to build the Python bot image
└── requirements.txt # Python package dependencies
```


# Rhea Assistant Project Structure

## Directory Layout

```
rhea-assistant/
├── .env                    # Environment variables
├── main.py                 # Main application entry point
├── requirements.txt        # Python dependencies
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # Docker image definition
├── README.md              # Project documentation
└── app/                   # Main application package
    ├── __init__.py
    ├── main.py            # Telegram bot main logic
    ├── agent.py           # LangChain agent with MCP integration
    ├── db.py              # Database and vector store management
    └── mcp_config.py      # MCP service configuration
```

## Key Features Implemented

### 1. Fixed Environment Variable Issues
- Changed `GOOGLE_API_KEY` to `GEMINI_API_KEY` throughout the codebase
- Added proper environment variable validation
- Fixed database connection parsing from `DATABASE_URL`

### 2. Enhanced Database Management
- Auto-creation of database and pgvector extension
- Proper connection string parsing from `DATABASE_URL`
- Better error handling and logging
- Sample data initialization

### 3. MCP Service Integration
- Dynamic MCP service discovery from environment variables
- Support for multiple services: Gmail, Notion, Google Sheets, Google Docs, Discord, Calendar, Drive, Slack, GitHub, Jira
- Async HTTP client for MCP communications
- Tool registration and execution through MCP

### 4. Improved Agent System
- Dynamic tool creation based on available MCP services
- Better error handling and conversation memory
- Structured tool schemas using Pydantic
- Enhanced system prompts with MCP service information

### 5. Better Logging and Error Handling
- Configurable log levels from environment
- Comprehensive error handling throughout
- Graceful degradation when services are unavailable

## Usage Instructions

### 1. Update Environment Variables
Replace the placeholder MCP URLs in your `.env` file with actual service URLs from your Composio dashboard.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python main.py
```

### 4. Test MCP Configuration
```bash
python -m app.mcp_config
```

### 5. Test Database Connection
```bash
python -m app.db
```

## MCP Service Configuration

Each MCP service is configured via environment variables:
- `rhea_gmail_mcp_url` - Gmail service
- `rhea_notion_mcp_url` - Notion service
- `rhea_gsheets_mcp_url` - Google Sheets service
- And so on...

Services are automatically discovered and registered when their URLs are provided in the environment.

## Agent Capabilities

The agent can now:
1. **Search conversation history** using vector similarity
2. **Get weather information** (mock implementation)
3. **Access MCP services** for:
   - Email management (Gmail)
   - Document management (Notion, Google Docs)
   - Spreadsheet operations (Google Sheets)
   - Calendar management
   - File storage (Google Drive)
   - Team communication (Discord, Slack)
   - Code repositories (GitHub)
   - Project management (Jira)

## Error Resolution

The main issues fixed:
1. **Missing GOOGLE_API_KEY** → Changed to GEMINI_API_KEY
2. **Database connection issues** → Fixed URL parsing and auto-creation
3. **Import errors** → Fixed module structure
4. **Missing MCP integration** → Added comprehensive MCP system
5. **Poor error handling** → Added validation and graceful degradation


# Rhea Assistant

A powerful Telegram bot powered by Google's Gemini AI with MCP (Model Context Protocol) integration for accessing external services like Gmail, Notion, Google Sheets, and more.

## Features

- 🤖 **AI-Powered Conversations**: Uses Google Gemini 1.5 Pro for intelligent responses
- 🧠 **Long-term Memory**: Stores conversation history in PostgreSQL with pgvector for semantic search
- 🔧 **MCP Integration**: Connect to external services via Model Context Protocol
- 📧 **Email Management**: Gmail integration for reading and sending emails
- 📝 **Document Management**: Notion, Google Docs integration
- 📊 **Spreadsheet Operations**: Google Sheets integration
- 📅 **Calendar Management**: Google Calendar integration
- 💬 **Team Communication**: Discord, Slack integration
- 🔄 **Version Control**: GitHub integration
- 📋 **Project Management**: Jira integration

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Telegram Bot Token (from @BotFather)
- Google AI (Gemini) API Key
- Composio account with MCP service URLs

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rhea-assistant
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and service URLs
   ```

3. **Start the services**
   ```bash
   docker-compose up -d
   ```

4. **Check logs**
   ```bash
   docker-compose logs -f bot
   ```

### Manual Setup (without Docker)

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up PostgreSQL with pgvector**
   ```sql
   CREATE DATABASE rhea;
   CREATE EXTENSION vector;
   ```

3. **Configure environment variables**
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   export DATABASE_URL="postgresql://user:password@localhost:5432/rhea"
   # Add other environment variables as needed
   ```

4. **Run the bot**
   ```bash
   python main.py
   ```

## Configuration

### Environment Variables

#### Required
- `GEMINI_API_KEY`: Google AI API key for Gemini
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `DATABASE_URL`: PostgreSQL connection string

#### Optional
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
- `REDIS_URL`: Redis connection string for caching
- `LANGCHAIN_API_KEY`: LangSmith API key for tracing
- `LANGCHAIN_TRACING_V2`: Enable LangSmith tracing

#### MCP Service URLs
Configure MCP services by setting their URLs:
- `rhea_gmail_mcp_url`: Gmail MCP service
- `rhea_notion_mcp_url`: Notion MCP service
- `rhea_gsheets_mcp_url`: Google Sheets MCP service
- `rhea_gdocs_mcp_url`: Google Docs MCP service
- `rhea_discord_mcp_url`: Discord MCP service
- `rhea_calendar_mcp_url`: Google Calendar MCP service
- `rhea_drive_mcp_url`: Google Drive MCP service
- `rhea_slack_mcp_url`: Slack MCP service
- `rhea_github_mcp_url`: GitHub MCP service
- `rhea_jira_mcp_url`: Jira MCP service

### MCP Services Setup

1. **Sign up for Composio** at https://composio.dev
2. **Create MCP servers** for each service you want to integrate
3. **Get the MCP URLs** from your Composio dashboard
4. **Add the URLs** to your `.env` file

## Usage

### Basic Commands

- `/start` - Start conversation with Rhea
- Send any message to chat with the AI assistant

### Example Interactions

**Weather Query:**
```
User: What's the weather like in London?
Rhea: The weather in London is sunny with 22°C temperature.
```

**Gmail Integration:**
```
User: Check my recent emails
Rhea: I'll check your Gmail for recent emails... [uses Gmail MCP service]
```

**Notion Integration:**
```
User: Create a new note in Notion about today's meeting
Rhea: I'll create a new note in your Notion workspace... [uses Notion MCP service]
```

**Google Sheets Integration:**
```
User: Add a new row to my expenses spreadsheet
Rhea: I'll add a new row to your expenses spreadsheet... [uses Google Sheets MCP service]
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │────│   Rhea Agent    │────│   MCP Services  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   + pgvector    │
                    └─────────────────┘
```

### Components

- **Telegram Bot**: Handles user interactions via Telegram
- **Rhea Agent**: LangChain agent powered by Gemini AI
- **MCP Services**: External service integrations via Model Context Protocol
- **PostgreSQL + pgvector**: Long-term memory and semantic search
- **Redis**: Caching and session management

## Development

### Project Structure

```
rhea-assistant/
├── app/
│   ├── main.py         # Telegram bot logic
│   ├── agent.py        # AI agent with MCP integration
│   ├── db.py           # Database management
│   └── mcp_config.py   # MCP service configuration
├── .env     # Python dependencies
├── requirements.txt     # Python dependencies
├── docker-compose.yml  # Docker services
└── Dockerfile          # Container definition
```

### Running Tests

```bash
# Test database connection
python -m app.db

# Test MCP configuration
python -m app.mcp_config

# Test agent functionality
python -m app.agent
```

### Adding New MCP Services

1. Add the service URL to your `.env` file:
   ```bash
   rhea_newservice_mcp_url=https://mcp.composio.dev/composio/server/your-id/mcp
   ```

2. The service will be automatically discovered and registered

### Debugging

- Enable debug logging: `LOG_LEVEL=DEBUG`
- Enable LangSmith tracing: `LANGCHAIN_TRACING_V2=true`
- Check Docker logs: `docker-compose logs -f bot`

## Troubleshooting

### Common Issues

1. **KeyError: 'GEMINI_API_KEY'**
   - Make sure you have `GEMINI_API_KEY` in your `.env` file
   - Not `GOOGLE_API_KEY` (old naming)

2. **Database connection errors**
   - Ensure PostgreSQL is running
   - Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`

3. **MCP service errors**
   - Verify MCP URLs are correct
   - Check Composio dashboard for service status
   - Ensure services are properly authenticated

4. **Import errors**
   - Make sure all dependencies are installed: `pip install -r requirements.txt`
   - Check Python path includes the project directory

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details