-- Create storage buckets for payment uploads and documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_uploads', 'payment_uploads', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for storage.objects
-- Allow authenticated users to upload files to these buckets
CREATE POLICY "Allow authenticated users to upload to payment_uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment_uploads');

CREATE POLICY "Allow authenticated users to upload to documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to view files in these buckets
CREATE POLICY "Allow authenticated users to view payment_uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment_uploads');

CREATE POLICY "Allow authenticated users to view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow admins to delete files
CREATE POLICY "Allow admins to delete from payment_uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment_uploads' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to delete from documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add bucket_name column to document_attachments table
ALTER TABLE public.document_attachments
ADD COLUMN IF NOT EXISTS bucket_name TEXT DEFAULT 'documents';
