"use strict";

{
  const desktopImage = document.getElementById("pc-wallpaper-image");
  const panel = document.getElementById("wallpaper");
  const preview = document.getElementById("wall-preview");
  const input = document.getElementById("wall-file");
  const pixel = document.getElementById("wall-pixel");
  const effect = document.getElementById("wall-effect-label");
  const status = document.getElementById("wall-status");
  const apply = document.getElementById("wall-apply");
  const reset = document.getElementById("wall-reset");
  const defaultImage = "./pc-wallpaper.webp";
  const defaultSetting = { original: null, pixelated: null, usePixel: true };
  const urls = new WeakMap();
  let active = defaultSetting;
  let draft = defaultSetting;
  let revision = 0;
  let decoding = false;
  let applying = false;

  const database = new Promise((resolve, reject) => {
    const request = indexedDB.open("neon-pcbang-wallpaper", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Wallpaper storage is blocked"));
  });

  function show(image, setting) {
    const isPixel = !setting.original || setting.usePixel;
    const blob = isPixel ? setting.pixelated : setting.original;
    image.classList.toggle("pixel", isPixel);
    if (image === desktopImage) image.toggleAttribute("data-default", !blob);
    const previous = urls.get(image);
    if (previous?.blob === blob) return;
    const url = blob ? URL.createObjectURL(blob) : defaultImage;
    image.src = url;
    urls.set(image, { blob, url });
    if (previous?.blob) URL.revokeObjectURL(previous.url);
  }

  const initialized = database.then((db) => new Promise((resolve, reject) => {
    const request = db.transaction("settings").objectStore("settings").get("wallpaper");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  })).then((saved) => {
    if (saved?.original instanceof Blob && saved.pixelated instanceof Blob) active = saved;
  }).catch(() => {
    // Wallpaper can still be changed for this visit when browser storage is unavailable.
  });
  window.prepareCafeWallpaper = () => initialized.then(() => show(desktopImage, active));

  async function save(setting) {
    const db = await database;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readwrite");
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.objectStore("settings").put(setting, "wallpaper");
    });
  }

  function message(text, error = false) {
    status.textContent = text;
    status.toggleAttribute("data-error", error);
  }

  function render() {
    show(preview, draft);
    pixel.checked = draft.usePixel;
    pixel.disabled = !draft.original || decoding || applying;
    effect.textContent = !draft.original ? "기본 픽셀 배경" : draft.usePixel ? "픽셀로 보기" : "원본으로 보기";
    input.disabled = applying;
    reset.disabled = applying;
    apply.disabled = decoding || applying;
  }

  async function pixelate(file) {
    const source = new Image();
    const url = URL.createObjectURL(file);
    try {
      source.src = url;
      await source.decode();
      const longest = Math.max(source.naturalWidth, source.naturalHeight);
      if (longest > 8192) throw new Error("Image is too large");
      const scale = Math.min(1, 240 / longest);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Wallpaper conversion failed")));
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.querySelectorAll("[data-wallpaper]").forEach((button) => {
    button.addEventListener("click", async () => {
      await initialized;
      if (panel.open || applying) return;
      draft = active;
      input.value = "";
      message("");
      render();
      panel.showModal();
    });
  });

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const current = ++revision;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) {
      decoding = false;
      render();
      message("12MB 이하의 PNG, JPG, WebP 이미지를 골라주세요.", true);
      return;
    }
    decoding = true;
    render();
    message("픽셀 미리보기를 만드는 중이에요.");
    try {
      const pixelated = await pixelate(file);
      if (current !== revision) return;
      draft = { original: file, pixelated, usePixel: true };
      message("미리보기에서 픽셀 효과와 원본을 비교해 보세요.");
    } catch {
      if (current === revision) message("이미지를 열 수 없어요. 다른 이미지나 더 작은 파일을 골라주세요.", true);
    } finally {
      if (current === revision) {
        decoding = false;
        render();
      }
    }
  });

  pixel.addEventListener("change", () => {
    draft = { ...draft, usePixel: pixel.checked };
    render();
  });

  reset.addEventListener("click", () => {
    revision++;
    decoding = false;
    input.value = "";
    draft = defaultSetting;
    message("기본 배경을 미리 보고 있어요.");
    render();
  });

  apply.addEventListener("click", async () => {
    if (decoding || applying) return;
    applying = true;
    render();
    const setting = draft;
    try {
      await save(setting);
      active = setting;
      show(desktopImage, active);
      panel.close();
    } catch {
      active = setting;
      show(desktopImage, active);
      message("이번 방문에 적용했어요. 브라우저가 설정 저장을 허용하지 않아요.", true);
    } finally {
      applying = false;
      render();
    }
  });

  panel.addEventListener("close", () => {
    revision++;
    decoding = false;
    draft = active;
    render();
  });
}
