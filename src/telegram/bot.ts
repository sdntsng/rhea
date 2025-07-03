import { Telegraf } from 'telegraf';
import { getAgent } from '../agent/agent';
import { vectorStore } from '../db/pg';

export async function startTelegramBot() {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
  const agent = getAgent();

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
      
      const content = response.answer?.content;
      let botResponse: string;
      
      if (typeof content === 'string') {
        botResponse = content;
      } else if (Array.isArray(content)) {
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
      
      if (!botResponse.trim()) {
        botResponse = 'I apologize, but I could not generate a response.';
      }
      
      ctx.reply(botResponse);

      await vectorStore.addDocuments([
        { pageContent: ctx.message.text, metadata: { type: 'user', threadId } },
        { pageContent: botResponse, metadata: { type: 'bot', threadId } },
      ]);
    }
  });

  await bot.launch();
  console.log('Telegram bot started.');
}
