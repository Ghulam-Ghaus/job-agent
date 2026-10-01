-- Enable pgvector extension (requires pgvector/pgvector:pg16 image)
-- This migration is applied manually on first deploy: prisma migrate deploy
CREATE EXTENSION IF NOT EXISTS vector;