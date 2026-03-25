
CREATE TABLE IF NOT EXISTS "User" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  name        TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Analysis" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "startupName"   TEXT NOT NULL,
  description     TEXT,                      
  status          TEXT NOT NULL DEFAULT 'pending',
  "financialData" JSONB,                     
  "swotData"      JSONB,                     
  "competitorData" JSONB,                    
  "finalReport"   TEXT,                      
  "pdfUrl"        TEXT,                      
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_userId ON "Analysis"("userId");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "analysisId" TEXT REFERENCES "Analysis"(id) ON DELETE SET NULL,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_chat_userId     ON "ChatMessage"("userId");
CREATE INDEX IF NOT EXISTS idx_chat_analysisId ON "ChatMessage"("analysisId");
