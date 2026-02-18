const $ = (id) => document.getElementById(id);

const stepEmail = $("step-email");
const stepOtp = $("step-otp");
const stepSuccess = $("step-success");

const emailInput = $("email");
const otpInput = $("otp");

const statusEl = $("status");
const userEl = $("user");

function setStatus(message) {
  statusEl.textContent = message || "";
}

function show(step) {
  stepEmail.classList.toggle("hidden", step !== "email");
  stepOtp.classList.toggle("hidden", step !== "otp");
  stepSuccess.classList.toggle("hidden", step !== "success");
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function refreshStatus() {
  const res = await fetch("/api/auth/status");
  const data = await res.json().catch(() => ({ loggedIn: false }));

  if (data.loggedIn) {
    userEl.textContent = JSON.stringify(data.user, null, 2);
    show("success");
  } else {
    show("email");
  }
}

$("btn-send").addEventListener("click", async () => {
  try {
    setStatus("Sending OTP...");
    const email = emailInput.value.trim();
    await api("/api/auth/start", { email });
    setStatus("OTP sent. Check your email.");
    show("otp");
    otpInput.value = "";
    otpInput.focus();
  } catch (e) {
    setStatus(e.message);
  }
});

$("btn-verify").addEventListener("click", async () => {
  try {
    setStatus("Verifying...");
    const code = otpInput.value.trim();
    const data = await api("/api/auth/verify", { code });
    userEl.textContent = JSON.stringify(data.user, null, 2);
    setStatus("");
    show("success");
  } catch (e) {
    setStatus(e.message);
  }
});

$("btn-back").addEventListener("click", () => {
  setStatus("");
  show("email");
});

$("btn-logout").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", {});
    setStatus("Logged out.");
    show("email");
  } catch (e) {
    setStatus(e.message);
  }
});

refreshStatus().catch(() => show("email"));
