-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Full-text search helper function for Hebrew + English
CREATE TEXT SEARCH CONFIGURATION hebrew_english (COPY = simple);
