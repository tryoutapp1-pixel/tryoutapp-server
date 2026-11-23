-- Preserve existing file_path/file_url values while adding the R2 object identifier.
-- Existing local files must be migrated separately and object_key populated after upload.
ALTER TABLE attachments
  ADD COLUMN object_key varchar(500) DEFAULT NULL AFTER file_path;
