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