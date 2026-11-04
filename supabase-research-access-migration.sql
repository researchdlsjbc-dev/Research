-- ============================================================
-- Research PDF access codes
-- Adds the per-paper code required before downloading a PDF and
-- a table used to rate-limit access-code guesses.
-- ============================================================

ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_access_code TEXT;
ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_access_code_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_pdf_access_code
  ON research (pdf_access_code)
  WHERE pdf_access_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS research_pdf_access_attempts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  research_id BIGINT NOT NULL REFERENCES research(id) ON DELETE CASCADE,
  ip_hash     TEXT NOT NULL,
  successful  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_pdf_attempts_lookup
  ON research_pdf_access_attempts (research_id, ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_pdf_attempts_created
  ON research_pdf_access_attempts (created_at);

COMMENT ON COLUMN research.pdf_access_code IS 'Code required to download the attached PDF; never exposed by public APIs';
COMMENT ON COLUMN research.pdf_access_code_updated_at IS 'When the PDF access code was generated or regenerated';
COMMENT ON TABLE research_pdf_access_attempts IS 'Failed PDF access-code attempts used for rate limiting';
