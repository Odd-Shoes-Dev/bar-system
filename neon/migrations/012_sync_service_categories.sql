-- Migration 012: Sync service categories
-- Inserts any category name used in the services table that doesn't already
-- exist in service_categories, so all services are visible in the categories page.

INSERT INTO service_categories (salon_id, name, is_active, sort_order)
SELECT
  s.salon_id,
  MIN(s.category) AS name,
  true,
  COALESCE(
    (SELECT MAX(sort_order) FROM service_categories sc2 WHERE sc2.salon_id = s.salon_id),
    0
  ) + ROW_NUMBER() OVER (PARTITION BY s.salon_id ORDER BY LOWER(MIN(s.category)))
FROM services s
WHERE s.category IS NOT NULL
  AND s.category <> ''
  AND NOT EXISTS (
    SELECT 1 FROM service_categories sc
    WHERE sc.salon_id = s.salon_id
      AND LOWER(sc.name) = LOWER(s.category)
  )
GROUP BY s.salon_id, LOWER(s.category)
ON CONFLICT (salon_id, name) DO NOTHING;
