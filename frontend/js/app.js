(function () {
  "use strict";

  const CURRENT_USER_KEY = "community_surplus_current_user_v1";
  const TOKEN_KEY = "community_surplus_token_v1";
  const requestedApiBase = new URLSearchParams(window.location.search).get("apiBase");
  const API_BASE_URL = String(window.CS_API_BASE_URL || requestedApiBase || "http://localhost:5000").replace(/\/$/, "");
  const FALLBACK_IMAGE = "images/placeholder.svg";
  const LEGACY_DEMO_KEYS = [
    "community_surplus_products_v1",
    "community_surplus_wishlist_v1",
    "community_surplus_users_v1",
    "community_surplus_purchases_v1"
  ];

  let wishlistIds = new Set();
  let wishlistLoadPromise = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Local storage is not available.", error);
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn("Local storage is not available.", error);
    }
  }

  function removeLegacyDemoStorage() {
    LEGACY_DEMO_KEYS.forEach(storageRemove);
  }

  function readJSON(key, fallback) {
    const raw = storageGet(key);
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function parseQuantity(value, fallback) {
    const quantity = Number(value ?? fallback);
    return Number.isInteger(quantity) && quantity >= 0 ? quantity : fallback;
  }

  function normalizeProduct(product) {
    const raw = product || {};
    let image = raw.image || FALLBACK_IMAGE;
    if (image.startsWith("/uploads/")) {
      image = API_BASE_URL + image;
    }

    const unitPrice = Number(raw.unitPrice ?? raw.sellingPrice ?? raw.selling_price ?? 0);
    const quantity = parseQuantity(raw.quantity ?? raw.availableQuantity ?? raw.available_quantity, 0);

    return {
      id: raw.id,
      productName: raw.productName || raw.product_name || "Untitled Product",
      description: raw.description || "",
      category: raw.category || "Other",
      condition: raw.condition || "Used",
      mrp: Number(raw.mrp || 0),
      sellingPrice: unitPrice,
      unitPrice,
      quantity,
      availableQuantity: quantity,
      image,
      location: raw.location || "Not specified",
      contactNumber: raw.contactNumber || raw.contact_number || "",
      status: raw.status || (quantity > 0 ? "Available" : "Sold"),
      sellerId: raw.sellerId || raw.seller_id,
      sellerName: raw.sellerName || raw.seller_name || "Community Seller",
      createdAt: raw.createdAt || raw.created_at || ""
    };
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) {
      return "Recently";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function shortText(text, size) {
    const clean = String(text || "");
    if (clean.length <= size) {
      return clean;
    }

    return clean.slice(0, size - 3).trim() + "...";
  }

  function getCurrentUser() {
    if (!getAuthToken()) {
      return null;
    }

    return readJSON(CURRENT_USER_KEY, null);
  }

  function setCurrentUser(user) {
    if (!user) {
      storageRemove(CURRENT_USER_KEY);
      return;
    }

    storageSet(CURRENT_USER_KEY, JSON.stringify(user));
  }

  function getAuthToken() {
    return storageGet(TOKEN_KEY);
  }

  function setAuth(user, token) {
    setCurrentUser(user);
    if (token) {
      storageSet(TOKEN_KEY, token);
    }
  }

  function logout() {
    setCurrentUser(null);
    storageRemove(TOKEN_KEY);
    wishlistIds = new Set();
    wishlistLoadPromise = null;
    window.location.href = "index.html";
  }

  function setMessage(element, text, type) {
    if (!element) {
      return;
    }

    element.textContent = text;
    element.classList.remove("error", "success");
    if (type) {
      element.classList.add(type);
    }
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  async function apiFetch(path, options) {
    const settings = options || {};
    const headers = { ...(settings.headers || {}) };
    const token = getAuthToken();
    let body = settings.body;

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    if (body && !(body instanceof FormData) && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        ...settings,
        headers,
        body
      });
    } catch (error) {
      throw new Error("Could not connect to the backend API. Start the server and check the database connection.");
    }

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  async function fetchProducts() {
    const data = await apiFetch("/products");
    return (data.products || []).map(normalizeProduct);
  }

  async function fetchProductById(id) {
    if (!id) {
      return null;
    }

    const data = await apiFetch("/products/" + encodeURIComponent(id));
    return normalizeProduct(data.product);
  }

  async function fetchMyProducts() {
    const data = await apiFetch("/products/mine");
    return (data.products || []).map(normalizeProduct);
  }

  async function createProduct(formData) {
    const data = await apiFetch("/products", {
      method: "POST",
      body: formData
    });
    return normalizeProduct(data.product);
  }

  async function updateProductRemote(id, payload) {
    const data = await apiFetch("/products/" + encodeURIComponent(id), {
      method: "PUT",
      body: payload
    });
    return normalizeProduct(data.product);
  }

  async function deleteProductRemote(id) {
    return apiFetch("/products/" + encodeURIComponent(id), { method: "DELETE" });
  }

  async function confirmPurchaseRemote(productId, quantity) {
    return apiFetch("/products/" + encodeURIComponent(productId) + "/confirm", {
      method: "POST",
      body: {
        quantity: parseQuantity(quantity, 1) || 1
      }
    });
  }

  async function fetchWishlistProducts() {
    const data = await apiFetch("/wishlist");
    const products = (data.products || []).map(normalizeProduct);
    wishlistIds = new Set(products.map(function (product) {
      return String(product.id);
    }));
    return products;
  }

  async function loadWishlistIds() {
    if (!getAuthToken()) {
      wishlistIds = new Set();
      return wishlistIds;
    }

    if (!wishlistLoadPromise) {
      wishlistLoadPromise = fetchWishlistProducts()
        .then(function () {
          return wishlistIds;
        })
        .catch(function (error) {
          wishlistLoadPromise = null;
          throw error;
        });
    }

    return wishlistLoadPromise;
  }

  function getWishlist() {
    return Array.from(wishlistIds);
  }

  function isWishlisted(id) {
    return wishlistIds.has(String(id));
  }

  async function toggleWishlist(id) {
    if (!getAuthToken()) {
      throw new Error("Please log in to save products to your wishlist.");
    }

    await loadWishlistIds();
    const saved = isWishlisted(id);

    if (saved) {
      await apiFetch("/wishlist/remove/" + encodeURIComponent(id), { method: "DELETE" });
      wishlistIds.delete(String(id));
    } else {
      await apiFetch("/wishlist/add", {
        method: "POST",
        body: { product_id: id }
      });
      wishlistIds.add(String(id));
    }

    return !saved;
  }

  function updateWishlistButton(button) {
    const id = button.dataset.wishlistButton;
    const saved = isWishlisted(id);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.textContent = saved ? "Saved" : "Save";
  }

  function bindWishlistButtons(scope, afterToggle) {
    const root = scope || document;
    const buttons = Array.from(root.querySelectorAll("[data-wishlist-button]"));

    buttons.forEach(updateWishlistButton);

    if (buttons.length && getAuthToken()) {
      loadWishlistIds().then(function () {
        buttons.forEach(updateWishlistButton);
      }).catch(function (error) {
        console.warn("Wishlist load failed.", error);
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", async function () {
        const id = button.dataset.wishlistButton;
        button.disabled = true;

        try {
          const saved = await toggleWishlist(id);
          updateWishlistButton(button);
          if (typeof afterToggle === "function") {
            afterToggle(id, saved);
          }
        } catch (error) {
          window.alert(error.message || "Wishlist update failed. Please log in and try again.");
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function productCard(product, options) {
    const settings = options || {};
    const item = normalizeProduct(product);
    const sold = item.status.toLowerCase() === "sold" || item.quantity < 1;
    const availableText = sold ? "0 available" : item.quantity + " available";
    const ownerActions = settings.ownerActions ? `
      <div class="owner-actions">
        <a class="button secondary" href="edit-product.html?id=${encodeURIComponent(item.id)}">Edit</a>
        <button class="button secondary" type="button" data-toggle-status="${escapeAttr(item.id)}">${sold ? "Mark Available" : "Mark Sold"}</button>
        <button class="button danger" type="button" data-delete-product="${escapeAttr(item.id)}">Delete</button>
      </div>
    ` : "";

    return `
      <article class="product-card${sold ? " is-sold" : ""}" data-product-card="${escapeAttr(item.id)}">
        <a class="product-media" href="product.html?id=${encodeURIComponent(item.id)}">
          <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.productName)}">
          <span class="product-badge">${escapeHTML(sold ? "Sold" : item.status)}</span>
        </a>
        <div class="product-body">
          <div>
            <h3><a href="product.html?id=${encodeURIComponent(item.id)}">${escapeHTML(item.productName)}</a></h3>
            <p>${escapeHTML(shortText(item.description, 96))}</p>
          </div>
          <div class="product-facts">
            <span class="price-pill">${escapeHTML(formatMoney(item.unitPrice))} each</span>
            <span class="status-pill">${escapeHTML(availableText)}</span>
            <span class="status-pill">${escapeHTML(item.category)}</span>
            <span class="status-pill">${escapeHTML(item.condition)}</span>
          </div>
          <p class="muted">${escapeHTML(item.location)} - Listed ${escapeHTML(formatDate(item.createdAt))}</p>
        </div>
        <div class="product-actions">
          <a class="button secondary" href="product.html?id=${encodeURIComponent(item.id)}">View Details</a>
          <button class="wishlist-button" type="button" data-wishlist-button="${escapeAttr(item.id)}" aria-pressed="false">Save</button>
        </div>
        ${ownerActions}
      </article>
    `;
  }

  function renderProductGrid(container, products, options) {
    if (!container) {
      return;
    }

    if (!products.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No products found</h3>
          <p class="muted">Try a different search or add the first product for your community.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="product-grid">
        ${products.map(function (product) {
          return productCard(product, options);
        }).join("")}
      </div>
    `;
    bindWishlistButtons(container);
  }

  async function registerUser(payload) {
    const data = await apiFetch("/register", {
      method: "POST",
      body: payload
    });
    setAuth(data.user, data.token);
    return data.user;
  }

  async function loginUser(credentials) {
    const data = await apiFetch("/login", {
      method: "POST",
      body: credentials
    });
    setAuth(data.user, data.token);
    return data.user;
  }

  async function fetchDashboard() {
    return apiFetch("/dashboard");
  }

  async function fetchProfile() {
    const data = await apiFetch("/profile");
    setCurrentUser(data.user);
    return data.user;
  }

  async function updateProfileRemote(payload) {
    const data = await apiFetch("/profile", {
      method: "PUT",
      body: payload
    });
    setCurrentUser(data.user);
    return data.user;
  }

  function initNav() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    const user = getCurrentUser();
    const links = document.querySelectorAll("[data-nav-links] a");
    const toggle = document.querySelector("[data-nav-toggle]");
    const navLinks = document.querySelector("[data-nav-links]");
    const userChip = document.querySelector("[data-user-chip]");

    links.forEach(function (link) {
      const linkPage = link.getAttribute("href").split("?")[0];
      link.classList.toggle("is-active", linkPage === current);
    });

    document.querySelectorAll("[data-auth-only]").forEach(function (node) {
      node.classList.toggle("hidden", !user);
    });

    document.querySelectorAll("[data-guest-only]").forEach(function (node) {
      node.classList.toggle("hidden", Boolean(user));
    });

    if (userChip) {
      userChip.textContent = user ? user.name : "Guest";
    }

    document.querySelectorAll("[data-logout]").forEach(function (button) {
      button.addEventListener("click", logout);
    });

    if (toggle && navLinks) {
      toggle.addEventListener("click", function () {
        navLinks.classList.toggle("is-open");
      });
    }
  }

  function initHomeSearch() {
    const form = document.querySelector("[data-home-search]");
    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const query = new FormData(form).get("q") || "";
      window.location.href = "products.html?q=" + encodeURIComponent(String(query).trim());
    });
  }

  async function initDashboard() {
    const root = document.querySelector("[data-dashboard]");
    if (!root) {
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      root.innerHTML = `
        <div class="notice">Please log in to view your dashboard.</div>
        <a class="button" href="login.html">Login</a>
      `;
      return;
    }

    root.innerHTML = `<div class="empty-state"><p class="muted">Loading dashboard from the backend...</p></div>`;

    try {
      const stats = await fetchDashboard();
      const recentPurchases = stats.recentPurchases || [];

      root.innerHTML = `
        <div class="metric-grid">
          <div class="metric-card"><span class="muted">Active listings</span><strong>${Number(stats.listings ?? 0)}</strong></div>
          <div class="metric-card"><span class="muted">Wishlist items</span><strong>${Number(stats.wishlist ?? 0)}</strong></div>
          <div class="metric-card"><span class="muted">Items bought</span><strong>${Number(stats.purchases ?? 0)}</strong></div>
        </div>
        <div class="dashboard-grid">
          <section class="panel stack">
            <h2>Next action</h2>
            <p class="muted">Add a product or manage your existing listings.</p>
            <a class="button" href="sell.html">Sell Product</a>
          </section>
          <section class="panel stack">
            <h2>Recent purchases</h2>
            ${recentPurchases.length ? recentPurchases.map(function (purchase) {
              const quantity = parseQuantity(purchase.quantity, 1) || 1;
              const unitPrice = Number(purchase.unitPrice ?? purchase.price ?? 0);
              const totalPrice = Number(purchase.totalPrice ?? unitPrice * quantity);
              return `<p><strong>${escapeHTML(purchase.productName)}</strong><br><span class="muted">${escapeHTML(formatMoney(unitPrice))} x ${quantity} = ${escapeHTML(formatMoney(totalPrice))} on ${escapeHTML(formatDate(purchase.purchaseDate))}</span></p>`;
            }).join("") : `<p class="muted">No purchase requests yet.</p>`}
          </section>
          <section class="panel stack">
            <h2>Marketplace</h2>
            <p class="muted">Browse listings, save useful items, or request a quantity when you want to buy.</p>
            <a class="button secondary" href="products.html">Browse Products</a>
          </section>
        </div>
      `;
    } catch (error) {
      root.innerHTML = `<div class="notice">${escapeHTML(error.message || "Could not load dashboard.")}</div>`;
    }
  }

  async function initProfile() {
    const form = document.querySelector("[data-profile-form]");
    if (!form) {
      return;
    }

    const user = getCurrentUser();
    const message = document.querySelector("[data-form-message]");

    if (!user) {
      form.innerHTML = `<div class="notice">Please log in to view and edit your profile.</div><a class="button" href="login.html">Login</a>`;
      return;
    }

    try {
      const profile = await fetchProfile();
      form.elements.name.value = profile.name || "";
      form.elements.email.value = profile.email || "";
    } catch (error) {
      setMessage(message, error.message || "Profile load failed.", "error");
      return;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const updated = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim()
      };

      try {
        const saved = await updateProfileRemote(updated);
        setCurrentUser(saved);
        setMessage(message, "Profile updated.", "success");
        initNav();
      } catch (error) {
        setMessage(message, error.message || "Profile update failed.", "error");
      }
    });
  }

  async function initMyProducts() {
    const root = document.querySelector("[data-my-products]");
    if (!root) {
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      root.innerHTML = `<div class="notice">Please log in to manage your products.</div><a class="button" href="login.html">Login</a>`;
      return;
    }

    async function renderMine() {
      root.innerHTML = `<div class="empty-state"><p class="muted">Loading your products from the backend...</p></div>`;
      const mine = await fetchMyProducts();
      renderProductGrid(root, mine, { ownerActions: true });
    }

    root.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest("[data-delete-product]");
      const toggleButton = event.target.closest("[data-toggle-status]");

      if (deleteButton) {
        const id = deleteButton.dataset.deleteProduct;
        const ok = window.confirm("Delete this product?");
        if (!ok) {
          return;
        }

        try {
          await deleteProductRemote(id);
          await renderMine();
        } catch (error) {
          window.alert(error.message || "Delete failed.");
        }
      }

      if (toggleButton) {
        const id = toggleButton.dataset.toggleStatus;
        const nextStatus = toggleButton.textContent.includes("Available") ? "Available" : "Sold";
        try {
          await updateProductRemote(id, { status: nextStatus });
          await renderMine();
        } catch (error) {
          window.alert(error.message || "Status update failed.");
        }
      }
    });

    renderMine().catch(function (error) {
      root.innerHTML = `<div class="notice">${escapeHTML(error.message || "Could not load products.")}</div>`;
    });
  }

  async function initEditProduct() {
    const form = document.querySelector("[data-edit-product-form]");
    if (!form) {
      return;
    }

    const user = getCurrentUser();
    const message = document.querySelector("[data-form-message]");
    const id = getParam("id");

    if (!user) {
      form.innerHTML = `<div class="notice">Please log in to edit your products.</div><a class="button" href="login.html">Login</a>`;
      return;
    }

    let product;
    try {
      product = await fetchProductById(id);
    } catch (error) {
      form.innerHTML = `<div class="notice">${escapeHTML(error.message || "Product could not be loaded.")}</div>`;
      return;
    }

    if (!product) {
      form.innerHTML = `<div class="notice">Product not found. Open My Products and choose an item to edit.</div>`;
      return;
    }

    form.elements.productName.value = product.productName;
    form.elements.description.value = product.description;
    form.elements.category.value = product.category;
    form.elements.condition.value = product.condition;
    form.elements.mrp.value = product.mrp;
    form.elements.sellingPrice.value = product.unitPrice;
    form.elements.quantity.value = product.quantity;
    form.elements.location.value = product.location;
    form.elements.contactNumber.value = product.contactNumber;
    form.elements.status.value = product.status;

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
      formData.append("status", form.elements.status.value);
      if (file) {
        formData.append("image", file);
      }

      try {
        await updateProductRemote(product.id, formData);
        setMessage(message, "Product updated.", "success");
        window.setTimeout(function () {
          window.location.href = "my-products.html";
        }, 700);
      } catch (error) {
        setMessage(message, error.message || "Product update failed.", "error");
      }
    });
  }

  removeLegacyDemoStorage();

  window.CS = {
    apiFetch,
    bindWishlistButtons,
    confirmPurchaseRemote,
    createProduct,
    deleteProductRemote,
    escapeAttr,
    escapeHTML,
    fetchDashboard,
    fetchMyProducts,
    fetchProductById,
    fetchProducts,
    fetchProfile,
    fetchWishlistProducts,
    FALLBACK_IMAGE,
    formatDate,
    formatMoney,
    getAuthToken,
    getCurrentUser,
    getParam,
    getWishlist,
    isWishlisted,
    loginUser,
    normalizeProduct,
    productCard,
    registerUser,
    renderProductGrid,
    setAuth,
    setCurrentUser,
    setMessage,
    toggleWishlist,
    updateProductRemote,
    updateProfileRemote
  };

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initHomeSearch();
    initDashboard();
    initProfile();
    initMyProducts();
    initEditProduct();
  });
})();
