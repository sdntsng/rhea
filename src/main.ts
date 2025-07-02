import 'dotenv/config';
import { startTelegramBot } from './telegram/bot';
import { initializeDatabase } from './db/pg';

async function main() {
  console.log('Initializing Rhea...');
  
  await initializeDatabase();
  
  await startTelegramBot();
  
  console.log('Rhea is running.');
}

main().catch(console.error);
