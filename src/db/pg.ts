import { Pool } from 'pg';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { embeddings } from '../config/config';

console.log(`Attempting to connect to database at: ${process.env.DATABASE_URL}`);

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const vectorStore = new PGVectorStore(embeddings, {
    pool,
    tableName: "conversations",
});

export const checkpointer = new PostgresSaver(pool);

export async function initializeDatabase() {
    await checkpointer.setup();
    await vectorStore.ensureTableInDatabase();
    console.log('Database initialized successfully.');
}
