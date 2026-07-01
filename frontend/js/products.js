document.addEventListener("DOMContentLoaded", async function () {
  "use strict";

  const grid = document.querySelector("[data-product-grid]");
  if (!grid || !window.CS) {
    return;
  }

  const searchInput = document.querySelector("[data-product-search]");
  const categorySelect = document.querySelector("[data-category-filter]");
  const conditionSelect = document.querySelector("[data-condition-filter]");
  const statusSelect = document.querySelector("[data-status-filter]");
  const sortSelect = document.querySelector("[data-sort-filter]");
  const countLabel = document.querySelector("[data-product-count]");
  const chips = document.querySelector("[data-category-chips]");
  const featuredLimit = Number(grid.dataset.featuredLimit || 0);
  let activeChip = "All";

  function uniqueValues(products, key) {
    return Array.from(new Set(products.map(function (product) {
      return product[key];
    }).filter(Boolean))).sort();
  }

  function fillSelect(select, label, values) {
    if (!select) {
      return;
    }

    select.innerHTML = `<option value="">${window.CS.escapeHTML(label)}</option>` + values.map(function (value) {
      return `<option value="${window.CS.escapeAttr(value)}">${window.CS.escapeHTML(value)}</option>`;
    }).join("");
  }

  function buildChips(products) {
    if (!chips) {
      return;
    }

    const values = ["All"].concat(uniqueValues(products, "category"));
    chips.innerHTML = values.map(function (value) {
      return `<button class="chip${value === activeChip ? " is-active" : ""}" type="button" data-category-chip="${window.CS.escapeAttr(value)}">${window.CS.escapeHTML(value)}</button>`;
    }).join("");
  }

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    if (searchInput && q) {
      searchInput.value = q;
    }
  }

  function productMatches(product, query, category, condition, status) {
    const haystack = [
      product.productName,
      product.description,
      product.category,
      product.condition,
      product.location,
      product.sellerName
    ].join(" ").toLowerCase();

    const chipCategory = activeChip === "All" ? "" : activeChip;
    return (!query || haystack.includes(query)) &&
      (!category || product.category === category) &&
      (!chipCategory || product.category === chipCategory) &&
      (!condition || product.condition === condition) &&
      (!status || product.status === status);
  }

  function sortProducts(products, mode) {
    const copy = products.slice();
    if (mode === "price-low") {
      return copy.sort(function (a, b) {
        return a.sellingPrice - b.sellingPrice;
      });
    }

    if (mode === "price-high") {
      return copy.sort(function (a, b) {
        return b.sellingPrice - a.sellingPrice;
      });
    }

    return copy.sort(function (a, b) {
      return Number(b.id) - Number(a.id) || new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function render() {
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const category = categorySelect ? categorySelect.value : "";
    const condition = conditionSelect ? conditionSelect.value : "";
    const status = statusSelect ? statusSelect.value : "";
    const sortMode = sortSelect ? sortSelect.value : "recent";
    const hasFilters = Boolean(query || category || condition || status || activeChip !== "All");
    let products = allProducts.filter(function (product) {
      return productMatches(product, query, category, condition, status);
    });

    products = sortProducts(products, sortMode);
    if (featuredLimit && !hasFilters) {
      products = products.slice(0, featuredLimit);
    }

    window.CS.renderProductGrid(grid, products);

    if (countLabel) {
      countLabel.textContent = products.length + " item" + (products.length === 1 ? "" : "s");
    }
  }

  grid.innerHTML = `<div class="empty-state"><p class="muted">Loading products from the backend...</p></div>`;
  let allProducts = [];
  try {
    allProducts = await window.CS.fetchProducts();
  } catch (error) {
    grid.innerHTML = `<div class="notice">${window.CS.escapeHTML(error.message || "Could not load products from the backend.")}</div>`;
    if (countLabel) {
      countLabel.textContent = "0 items";
    }
    return;
  }
  readQuery();
  fillSelect(categorySelect, "All categories", uniqueValues(allProducts, "category"));
  fillSelect(conditionSelect, "Any condition", uniqueValues(allProducts, "condition"));
  fillSelect(statusSelect, "Any status", uniqueValues(allProducts, "status"));
  buildChips(allProducts);

  [searchInput, categorySelect, conditionSelect, statusSelect, sortSelect].forEach(function (control) {
    if (control) {
      control.addEventListener("input", render);
      control.addEventListener("change", render);
    }
  });

  if (chips) {
    chips.addEventListener("click", function (event) {
      const button = event.target.closest("[data-category-chip]");
      if (!button) {
        return;
      }

      activeChip = button.dataset.categoryChip;
      buildChips(allProducts);
      render();
    });
  }

  render();
});
