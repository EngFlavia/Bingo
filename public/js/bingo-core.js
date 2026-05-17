export const MIN_BINGO_NUMBER = 1;
export const MAX_BINGO_NUMBER = 75;

export function getAllBingoNumbers() {
  return Array.from(
    { length: MAX_BINGO_NUMBER - MIN_BINGO_NUMBER + 1 },
    (_, index) => MIN_BINGO_NUMBER + index
  );
}

export function createInitialBingoState() {
  return {
    drawnNumbers: [],
    updatedAt: Date.now()
  };
}

export function resetBingoState() {
  return createInitialBingoState();
}

export function drawNextNumber(state, random = Math.random) {
  const drawn = new Set(state.drawnNumbers);
  const available = getAllBingoNumbers().filter((number) => !drawn.has(number));

  if (available.length === 0) {
    return {
      ...state,
      updatedAt: Date.now()
    };
  }

  const nextNumber = available[Math.floor(random() * available.length)];

  return {
    drawnNumbers: [...state.drawnNumbers, nextNumber],
    updatedAt: Date.now()
  };
}

export function getLastDraws(state, amount = 3) {
  return state.drawnNumbers.slice(-amount);
}

export function isDrawn(state, number) {
  return state.drawnNumbers.includes(number);
}
