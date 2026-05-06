/* ============================================================
   PC STORE — MAIN SCRIPT
   Modular, clean, production-grade
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let cart = JSON.parse(localStorage.getItem('tncCart')) || [];
// Data integrity check
if (cart.length > 0 && !cart[0].image) {
  cart = [];
  localStorage.removeItem('tncCart');
}
cart.forEach(item => { if (!item.quantity) item.quantity = 1; });

let currentDiscount = parseInt(localStorage.getItem('cartDiscount')) || 0;
let selectedRating  = 5;
let slideIndex      = 0;
let slideInterval   = null;

// ============================================================
// UTILITIES
// ============================================================
const formatVND = n => n.toLocaleString('vi-VN') + ' ₫';

function genOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return 'PC-' + Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function $(selector, ctx = document) {
  return ctx.querySelector(selector);
}
function $$(selector, ctx = document) {
  return Array.from(ctx.querySelectorAll(selector));
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' error' : ''}`;
  toast.innerHTML = `${type === 'success' ? '✓' : '✕'} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

// ============================================================
// CART: CORE LOGIC
// ============================================================
function saveCart() {
  localStorage.setItem('tncCart', JSON.stringify(cart));
}

function addToCart(productName, productPrice, productImg) {
  const existing = cart.find(i => i.name === productName);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ name: productName, price: productPrice, image: productImg, quantity: 1 });
  }
  saveCart();
  updateCartUI();
  showToast(`Đã thêm "${productName}" vào giỏ hàng`);
}

function changeQuantity(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

// ============================================================
// CART: RENDER
// ============================================================
function buildCartHTML() {
  if (cart.length === 0) {
    return '<li class="empty-cart">Giỏ hàng đang trống</li>';
  }
  return cart.map((item, i) => `
    <li class="cart-item">
      <img src="${item.image}" alt="${item.name}" loading="lazy">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">${formatVND(item.price)}</span>
        <div class="qty-controls">
          <button onclick="changeQuantity(${i},-1)" aria-label="Giảm">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity(${i},1)" aria-label="Tăng">+</button>
        </div>
      </div>
      <button class="remove-btn" title="Xóa" onclick="removeFromCart(${i})" aria-label="Xóa">&times;</button>
    </li>
  `).join('');
}

function calcTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  let discount = 0;

  if (subtotal === 0) {
    currentDiscount = 0;
    localStorage.removeItem('cartDiscount');
  }

  if (subtotal > 0 && currentDiscount > 0) {
    discount = subtotal * (currentDiscount / 100);
  }

  const total = subtotal - discount;
  return { subtotal, discount, total, totalItems };
}

function buildTotalHTML({ total, discount }) {
  let html = `<strong>Tổng tiền:</strong> <span class="highlight">${formatVND(total)}</span>`;
  if (discount > 0) {
    html += `<br><small class="discount-text">↓ Đã giảm ${currentDiscount}% (${formatVND(discount)})</small>`;
  }
  return html;
}

function updateCartUI() {
  const htmlContent  = buildCartHTML();
  const totals       = calcTotals();
  const totalHTML    = buildTotalHTML(totals);

  // All cart item containers
  ['cart-items', 'modal-cart-items', 'checkout-items'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = htmlContent;
  });

  // All total containers
  ['total-price', 'modal-total-price', 'checkout-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = totalHTML;
  });

  // All badges
  $$('#cart-count').forEach(el => { el.textContent = totals.totalItems; });
}

// ============================================================
// CART MODAL
// ============================================================
function openCartModal() {
  const overlay = document.getElementById('cart-modal');
  const panel   = document.getElementById('cart-modal-content');
  if (!overlay || !panel) return;
  overlay.style.display = 'block';
  requestAnimationFrame(() => panel.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closeCartModal() {
  const overlay = document.getElementById('cart-modal');
  const panel   = document.getElementById('cart-modal-content');
  if (!overlay || !panel) return;
  panel.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 350);
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('cart-modal');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeCartModal();
    });
  }
});

// ============================================================
// PROMO CODE
// ============================================================
const PROMO_CODES = {
  'PCSTORE2026': 10,
  'GAMING2026':  15,
};

function applyPromo() {
  const input = document.getElementById('promo-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  const pct  = PROMO_CODES[code];

  if (pct) {
    currentDiscount = pct;
    localStorage.setItem('cartDiscount', currentDiscount);
    updateCartUI();
    showToast(`Mã hợp lệ! Giảm ${pct}% cho đơn hàng`);
  } else {
    showToast('Mã giảm giá không hợp lệ', 'error');
  }
  input.value = '';
}

// ============================================================
// HERO SLIDER
// ============================================================
function initSlider() {
  const slides = $$('.slide');
  if (slides.length === 0) return;
  slides.forEach((s, i) => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  slides[0].style.display = 'flex';
  slides[0].classList.add('active');
  startSlideTimer();
}

function showSlide(n) {
  const slides = $$('.slide');
  if (!slides.length) return;
  if (n >= slides.length) slideIndex = 0;
  if (n < 0)             slideIndex = slides.length - 1;
  slides.forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
  slides[slideIndex].style.display = 'flex';
  slides[slideIndex].classList.add('active');
}

function moveSlide(n) {
  clearInterval(slideInterval);
  slideIndex += n;
  showSlide(slideIndex);
  startSlideTimer();
}

function startSlideTimer() {
  clearInterval(slideInterval);
  if ($$('.slide').length > 1) {
    slideInterval = setInterval(() => { slideIndex++; showSlide(slideIndex); }, 4500);
  }
}

// ============================================================
// SEARCH
// ============================================================
function performSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  const query = input.value.trim().toLowerCase();
  if (!query) return;
  localStorage.setItem('searchQuery', query);
  window.location.href = 'all-products.html';
}

// ============================================================
// SORT BY PRICE
// ============================================================
function sortProducts() {
  const select = document.getElementById('sort-select');
  const grid   = document.querySelector('.product-grid');
  if (!grid || !select || !select.value) return;

  const cards = $$('.product-card', grid);
  cards.sort((a, b) => {
    const pa = parseInt(a.querySelector('.price').innerText.replace(/\D/g, ''));
    const pb = parseInt(b.querySelector('.price').innerText.replace(/\D/g, ''));
    return select.value === 'asc' ? pa - pb : pb - pa;
  });
  cards.forEach(c => grid.appendChild(c));
}

// ============================================================
// CATEGORY FILTER (Tags)
// ============================================================
function initFilter() {
  const tags = $$('.filter-tag');
  if (!tags.length) return;

  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      const filter = tag.dataset.filter;
      filterProducts(filter);
    });
  });
}

function filterProducts(category) {
  const cards = $$('.product-card');
  cards.forEach(card => {
    const cardCat = card.dataset.category || 'all';
    const match   = category === 'all' || cardCat === category;

    if (match) {
      card.style.display  = '';
      card.style.opacity  = '';
      card.style.transform = '';
    } else {
      card.style.opacity  = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => { if (!card.closest('.product-grid')) return;
        const active = ($('.filter-tag.active') || {}).dataset?.filter || 'all';
        if (active !== 'all' && (card.dataset.category || 'all') !== active) {
          card.style.display = 'none';
        }
      }, 250);
    }

    // Transition
    card.style.transition = 'opacity 0.25s, transform 0.25s';
  });
}

// ============================================================
// RECEIPT MODAL
// ============================================================
function openReceiptModal(customerName, phone, address, paymentMethod) {
  const overlay = document.getElementById('receipt-modal');
  if (!overlay) return;

  const totals  = calcTotals();
  const orderId = genOrderId();
  const now     = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });

  const itemsHTML = cart.map(item => `
    <div class="receipt-item-row">
      <span class="receipt-item-name">${item.name}</span>
      <span class="receipt-item-qty">x${item.quantity}</span>
      <span class="receipt-item-price">${formatVND(item.price * item.quantity)}</span>
    </div>
  `).join('');

  const discountRow = totals.discount > 0 ? `
    <div class="receipt-item-row" style="color:var(--text-dim);">
      <span class="receipt-item-name" style="color:#00e676;">Giảm giá (${currentDiscount}%)</span>
      <span class="receipt-item-price" style="color:#00e676;">-${formatVND(totals.discount)}</span>
    </div>
  ` : '';

  const payMap = {
    'cod':  'Thanh toán khi nhận hàng',
    'bank': 'Chuyển khoản ngân hàng',
    'momo': 'Ví MoMo',
  };

  overlay.querySelector('.receipt-id').textContent = `MÃ ĐƠN: ${orderId}`;
  overlay.querySelector('#receipt-customer').textContent = customerName;
  overlay.querySelector('#receipt-phone').textContent    = phone;
  overlay.querySelector('#receipt-address').textContent  = address;
  overlay.querySelector('#receipt-date').textContent     = `${dateStr} ${timeStr}`;
  overlay.querySelector('#receipt-payment').textContent  = payMap[paymentMethod] || paymentMethod;
  overlay.querySelector('.receipt-items').innerHTML      = itemsHTML + discountRow;
  overlay.querySelector('.receipt-amount').textContent   = formatVND(totals.total);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReceiptModal() {
  const overlay = document.getElementById('receipt-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  // Clear cart
  cart = [];
  currentDiscount = 0;
  localStorage.removeItem('tncCart');
  localStorage.removeItem('cartDiscount');
  window.location.href = 'index.html';
}

function printReceipt() {
  window.print();
}

// ============================================================
// PRODUCT DETAIL PAGE
// ============================================================
function viewProduct(name, price, img) {
  localStorage.setItem('viewingProduct', JSON.stringify({ name, price, image: img }));
  window.location.href = 'product.html';
}

function initProductDetail() {
  const el = document.getElementById('detail-name');
  if (!el) return;

  const product = JSON.parse(localStorage.getItem('viewingProduct') || 'null');
  if (!product) return;

  document.getElementById('detail-name').textContent  = product.name;
  document.getElementById('detail-price').textContent = formatVND(product.price);
  document.getElementById('detail-image').src         = product.image;
  document.getElementById('detail-add-btn').setAttribute(
    'onclick', `addToCart('${product.name}',${product.price},'${product.image}')`
  );

  updateStars(5);
  $$('#star-rating span').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.val);
      updateStars(selectedRating);
    });
    star.addEventListener('mouseover', () => updateStars(parseInt(star.dataset.val)));
    star.addEventListener('mouseleave', () => updateStars(selectedRating));
  });

  loadReviews();
}

// ============================================================
// STAR RATING & REVIEWS
// ============================================================
function updateStars(rating) {
  $$('#star-rating span').forEach(star => {
    star.style.color = parseInt(star.dataset.val) <= rating ? '#ffd700' : '#333';
  });
}

function submitReview() {
  const name    = document.getElementById('reviewer-name')?.value.trim();
  const text    = document.getElementById('review-text')?.value.trim();
  const product = JSON.parse(localStorage.getItem('viewingProduct') || 'null');

  if (!name || !text) { showToast('Vui lòng nhập tên và nội dung đánh giá', 'error'); return; }
  if (!product) return;

  const review    = { name, text, rating: selectedRating, date: new Date().toLocaleDateString('vi-VN') };
  const allReviews = JSON.parse(localStorage.getItem('productReviews') || '{}');
  if (!allReviews[product.name]) allReviews[product.name] = [];
  allReviews[product.name].push(review);
  localStorage.setItem('productReviews', JSON.stringify(allReviews));

  document.getElementById('reviewer-name').value = '';
  document.getElementById('review-text').value   = '';
  selectedRating = 5;
  updateStars(5);
  loadReviews();
  showToast('Cảm ơn bạn đã đánh giá sản phẩm!');
}

function loadReviews() {
  const list    = document.getElementById('reviews-list');
  if (!list) return;
  const product = JSON.parse(localStorage.getItem('viewingProduct') || 'null');
  if (!product) return;

  const allReviews     = JSON.parse(localStorage.getItem('productReviews') || '{}');
  const productReviews = allReviews[product.name] || [];

  if (!productReviews.length) {
    list.innerHTML = `
      <div class="review-card">
        <strong style="color:#fff;">Quản trị viên</strong>
        <span style="color:#ffd700;margin-left:8px;">★★★★★</span>
        <p style="color:var(--text-dim);margin-top:8px;">Sản phẩm chính hãng, chất lượng tuyệt vời. Hãy là người đầu tiên đánh giá!</p>
      </div>`;
    return;
  }

  list.innerHTML = [...productReviews].reverse().map((r, i) => `
    <div class="review-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <strong style="color:#fff;">${r.name}</strong>
          <span style="color:#ffd700;font-size:13px;margin-left:8px;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
        </div>
        <button onclick="deleteReview(${productReviews.length-1-i})"
          style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-muted);transition:var(--transition);"
          onmouseover="this.style.color='var(--red)'"
          onmouseout="this.style.color='var(--text-muted)'"
          title="Xóa">🗑</button>
      </div>
      <p style="color:var(--text-dim);margin-top:8px;font-size:14px;">${r.text}</p>
      <small style="color:var(--text-muted);font-size:11px;">${r.date}</small>
    </div>
  `).join('');
}

function deleteReview(index) {
  if (!confirm('Xóa đánh giá này?')) return;
  const product = JSON.parse(localStorage.getItem('viewingProduct') || 'null');
  if (!product) return;
  const allReviews = JSON.parse(localStorage.getItem('productReviews') || '{}');
  if (allReviews[product.name]) {
    allReviews[product.name].splice(index, 1);
    localStorage.setItem('productReviews', JSON.stringify(allReviews));
    loadReviews();
    showToast('Đã xóa đánh giá');
  }
}

// ============================================================
// ALL-PRODUCTS SEARCH FILTER
// ============================================================
function applySearchFilter() {
  const query = localStorage.getItem('searchQuery');
  if (!window.location.pathname.includes('all-products.html') || !query) return;

  const cards = $$('.product-card');
  let count   = 0;
  cards.forEach(card => {
    const match = card.innerText.toLowerCase().includes(query) ||
      (card.querySelector('img')?.alt || '').toLowerCase().includes(query);
    card.style.display = match ? '' : 'none';
    if (match) count++;
  });

  const title = document.querySelector('.section-title');
  if (title) {
    title.innerHTML = `📦 KẾT QUẢ: "<span style="color:var(--red)">${query}</span>" (${count} sản phẩm)`;
  }
  localStorage.removeItem('searchQuery');
}

// ============================================================
// SCROLL TO TOP
// ============================================================
function initScrollTop() {
  const btn = document.createElement('button');
  btn.id        = 'scrollTopBtn';
  btn.title     = 'Lên đầu trang';
  btn.innerHTML = '↑';
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.style.display = (document.documentElement.scrollTop > 300) ? 'block' : 'none';
  }, { passive: true });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ============================================================
// CHECKOUT FORM
// ============================================================
function initCheckout() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Giỏ hàng đang trống!', 'error');
      return;
    }
    const name    = document.getElementById('fullname')?.value || '';
    const phone   = document.getElementById('phone')?.value    || '';
    const address = document.getElementById('address')?.value  || '';
    const payment = document.getElementById('payment')?.value  || 'cod';

    openReceiptModal(name, phone, address, payment);
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  initSlider();
  initFilter();
  initScrollTop();
  initProductDetail();
  initCheckout();
  applySearchFilter();

  // Keyboard: Enter to search
  document.getElementById('search-input')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') performSearch();
  });

  // Close cart if checkout btn exists on a non-modal page
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (cart.length === 0) { showToast('Giỏ hàng đang trống!', 'error'); return; }
      window.location.href = 'checkout.html';
    });
  }
});