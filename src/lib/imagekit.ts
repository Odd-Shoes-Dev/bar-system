import ImageKit from 'imagekit';

/**
 * Returns an authenticated ImageKit client instance.
 */
export function getImageKit() {
  if (
    !process.env.IMAGEKIT_PUBLIC_KEY ||
    !process.env.IMAGEKIT_PRIVATE_KEY ||
    !process.env.IMAGEKIT_URL_ENDPOINT
  ) {
    throw new Error('ImageKit environment variables are not configured');
  }
  return new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}

/**
 * Builds the ImageKit folder path for a given tenant.
 *
 * Structure:
 *   /{appFolder}/{barId}/{subfolder?}
 *
 * Examples:
 *   getFolder('abc123')           → /salon-system/abc123
 *   getFolder('abc123', 'logos')  → /salon-system/abc123/logos
 *   getFolder('abc123', 'staff')  → /salon-system/abc123/staff
 *
 * The top-level app folder is read from IMAGEKIT_APP_FOLDER (default: "salon-system").
 */
export function getFolder(barId: string, subfolder?: string): string {
  const appFolder = (process.env.IMAGEKIT_APP_FOLDER || 'salon-system').replace(/^\/|\/$/g, '');
  const parts = ['', appFolder, barId];
  if (subfolder) parts.push(subfolder.replace(/^\/|\/$/g, ''));
  return parts.join('/');
}
