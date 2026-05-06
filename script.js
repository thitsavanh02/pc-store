/* ============================================================
   PC STORE — MAIN SCRIPT  v2.0
   Modular, production-grade frontend logic
   ============================================================ */

'use strict';

// ============================================================
//  MODULE: STATE
// ============================================================
const State = (() => {
  let cart = JSON.parse(localStorage.getItem('tncCart')) || [];

  // Guard: purge any cart data missing images (legacy cleanup)
  if (cart.length > 0 && !cart[0]?.image) {
    cart = [];
    localStorage.removeItem('tncCart');
  }
  cart.forEach(item => { if (!item.quantity) item.quantity = 1; });

  let discount = parseInt(localStorage.getItem('cartDiscount')) || 0;
  let selectedRating = 5;
  let slideIndex = 0;
  let slideInterval = null;

  return {
    get cart()           { return cart; },
    set cart(v)          { cart = v; },
    get discount()       { return discount; },
    set discount(v)      { discount = v; },
    get selectedRating() { return selectedRating; },
    set selectedRating(v){ selectedRating = v; },
    get slideIndex()     { return slideIndex; },
    set slideIndex(v)    { slideIndex = v; },
    get slideInterval()  { return slideInterval; },
    set slideInterval(v) { slideInterval = v; },
  };
})();

// ============================================================
//  MODULE: UTILITIES
// ============================================================
const Utils = {
  formatVND:  n => n.toLocaleString('vi-VN') + ' ₫',
  genOrderId: () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return 'PC-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  $:  (sel, ctx = document) => ctx.querySelector(sel),
  $$: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),

  /**
   * Debounce — prevents rapid repeated calls
   */
  debounce(fn, delay = 150) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  },

  /**
   * Format a JS Date to Vietnamese locale string
   */
  formatDate(d = new Date()) {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  },
};

