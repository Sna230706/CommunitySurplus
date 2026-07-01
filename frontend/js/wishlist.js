document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const root = document.querySelector("[data-wishlist-page]");
  if (!root || !window.CS) {
    return;
  }

  async function render() {
    if (!window.CS.getAuthToken()) {
      root.innerHTML = `<div class="notice">Please log in to view your saved products.</div><a class="button" href="login.html">Login</a>`;
      return;
    }

    root.innerHTML = `<div class="empty-state"><p class="muted">Loading wishlist from the backend...</p></div>`;
    const products = await window.CS.fetchWishlistProducts();
    window.CS.renderProductGrid(root, products);
    window.CS.bindWishlistButtons(root, render);
  }

  render().catch(function (error) {
    root.innerHTML = `<div class="notice">${window.CS.escapeHTML(error.message || "Could not load wishlist.")}</div>`;
  });
});
