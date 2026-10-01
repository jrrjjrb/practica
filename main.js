import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  escapeHtml,
  safeUrl,
  validRating,
  createdMs,
  maskEmail,
  stars,
  reviewsWord
} from "./utils.js";

const authNav = document.getElementById("auth-nav");
const container = document.getElementById("products-list");
const searchInput = document.getElementById("search-input");

const productModal = document.getElementById("product-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const modalImg = document.getElementById("modal-img");
const modalTitle = document.getElementById("modal-title");
const modalRating = document.getElementById("modal-rating");
const modalDescription = document.getElementById("modal-description");
const modalPrice = document.getElementById("modal-price");
const modalAddBtn = document.getElementById("modal-add-btn");
const modalReviewsList = document.getElementById("modal-reviews-list");

let currentUser = null;
let allProducts = [];
let reviewsByTitle = new Map(); // название товара -> список отзывов (в памяти, читаем один раз)

/* ==========================================
   1. Авторизация
   ========================================== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (!user) {
    if (authNav) authNav.innerHTML = `<a href="auth.html" class="nav-btn login">Войти</a>`;
    renderCart([]);
    return;
  }

  // Кнопку кабинета показываем сразу, не ждём роль
  if (authNav) authNav.innerHTML = `<a href="profile.html" class="nav-btn">Личный кабинет</a>`;
  loadFirestoreCart();
  loadRoleAndShowAdminLink(user.uid);
});

async function loadRoleAndShowAdminLink(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const role = snap.exists() ? snap.data().role : "user";
    if (role === "admin" && authNav && currentUser && currentUser.uid === uid) {
      authNav.insertAdjacentHTML(
        "beforeend",
        `<a href="admin.html" class="nav-btn" style="background: #e91e63;">Админка</a>`
      );
    }
  } catch (err) {
    console.error("Ошибка при получении роли:", err);
  }
}

/* ==========================================
   2. Корзина
   ========================================== */
async function getCartItems() {
  const snap = await getDoc(doc(db, "carts", currentUser.uid));
  return snap.exists() ? snap.data().items || [] : [];
}

window.addToCart = async function (id, title, price) {
  if (!currentUser) {
    alert("Для добавления в корзину нужно войти в аккаунт!");
    window.location.href = "auth.html";
    return;
  }

  try {
    const items = await getCartItems();
    items.push({
      id,
      title,
      price: Number(price),
      addedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "carts", currentUser.uid), { items });
    alert(`Товар "${title}" добавлен в корзину!`);
    renderCart(items);
  } catch (error) {
    console.error("Ошибка добавления в корзину:", error);
    alert("Ошибка добавления! Проверьте авторизацию.");
  }
};

async function loadFirestoreCart() {
  if (!currentUser) return;
  try {
    renderCart(await getCartItems());
  } catch (err) {
    console.error("Ошибка при загрузке корзины:", err);
  }
}

function renderCart(items) {
  const cartCount = document.getElementById("cart-count");
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");

  if (cartCount) cartCount.textContent = items.length;
  if (!cartItems) return;

  if (items.length === 0) {
    cartItems.innerHTML = `<p style="color:#aaa; text-align:center;">Корзина пуста</p>`;
    if (cartTotal) cartTotal.textContent = "Итого: 0 ₸";
    return;
  }

  let total = 0;
  const rows = items.map((item, index) => {
    total += Number(item.price);
    return `
      <div class="cart-item">
        <div>
          <div><b>${escapeHtml(item.title)}</b></div>
          <div style="color:#4caf50;">${Number(item.price).toLocaleString()} ₸</div>
        </div>
        <button onclick="removeFromFirestoreCart(${index})" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Удалить</button>
      </div>
    `;
  });

  cartItems.innerHTML =
    rows.join("") +
    `<button id="checkout-btn" onclick="checkout()" style="background:#4caf50; color:white; border:none; width:100%; padding:8px; margin-top:10px; border-radius:4px; cursor:pointer; font-weight:bold;">Оформить покупку</button>`;

  if (cartTotal) cartTotal.textContent = `Итого: ${total.toLocaleString()} ₸`;
}

window.removeFromFirestoreCart = async function (index) {
  if (!currentUser) return;
  try {
    const items = await getCartItems();
    items.splice(index, 1);
    await setDoc(doc(db, "carts", currentUser.uid), { items });
    renderCart(items);
  } catch (err) {
    console.error("Ошибка удаления из корзины:", err);
  }
};

let checkingOut = false;
window.checkout = async function () {
  if (!currentUser || checkingOut) return;
  checkingOut = true;
  const btn = document.getElementById("checkout-btn");
  if (btn) btn.disabled = true;

  try {
    const items = await getCartItems();
    if (!items.length) return;

    const total = items.reduce((sum, item) => sum + Number(item.price), 0);

    await addDoc(collection(db, "orders"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      items,
      totalPrice: total,
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "carts", currentUser.uid), { items: [] });
    alert("Покупка успешно оформлена! Оставить отзыв можно в личном кабинете.");
    renderCart([]);
  } catch (err) {
    console.error("Ошибка при оформлении заказа:", err);
    alert("Не удалось оформить покупку.");
  } finally {
    checkingOut = false;
    if (btn) btn.disabled = false;
  }
};

window.toggleCart = function () {
  const modal = document.getElementById("cart-modal");
  if (modal) modal.style.display = modal.style.display === "flex" ? "none" : "flex";
};

/* ==========================================
   3. Товары + рейтинги (2 запроса параллельно, а не 1 + N последовательных)
   ========================================== */
function groupReviews(snapshot) {
  const map = new Map();
  if (!snapshot) return map;

  snapshot.forEach((docSnap) => {
    const review = docSnap.data();
    if (!map.has(review.productTitle)) map.set(review.productTitle, []);
    map.get(review.productTitle).push(review);
  });

  // Новые сверху
  map.forEach((list) => list.sort((a, b) => createdMs(b) - createdMs(a)));
  return map;
}

// Средний рейтинг считаем только по корректным оценкам 1..5.
// Раньше битая оценка молча считалась как 5 — это искажало среднее.
function getRatingStats(reviews) {
  let sum = 0;
  let count = 0;
  reviews.forEach((r) => {
    const rating = validRating(r.rating);
    if (rating !== null) {
      sum += rating;
      count++;
    }
  });
  return { avg: count ? (sum / count).toFixed(1) : null, count };
}

function formatRating(item) {
  return item.reviewsCount
    ? `⭐ ${item.avgRating} (${item.reviewsCount} ${reviewsWord(item.reviewsCount)})`
    : "Пока нет оценок";
}

async function loadProducts() {
  if (!container) return;
  container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">Загрузка каталога...</p>`;

  try {
    const [productsSnap, reviewsSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "reviews")).catch((err) => {
        console.error("Ошибка загрузки отзывов:", err);
        return null;
      })
    ]);

    reviewsByTitle = groupReviews(reviewsSnap);

    allProducts = productsSnap.docs.map((docSnap) => {
      const item = { ...docSnap.data(), id: docSnap.id };
      const stats = getRatingStats(reviewsByTitle.get(item.title) || []);
      item.avgRating = stats.avg;
      item.reviewsCount = stats.count;
      return item;
    });

    applyFilter();
  } catch (error) {
    console.error("Ошибка загрузки товаров:", error);
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #f44336;">Не удалось загрузить каталог. Обновите страницу.</p>`;
  }
}

