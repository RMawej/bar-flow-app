// WhackAMole.tsx
import React, { useEffect, useState, useRef } from "react";

const NUM_HOLES = 9;
const HOLES_PER_ROW = 3;
const ICONS = ["🍺", "🍷", "🍹", "🥂", "🍸", "🍻"];

const getRandomIndexes = (count: number, max: number): number[] => {
  const indexes = new Set<number>();
  while (indexes.size < count) {
    indexes.add(Math.floor(Math.random() * max));
  }
  return Array.from(indexes);
};

const WhackAMole: React.FC = () => {
  const [score, setScore] = useState(0);
  const [moleIndexes, setMoleIndexes] = useState<number[]>(getRandomIndexes(3, NUM_HOLES));
  const [iconsMap, setIconsMap] = useState<{ [key: number]: string }>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [bestSPM, setBestSPM] = useState<number>(() => Number(localStorage.getItem("best_spm")) || 0);
  const [gameStarted, setGameStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const newIcons: { [key: number]: string } = {};
    moleIndexes.forEach((idx) => {
      newIcons[idx] = ICONS[Math.floor(Math.random() * ICONS.length)];
    });
    setIconsMap(newIcons);
  }, [moleIndexes]);

  useEffect(() => {
    if (!gameStarted) return;
    intervalRef.current = setInterval(() => {
      const newIndexes = getRandomIndexes(1, NUM_HOLES);
      setMoleIndexes(newIndexes);
    }, 800);
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [gameStarted]);

  const handleHit = (index: number) => {
    if (moleIndexes.includes(index)) {
      setScore((s) => s + 1);
      setMoleIndexes([]);
    }
  };

  const elapsedMinutes = startTime ? (Date.now() - startTime) / 60000 : 0.00001;
  const spm = Math.round(score / elapsedMinutes);

  useEffect(() => {
    if (spm > bestSPM) {
      setBestSPM(spm);
      localStorage.setItem("best_spm", String(spm));
    }
  }, [spm, bestSPM]);

  const handleStart = () => {
    setStartTime(Date.now());
    setScore(0);
    setGameStarted(true);
  };

  const handleReset = () => {
    setScore(0);
    setStartTime(null);
    setGameStarted(false);
    setMoleIndexes(getRandomIndexes(3, NUM_HOLES));
  };

  return (
    <div style={{ textAlign: "center", fontFamily: "sans-serif", paddingTop: 40 }}>
      <h1>Whack-a-Boisson 🍻</h1>
      <p>Score: {score}</p>

      {/* Game grid wrapper with relative position */}
      <div style={{ position: "relative", display: "inline-block", marginTop: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${HOLES_PER_ROW}, 80px)`,
            gap: 20,
            justifyContent: "center",
          }}
        >
          {Array.from({ length: NUM_HOLES }).map((_, i) => (
            <div
              key={i}
              onClick={() => handleHit(i)}
              style={{
                width: 80,
                height: 80,
                background: "#eee",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                cursor: "pointer",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              }}
            >
              {moleIndexes.includes(i) ? iconsMap[i] : ""}
            </div>
          ))}
        </div>

        {/* Overlay ONLY over grid */}
        {!gameStarted && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              borderRadius: 8,
            }}
          >
            <button onClick={handleStart} style={{ padding: "16px 32px", fontSize: 24, background: "#fff", borderRadius: 8 }}>
              ▶️ Play
            </button>
          </div>
        )}
      </div>

      {/* Reset button */}
      <div style={{ marginTop: 20 }}>
        <button onClick={handleReset} style={{ padding: "10px 20px", fontSize: "16px" }}>
          🔄 Reset
        </button>
      </div>
    </div>
  );
};

export default WhackAMole;
