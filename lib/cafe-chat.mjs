const maximumLength = 80;
const url = /(?:https?:\/\/|www\.|[\p{L}\p{N}-]+\.(?:com|net|org|kr|io|gg|me)\b)/iu;
const repeated = /^([\p{L}\p{N}])\1{7,}$/u;
const profanity = [
  "시발", "씨발", "씨팔", "씹새끼", "씹할", "병신", "개새끼", "개쌔끼", "새끼야", "새끼들",
  "지랄", "좆", "존나", "ㅅㅂ", "ㅂㅅ", "fuck", "shit", "bitch", "asshole",
].map((word) => word.normalize("NFKC").toLocaleLowerCase("ko"));

function foldForModeration(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ko")
    .replace(/[\p{White_Space}\p{Punctuation}\p{Cf}]+/gu, "");
}

export function normalizeCafeChatText(value) {
  if (typeof value !== "string") return { error: "chat_invalid" };
  const text = value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  if (!text || Array.from(text).length > maximumLength || /[\r\n]/u.test(text)) {
    return { error: "chat_invalid" };
  }
  const folded = foldForModeration(text);
  if (url.test(text.normalize("NFKC")) || repeated.test(folded) || profanity.some((word) => folded.includes(word))) {
    return { error: "chat_blocked" };
  }
  return { text, filteredText: folded };
}

export function cafeChatSpace(seat) {
  if (!seat || seat.startsWith("hall:")) return "hall";
  return seat.split(":", 1)[0];
}