function renderProducts(products) {
  if (products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">Ничего не найдено</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${escapeHtml(safeUrl(item.imageUrl))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="cursor: pointer;">
      <h3 style="cursor: pointer;">${escapeHtml(item.title)}</h3>
      <div class="rating">${formatRating(item)}</div>
      <p class="price">${Number(item.price).toLocaleString()} ₸</p>
      <p style="font-size: 0.9em; color: #ccc;">${escapeHtml(item.description || "")}</p>
      <button class="add-btn" style="background:#4caf50; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px;">В корзину</button>
    `;

    card.querySelector("img").addEventListener("click", () => openProductModal(item));
    card.querySelector("h3").addEventListener("click", () => openProductModal(item));
    card.querySelector(".add-btn").addEventListener("click", () => {
      window.addToCart(item.id, item.title, item.price);
    });

    fragment.appendChild(card);
  });

  container.replaceChildren(fragment);
}

function applyFilter() {
  const queryStr = searchInput ? searchInput.value.toLowerCase().trim() : "";
  renderProducts(
    allProducts.filter((item) => item.title && item.title.toLowerCase().includes(queryStr))
  );
}

if (searchInput) {
  searchInput.addEventListener("input", applyFilter);
}

/* ==========================================
   4. Карточка товара: отзывы ТОЛЬКО для просмотра
   (писать отзыв можно только в личном кабинете, редактировать/удалять нельзя)
   ========================================== */
function openProductModal(item) {
  if (!productModal) return;

  modalImg.referrerPolicy = "no-referrer";
  modalImg.src = safeUrl(item.imageUrl);
  modalTitle.textContent = item.title;
  modalRating.textContent = formatRating(item);
  modalDescription.textContent = item.description || "";
  modalPrice.textContent = `${Number(item.price).toLocaleString()} ₸`;

  modalAddBtn.onclick = () => {
    window.addToCart(item.id, item.title, item.price);
    productModal.style.display = "none";
  };

  renderReviews(item.title);
  productModal.style.display = "flex"; // отзывы уже в памяти — окно открывается мгновенно
}

function renderReviews(productTitle) {
  if (!modalReviewsList) return;

  const list = reviewsByTitle.get(productTitle) || [];
  if (list.length === 0) {
    modalReviewsList.innerHTML = "<p style='color:#888;'>Отзывов на этот товар пока нет.</p>";
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((review) => {
    const rating = validRating(review.rating);

    const row = document.createElement("div");
    row.style.cssText = "border-bottom: 1px solid #333; padding: 6px 0; text-align: left;";

    const head = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = maskEmail(review.userEmail);
    head.append(name, rating ? ` — ${stars(rating)} (${rating})` : "");

    const body = document.createElement("div");
    body.style.cssText = "color: #ddd; margin-top: 3px;";
    body.textContent = review.text || "";

    row.append(head, body);
    fragment.appendChild(row);
  });

  modalReviewsList.replaceChildren(fragment);
}

function closeProductModal() {
  if (productModal) productModal.style.display = "none";
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeProductModal);
if (productModal) {
  productModal.addEventListener("click", (e) => {
    if (e.target === productModal) closeProductModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProductModal();
});

loadProducts();