// ============================================================
//  MODULE: TOAST NOTIFICATIONS
// ============================================================
const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.id = 'toast-container';
        document.body.appendChild(this._container);
      }
    }
    return this._container;
  },

  show(message, type = 'success', duration = 3000) {
    const container = this._getContainer();
    const iconMap = { success: '✓', error: '✕', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.position = 'relative';
    toast.innerHTML = `
      <div class="toast-icon">${iconMap[type] || '✓'}</div>
      <span class="toast-msg">${message}</span>
      <div class="toast-progress"></div>
    `;
    container.appendChild(toast);

    const timer = setTimeout(() => {
      toast.classList.add('hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);

    // Click to dismiss early
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      toast.classList.add('hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    });
  },

  success: (msg, dur) => Toast.show(msg, 'success', dur),
  error:   (msg, dur) => Toast.show(msg, 'error',   dur),
  info:    (msg, dur) => Toast.show(msg, 'info',    dur),
};

// Expose legacy alias
function showToast(message, type = 'success') { Toast.show(message, type); }

// ============================================================
//  MODULE: PAGE TRANSITIONS
// ============================================================
const PageTransition = {
  _overlay: null,

  _get() {
    if (!this._overlay) {
      this._overlay = document.createElement('div');
      this._overlay.id = 'page-transition';
      document.body.appendChild(this._overlay);
    }
    return this._overlay;
  },

  /**
   * Navigate to a URL with a smooth page-leave animation
   */
  navigate(url) {
    const el = this._get();
    el.classList.add('leaving');
    setTimeout(() => { window.location.href = url; }, 380);
  },

  /**
   * Animate in on page load
   */
  enter() {
    const el = this._get();
    el.classList.add('entering');
    requestAnimationFrame(() => {
      setTimeout(() => { el.classList.remove('entering'); el.classList.add('done'); }, 50);
    });
  },
};

// ============================================================
//  MODULE: CART
// ============================================================
const Cart = {

  save() {
    localStorage.setItem('tncCart', JSON.stringify(State.cart));
  },

  add(name, price, image) {
    const existing = State.cart.find(i => i.name === name);
    if (existing) {
      existing.quantity += 1;
    } else {
      State.cart.push({ name, price, image, quantity: 1 });
    }
    this.save();
    this.updateUI();
    this._bumpBadge();
    Toast.success(`Đã thêm vào giỏ: <strong>${name}</strong>`);
  },

  changeQty(index, delta) {
    State.cart[index].quantity += delta;
    if (State.cart[index].quantity <= 0) State.cart.splice(index, 1);
    this.save();
    this.updateUI();
  },

  remove(index) {
    const name = State.cart[index]?.name || '';
    State.cart.splice(index, 1);
    this.save();
    this.updateUI();
    Toast.info(`Đã xóa "${name}" khỏi giỏ`);
  },

  clear() {
    State.cart = [];
    State.discount = 0;
    localStorage.removeItem('tncCart');
    localStorage.removeItem('cartDiscount');
    this.updateUI();
  },

  _bumpBadge() {
    Utils.$$('#cart-count').forEach(el => {
      el.classList.remove('bump');
      void el.offsetWidth; // reflow
      el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 400);
    });
  },

  calcTotals() {
    const subtotal   = State.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalItems = State.cart.reduce((s, i) => s + i.quantity, 0);
    if (subtotal === 0) {
      State.discount = 0;
      localStorage.removeItem('cartDiscount');
    }
    const discountAmt = (subtotal > 0 && State.discount > 0)
      ? subtotal * (State.discount / 100) : 0;
    return { subtotal, discountAmt, total: subtotal - discountAmt, totalItems };
  },

  _buildItemsHTML() {
    if (State.cart.length === 0) return '<li class="empty-cart"></li>';
    return State.cart.map((item, i) => `
      <li class="cart-item">
        <img src="${item.image}" alt="${item.name}" loading="lazy">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-price">${Utils.formatVND(item.price)}</span>
          <div class="qty-controls">
            <button onclick="Cart.changeQty(${i}, -1)" aria-label="Giảm">−</button>
            <span>${item.quantity}</span>
            <button onclick="Cart.changeQty(${i}, 1)" aria-label="Tăng">+</button>
          </div>
        </div>
        <button class="remove-btn" onclick="Cart.remove(${i})" aria-label="Xóa sản phẩm">&times;</button>
      </li>
    `).join('');
  },

  _buildTotalHTML({ total, discountAmt }) {
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-family:var(--font-hud);font-size:10px;letter-spacing:2px;color:var(--text-muted);">TỔNG TIỀN</span>
        <span class="highlight">${Utils.formatVND(total)}</span>
      </div>
    `;
    if (discountAmt > 0) {
      html += `<p class="discount-text" style="text-align:right;margin-top:4px;">
        ↓ Đã giảm ${State.discount}% (−${Utils.formatVND(discountAmt)})
      </p>`;
    }
    return html;
  },

  updateUI() {
    const itemsHTML = this._buildItemsHTML();
    const totals    = this.calcTotals();
    const totalHTML = this._buildTotalHTML(totals);

    ['modal-cart-items', 'checkout-items'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = itemsHTML;
    });

    ['modal-total-price', 'checkout-total'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = totalHTML;
    });

    Utils.$$('#cart-count').forEach(el => { el.textContent = totals.totalItems; });
  },
};

// Expose globally (used by inline onclick handlers in HTML)
function addToCart(name, price, img) { Cart.add(name, price, img); }
function changeQuantity(i, d) { Cart.changeQty(i, d); }
function removeFromCart(i) { Cart.remove(i); }

// ============================================================
//  MODULE: CART MODAL
// ============================================================
const CartModal = {
  open() {
    const overlay = document.getElementById('cart-modal');
    const panel   = document.getElementById('cart-modal-content');
    if (!overlay || !panel) return;
    overlay.style.display = 'block';
    requestAnimationFrame(() => panel.classList.add('open'));
    document.body.style.overflow = 'hidden';
  },

  close() {
    const overlay = document.getElementById('cart-modal');
    const panel   = document.getElementById('cart-modal-content');
    if (!overlay || !panel) return;
    panel.classList.remove('open');
    setTimeout(() => {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }, 400);
  },

  init() {
    const overlay = document.getElementById('cart-modal');
    if (overlay) {
      overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });
  },
};

function openCartModal()  { CartModal.open(); }
function closeCartModal() { CartModal.close(); }

// ============================================================
//  MODULE: PROMO CODES
// ============================================================
const Promo = {
  CODES: { 'PCSTORE2026': 10, 'GAMING2026': 15, 'NEWGAMER': 5 },

  apply() {
    const input = document.getElementById('promo-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    const pct  = this.CODES[code];

    if (pct) {
      State.discount = pct;
      localStorage.setItem('cartDiscount', pct);
      Cart.updateUI();
      Toast.success(`Mã hợp lệ! Giảm ${pct}% cho đơn hàng 🎉`);
    } else {
      Toast.error('Mã giảm giá không hợp lệ');
    }
    input.value = '';
  },
};

function applyPromo() { Promo.apply(); }

// ============================================================
//  MODULE: HERO SLIDER
// ============================================================
const Slider = {
  _slides: [],
  _dots:   [],

  init() {
    this._slides = Utils.$$('.slide');
    if (!this._slides.length) return;

    // Create dots
    this._createDots();

    // Hide all, show first
    this._slides.forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    this._show(0);
    this._startTimer();

    // Keyboard support
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // Touch swipe
    this._initSwipe();
  },

  _createDots() {
    const slider = Utils.$('.hero-slider');
    if (!slider || this._slides.length <= 1) return;
    const dotsEl = document.createElement('div');
    dotsEl.className = 'slider-dots';
    this._slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => { this._stop(); this._show(i); this._startTimer(); });
      dotsEl.appendChild(dot);
    });
    slider.appendChild(dotsEl);
    this._dots = Utils.$$('.slider-dot');
  },

  _show(n) {
    if (n >= this._slides.length) n = 0;
    if (n < 0) n = this._slides.length - 1;
    State.slideIndex = n;

    this._slides.forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    this._slides[n].style.display = 'flex';
    this._slides[n].classList.add('active');

    this._dots.forEach((d, i) => d.classList.toggle('active', i === n));
  },

  next() { this._stop(); this._show(State.slideIndex + 1); this._startTimer(); },
  prev() { this._stop(); this._show(State.slideIndex - 1); this._startTimer(); },

  _startTimer() {
    this._stop();
    if (this._slides.length > 1) {
      State.slideInterval = setInterval(() => this._show(State.slideIndex + 1), 4800);
    }
  },
  _stop() { clearInterval(State.slideInterval); },

  _initSwipe() {
    const slider = Utils.$('.hero-slider');
    if (!slider) return;
    let startX = 0;
    slider.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) diff > 0 ? this.next() : this.prev();
    }, { passive: true });
  },
};

function moveSlide(n) { n > 0 ? Slider.next() : Slider.prev(); }

// ============================================================
//  MODULE: PRODUCT FILTER & SORT
// ============================================================
const Products = {
  initFilter() {
    const tags = Utils.$$('.filter-tag');
    if (!tags.length) return;
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        tags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        this._filter(tag.dataset.filter);
      });
    });
  },

  _filter(category) {
    Utils.$$('.product-card').forEach(card => {
      const match = category === 'all' || card.dataset.category === category;
      card.style.display = match ? '' : 'none';
    });
  },

  sort() {
    const select = document.getElementById('sort-select');
    const grid   = Utils.$('.product-grid');
    if (!grid || !select || !select.value) return;

    const cards = Utils.$$('.product-card', grid);
    cards.sort((a, b) => {
      const pa = parseInt(a.querySelector('.price').innerText.replace(/\D/g, ''));
      const pb = parseInt(b.querySelector('.price').innerText.replace(/\D/g, ''));
      return select.value === 'asc' ? pa - pb : pb - pa;
    });
    cards.forEach(c => grid.appendChild(c));
  },

  applySearchFilter() {
    const query = localStorage.getItem('searchQuery');
    if (!window.location.pathname.includes('all-products.html') || !query) return;

    let count = 0;
    Utils.$$('.product-card').forEach(card => {
      const match = card.innerText.toLowerCase().includes(query);
      card.style.display = match ? '' : 'none';
      if (match) count++;
    });
    const title = Utils.$('.section-title');
    if (title) {
      title.innerHTML = `📦 KẾT QUẢ: "<span style="color:var(--red)">${query}</span>" (${count} sản phẩm)`;
    }
    localStorage.removeItem('searchQuery');
  },

  /**
   * Replace product-grid with skeleton loaders, then reveal real cards
   * Useful when loading from an API in the future
   */
  showSkeletons(count = 4) {
    const grid = Utils.$('.product-grid');
    if (!grid) return;
    const skels = Array.from({ length: count }, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-line w80"></div>
        <div class="skeleton skeleton-line w60"></div>
        <div class="skeleton skeleton-line w40"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    `).join('');
    grid.innerHTML = skels;
  },
};

function sortProducts() { Products.sort(); }

// ============================================================
//  MODULE: SEARCH
// ============================================================
const Search = {
  perform() {
    const input = document.getElementById('search-input');
    if (!input || !input.value.trim()) return;
    localStorage.setItem('searchQuery', input.value.trim().toLowerCase());
    PageTransition.navigate('all-products.html');
  },
};

function performSearch() { Search.perform(); }

// ============================================================
//  MODULE: RECEIPT MODAL
// ============================================================
const Receipt = {
  open(customerName, phone, address, paymentMethod) {
    const overlay = document.getElementById('receipt-modal');
    if (!overlay) return;

    const totals  = Cart.calcTotals();
    const orderId = Utils.genOrderId();
    const dateStr = Utils.formatDate();

    const itemsHTML = State.cart.map(item => `
      <div class="receipt-item-row">
        <span class="receipt-item-name">${item.name}</span>
        <span class="receipt-item-qty">x${item.quantity}</span>
        <span class="receipt-item-price">${Utils.formatVND(item.price * item.quantity)}</span>
      </div>
    `).join('');

    const payMap = { cod: 'Thanh toán khi nhận hàng', bank: 'Chuyển khoản ngân hàng', momo: 'Ví MoMo' };

    overlay.querySelector('.receipt-id').textContent = `MÃ ĐƠN: ${orderId}`;
    overlay.querySelector('#receipt-customer').textContent = customerName;
    overlay.querySelector('#receipt-phone').textContent    = phone;
    overlay.querySelector('#receipt-address').textContent  = address;
    overlay.querySelector('#receipt-date').textContent     = dateStr;
    overlay.querySelector('#receipt-payment').textContent  = payMap[paymentMethod] || paymentMethod;
    overlay.querySelector('.receipt-items').innerHTML      = itemsHTML;
    overlay.querySelector('.receipt-amount').textContent   = Utils.formatVND(totals.total);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    const overlay = document.getElementById('receipt-modal');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    Cart.clear();
    PageTransition.navigate('index.html');
  },
};

function openReceiptModal(n, p, a, m) { Receipt.open(n, p, a, m); }
function closeReceiptModal()          { Receipt.close(); }
function printReceipt()               { window.print(); }

// ============================================================
//  MODULE: PRODUCT DETAIL
// ============================================================
const ProductDetail = {
  init() {
    const el = document.getElementById('detail-name');
    if (!el) return;

    const product = JSON.parse(localStorage.getItem('viewingProduct') || 'null');
    if (!product) { window.location.href = 'index.html'; return; }

    el.textContent = product.name;
    document.getElementById('detail-price').textContent = Utils.formatVND(product.price);
    document.getElementById('detail-image').src         = product.image;
    document.getElementById('detail-add-btn')
      .setAttribute('onclick', `Cart.add('${product.name}',${product.price},'${product.image}')`);

    this._initStars();
  },

  _initStars() {
    this._updateStarUI(State.selectedRating);
    Utils.$$('#star-rating span').forEach(star => {
      star.addEventListener('mouseenter', () => this._updateStarUI(parseInt(star.dataset.val)));
      star.addEventListener('mouseleave', () => this._updateStarUI(State.selectedRating));
      star.addEventListener('click', () => {
        State.selectedRating = parseInt(star.dataset.val);
        this._updateStarUI(State.selectedRating);
      });
    });
  },

  _updateStarUI(rating) {
    Utils.$$('#star-rating span').forEach(star => {
      star.style.color = parseInt(star.dataset.val) <= rating ? '#ffd700' : '#333';
    });
  },
};

// Store product data and navigate
function viewProduct(name, price, img) {
  localStorage.setItem('viewingProduct', JSON.stringify({ name, price, image: img }));
  PageTransition.navigate('product.html');
}

// ============================================================
//  MODULE: REVIEWS
// ============================================================
const Reviews = {
  _key() {
    const p = JSON.parse(localStorage.getItem('viewingProduct') || '{}');
    return `reviews_${p.name || 'unknown'}`;
  },

  load() {
    const list = document.getElementById('reviews-list');
    if (!list) return;
    const reviews = JSON.parse(localStorage.getItem(this._key()) || '[]');
    list.innerHTML = reviews.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>'
      : reviews.map(r => `
        <div class="review-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:14px;">${r.name}</strong>
            <span style="color:#ffd700;font-size:14px;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.5;">${r.text}</p>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:8px;display:block;">${r.date}</span>
        </div>
      `).join('');
  },

  submit() {
    const nameEl = document.getElementById('reviewer-name');
    const textEl = document.getElementById('review-text');
    if (!nameEl || !textEl) return;

    const name = nameEl.value.trim();
    const text = textEl.value.trim();
    if (!name || !text) { Toast.error('Vui lòng điền tên và nội dung đánh giá'); return; }

    const reviews = JSON.parse(localStorage.getItem(this._key()) || '[]');
    reviews.unshift({ name, text, rating: State.selectedRating, date: Utils.formatDate() });
    localStorage.setItem(this._key(), JSON.stringify(reviews));

    nameEl.value = '';
    textEl.value = '';
    State.selectedRating = 5;
    ProductDetail._updateStarUI(5);
    this.load();
    Toast.success('Đánh giá của bạn đã được gửi!');
  },
};

function submitReview() { Reviews.submit(); }

// ============================================================
//  MODULE: CHECKOUT
// ============================================================
const Checkout = {
  init() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (State.cart.length === 0) { Toast.error('Giỏ hàng đang trống!'); return; }

      const name    = document.getElementById('fullname')?.value?.trim() || '';
      const phone   = document.getElementById('phone')?.value?.trim()    || '';
      const email   = document.getElementById('email')?.value?.trim()    || '';
      const address = document.getElementById('address')?.value?.trim()  || '';
      const payment = document.getElementById('payment')?.value          || 'cod';

      // Basic front-end validation
      if (!name)    { Toast.error('Vui lòng nhập họ tên'); return; }
      if (!phone)   { Toast.error('Vui lòng nhập số điện thoại'); return; }
      if (!email)   { Toast.error('Vui lòng nhập email'); return; }
      if (!address) { Toast.error('Vui lòng nhập địa chỉ'); return; }

      const orderData = {
        orderId: Utils.genOrderId(),
        name, phone, email, address, payment,
        items: State.cart,
        total: Cart.calcTotals().total,
      };

      // Disable submit button while processing
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'ĐANG XỬ LÝ...'; }

      Toast.info('Đang xử lý đơn hàng...');

      try {
        const response = await fetch('http://localhost:3000/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const result = await response.json();

        if (result.success) {
          Receipt.open(name, phone, address, payment);
        } else {
          throw new Error(result.message || 'Unknown error');
        }
      } catch (err) {
        console.error('[Checkout Error]', err);
        Toast.error('Không thể kết nối server. Vui lòng kiểm tra và thử lại.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'XÁC NHẬN ĐẶT HÀNG →'; }
      }
    });
  },
};

