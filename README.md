# 🤖 Rhea - FounderBot

A production-ready Telegram bot with long-term memory capabilities using LangGraph, PostgreSQL vector storage, and LangSmith for observability.

### Features
- **🧠 Long-term Memory**: Uses `pgvector` for similarity search across conversation history.
- **🔄 Stateful Conversations**: Manages complex interactions using LangGraph and PostgreSQL for check-ins.
- **🔭 Observability & Evaluation**: Integrates with LangSmith for tracing, monitoring, and debugging.
- **🐳 Dockerized**: Comes with `docker-compose` for easy and reproducible deployments.
- **⚡ Async Architecture**: Built on Node.js for high-performance, concurrent operations.

### Technology Stack
- **Backend**: Node.js, TypeScript
- **AI Framework**: LangChain.js (`LangGraph`)
- **LLM**: Google Gemini (`gemini-2.5-flash`)
- **Embeddings**: Google Gemini (`text-embedding-004`)
- **Vector Store**: PostgreSQL with `pgvector`
- **Checkpointer**: PostgreSQL
- **Observability**: LangSmith
- **Containerization**: Docker, Docker Compose
- **Tools**: Composio

---

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sdntsng/rhea.git
    cd rhea
    ```

2.  **Set up environment:**
    Copy the example `.env` file and fill in your credentials.
    ```bash
    cp .env.example .env
    ```

3.  **Start the services:**
    ```bash
    docker-compose up --build
    ```

### Configuration

Your `.env` file should contain the following keys:

| Environment Variable  | Description                                        |
| --------------------- | -------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | Your token from Telegram's @BotFather.             |
| `GEMINI_API_KEY`      | Your Google AI API key.                            |
| `DATABASE_URL`        | PostgreSQL connection string for `pgvector`.       |
| `LANGCHAIN_TRACING_V2`| Set to `true` to enable LangSmith.                 |
| `LANGCHAIN_API_KEY`   | Your API key for LangSmith.                        |
| `COMPOSIO_API_KEY`    | Your API key for Composio.                         |

---

### How Memory Works

The bot's long-term memory is managed through a process of ingestion and relevance-based retrieval.

#### Ingestion
- When a user sends a message, both the user's input and the bot's subsequent response are processed.
- Each message is converted into a numerical vector representation using Google's `text-embedding-004` model.
- These vectors, along with the original text and metadata (e.g., `type: 'user'` or `type: 'bot'`), are stored as documents in the `conversations` table in the PostgreSQL database.

#### Retrieval
- When a new message is received, it is also converted into a vector.
- This new vector is used to perform a similarity search against all the vectors stored in the `conversations` table.
- The **top 2 most relevant documents** (i.e., past conversation snippets) are retrieved from the database.
- These retrieved snippets are then passed to the Google Gemini model as part of the context, allowing the bot to generate a response that is informed by relevant past interactions.

---

### Connected Tools (via Composio)

Rhea has access to the following tools, allowing it to perform a wide range of actions on your behalf:

- **Collaboration**: Notion, Linear
- **Communication**: Gmail, Discord
- **Scheduling**: Google Calendar
- **File Management**: Google Drive, Google Docs, Google Sheets
- **Development**: GitHub

---

### Development

To run the bot in a development environment with hot-reloading:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Project Structure
```
rhea/
├── src/
│   ├── agent/       # Core LangGraph agent definition
│   ├── db/          # Database connection & schema
│   └── telegram/    # Telegram bot adapter logic
├── .env.example     # Environment variable template
├── docker-compose.yml # Production Docker configuration
├── package.json
└── tsconfig.json
```