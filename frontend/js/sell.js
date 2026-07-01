document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const form = document.querySelector("[data-sell-form]");
  if (!form || !window.CS) {
    return;
  }

  const message = document.querySelector("[data-form-message]");
  const user = window.CS.getCurrentUser();

  if (!user || !window.CS.getAuthToken()) {
    window.CS.setMessage(message, "Log in before adding a product.", "error");
    form.querySelectorAll("input, select, textarea, button").forEach(function (control) {
      control.disabled = true;
    });
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const file = form.elements.image.files[0];
    const formData = new FormData();

    formData.append("product_name", form.elements.productName.value.trim());
    formData.append("description", form.elements.description.value.trim());
    formData.append("category", form.elements.category.value);
    formData.append("condition", form.elements.condition.value);
    formData.append("mrp", form.elements.mrp.value);
    formData.append("selling_price", form.elements.sellingPrice.value);
    formData.append("quantity", form.elements.quantity.value);
    formData.append("location", form.elements.location.value.trim());
    formData.append("contact_number", form.elements.contactNumber.value.trim());
    if (file) {
      formData.append("image", file);
    }

    try {
      await window.CS.createProduct(formData);
      window.CS.setMessage(message, "Product added to the marketplace.", "success");
      form.reset();
      window.setTimeout(function () {
        window.location.href = "my-products.html";
      }, 700);
    } catch (error) {
      window.CS.setMessage(message, error.message || "Product save failed.", "error");
    }
  });
});
