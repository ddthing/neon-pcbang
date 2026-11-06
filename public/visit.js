"use strict";

{
  const key = "neon-pcbang-regular";
  const card = document.getElementById("visit-card");
  const count = document.getElementById("visit-count");
  const reward = document.getElementById("visit-reward");
  const stamps = [...card.querySelectorAll("[data-stamp]")];
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  const collected = new Set(stamps.map((item) => item.dataset.stamp)
    .filter((stamp) => Array.isArray(saved) && saved.includes(stamp)));

  function paint(newStamp) {
    for (const item of stamps) {
      const hasStamp = collected.has(item.dataset.stamp);
      item.classList.toggle("stamped", hasStamp);
      item.classList.toggle("stamp-new", item.dataset.stamp === newStamp);
      item.setAttribute("aria-label", item.textContent + (hasStamp ? ", 획득" : ", 획득 전"));
    }
    count.textContent = collected.size + " / " + stamps.length;
    if (collected.size === stamps.length) {
      card.classList.add("complete");
      reward.textContent = "단골 별을 받았어요! 내 캐릭터 이름 옆에서 확인해 보세요.";
    }
  }

  window.cafeIsRegular = () => collected.size === stamps.length;
  window.recordCafeStamp = (stamp) => {
    if (collected.has(stamp) || !stamps.some((item) => item.dataset.stamp === stamp)) return;
    collected.add(stamp);
    try { localStorage.setItem(key, JSON.stringify([...collected])); } catch {}
    paint(stamp);
    if (window.cafeIsRegular()) {
      document.dispatchEvent(new Event("cafe-regular"));
      document.querySelector(".u070").dispatchEvent(new CustomEvent("pcbang-notice", {
        detail: { message: "단골 카드 완성! 이름 옆에 별이 붙었어요.", kind: "ok" },
      }));
    }
  };
  paint();
}
