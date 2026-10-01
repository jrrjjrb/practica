import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml, safeUrl } from "./utils.js";

const addProductForm = document.getElementById("add-product-form");
const allOrdersList = document.getElementById("all-orders-list");
const adminProductsList = document.getElementById("admin-products-list");

// 1. Защита страницы: доступ только для role === 'admin'
// (настоящая защита — в firestore.rules, это только удобство интерфейса)
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  try {
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (!userDocSnap.exists() || userDocSnap.data().role !== "admin") {
      alert("Доступ запрещен! Эта страница только для администраторов.");
      window.location.href = "index.html";
      return;
    }
  } catch (err) {
    console.error("Ошибка проверки роли:", err);
    window.location.href = "index.html";
    return;
  }

  loadAdminProducts();
  loadAllOrders();
});

// 2. Добавление товара
if (addProductForm) {
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = addProductForm.querySelector("button[type='submit']");
    const title = document.getElementById("prod-title").value.trim();
    const price = Number(document.getElementById("prod-price").value);
    const imageUrl = document.getElementById("prod-img").value.trim();
    const description = document.getElementById("prod-desc").value.trim();

    if (!title || !(price > 0) || !safeUrl(imageUrl)) {
      alert("Проверьте название, цену (больше 0) и ссылку на картинку (http/https).");
      return;
    }

    submitBtn.disabled = true;
    try {
      await addDoc(collection(db, "products"), {
        title,
        price,
        imageUrl,
        description,
        createdAt: serverTimestamp()
      });
      alert("Товар успешно добавлен!");
      addProductForm.reset();
    } catch (err) {
      console.error("Ошибка при добавлении товара:", err);
      alert("Ошибка при добавлении товара");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// 3. Список товаров с удалением (real-time)
function loadAdminProducts() {
  if (!adminProductsList) return;

  // Один обработчик на весь список вместо навешивания на каждую кнопку при каждом обновлении
  adminProductsList.addEventListener("click", async (e) => {
    const button = e.target.closest(".delete-btn");
    if (!button) return;

    if (!confirm("Вы действительно хотите удалить этот товар из базы?")) return;
    try {
      await deleteDoc(doc(db, "products", button.dataset.id));
    } catch (err) {
      console.error("Ошибка при удалении товара:", err);
      alert("Ошибка при удалении товара");
    }
  });

  onSnapshot(collection(db, "products"), (snapshot) => {
    if (snapshot.empty) {
      adminProductsList.innerHTML = "<p style='color:#a1a1aa;'>Товаров в базе пока нет</p>";
      return;
    }

    const html = snapshot.docs.map((docSnap) => {
      const product = docSnap.data();
      return `
        <div class="order-item" style="display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${escapeHtml(safeUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="width: 45px; height: 45px; object-fit: contain; background: #141416; border-radius: 4px; padding: 4px;">
            <div>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(product.title)}</div>
              <div style="color: #22c55e; font-size: 0.9em; font-weight: 500;">${Number(product.price || 0).toLocaleString()} ₸</div>
            </div>
          </div>
          <button class="btn-logout delete-btn" data-id="${escapeHtml(docSnap.id)}">Удалить</button>
        </div>
      `;
    });

    adminProductsList.innerHTML = html.join("");
  });
}

// 4. Все заказы
async function loadAllOrders() {
  if (!allOrdersList) return;
  try {
    const querySnapshot = await getDocs(collection(db, "orders"));
    if (querySnapshot.empty) {
      allOrdersList.innerHTML = "<p style='color:#aaa;'>Заказов пока нет</p>";
      return;
    }

    const html = querySnapshot.docs.map((docSnap) => {
      const order = docSnap.data();
      const titles = (order.items || []).map((i) => i.title).join(", ");
      return `
        <div class="order-item">
          <div><b>Покупатель:</b> ${escapeHtml(order.userEmail || "Неизвестен")}</div>
          <div><b>Товары:</b> ${escapeHtml(titles)}</div>
          <div style="color:#22c55e;">Сумма: ${Number(order.totalPrice || 0).toLocaleString()} ₸</div>
        </div>
      `;
    });

    allOrdersList.innerHTML = html.join("");
  } catch (err) {
    console.error("Ошибка при загрузке заказов:", err);
  }
}
