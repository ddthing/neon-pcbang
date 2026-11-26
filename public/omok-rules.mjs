// 오목 금수 규칙 (순수 함수, 서버·클라이언트·AI 공용)
// - 정확히 5목이면 승리. 5목이 되는 수는 다른 금수보다 우선해서 항상 둘 수 있다.
// - 육목 이상(장목)이 되는 수는 둘 수 없다.
// - 열린 3이 두 줄 이상 동시에 생기는 수(쌍삼, 3-3)는 둘 수 없다.
// 적용 대상은 OMOK_RESTRICTED_STONES 로 정한다. 기본은 흑·백 모두(일반 오목 룰).
// 렌주처럼 흑(선수)만 제한하려면 [1] 로 바꾸면 된다.
export const OMOK_SIZE = 15;
export const OMOK_RESTRICTED_STONES = Object.freeze([1, 2]);

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// index 를 가운데(오프셋 0)로 하는 한 줄을 -5..+5 범위로 읽는다. 판 밖은 -1.
function readLine(board, index, dr, dc) {
  const r0 = Math.floor(index / OMOK_SIZE);
  const c0 = index % OMOK_SIZE;
  const line = [];
  for (let d = -5; d <= 5; d++) {
    const r = r0 + dr * d;
    const c = c0 + dc * d;
    line.push(r < 0 || r >= OMOK_SIZE || c < 0 || c >= OMOK_SIZE ? -1 : board[r * OMOK_SIZE + c]);
  }
  return line;
}

// line[5] 가 방금 둔 자리. 그 자리를 포함하는 연속 돌 구간 [start, end] 를 돌려준다.
function runAround(line, center, stone) {
  let start = center;
  let end = center;
  while (start > 0 && line[start - 1] === stone) start--;
  while (end < line.length - 1 && line[end + 1] === stone) end++;
  return [start, end];
}

// 한 수 더 두면 "양쪽이 열린 정확한 4(011110)"가 되는 3 = 열린 3
function isOpenThree(line, stone) {
  const center = 5;
  const [s0, e0] = runAround(line, center, stone);
  if (e0 - s0 + 1 >= 4) return false; // 이미 4 이상이면 3이 아니다
  for (let p = center - 4; p <= center + 4; p++) {
    if (p < 0 || p >= line.length || line[p] !== 0) continue;
    line[p] = stone;
    const [start, end] = runAround(line, center, stone);
    line[p] = 0;
    if (end - start + 1 !== 4 || p < start || p > end) continue;
    if (line[start - 1] === 0 && line[end + 1] === 0) return true;
  }
  return false;
}

/**
 * 빈 칸 index 에 stone(1=흑, 2=백)을 둘 때의 판정.
 * @returns {{ ok: boolean, win: boolean, reason: "" | "occupied" | "overline" | "double-three" }}
 */
export function omokMoveVerdict(board, index, stone, restricted = OMOK_RESTRICTED_STONES) {
  if (!Number.isInteger(index) || index < 0 || index >= OMOK_SIZE * OMOK_SIZE || board[index] !== 0) {
    return { ok: false, win: false, reason: "occupied" };
  }
  let five = false;
  let overline = false;
  let openThrees = 0;
  for (const [dr, dc] of DIRS) {
    const line = readLine(board, index, dr, dc);
    line[5] = stone;
    const [start, end] = runAround(line, 5, stone);
    const length = end - start + 1;
    if (length === 5) five = true;
    else if (length > 5) overline = true;
    else if (isOpenThree(line, stone)) openThrees++;
  }
  const limited = restricted.includes(stone);
  if (five) return { ok: true, win: true, reason: "" };
  if (overline) {
    // 제한을 받지 않는 돌은 예전 규칙대로 6목 이상도 승리로 본다.
    return limited ? { ok: false, win: false, reason: "overline" } : { ok: true, win: true, reason: "" };
  }
  if (limited && openThrees >= 2) return { ok: false, win: false, reason: "double-three" };
  return { ok: true, win: false, reason: "" };
}

export function omokForbiddenMessage(reason) {
  if (reason === "double-three") return "쌍삼(3-3) 자리라 둘 수 없어요. 다른 곳에 두세요.";
  if (reason === "overline") return "육목(6개 이상)이 되는 자리라 둘 수 없어요.";
  return "둘 수 없는 자리예요.";
}
