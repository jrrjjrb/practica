import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const switchBtn = document.getElementById("switch-btn");
const formTitle = document.getElementById("form-title");

let isLogin = true;

const ERRORS = {
  "auth/email-already-in-use": "Этот email уже зарегистрирован.",
  "auth/invalid-email": "Некорректный email.",
  "auth/weak-password": "Пароль слишком простой (минимум 6 символов).",
  "auth/invalid-credential": "Неверный email или пароль.",
  "auth/user-not-found": "Неверный email или пароль.",
  "auth/wrong-password": "Неверный email или пароль.",
  "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
  "auth/network-request-failed": "Нет соединения с интернетом."
};

// Переключение Вход / Регистрация
if (switchBtn) {
  switchBtn.addEventListener("click", () => {
    isLogin = !isLogin;
    formTitle.textContent = isLogin ? "Вход" : "Регистрация";
    submitBtn.textContent = isLogin ? "Войти" : "Зарегистрироваться";
    switchBtn.textContent = isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти";
  });
}

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Запись в users (роль всегда "user", админа назначают вручную в консоли Firebase)
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "user",
          createdAt: serverTimestamp()
        });
      }
      window.location.href = "index.html";
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      alert(ERRORS[error.code] || "Ошибка: " + error.message);
      submitBtn.disabled = false;
    }
  });
}
