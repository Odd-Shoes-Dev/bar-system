-- Update localhost salon to use 'posh' subdomain for production
UPDATE salons 
SET subdomain = 'posh'
WHERE subdomain = 'localhost';

-- Verify the update
SELECT id, name, subdomain, theme_primary_color, slogan 
FROM salons 
WHERE subdomain = 'posh';
