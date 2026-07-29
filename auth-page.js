const form = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const displayNameInput = document.querySelector("#display-name");
const statusEl = document.querySelector("#auth-status");
const signUpButton = document.querySelector("#sign-up");
const signOutButton = document.querySelector("#sign-out");
const openAppLink = document.querySelector("#open-app");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff8296" : "";
}

function renderSession(session) {
  const signedIn = Boolean(session?.user);
  signOutButton.classList.toggle("hidden", !signedIn);
  openAppLink.classList.toggle("hidden", !signedIn);
  form.querySelector('button[type="submit"]').classList.toggle("hidden", signedIn);
  signUpButton.classList.toggle("hidden", signedIn);
  setStatus(signedIn ? `เข้าสู่ระบบแล้ว: ${session.user.email}` : "พร้อมเข้าสู่ระบบ");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("กำลังเข้าสู่ระบบ...");
  const { data, error } = await window.LOTTOVIP_AUTH.signIn(emailInput.value, passwordInput.value);
  if (error) return setStatus(error.message, true);
  renderSession(data.session);
});

signUpButton.addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  setStatus("กำลังสร้างบัญชี...");
  const { data, error } = await window.LOTTOVIP_AUTH.signUp(
    emailInput.value,
    passwordInput.value,
    displayNameInput.value
  );
  if (error) return setStatus(error.message, true);
  renderSession(data.session);
  if (!data.session) setStatus("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
});

signOutButton.addEventListener("click", async () => {
  const { error } = await window.LOTTOVIP_AUTH.signOut();
  if (error) return setStatus(error.message, true);
  renderSession(null);
});

window.LOTTOVIP_AUTH.getSession().then(({ data }) => renderSession(data.session));
window.lottovipSupabase.auth.onAuthStateChange((_event, session) => renderSession(session));

