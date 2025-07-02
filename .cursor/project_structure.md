# Project Structure

This project adopts a modular structure inspired by production-grade LangGraph applications.

```
rhea/
├── .vscode/                 # VSCode settings
├── src/
│   ├── agent/               # Core LangGraph agent definition & factory
│   ├── config/              # Configuration loader (e.g., for env vars)
│   ├── db/                  # Database connection, schema, checkpointer
│   └── telegram/            # Telegram bot adapter logic
├── .env.example             # Environment variable template
├── .gitignore
├── Dockerfile               # Defines the bot's container image
├── README.md
├── docker-compose.dev.yml   # Docker Compose for development (with hot-reloading)
├── docker-compose.yml       # Production Docker Compose configuration
├── package.json
└── tsconfig.json
```

### Module Responsibilities

-   **`src/agent/`**: Contains the core logic of the AI. This includes the `StateGraph` definition, the tools the agent can use, and the prompts that guide its behavior.
-   **`src/config/`**: Manages environment variables and application-wide configuration.
-   **`src/db/`**: Handles all database interactions. It sets up the connection pool, defines the schema for `pgvector`, and manages the `Checkpointer` for persisting graph state.
-   **`src/telegram/`**: Acts as the interface between the user and the agent. It uses `Telegraf` to receive messages and passes them to the LangGraph agent for processing.
-   **`main.ts`**: The main entry point of the application, responsible for initializing and starting all services. 