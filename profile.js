import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml, validRating, createdMs, stars } from "./utils.js";

const userEmailEl = document.getElementById("user-email");
const userRoleEl = document.getElementById("user-role");
const logoutBtn = document.getElementById("logout-btn");
const ordersList = document.getElementById("orders-list");
const myReviewsList = document.getElementById("my-reviews-list");

const reviewModal = document.getElementById("review-modal");
const closeReviewModalBtn = document.getElementById("close-review-modal");
const profileReviewForm = document.getElementById("profile-review-form");
const reviewModalTitle = document.getElementById("review-modal-title");
const reviewProductTitleInput = document.getElementById("review-product-title");
const reviewProductIdInput = document.getElementById("review-product-id");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = user;
  if (userEmailEl) userEmailEl.textContent = user.email;

  // Всё грузим параллельно
  const [, reviews, orders] = await Promise.all([
    loadRole(),
    fetchMyReviews(),
    fetchMyOrders()
  ]);

  const reviewedTitles = new Set(reviews.map((r) => r.productTitle));
  renderOrders(orders, reviewedTitles);
  renderMyReviews(reviews);
});

async function loadRole() {
  if (!userRoleEl) return;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const role = snap.exists() ? snap.data().role : "user";
    userRoleEl.textContent = role === "admin" ? "Администратор" : "Покупатель";
  } catch (err) {
    console.error("Ошибка при получении роли:", err);
    userRoleEl.textContent = "Покупатель";
  }
}

/* ==========================================
   Данные
   ========================================== */
async function fetchMyOrders() {
  try {
    const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data()).sort((a, b) => createdMs(b) - createdMs(a));
  } catch (err) {
    console.error("Ошибка при загрузке заказов:", err);
    if (ordersList) ordersList.innerHTML = "<p style='color:#f44336;'>Не удалось загрузить покупки</p>";
    return null;
  }
}

async function fetchMyReviews() {
  try {
    const q = query(collection(db, "reviews"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data()).sort((a, b) => createdMs(b) - createdMs(a));
  } catch (err) {
    console.error("Ошибка при загрузке отзывов:", err);
    if (myReviewsList) myReviewsList.innerHTML = "<p style='color:#f44336;'>Не удалось загрузить отзывы</p>";
    return [];
  }
}

/* ==========================================
   Покупки (отсюда открывается форма отзыва)
   ========================================== */
function renderOrders(orders, reviewedTitles) {
  if (!ordersList || orders === null) return;

  if (orders.length === 0) {
    ordersList.innerHTML = "<p style='color:#aaa;'>Покупок пока нет</p>";
    return;
  }

  const fragment = document.createDocumentFragment();

  orders.forEach((order) => {
    const box = document.createElement("div");
    box.className = "order-item";
    box.style.cssText =
      "margin-bottom: 15px; background: #141416; padding: 12px 16px; border-radius: 8px; border: 1px solid #27272a;";

    const total = document.createElement("div");
    total.style.cssText = "margin-bottom: 8px; color: #a1a1aa; font-size: 0.85em;";
    total.innerHTML = `Сумма заказа: <b style="color: #22c55e;">${Number(order.totalPrice || 0).toLocaleString()} ₸</b>`;
    box.appendChild(total);

    (order.items || []).forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #27272a;";

      row.innerHTML = `
        <div>
          <span style="font-weight: 600; color: #fff;">${escapeHtml(item.title)}</span>
          <span style="color: #22c55e; margin-left: 10px; font-size: 0.9em;">${Number(item.price || 0).toLocaleString()} ₸</span>
        </div>
      `;

      const btn = document.createElement("button");
      btn.style.cssText =
        "background: #2563eb; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500; white-space: nowrap;";

      if (reviewedTitles.has(item.title)) {
        btn.textContent = "Отзыв оставлен";
        btn.disabled = true;
      } else {
        btn.textContent = "Оставить отзыв";
        btn.addEventListener("click", () => openReviewModal(item.title, item.id));
      }

      row.appendChild(btn);
      box.appendChild(row);
    });

    fragment.appendChild(box);
  });

  ordersList.replaceChildren(fragment);
}

