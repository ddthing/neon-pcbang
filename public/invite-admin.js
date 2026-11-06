"use strict";

const inviteCopy = document.getElementById("copy-invite");
inviteCopy?.addEventListener("click", async () => {
  const input = document.getElementById("issued-code");
  const status = document.getElementById("copy-invite-status");
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = "초대코드를 복사했어요.";
  } catch {
    input.focus();
    input.select();
    status.textContent = "선택한 코드를 직접 복사해 주세요.";
  }
});
