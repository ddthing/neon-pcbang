// Shared Real-Time Hall Leaderboard Client Widget & Score Submitter
function getMemberToken() {
  try {
    let token = localStorage.getItem("corner-cafe-member");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("corner-cafe-member", token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

function getNickname() {
  try { return (localStorage.getItem("neon-cafe-nickname") || "").trim(); } catch { return ""; }
}

export async function fetchLeaderboard(game, mode = "standard") {
  const res = await fetch("./api/arcade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", game, mode }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("leaderboard");
  return res.json();
}

export async function submitArcadeScore(game, score, { mode = "standard", metric = "" } = {}) {
  if (!Number.isInteger(score) || score <= 0) return null;
  try {
    const res = await fetch("./api/arcade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        game,
        mode,
        member: getMemberToken(),
        nickname: getNickname(),
        score,
        metric,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    document.dispatchEvent(new CustomEvent("arcade-leaderboard-updated", { detail: { game, mode, data } }));
    return data;
  } catch {
    return null;
  }
}

export function mountLeaderboardBox(dialogEl, game, getMode = () => "standard", formatScore = (s, m) => m || `${s.toLocaleString()}점`) {
  if (!dialogEl || dialogEl.querySelector(".arcade-rank-box")) return { refresh: () => {} };
  const inner = dialogEl.querySelector(".dialog-inner") || dialogEl;
  const details = document.createElement("details");
  details.className = "arcade-rank-box";
  details.innerHTML = `
    <summary class="mono">🏆 매장 실시간 TOP 5 랭킹</summary>
    <ol class="arcade-rank-list"><li class="empty">랭킹을 불러오는 중...</li></ol>`;
  inner.append(details);
  const list = details.querySelector(".arcade-rank-list");

  function renderEntries(entries = []) {
    if (!entries.length) {
      list.innerHTML = `<li class="empty">아직 첫 기록이 없어요. 1등에 도전하세요!</li>`;
      return;
    }
    list.replaceChildren(...entries.slice(0, 5).map((e) => {
      const li = document.createElement("li");
      const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`;
      const rankSpan = document.createElement("span");
      rankSpan.className = "rk mono";
      rankSpan.textContent = medal;
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = e.nickname;
      const valSpan = document.createElement("em");
      valSpan.className = "mono";
      valSpan.textContent = formatScore(e.score, e.metric);
      li.append(rankSpan, nameStrong, valSpan);
      return li;
    }));
  }

  async function refresh() {
    if (!dialogEl.open || !details.open) return;
    try {
      const data = await fetchLeaderboard(game, getMode());
      renderEntries(data.entries);
    } catch {
      list.innerHTML = `<li class="empty">오프라인 상태예요.</li>`;
    }
  }

  details.addEventListener("toggle", () => { if (details.open) refresh(); });
  document.addEventListener("arcade-leaderboard-updated", ({ detail }) => {
    if (detail.game === game && detail.mode === getMode()) renderEntries(detail.data.entries);
  });
  return { refresh };
}
