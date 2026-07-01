document.addEventListener("DOMContentLoaded", async function () {
  "use strict";

  const root = document.querySelector("[data-product-detail]");
  if (!root || !window.CS) {
    return;
  }

  const id = window.CS.getParam("id");
  let product;

  try {
    product = await window.CS.fetchProductById(id);
  } catch (error) {
    root.innerHTML = `
      <div class="empty-state">
        <h2>Product could not be loaded</h2>
        <p class="muted">${window.CS.escapeHTML(error.message || "Check that the backend API is running.")}</p>
        <a class="button" href="products.html">Browse Products</a>
      </div>
    `;
    return;
  }

  if (!product) {
    root.innerHTML = `
      <div class="empty-state">
        <h2>Product not found</h2>
        <p class="muted">This item may have been removed.</p>
        <a class="button" href="products.html">Browse Products</a>
      </div>
    `;
    return;
  }

  let availableQuantity = Math.max(0, Number(product.quantity || 0));
  const unitPrice = Number(product.unitPrice ?? product.sellingPrice ?? 0);
  const hasSession = Boolean(window.CS.getAuthToken());
  const sold = product.status.toLowerCase() === "sold" || availableQuantity < 1;
  const availableText = sold ? "0 available" : availableQuantity + " available";
  const initialQuantity = sold ? 0 : 1;
  const initialTotal = unitPrice * initialQuantity;

  root.innerHTML = `
    <div class="detail-media">
      <img src="${window.CS.escapeAttr(product.image)}" alt="${window.CS.escapeAttr(product.productName)}">
    </div>
    <div class="detail-panel">
      <div>
        <p class="eyebrow">${window.CS.escapeHTML(product.category)} - ${window.CS.escapeHTML(product.condition)}</p>
        <h1>${window.CS.escapeHTML(product.productName)}</h1>
        <p class="muted">${window.CS.escapeHTML(product.description)}</p>
      </div>
      <div class="product-facts">
        <span class="price-pill">${window.CS.escapeHTML(window.CS.formatMoney(unitPrice))} each</span>
        <span class="status-pill">MRP ${window.CS.escapeHTML(window.CS.formatMoney(product.mrp))}</span>
        <span class="status-pill" data-status-pill>${window.CS.escapeHTML(sold ? "Sold" : product.status)}</span>
        <span class="status-pill" data-quantity-pill>${window.CS.escapeHTML(availableText)}</span>
      </div>
      <ul class="detail-meta">
        <li><span>Seller</span><strong>${window.CS.escapeHTML(product.sellerName)}</strong></li>
        <li><span>Location</span><strong>${window.CS.escapeHTML(product.location)}</strong></li>
        <li><span>Contact</span><strong>${window.CS.escapeHTML(product.contactNumber || "Not shared")}</strong></li>
        <li><span>Quantity Available</span><strong data-quantity-meta>${window.CS.escapeHTML(availableText)}</strong></li>
        <li><span>Listed</span><strong>${window.CS.escapeHTML(window.CS.formatDate(product.createdAt))}</strong></li>
      </ul>
      <form class="purchase-form" data-purchase-form>
        <label class="field purchase-quantity">
          <span>Quantity Requested</span>
          <input name="quantity" type="number" min="1" max="${window.CS.escapeAttr(availableQuantity)}" step="1" value="${window.CS.escapeAttr(initialQuantity)}" ${sold ? "disabled" : ""}>
        </label>
        <div class="purchase-total" data-purchase-total>
          <span>Total</span>
          <strong>${window.CS.escapeHTML(window.CS.formatMoney(initialTotal))}</strong>
        </div>
        <div class="purchase-actions">
          <a class="button" href="${product.contactNumber ? "tel:" + encodeURIComponent(product.contactNumber) : "#"}">Contact Seller</a>
          <button class="button secondary" type="submit" data-confirm-purchase="${window.CS.escapeAttr(product.id)}" ${sold || !hasSession ? "disabled" : ""}>Request Purchase</button>
          <button class="wishlist-button" type="button" data-wishlist-button="${window.CS.escapeAttr(product.id)}" aria-pressed="false">Save</button>
        </div>
      </form>
      <p class="form-message" data-detail-message>${sold ? "This product is already marked as sold." : (!hasSession ? "Log in to request a quantity." : "")}</p>
    </div>
  `;

  window.CS.bindWishlistButtons(root);

  const purchaseForm = root.querySelector("[data-purchase-form]");
  const confirmButton = root.querySelector("[data-confirm-purchase]");
  const quantityInput = root.querySelector("[name='quantity']");
  const quantityPill = root.querySelector("[data-quantity-pill]");
  const quantityMeta = root.querySelector("[data-quantity-meta]");
  const statusPill = root.querySelector("[data-status-pill]");
  const totalDisplay = root.querySelector("[data-purchase-total] strong");
  const message = root.querySelector("[data-detail-message]");

  function requestedQuantity() {
    const value = Number(quantityInput.value);
    return Number.isInteger(value) && value > 0 ? value : 0;
  }

  function updateTotalDisplay() {
    if (totalDisplay) {
      totalDisplay.textContent = window.CS.formatMoney(unitPrice * requestedQuantity());
    }
  }

  function updateQuantityDisplay(nextProduct) {
    if (nextProduct) {
      product.status = nextProduct.status;
      availableQuantity = Math.max(0, Number(nextProduct.quantity || 0));
    } else {
      availableQuantity = Math.max(0, availableQuantity - Number(quantityInput.value || 0));
      product.status = availableQuantity === 0 ? "Sold" : "Available";
    }

    const isSold = product.status.toLowerCase() === "sold" || availableQuantity < 1;
    const nextText = isSold ? "0 available" : availableQuantity + " available";
    quantityPill.textContent = nextText;
    quantityMeta.textContent = nextText;
    statusPill.textContent = isSold ? "Sold" : product.status;
    quantityInput.max = String(availableQuantity);
    quantityInput.value = isSold ? "0" : "1";
    quantityInput.disabled = isSold;
    confirmButton.disabled = isSold || !window.CS.getAuthToken();
    updateTotalDisplay();
  }

  if (quantityInput) {
    quantityInput.addEventListener("input", updateTotalDisplay);
  }

  if (purchaseForm && confirmButton) {
    purchaseForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const requestedQuantity = Number(quantityInput.value);

      if (!window.CS.getAuthToken()) {
        window.CS.setMessage(message, "Please log in to request a quantity.", "error");
        return;
      }

      if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > availableQuantity) {
        window.CS.setMessage(message, "Choose a quantity between 1 and " + availableQuantity + ".", "error");
        return;
      }

      try {
        const result = await window.CS.confirmPurchaseRemote(product.id, requestedQuantity);
        const updatedProduct = result && result.product ? window.CS.normalizeProduct(result.product) : null;
        updateQuantityDisplay(updatedProduct);
        const totalPrice = result && result.totalPrice ? Number(result.totalPrice) : unitPrice * requestedQuantity;
        window.CS.setMessage(message, "Purchase requested for " + requestedQuantity + " item" + (requestedQuantity === 1 ? "" : "s") + ". Total: " + window.CS.formatMoney(totalPrice) + ".", "success");
      } catch (error) {
        window.CS.setMessage(message, error.message || "Purchase confirmation failed.", "error");
      }
    });
  }
});
