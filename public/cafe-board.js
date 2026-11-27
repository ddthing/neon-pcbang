const dialog = document.getElementById("cafe-board");
const filter = document.getElementById("cafe-board-filter");
const posts = document.getElementById("cafe-board-posts");
const form = document.getElementById("cafe-board-form");
const message = document.getElementById("cafe-board-message");
const statuses = { pending: "접수", accepted: "반영", closed: "종료", held: "보류" };
let serial = 0;

async function request(data, status) {
  const url = "./api/cafe-board" + (status ? "?status=" + encodeURIComponent(status) : "");
  const response = await fetch(url, data ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  } : {});
  if (!response.ok) throw new Error("board request failed");
  return response.json();
}

function makePost(post, admin) {
  const article = document.createElement("article");
  const title = document.createElement("h3");
  title.textContent = post.title;
  const info = document.createElement("small");
  info.textContent = [post.kind === "bug" ? "오류 제보" : "건의", statuses[post.status]].join(" · ");
  const detail = document.createElement("p");
  detail.textContent = post.detail;
  article.append(title, info, detail);
  if (admin) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", post.title + " 상태");
    for (const [value, label] of Object.entries(statuses)) select.add(new Option(label, value));
    select.value = post.status;
    select.addEventListener("change", async () => {
      try {
        await request({ action: "status", id: post.id, status: select.value });
        void refresh();
      } catch {
        select.value = post.status;
        message.textContent = "상태를 바꾸지 못했어요.";
      }
    });
    article.append(select);
  }
  return article;
}

function makeWelcomePost() {
  const article = document.createElement("article");
  article.className = "cafe-board-pinned";
  article.innerHTML = "<h3>📌 사장님 공지 · 길모퉁이PC방에 오신 걸 환영해요!</h3><small>공지 · 고정</small><p>48석 PC방 홀과 프라이빗 룸, 옥상 테라스에서 게임과 먹거리를 즐기고 불편한 점이나 건의사항을 편하게 남겨 주세요.</p>";
  return article;
}

async function refresh() {
  const token = ++serial;
  try {
    const data = await request(null, filter.value);
    if (token !== serial) return;
    const nodes = data.posts.map((post) => makePost(post, data.admin));
    if (!nodes.length && !filter.value) nodes.push(makeWelcomePost());
    if (nodes.length) posts.replaceChildren(...nodes);
    else posts.textContent = "표시할 글이 없어요.";
  } catch {
    if (token === serial) posts.textContent = "게시글을 불러오지 못했어요.";
  }
}

new MutationObserver(() => {
  if (dialog.open) void refresh();
}).observe(dialog, { attributes: true, attributeFilter: ["open"] });
filter.addEventListener("change", refresh);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request(Object.fromEntries(new FormData(form)));
    form.reset();
    filter.value = "";
    message.textContent = "게시판에 등록했어요.";
    await refresh();
  } catch {
    message.textContent = "등록하지 못했어요. 내용을 확인하고 다시 시도해 주세요.";
  } finally {
    button.disabled = false;
  }
});
