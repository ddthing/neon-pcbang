// Lucian UX/UI Prompt #256 · MIT License (c) 2026 Seokwoooo
(() => {
  const boot = document.getElementById("cafe-boot");
  if (sessionStorageSafe()) return;
  const progress = boot.querySelector('[role="progressbar"]');
  function paint(value, label) {
    progress.setAttribute("aria-valuenow", value);
    boot.querySelector(".u256-n span").textContent = value;
    boot.querySelector(".u256-br i").style.width = value + "%";
    document.getElementById("boot-label").textContent = label;
  }
  function sessionStorageSafe() {
    try { return sessionStorage.getItem("corner-cafe-entered") === "1"; }
    catch { return false; }
  }
  boot.hidden = false;
  const room = document.querySelector(".room");
  room.inert = true;
  paint(15, "매장 준비 중");
  let ready = false;
  const world = new Promise((resolve) => document.addEventListener("cafe-ready", resolve, { once: true }));
  const art = document.getElementById("lobby-art").decode().catch(() => {}).then(() => {
    if (!ready) paint(82, "문을 열고 있어요");
  });
  let timeout;
  Promise.race([Promise.all([art, world]), new Promise((resolve) => { timeout = setTimeout(resolve, 4000); })])
    .then(() => {
      clearTimeout(timeout);
      ready = true;
      paint(100, "입장 완료");
      requestAnimationFrame(() => {
        boot.classList.add("is-open");
        room.inert = false;
        try { sessionStorage.setItem("corner-cafe-entered", "1"); } catch {}
        setTimeout(() => { boot.hidden = true; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 920);
      });
    });
})();
