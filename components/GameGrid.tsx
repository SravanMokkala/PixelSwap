'use client';

import { useEffect, useState } from 'react';
import { splitImageIntoTiles } from '@/lib/imageTiles';

interface GameGridProps {
  board: number[];
  rows: number;
  cols: number;
  imageUrl: string;
  selectedTile: number | null;
  highlightedTile?: number | null; // Highlighted position (for keyboard navigation)
  onTileClick: (pos: number) => void;
  isAnimating: boolean;
  isInteractive?: boolean; // If false, board is view-only (opponent's board)
  playerLabel?: string; // Label to show above the board
}

export default function GameGrid({
  board,
  rows,
  cols,
  imageUrl,
  selectedTile,
  highlightedTile = null,
  onTileClick,
  isAnimating,
  isInteractive = true,
  playerLabel,
}: GameGridProps) {
  const [tileImages, setTileImages] = useState<Map<number, string>>(new Map());

  // Load and split the image when imageUrl changes
  useEffect(() => {
    if (!imageUrl) return;

    splitImageIntoTiles(imageUrl, rows, cols)
      .then((tiles) => {
        setTileImages(tiles);
      })
      .catch((error) => {
        console.error('Failed to split image into tiles:', error);
      });
  }, [imageUrl, rows, cols]);

  const getAdjacentPositions = (pos: number): number[] => {
    const row = Math.floor(pos / cols);
    const col = pos % cols;
    const adjacent: number[] = [];

    if (row > 0) adjacent.push(pos - cols);
    if (row < rows - 1) adjacent.push(pos + cols);
    if (col > 0) adjacent.push(pos - 1);
    if (col < cols - 1) adjacent.push(pos + 1);

    return adjacent;
  };

  const adjacentTiles = selectedTile !== null ? getAdjacentPositions(selectedTile) : [];

  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      {playerLabel && (
        <div className="text-center mb-2 text-white font-semibold">
          {playerLabel}
        </div>
      )}
      <div
        className={`grid bg-black/20 p-2 rounded-lg ${!isInteractive ? 'opacity-75' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          aspectRatio: '1',
          gap: '0px',
        }}
      >
            {board.map((value, index) => {
              const isSelected = selectedTile === index;
              const isHighlighted = highlightedTile === index;
              const isAdjacent = adjacentTiles.includes(index);
              const isCorrect = value === index;
              
              // Get the tile image for this piece
              // value is the position in the solved board (0-24)
              // This tells us which tile image to show
              const tileImageUrl = tileImages.get(value) || '';

              const borderColor = isSelected 
                ? 'rgb(253, 224, 71)' // yellow-300
                : isHighlighted && !isSelected
                ? 'rgb(103, 232, 249)' // cyan-300
                : isAdjacent && !isSelected && !isHighlighted
                ? 'rgb(134, 239, 172)' // green-300
                : 'rgb(75, 85, 99)'; // gray-600
              
              const glowShadow = isSelected 
                ? '0 0 0 4px rgba(253, 224, 71, 0.7)'
                : isHighlighted && !isSelected
                ? '0 0 0 4px rgba(103, 232, 249, 0.7)'
                : isAdjacent && !isSelected && !isHighlighted
                ? '0 0 0 2px rgba(134, 239, 172, 0.6)'
                : 'none';

              return (
                <div
                  key={index}
                  onClick={isInteractive ? () => onTileClick(index) : undefined}
                  className={`
                    relative
                    transition-all
                    duration-150
                    ${isInteractive ? 'cursor-default' : 'cursor-default'}
                    ${isSelected ? 'scale-105 z-20' : ''}
                    ${isHighlighted && !isSelected ? 'z-15' : ''}
                    ${isAdjacent && !isSelected && !isHighlighted ? 'z-10' : ''}
                    ${isCorrect ? 'ring-1 ring-green-500/30' : ''}
                  `}
                  style={{
                    aspectRatio: '1',
                    boxSizing: 'border-box',
                    margin: '0',
                    padding: '0',
                    boxShadow: glowShadow,
                  }}
                >
                  {/* Image container with overflow hidden */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      zIndex: 1,
                    }}
                  >
                    {tileImageUrl ? (
                      <img
                        src={tileImageUrl}
                        alt={`Tile ${index}`}
                        className="w-full h-full"
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          objectFit: 'fill',
                          margin: '0',
                          padding: '0',
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800" />
                    )}
                  </div>
                  {/* Border overlay - always on top */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: borderColor,
                      zIndex: 10,
                      boxSizing: 'border-box',
                    }}
                  />
            </div>
          );
        })}
      </div>
    </div>
  );
}
