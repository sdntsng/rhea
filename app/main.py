import logging
import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from app.agent import handle_message
from app.db import initialize_db
from collections import defaultdict
from langchain_core.messages import HumanMessage, AIMessage

# Load environment variables from .env file
load_dotenv()

# Enable logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", 
    level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper())
)
logger = logging.getLogger(__name__)

# In-memory chat history
# defaultdict will create an empty list for any new user_id
chat_histories = defaultdict(list)
MAX_HISTORY_LENGTH = 10 # Number of turns (user + bot) to keep

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /start is issued."""
    await update.message.reply_text("Hi! I'm Rhea, your helpful assistant. How can I help you today?")

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming text messages and respond using the agent."""
    user_id = str(update.effective_user.id)
    message_text = update.message.text
    
    # Get current chat history
    current_history = chat_histories[user_id]

    # Let the user know the bot is thinking
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action='typing')

    try:
        # Get the response from the agent
        bot_response = await handle_message(user_id, message_text, current_history)

        # Update chat history
        current_history.append(HumanMessage(content=message_text))
        current_history.append(AIMessage(content=bot_response))
        
        # Trim history if it gets too long
        if len(current_history) > MAX_HISTORY_LENGTH * 2:
            chat_histories[user_id] = current_history[-(MAX_HISTORY_LENGTH * 2):]

        # Send the response back to the user
        await update.message.reply_text(bot_response)

    except Exception as e:
        logger.error(f"Error handling message for user {user_id}: {e}", exc_info=True)
        await update.message.reply_text("Sorry, I encountered an error. Please try again later.")

def validate_environment():
    """Validate that all required environment variables are set."""
    required_vars = [
        "TELEGRAM_BOT_TOKEN",
        "GEMINI_API_KEY",
        "DATABASE_URL"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def main() -> None:
    """Start the bot."""
    try:
        # Validate environment variables
        validate_environment()
        
        # Initialize the database first
        initialize_db()
        logger.info("Database initialized successfully.")
        
    except Exception as e:
        logger.error(f"Failed to initialize: {e}", exc_info=True)
        return # Exit if initialization fails

    # Get the Telegram token from environment variables
    token = os.environ.get("TELEGRAM_BOT_TOKEN")

    # Create the Application and pass it your bot's token.
    application = Application.builder().token(token).build()

    # on different commands - answer in Telegram
    application.add_handler(CommandHandler("start", start))

    # on non command i.e message - handle the message from Telegram
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    # Run the bot until the user presses Ctrl-C
    logger.info("Bot is running...")
    application.run_polling()

if __name__ == "__main__":
    main()