/* ==========================================
   Окно отзыва
   ========================================== */
function openReviewModal(productTitle, productId) {
  if (!reviewModal) return;
  reviewProductTitleInput.value = productTitle;
  reviewProductIdInput.value = productId || "";
  reviewModalTitle.textContent = `Отзыв на ${productTitle}`; // textContent — безопасно
  document.getElementById("modal-review-text").value = "";
  document.getElementById("modal-rating-select").value = "5";
  reviewModal.style.display = "flex";
}

function closeReviewModal() {
  if (reviewModal) reviewModal.style.display = "none";
}

if (closeReviewModalBtn) closeReviewModalBtn.addEventListener("click", closeReviewModal);
if (reviewModal) {
  reviewModal.addEventListener("click", (e) => {
    if (e.target === reviewModal) closeReviewModal();
  });
}

if (profileReviewForm) {
  profileReviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = profileReviewForm.querySelector("button[type='submit']");
    const productTitle = reviewProductTitleInput.value;
    const productId = reviewProductIdInput.value;
    const rating = validRating(document.getElementById("modal-rating-select").value);
    const text = document.getElementById("modal-review-text").value.trim();

    if (!productTitle || !text) {
      alert("Заполните текст отзыва!");
      return;
    }
    if (rating === null) {
      alert("Выберите оценку от 1 до 5.");
      return;
    }

    const data = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      productTitle,
      rating,
      text,
      createdAt: serverTimestamp()
    };

    submitBtn.disabled = true; // защита от двойного клика = двух отзывов
    try {
      if (productId) {
        // Один отзыв на один товар от одного пользователя: id документа фиксированный,
        // повторная запись = обновление, а обновлять отзывы правила Firestore запрещают.
        await setDoc(doc(db, "reviews", `${currentUser.uid}_${productId}`), { ...data, productId });
      } else {
        await addDoc(collection(db, "reviews"), data);
      }

      closeReviewModal();
      const [reviews, orders] = await Promise.all([fetchMyReviews(), fetchMyOrders()]);
      renderOrders(orders, new Set(reviews.map((r) => r.productTitle)));
      renderMyReviews(reviews);
    } catch (err) {
      console.error("Ошибка при сохранении отзыва:", err);
      alert(
        err.code === "permission-denied"
          ? "Не удалось сохранить: отзыв на этот товар уже есть или нет прав."
          : "Не удалось сохранить отзыв."
      );
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ==========================================
   Мои отзывы (только просмотр)
   ========================================== */
function renderMyReviews(reviews) {
  if (!myReviewsList) return;

  if (reviews.length === 0) {
    myReviewsList.innerHTML = "<p style='color:#aaa;'>Вы еще не оставляли отзывы</p>";
    return;
  }

  const fragment = document.createDocumentFragment();

  reviews.forEach((r) => {
    const rating = validRating(r.rating);

    const item = document.createElement("div");
    item.className = "review-item";
    item.style.cssText =
      "background: #141416; padding: 10px 14px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #27272a;";

    const head = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = r.productTitle;
    head.append(title, rating ? ` — ${stars(rating)} (${rating})` : "");

    const body = document.createElement("div");
    body.style.cssText = "color: #ccc; margin-top: 4px; font-size: 0.9em;";
    body.textContent = r.text || "";

    item.append(head, body);
    fragment.appendChild(item);
  });

  const note = document.createElement("p");
  note.style.cssText = "color: #71717a; font-size: 0.8em; margin-top: 8px;";
  note.textContent = "Отправленные отзывы нельзя изменить или удалить.";
  fragment.appendChild(note);

  myReviewsList.replaceChildren(fragment);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => signOut(auth));
}
