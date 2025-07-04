-- Initialize database with pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a user for the application if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rhea') THEN
        CREATE USER rhea WITH PASSWORD 'rhea';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE rhea TO rhea;
GRANT ALL PRIVILEGES ON SCHEMA public TO rhea;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rhea;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rhea;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rhea;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rhea;