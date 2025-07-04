from langchain_community.vectorstores.pgvector import PGVector
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.docstore.document import Document
import os
from typing import List
import logging
from urllib.parse import urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger(__name__)

# Constants
COLLECTION_NAME = "rhea_memory"

def parse_database_url(database_url: str) -> dict:
    """Parse DATABASE_URL into components."""
    parsed = urlparse(database_url)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path[1:],  # Remove leading slash
        "user": parsed.username,
        "password": parsed.password,
    }

def ensure_database_exists():
    """Ensure the database exists, create if it doesn't."""
    try:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL not found in environment variables")
        
        db_params = parse_database_url(database_url)
        
        # Connect to default 'postgres' database to create our database
        conn = psycopg2.connect(
            host=db_params["host"],
            port=db_params["port"],
            user=db_params["user"],
            password=db_params["password"],
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create database if it doesn't exist
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_params['database']}'")
        if not cursor.fetchone():
            cursor.execute(f"CREATE DATABASE {db_params['database']}")
            logger.info(f"Created database: {db_params['database']}")
        
        cursor.close()
        conn.close()
        
        # Now connect to our database and ensure pgvector extension
        conn = psycopg2.connect(**db_params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create pgvector extension if it doesn't exist
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
        logger.info("Ensured pgvector extension exists")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error ensuring database exists: {e}")
        raise

# Get database connection string from environment
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables")

# Parse database URL for PGVector
db_params = parse_database_url(DATABASE_URL)
CONNECTION_STRING = PGVector.connection_string_from_db_params(
    driver="psycopg2",
    host=db_params["host"],
    port=db_params["port"],
    database=db_params["database"],
    user=db_params["user"],
    password=db_params["password"],
)

# Initialize embeddings with proper API key
def get_embeddings():
    """Get embeddings model with proper API key."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables")
    
    return GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=api_key,
        transport="rest",
    )

# Initialize PGVector store
def get_vector_store():
    """Get or create the vector store."""
    try:
        embeddings = get_embeddings()
        return PGVector(
            connection_string=CONNECTION_STRING,
            embedding_function=embeddings,
            collection_name=COLLECTION_NAME,
            use_jsonb=True,
        )
    except Exception as e:
        logger.error(f"Error creating vector store: {e}")
        raise

def get_retriever(k_value: int = 4):
    """Get a retriever for the vector store."""
    store = get_vector_store()
    return store.as_retriever(search_kwargs={"k": k_value})

def add_documents(texts: List[str], metadatas: List[dict] = None):
    """Add documents to the vector store."""
    if metadatas is None:
        metadatas = [{}] * len(texts)
    
    store = get_vector_store()
    store.add_texts(texts=texts, metadatas=metadatas)

def add_document_from_text(text: str, metadata: dict = None):
    """Create a document from text and add it to the store."""
    if metadata is None:
        metadata = {}
    
    doc = Document(page_content=text, metadata=metadata)
    store = get_vector_store()
    store.add_documents([doc])

def initialize_db():
    """Initialize the database with some sample data"""
    try:
        # Ensure database and extensions exist
        ensure_database_exists()
        
        # Test the connection by creating the vector store
        store = get_vector_store()
        
        # Add some sample documents if the collection is empty
        try:
            # Try to retrieve some documents to see if any exist
            retriever = get_retriever(k_value=1)
            test_docs = retriever.get_relevant_documents("test")
            
            if not test_docs:
                logger.info("Adding sample documents to empty database")
                sample_texts = [
                    "This is a sample document about artificial intelligence and machine learning.",
                    "Python is a popular programming language for data science and AI applications.",
                    "Vector databases are useful for storing and retrieving embeddings efficiently.",
                ]
                
                add_documents(sample_texts)
                logger.info("Database initialized with sample data")
            else:
                logger.info("Database already contains data")
                
        except Exception as e:
            logger.warning(f"Could not check existing data, proceeding anyway: {e}")
            
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

if __name__ == "__main__":
    # Test the database
    initialize_db()
    retriever = get_retriever(k_value=3)
    docs = retriever.get_relevant_documents("Python programming")
    print(f"Found {len(docs)} relevant documents")
    for doc in docs:
        print(f"- {doc.page_content[:100]}...")