// ============================================================
//  MODULE: HEADER ENHANCEMENTS
// ============================================================
const Header = {
  init() {
    // Sticky scroll effect
    const header = Utils.$('header');
    if (header) {
      window.addEventListener('scroll', Utils.debounce(() => {
        header.classList.toggle('scrolled', window.scrollY > 40);
      }, 50), { passive: true });
    }

    // Mobile hamburger
    const ham = Utils.$('.hamburger');
    const nav = Utils.$('nav');
    if (ham && nav) {
      ham.addEventListener('click', () => {
        ham.classList.toggle('open');
        nav.classList.toggle('open');
      });
      // Close nav on outside click
      document.addEventListener('click', e => {
        if (!ham.contains(e.target) && !nav.contains(e.target)) {
          ham.classList.remove('open');
          nav.classList.remove('open');
        }
      });
    }

    // Search on Enter
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') Search.perform();
      });
    }
  },
};

// ============================================================
//  MODULE: SCROLL ANIMATIONS (Intersection Observer)
// ============================================================
const ScrollAnims = {
  init() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    Utils.$$('.product-card, .cat-item, .highlight-categories').forEach(el => {
      obs.observe(el);
    });
  },
};

// ============================================================
//  MODULE: SCROLL-TO-TOP BUTTON
// ============================================================
const ScrollTop = {
  init() {
    const btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.title = 'Lên đầu trang';
    btn.innerHTML = '↑';
    btn.style.display = 'none';
    document.body.appendChild(btn);

    window.addEventListener('scroll', Utils.debounce(() => {
      btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    }, 100), { passive: true });

    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  },
};

