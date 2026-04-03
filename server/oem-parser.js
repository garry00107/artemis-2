/**
 * OEM (Orbital Ephemeris Message) Parser
 * Parses CCSDS OEM format text into state vector arrays
 * 
 * Handles both:
 * - Files with explicit DATA_START/DATA_STOP markers
 * - Files where data lines appear directly after META_STOP (NASA's format)
 */

const TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function parseOEM(text) {
  const lines = text.split('\n');
  const vectors = [];
  let pastMeta = false;
  let inDataBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('COMMENT')) continue;
    
    // Track DATA_START/DATA_STOP if present
    if (trimmed === 'DATA_START') { inDataBlock = true; continue; }
    if (trimmed === 'DATA_STOP') { inDataBlock = false; continue; }
    
    // Track META_STOP
    if (trimmed === 'META_STOP') { pastMeta = true; continue; }
    
    // Skip metadata/header lines
    if (trimmed.includes('=') || trimmed === 'META_START') continue;
    
    // Parse data lines: either inside DATA_START block or after META_STOP
    if (inDataBlock || pastMeta) {
      // Check if line starts with a timestamp
      if (TIMESTAMP_REGEX.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 7) {
          vectors.push({
            time: new Date(parts[0] + 'Z').getTime(),
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            z: parseFloat(parts[3]),
            vx: parseFloat(parts[4]),
            vy: parseFloat(parts[5]),
            vz: parseFloat(parts[6]),
          });
        }
      }
    }
  }

  return vectors;
}
