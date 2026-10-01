// Защита от XSS: любой пользовательский текст, вставляемый через innerHTML, надо экранировать
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// Пропускаем только http/https ссылки (для картинок)
export function safeUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/^data:image\//i.test(raw)) return raw; // встроенные картинки
  try {
    // base нужен, чтобы относительные пути вроде img/gpu.png тоже работали
    const u = new URL(raw, window.location.href);
    return u.protocol === "https:" || u.protocol === "http:" ? raw : "";
  } catch {
    return "";
  }
}

// Возвращает целое 1..5 или null, если оценка некорректная
export function validRating(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// Время создания в мс (у только что добавленного документа createdAt ещё null)
export function createdMs(data) {
  return data && data.createdAt && data.createdAt.toMillis
    ? data.createdAt.toMillis()
    : Date.now();
}

// ab***@gmail.com — чтобы не светить почту покупателя всем подряд
export function maskEmail(email) {
  if (!email || !email.includes("@")) return "Покупатель";
  const [name, domain] = email.split("@");
  return name.slice(0, 2) + "***@" + domain;
}

export function stars(n) {
  return "⭐".repeat(n);
}

export function reviewsWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "отзыв";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "отзыва";
  return "отзывов";
}
