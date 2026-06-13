-- Migration 015: Make client_id optional on visits (walk-in support)
-- Bars often record sales without capturing customer details.

ALTER TABLE visits ALTER COLUMN client_id DROP NOT NULL;
