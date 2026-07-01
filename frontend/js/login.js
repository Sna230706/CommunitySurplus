document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const form = document.querySelector("[data-login-form]");
  if (!form || !window.CS) {
    return;
  }

  const message = document.querySelector("[data-form-message]");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;

    try {
      await window.CS.loginUser({ email, password });
      window.CS.setMessage(message, "Logged in successfully.", "success");
      window.setTimeout(function () {
        window.location.href = "dashboard.html";
      }, 500);
    } catch (error) {
      window.CS.setMessage(message, error.message || "Email or password is incorrect.", "error");
    }
  });
});
