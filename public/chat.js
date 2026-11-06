"use strict";

const form = document.getElementById("cafe-chat-form");
if (form) {
  const input = document.getElementById("cafe-chat-input");
  const submit = form.querySelector("button[type=submit]");
  const status = document.getElementById("cafe-chat-status");
  const avatars = document.getElementById("cafe-avatars");
  const muteAll = document.getElementById("cafe-chat-mute");
  const mutedList = document.getElementById("cafe-chat-list");
  const muteKey = "neon-pcbang-chat-muted";
  const muteAllKey = "neon-pcbang-chat-mute-all";
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const muted = new Set(readMutedSenders());
  const bubbles = new Map();
  let mutedAll = storageBoolean(muteAllKey);
  let sending = false;
  let cooldownUntil = 0;
  let visitorList = [];
  let mutedListKey = "";
  let statusTimer;

  function announce(message) {
    clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.toggle("pc-sr-only", !message);
    status.classList.toggle("cafe-chat-feedback", Boolean(message));
    if (message) {
      statusTimer = setTimeout(() => {
        status.textContent = "";
        status.classList.add("pc-sr-only");
        status.classList.remove("cafe-chat-feedback");
      }, 3200);
    }
  }

  function readMutedSenders() {
    try {
      const stored = JSON.parse(localStorage.getItem(muteKey));
      return Array.isArray(stored)
        ? stored.filter((sender) => typeof sender === "string" && /^[a-f0-9]{64}$/.test(sender)).slice(-32)
        : [];
    } catch {
      return [];
    }
  }

  function storageBoolean(key) {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  }

  function removeBubble(sender) {
    const bubble = bubbles.get(sender);
    if (!bubble) return;
    clearTimeout(bubble.timer);
    bubble.node.remove();
    bubbles.delete(sender);
  }

  function saveMutedSenders() {
    try { localStorage.setItem(muteKey, JSON.stringify([...muted].slice(-32))); } catch {}
  }

  function showMessages({ now, space, messages, visitors }) {
    if (!Array.isArray(messages)) return;
    if (Array.isArray(visitors)) renderMutedList(visitors);
    const visible = new Set();
    for (const message of messages) {
      if (!message || typeof message.sender !== "string" || typeof message.text !== "string" ||
          message.space !== space || !Number.isFinite(message.expiresAt)) continue;
      const remaining = message.expiresAt - now;
      if (remaining <= 0 || muted.has(message.sender) ||
          (mutedAll && message.sender !== window.cafeChatVisitorId)) continue;
      const sprite = avatars.querySelector('.cafe-visitor[data-visitor-id="' + CSS.escape(message.sender) + '"]');
      if (!sprite) continue;
      visible.add(message.sender);
      let bubble = bubbles.get(message.sender);
      if (!bubble) {
        const node = document.createElement("span");
        node.className = "cafe-speech-bubble";
        node.setAttribute("aria-hidden", "true");
        sprite.append(node);
        bubble = { node, id: "", timer: 0 };
        bubbles.set(message.sender, bubble);
      } else if (bubble.node.parentElement !== sprite) {
        bubble.node.remove();
        sprite.append(bubble.node);
      }
      if (bubble.id !== message.id) {
        bubble.id = message.id;
        bubble.node.textContent = message.text;
        bubble.node.classList.remove("is-arriving");
        if (!media.matches) {
          void bubble.node.offsetWidth;
          bubble.node.classList.add("is-arriving");
        }
      }
      clearTimeout(bubble.timer);
      bubble.timer = setTimeout(() => removeBubble(message.sender), remaining);
    }

    for (const sender of bubbles.keys()) {
      if (!visible.has(sender)) removeBubble(sender);
    }
  }

  function setMuted(sender, value) {
    if (value) muted.add(sender);
    else muted.delete(sender);
    saveMutedSenders();
    if (value) removeBubble(sender);
  }

  function renderMutedList(visitors) {
    if (!mutedList || !Array.isArray(visitors)) return;
    const peers = visitors.filter((visitor) => visitor?.id && visitor.id !== window.cafeChatVisitorId);
    const signature = peers.map(({ id, name }) => id + ":" + name).join("|");
    visitorList = visitors;
    if (signature === mutedListKey) return;
    mutedListKey = signature;
    const visible = new Set(peers.map(({ id }) => id));
    const current = new Map([...mutedList.children].map((row) => [row.dataset.senderId, row]));
    const fragment = document.createDocumentFragment();
    for (const peer of peers) {
      const row = current.get(peer.id) || document.createElement("div");
      row.dataset.senderId = peer.id;
      if (!current.has(peer.id)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cafe-chat-mute-player";
        button.addEventListener("click", () => {
          setMuted(peer.id, !muted.has(peer.id));
          mutedListKey = "";
          renderMutedList(visitorList);
        });
        row.append(button);
      }
      const button = row.querySelector("button");
      button.textContent = (muted.has(peer.id) ? "말풍선 표시 · " : "말풍선 숨기기 · ") + peer.name;
      button.setAttribute("aria-pressed", String(muted.has(peer.id)));
      fragment.append(row);
    }
    for (const [sender, row] of current) if (!visible.has(sender)) row.remove();
    mutedList.replaceChildren(fragment);
  }

  function errorText(result) {
    switch (result.error) {
      case "chat_blocked":
        return "욕설, 링크와 반복 메시지는 보낼 수 없어요.";
      case "chat_cooldown": {
        const wait = Number.isFinite(result.retryAfterMs)
          ? Math.ceil(result.retryAfterMs / 1000)
          : 2;
        return wait + "초 뒤에 다시 보낼 수 있어요.";
      }
      case "chat_room_changed":
        return "이동이 끝난 뒤 다시 보내 주세요.";
      case "chat_invalid":
        return "채팅은 80자 이내로 입력해 주세요.";
      default:
        return "메시지를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const message = input.value.trim();
    if (!message) {
      announce("메시지를 입력해 주세요.");
      input.focus();
      return;
    }
    if (Array.from(message).length > 80) {
      announce("채팅은 80자 이내로 입력해 주세요.");
      input.focus();
      return;
    }

    sending = true;
    submit.disabled = true;
    announce("");
    try {
      const result = await window.cafeChatSay(message);
      if (Array.isArray(result?.visitors)) {
        visitorList = result.visitors;
        mutedListKey = "";
        renderMutedList(visitorList);
      }
      if (result.error) {
        announce(errorText(result));
        if (result.error === "chat_cooldown" && Number.isFinite(result.retryAfterMs)) {
          cooldownUntil = Math.max(cooldownUntil, Date.now() + result.retryAfterMs);
        }
        return;
      }
      input.value = "";
      announce("메시지를 보냈어요.");
      cooldownUntil = Date.now() + 2000;
      if (Array.isArray(result.chat)) showMessages({
        now: result.now,
        space: document.querySelector(".scene").dataset.space === "lobby"
          ? "hall"
          : document.querySelector(".scene").dataset.space,
        messages: result.chat,
      });
    } catch {
      announce("연결이 끊겨 메시지를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      sending = false;
      submit.disabled = Date.now() < cooldownUntil;
      if (submit.disabled) {
        setTimeout(() => {
          submit.disabled = false;
        }, Math.max(0, cooldownUntil - Date.now()));
      }
    }
  });

  form.addEventListener("input", (event) => {
    if (event.target !== input) return;
    submit.disabled = sending || Date.now() < cooldownUntil || input.value.trim().length === 0;
    if (status.textContent.startsWith("메시지를 입력해 주세요.")) announce("");
  });

  if (muteAll) {
    muteAll.checked = mutedAll;
    muteAll.addEventListener("change", () => {
      mutedAll = muteAll.checked;
      try { localStorage.setItem(muteAllKey, mutedAll ? "1" : "0"); } catch {}
      if (mutedAll) {
        for (const sender of bubbles.keys()) {
          if (sender !== window.cafeChatVisitorId) removeBubble(sender);
        }
      }
    });
  }
  document.addEventListener("cafe-chat-sync", (event) => {
    window.cafeChatVisitorId = event.detail?.visitorId;
    showMessages(event.detail);
  });
  submit.disabled = input.value.trim().length === 0;
  window.cafeChatRemoveVisitor = removeBubble;
  media.addEventListener("change", () => {
    if (media.matches) {
      for (const bubble of bubbles.values()) bubble.node.classList.remove("is-arriving");
    }
  });
}
