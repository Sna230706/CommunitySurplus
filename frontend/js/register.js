document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const form = document.querySelector("[data-register-form]");
  if (!form || !window.CS) {
    return;
  }

  const message = document.querySelector("[data-form-message]");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;

    if (password.length < 6) {
      window.CS.setMessage(message, "Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      window.CS.setMessage(message, "Passwords do not match.", "error");
      return;
    }

    const payload = {
      name,
      email,
      password
    };

    try {
      await window.CS.registerUser(payload);
      window.CS.setMessage(message, "Account created.", "success");
      window.setTimeout(function () {
        window.location.href = "dashboard.html";
      }, 500);
    } catch (error) {
      window.CS.setMessage(message, error.message || "Account creation failed.", "error");
    }
  });
});
