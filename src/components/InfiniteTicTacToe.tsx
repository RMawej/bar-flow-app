import { useState } from "react";

type Cell = "X" | "O" | null;

const TicTacToe4x4 = () => {
  const [board, setBoard] = useState<Cell[]>(Array(16).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [score, setScore] = useState({ X: 0, O: 0 });
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [winner, setWinner] = useState<Cell | null>(null);

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const newBoard = [...board];
    newBoard[i] = xIsNext ? "X" : "O";
    setBoard(newBoard);

    const result = calculateWinner(newBoard);
    if (result) {
      const [winPlayer, line] = result;
      setScore((s) => ({ ...s, [winPlayer]: s[winPlayer] + 1 }));
      setWinner(winPlayer);
      setWinningLine(line);
      setTimeout(() => {
        setBoard(Array(16).fill(null));
        setWinner(null);
        setWinningLine(null);
      }, 1500);
      setXIsNext(!xIsNext);
    } else if (newBoard.every(cell => cell)) {
      setWinner("Draw");
      setTimeout(() => {
        setBoard(Array(16).fill(null));
        setWinner(null);
      }, 1500);
    } else {
      setXIsNext(!xIsNext);
    }
  };

  const calculateWinner = (b: Cell[]): [Cell, number[]] | null => {
    const lines = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9,10,11], [12,13,14,15],
      [0, 4, 8,12], [1, 5, 9,13], [2, 6,10,14], [3, 7,11,15],
      [0, 5,10,15], [3, 6, 9,12],
    ];
    for (const line of lines) {
      const [a, b1, c, d] = line;
      if (b[a] && b[a] === b[b1] && b[a] === b[c] && b[a] === b[d]) {
        return [b[a], line];
      }
    }
    return null;
  };

  return (
    <div className="text-center space-y-4">
      <div className="text-xl font-bold">Tic Tac Toe 4x4</div>
      <div className="grid grid-cols-4 gap-1 max-w-xs mx-auto">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`w-16 h-16 text-2xl font-bold border-2 ${
              cell === "X" ? "text-red-500" : cell === "O" ? "text-blue-500" : "text-black"
            } ${winningLine?.includes(i) ? "bg-green-200" : "bg-white"} border-gray-300`}
          >
            {cell}
          </button>
        ))}
      </div>
      {winner === "Draw" ? (
          <div className="text-md font-medium text-gray-600">Match nul !</div>
        ) : winner ? (
          <div className="text-md font-medium text-green-600">🏆 {winner} a gagné !</div>
        ) : null}
      <div className="text-sm mt-2">Tour : {xIsNext ? "X" : "O"}</div>
      <div className="text-sm text-gray-600">Score – X : {score.X} | O : {score.O}</div>
    </div>
  );
};

export default TicTacToe4x4;
