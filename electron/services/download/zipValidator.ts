import fs from 'node:fs';
import AdmZip from 'adm-zip';

/**
 * Validates that a file is a valid ZIP archive.
 * @throws Error if file is not a valid ZIP
 */
export const validateZipIntegrity = async (dest: string) => {
  const stats = fs.statSync(dest);
  
  if (stats.size === 0) {
    throw new Error('Archive file is empty (0 bytes)');
  }
  
  try {
    const zip = new AdmZip(dest);
    zip.getEntries();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Check if error is about missing ZIP signature (truncated download)
    if (errorMessage.includes('end of central directory record signature not found') || 
        errorMessage.includes('ZIP') || 
        errorMessage.includes('signature')) {
      throw new Error(`Invalid or truncated ZIP archive (${stats.size} bytes): ${errorMessage}. This usually indicates a corrupted or incomplete download.`);
    }
    throw new Error(`Invalid archive (${stats.size} bytes): ${errorMessage}`);
  }
};