// ============================================================
//  MODULE: MY ORDERS PAGE
// ============================================================
const OrderHistory = {
  async fetch(email) {
    const resultsDiv = document.getElementById('order-results');
    if (!resultsDiv) return;

    // Show skeletons while loading
    resultsDiv.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${Array(2).fill(`
          <div class="skeleton-card" style="padding:20px;">
            <div class="skeleton skeleton-line w60" style="height:18px;margin-bottom:12px;"></div>
            <div class="skeleton skeleton-line w80"></div>
            <div class="skeleton skeleton-line w40"></div>
          </div>
        `).join('')}
      </div>
    `;

    try {
      const res    = await fetch('http://localhost:3000/my-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const orders = await res.json();

      if (orders.length === 0) {
        resultsDiv.innerHTML = `
          <div style="text-align:center;padding:40px;color:var(--text-muted);">
            <div style="font-size:40px;margin-bottom:12px;">📭</div>
            <p style="font-family:var(--font-hud);font-size:11px;letter-spacing:2px;">Không tìm thấy đơn hàng nào cho email này</p>
          </div>`;
        return;
      }

      resultsDiv.innerHTML = [...orders].reverse().map(order => `
        <div class="skeleton-card animate-in" style="padding:22px;border:1px solid var(--border);background:var(--bg-card);">
          <div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--border);padding-bottom:12px;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <strong style="color:var(--cyan);font-family:var(--font-hud);font-size:11px;letter-spacing:2px;">${order.orderId}</strong>
            <span style="color:var(--text-muted);font-size:12px;font-family:var(--font-mono);">${order.date}</span>
          </div>
          <ul style="list-style:none;padding:0;margin-bottom:14px;">
            ${order.items.map(i => `
              <li style="font-size:14px;margin-bottom:6px;display:flex;justify-content:space-between;">
                <span style="color:var(--text-dim);">${i.name} <span style="color:var(--text-muted);">×${i.quantity}</span></span>
                <span style="color:var(--red);font-family:var(--font-hud);font-size:12px;">${(i.price * i.quantity).toLocaleString('vi-VN')} ₫</span>
              </li>
            `).join('')}
          </ul>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-deep);border-radius:var(--radius-sm);flex-wrap:wrap;gap:8px;">
            <span style="color:var(--green);font-size:13px;font-weight:600;">🚚 ${order.status}</span>
            <strong style="color:var(--red);font-family:var(--font-hud);font-size:15px;">${order.total.toLocaleString('vi-VN')} ₫</strong>
          </div>
        </div>
      `).join('');

    } catch (err) {
      resultsDiv.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--red);">
          <p style="font-family:var(--font-hud);font-size:11px;letter-spacing:2px;">Không thể kết nối server</p>
          <p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Vui lòng kiểm tra Node.js server đang chạy</p>
        </div>`;
    }
  },
};

// Global hook for my-orders.html
function fetchMyOrders() {
  const email = document.getElementById('search-email')?.value?.trim();
  if (!email) { Toast.error('Vui lòng nhập email trước khi tìm kiếm'); return; }
  OrderHistory.fetch(email);
}

// ============================================================
//  INIT — DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Core
  Cart.updateUI();
  CartModal.init();
  Header.init();
  ScrollTop.init();
  ScrollAnims.init();

  // Page-specific
  Slider.init();
  Products.initFilter();
  Products.applySearchFilter();
  ProductDetail.init();
  Reviews.load();
  Checkout.init();

  // Page entry animation
  PageTransition.enter();
});