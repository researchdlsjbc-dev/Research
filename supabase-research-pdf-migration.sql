-- ============================================================
-- Research PDF attachments
-- Adds the Supabase Storage metadata columns used by the admin
-- "Attach File" tab. PDF objects live under the pdfs/ prefix.
-- ============================================================

ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_file_name TEXT;
ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_size BIGINT;
ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_content_type TEXT;

COMMENT ON COLUMN research.pdf_path IS 'Supabase Storage object path under pdfs/<research-code>/';
COMMENT ON COLUMN research.pdf_file_name IS 'Original display name of the attached PDF';
COMMENT ON COLUMN research.pdf_size IS 'PDF size in bytes';
COMMENT ON COLUMN research.pdf_content_type IS 'PDF MIME type (application/pdf)';
