import { Telegraf } from 'telegraf';
import { getAgent } from '../agent/agent';
import { vectorStore } from '../db/pg';

export async function startTelegramBot() {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
  const agent = await getAgent();

  bot.start((ctx) => {
    ctx.reply('Rhea is online. Ask me anything!');
  });

  bot.on('message', async (ctx) => {
    if ('text' in ctx.message) {
      const threadId = ctx.chat.id.toString();
      const response = await agent.invoke(
        { question: ctx.message.text },
        { configurable: { thread_id: threadId } }
      );
      
      // Extract and convert the content from the AIMessage to string
      const content = response.answer?.content;
      let botResponse: string;
      
      if (typeof content === 'string') {
        botResponse = content;
      } else if (Array.isArray(content)) {
        // Handle content arrays by extracting text from text parts
        botResponse = content.map(part => {
          if (typeof part === 'string') {
            return part;
          } else if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
            return part.text;
          }
          return '';
        }).join('');
      } else {
        botResponse = 'I apologize, but I encountered an error processing your request.';
      }
      
      // Fallback if we got empty response
      if (!botResponse.trim()) {
        botResponse = 'I apologize, but I could not generate a response.';
      }
      
      ctx.reply(botResponse);

      // Add both user message and bot response to vector store with string content
      await vectorStore.addDocuments([
        { pageContent: ctx.message.text, metadata: { type: 'user', threadId } },
        { pageContent: botResponse, metadata: { type: 'bot', threadId } },
      ]);
    }
  });

  await bot.launch();
  console.log('Telegram bot started.');
}
