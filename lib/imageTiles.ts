/**
 * Split an image into a grid of tiles with perfect alignment
 * Returns a Map where key is the tile index (0-N) and value is a data URL
 */
export async function splitImageIntoTiles(
  imageUrl: string,
  rows: number,
  cols: number
): Promise<Map<number, string>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Step 1: Crop image to perfect square (take minimum of width/height)
        const size = Math.min(img.width, img.height);
        const sourceX = Math.floor((img.width - size) / 2);
        const sourceY = Math.floor((img.height - size) / 2);
        
        // Step 2: Create a square canvas for the cropped image
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the cropped square image onto the canvas
        ctx.drawImage(
          img,
          sourceX, sourceY, size, size,  // Source: crop from center
          0, 0, size, size                // Destination: full canvas
        );
        
        // Step 3: Calculate tile dimensions as integers
        // Round down to ensure consistent tile sizes, then resize canvas to exact multiples
        const baseTileWidth = Math.floor(size / cols);
        const baseTileHeight = Math.floor(size / rows);
        const exactTileWidth = baseTileWidth;
        const exactTileHeight = baseTileHeight;
        
        // Calculate the exact canvas size we'll use (must be divisible by cols/rows)
        const exactCanvasSize = Math.min(exactTileWidth * cols, exactTileHeight * rows);
        
        // Create a resized canvas with exact dimensions
        const exactCanvas = document.createElement('canvas');
        exactCanvas.width = exactCanvasSize;
        exactCanvas.height = exactCanvasSize;
        const exactCtx = exactCanvas.getContext('2d');
        
        if (!exactCtx) {
          reject(new Error('Could not get exact canvas context'));
          return;
        }
        
        exactCtx.imageSmoothingEnabled = true;
        exactCtx.imageSmoothingQuality = 'high';
        
        // Draw the cropped image, scaled to exact size
        exactCtx.drawImage(canvas, 0, 0, size, size, 0, 0, exactCanvasSize, exactCanvasSize);
        
        // Recalculate tile dimensions based on exact canvas size
        const tileWidth = Math.floor(exactCanvasSize / cols);
        const tileHeight = Math.floor(exactCanvasSize / rows);
        
        // Create a map to store tile data URLs
        const tileMap = new Map<number, string>();
        
        // Step 4: Extract each tile with exact pixel boundaries - all tiles same size
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const tileIndex = row * cols + col;
            
            // Calculate exact integer pixel coordinates
            const sourceX = col * tileWidth;
            const sourceY = row * tileHeight;
            
            // All tiles use the same dimensions for perfect alignment
            // Create a canvas for this tile
            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tileWidth;
            tileCanvas.height = tileHeight;
            const tileCtx = tileCanvas.getContext('2d');
            
            if (!tileCtx) {
              continue;
            }
            
            // Disable image smoothing for pixel-perfect extraction
            tileCtx.imageSmoothingEnabled = false;
            
            // Extract the exact tile region from the exact-size canvas
            tileCtx.drawImage(
              exactCanvas,
              sourceX, sourceY, tileWidth, tileHeight,  // Source region (exact pixels)
              0, 0, tileWidth, tileHeight               // Destination: full tile canvas
            );
            
            // Convert to data URL and store (use PNG to avoid compression artifacts)
            const dataUrl = tileCanvas.toDataURL('image/png');
            tileMap.set(tileIndex, dataUrl);
          }
        }
        
        resolve(tileMap);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

