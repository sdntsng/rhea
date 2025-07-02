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
      // @ts-ignore
      ctx.reply(response.answer);

      await vectorStore.addDocuments([
        { pageContent: ctx.message.text, metadata: { type: 'user', threadId } },
        // @ts-ignore
        { pageContent: response.answer, metadata: { type: 'bot', threadId } },
      ]);
    }
  });

  await bot.launch();
  console.log('Telegram bot started.');
}
