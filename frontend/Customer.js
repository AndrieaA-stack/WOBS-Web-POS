
const RENDER_BACKEND_URL = "https://wobs-web-pos.onrender.com"; 

const isLocalhost = (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" || 
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.") ||
  window.location.hostname.endsWith(".local") ||
  window.location.protocol === "file:"
);

const API_URL = isLocalhost
  ? `http://${(window.location.hostname && !window.location.hostname.includes('file')) ? window.location.hostname : 'localhost'}:5000/api` 
  : `${RENDER_BACKEND_URL}/api`;

const MIN_DELIVERY_AMOUNT = 150.00;

var products = [];
var cart = [];
var selectedCategory = 'All';

// Store Origin: Pandayan, Meycauayan, Bulacan (Personal Delivery Rider Base)
const STORE_ORIGIN = {
  name: "Laura Sari-Sari Store",
  barangay: "Pandayan",
  city: "Meycauayan",
  province: "Bulacan",
  lat: 14.7355,
  lng: 120.9575,
  maxDeliveryRadiusKm: 15.0
};

let customerVerifiedGpsDistance = null;

// Haversine distance formula to compute distance in km
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = deg => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// User-triggered GPS verification
function verifyCustomerGpsDistance() {
  const badge = document.getElementById('cust-gps-status-badge');
  const msgEl = document.getElementById('cust-auth-msg');

  if (!navigator.geolocation) {
    if (badge) {
      badge.style.color = '#eab308';
      badge.textContent = 'GPS not supported on browser. Choose city below.';
    }
    return;
  }

  if (badge) {
    badge.style.color = '#38bdf8';
    badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking GPS distance...';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const distKm = calculateHaversineDistanceKm(STORE_ORIGIN.lat, STORE_ORIGIN.lng, userLat, userLng);
      customerVerifiedGpsDistance = distKm;

      if (distKm <= STORE_ORIGIN.maxDeliveryRadiusKm) {
        if (badge) {
          badge.style.color = '#10b981';
          badge.innerHTML = `✅ ${distKm.toFixed(1)} km away (Within 15km Zone!)`;
        }
        if (msgEl) {
          msgEl.className = 'scan-msg text-success';
          msgEl.textContent = `✅ Location Verified: You are ${distKm.toFixed(1)} km from Pandayan, Meycauayan — eligible for personal rider delivery.`;
        }
      } else {
        if (badge) {
          badge.style.color = '#ef4444';
          badge.innerHTML = `❌ ${distKm.toFixed(1)} km away (Exceeds 15km limit)`;
        }
        if (msgEl) {
          msgEl.className = 'scan-msg text-danger';
          msgEl.textContent = `❌ Your GPS distance (${distKm.toFixed(1)} km) is outside our 15 km personal delivery rider radius from Pandayan, Meycauayan.`;
        }
      }
    },
    (err) => {
      console.warn("Geolocation denied or error:", err.message);
      if (badge) {
        badge.style.color = '#64748b';
        badge.textContent = 'GPS optional. Select your registered City within 15km.';
      }
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Location Mapping: Exclusively municipalities & barangays within 15km radius of Pandayan, Meycauayan, Bulacan
const LOCATION_DATA = {
  "Meycauayan": [
    "Pandayan", "Bahay Pare", "Bancal", "Bangcal", "Calvario", "Camalig", 
    "Hulo", "Iba", "Langka", "Lawa", "Libtong", "Liputan", "Malhacan", 
    "Perez", "Poblacion", "Saint Francis", "Saluysoy", "Tugatog", "Caingin", "Ubihan", "Zamora"
  ],
  "Marilao": [
    "Abangan Norte", "Abangan Sur", "Ibayo", "Lambakin", "Lias", "Loma de Gato", 
    "Nagbalon", "Patubig", "Poblacion 1st", "Poblacion 2nd", "Prenza 1st", "Prenza 2nd", 
    "Saog", "Santa Rosa 1st", "Santa Rosa 2nd", "Tabing Ilog"
  ],
  "Valenzuela": [
    "Arkong Bato", "Balangkas", "Bignay", "Bisig", "Canumay East", "Canumay West", 
    "Coloong", "Dalandanan", "Lawang Bato", "Lingunan", "Mabolo", "Malanday", 
    "Malinta", "Mapulang Lupa", "Palasan", "Parada", "Pariancillo Villa", 
    "Paso de Blas", "Pasolo", "Poblacion", "Polo", "Punturin", "Rincon", 
    "Tagalag", "Veinte Reales", "Wawang Pulo"
  ],
  "Obando": [
    "Binuangan", "Catanghalan", "Hulo", "Lawa", "Paco", "Pag-asa", 
    "Paliwas", "Panghulo", "Salambao", "San Pascual", "Tawiran"
  ],
  "Bocaue": [
    "Antipona", "Bagumbayan", "Bambang", "Batia", "Biñang 1st", "Biñang 2nd", 
    "Bolacan", "Bundukan", "Bunlo", "Caingin", "Duhat", "Igulot", "Lolomboy", 
    "Poblacion", "Sulucan", "Taal", "Tambobong", "Turo", "Wakas"
  ],
  "Santa Maria": [
    "Bagbaguin", "Balasing", "Buenavista", "Bulac", "Camangyanan", "Catmon", 
    "Caypombo", "Caysio", "Guyong", "Lalakhan", "Mag-asawang Sapa", "Mahabang Parang", 
    "Manggahan", "Parada", "Poblacion", "Pulong Buhangin", "San Gabriel", 
    "San Jose Patag", "San Vicente", "Santa Clara", "Santa Cruz", "Silangan", "Tumana"
  ],
  "Balagtas": [
    "Borol 1st", "Borol 2nd", "Dalig", "Longos", "Panginay", "Pulong Gubat", 
    "San Juan", "Santol", "Wawa"
  ]
};

// Fallback products when backend database is unavailable
const MOCK_PRODUCTS = [
  { id: 'p1', barcode: '4800016022014', name: 'Lucky Me! Pancit Canton', category: 'Instant Noodles', cost: 13.00, price: 16.00, stock: 40, expiry: '2027-02-15', image: '' },
  { id: 'p2', barcode: '4800016055012', name: 'Century Tuna Flakes 180g', category: 'Canned Goods', cost: 38.50, price: 46.00, stock: 18, expiry: '2027-08-20', image: '' },
  { id: 'p3', barcode: '4800092112345', name: 'San Mig Coffee 3-in-1', category: 'Beverages', cost: 7.00, price: 9.00, stock: 80, expiry: '2026-12-10', image: '' }
];

// Convert image file into Base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

async function fetchProductsFromDB() {
  try {
    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error("Backend offline");
    const data = await res.json();
    products = data.map(p => ({
      ...p,
      cost: parseFloat(p.cost),
      price: parseFloat(p.price),
      stock: parseInt(p.stock, 10) || 0,
      expiry: (p.expiry && String(p.expiry).trim() !== '' && p.expiry !== 'null') ? p.expiry.split('T')[0] : null
    }));
  } catch (err) {
    console.warn("⚠️ Unable to reach backend API. Loading local presentation data.");
    products = MOCK_PRODUCTS;
  }
  return products;
}

function updateBarangayOptions() {
  const citySelect = document.getElementById('cust-city');
  const brgySelect = document.getElementById('cust-brgy');
  const selectedCity = citySelect.value;

  brgySelect.innerHTML = '<option value="">Select Barangay</option>';

  if (selectedCity && LOCATION_DATA[selectedCity]) {
    LOCATION_DATA[selectedCity].forEach(brgy => {
      const opt = document.createElement('option');
      opt.value = brgy;
      opt.textContent = brgy;
      brgySelect.appendChild(opt);
    });
    brgySelect.disabled = false;
  } else {
    brgySelect.innerHTML = '<option value="">Select City First</option>';
    brgySelect.disabled = true;
  }
}

// ==================== CUSTOMER AUTH & SESSION MANAGEMENT ====================

function getCurrentCustomer() {
  try {
    const raw = sessionStorage.getItem('wobs_customer_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function checkCustomerAuth() {
  const customer = getCurrentCustomer();
  const authModal = document.getElementById('modal-customer-auth');
  const greetingEl = document.getElementById('customer-display-name');
  const logoutBtn = document.getElementById('btn-customer-logout');
  const ordersBtn = document.getElementById('btn-customer-orders');

  if (!customer) {
    if (greetingEl) greetingEl.textContent = 'Guest';
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (ordersBtn) ordersBtn.classList.add('hidden');
    if (authModal) authModal.classList.remove('hidden');
    return false;
  }

  if (greetingEl) greetingEl.textContent = customer.fullname || customer.username;
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  if (ordersBtn) ordersBtn.classList.remove('hidden');
  if (authModal) authModal.classList.add('hidden');
  return true;
}

function switchCustomerAuthTab(type) {
  const tabLogin = document.getElementById('cust-tab-btn-login');
  const tabReg = document.getElementById('cust-tab-btn-register');
  const formLogin = document.getElementById('form-cust-login');
  const formReg = document.getElementById('form-cust-register');
  const msgEl = document.getElementById('cust-auth-msg');

  if (msgEl) {
    msgEl.textContent = '';
    msgEl.className = 'scan-msg';
  }

  if (type === 'login') {
    if (tabLogin) tabLogin.className = 'auth-tab-btn active';
    if (tabReg) tabReg.className = 'auth-tab-btn';
    if (formLogin) formLogin.classList.remove('hidden');
    if (formReg) formReg.classList.add('hidden');
  } else {
    if (tabReg) tabReg.className = 'auth-tab-btn active';
    if (tabLogin) tabLogin.className = 'auth-tab-btn';
    if (formReg) formReg.classList.remove('hidden');
    if (formLogin) formLogin.classList.add('hidden');
  }
}

function updateRegisterBarangayOptions() {
  const citySelect = document.getElementById('cust-reg-city');
  const brgySelect = document.getElementById('cust-reg-brgy');
  if (!citySelect || !brgySelect) return;
  const selectedCity = citySelect.value;

  brgySelect.innerHTML = '<option value="">Select Barangay</option>';
  if (selectedCity && LOCATION_DATA[selectedCity]) {
    LOCATION_DATA[selectedCity].forEach(brgy => {
      const opt = document.createElement('option');
      opt.value = brgy;
      opt.textContent = brgy;
      brgySelect.appendChild(opt);
    });
    brgySelect.disabled = false;
  } else {
    brgySelect.innerHTML = '<option value="">Select City First</option>';
    brgySelect.disabled = true;
  }
}

async function handleCustomerLoginSubmit(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('cust-login-user').value.trim();
  const password = document.getElementById('cust-login-pass').value.trim();
  const msgEl = document.getElementById('cust-auth-msg');

  if (!username || !password) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = '❌ Please enter username and password.';
    }
    return;
  }

  try {
    const res = await fetch(`${API_URL}/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      sessionStorage.setItem('wobs_customer_user', JSON.stringify(data.user));
      checkCustomerAuth();
      renderPosCatalog();
    } else {
      if (msgEl) {
        msgEl.className = 'scan-msg text-danger';
        msgEl.textContent = '❌ ' + (data.message || 'Invalid username or password.');
      }
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = '❌ Unable to connect to server. Please try again.';
    }
  }
}

async function handleCustomerRegisterSubmit(e) {
  if (e) e.preventDefault();
  const fullname = document.getElementById('cust-reg-fullname').value.trim();
  const username = document.getElementById('cust-reg-username').value.trim();
  const password = document.getElementById('cust-reg-password').value.trim();
  const phone = document.getElementById('cust-reg-phone').value.trim();
  const city = document.getElementById('cust-reg-city').value;
  const barangay = document.getElementById('cust-reg-brgy').value;
  const street = document.getElementById('cust-reg-street').value.trim();
  const msgEl = document.getElementById('cust-auth-msg');

  if (!fullname || !username || !password || !phone || !city || !barangay || !street) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = '❌ Please complete all registration fields.';
    }
    return;
  }

  // Validate 15km Delivery Radius Restriction
  if (!LOCATION_DATA[city]) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = '❌ Registration is restricted to addresses within 15km of Pandayan, Meycauayan, Bulacan.';
    }
    return;
  }

  if (customerVerifiedGpsDistance !== null && customerVerifiedGpsDistance > STORE_ORIGIN.maxDeliveryRadiusKm) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = `❌ Your GPS distance (${customerVerifiedGpsDistance.toFixed(1)} km) exceeds our 15 km delivery rider radius from Pandayan, Meycauayan.`;
    }
    return;
  }

  try {
    const res = await fetch(`${API_URL}/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fullname, 
        username, 
        password, 
        phone, 
        city, 
        barangay, 
        street,
        gpsDistance: customerVerifiedGpsDistance 
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      sessionStorage.setItem('wobs_customer_user', JSON.stringify(data.user));
      checkCustomerAuth();
      renderPosCatalog();
      alert(`🎉 Welcome to Laura's Store, ${data.user.fullname}! Your account has been registered.`);
    } else {
      if (msgEl) {
        msgEl.className = 'scan-msg text-danger';
        msgEl.textContent = '❌ ' + (data.message || 'Registration failed.');
      }
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = '❌ Network error during registration. Please try again.';
    }
  }
}

function handleCustomerLogout() {
  if (confirm("Are you sure you want to log out of your account?")) {
    sessionStorage.removeItem('wobs_customer_user');
    clearCart();
    checkCustomerAuth();
  }
}

// ==================== CUSTOMER ORDER HISTORY & RECEIPT VIEW ====================

function openCustomerOrdersModal() {
  const modal = document.getElementById('modal-customer-orders');
  if (modal) {
    modal.classList.remove('hidden');
    loadCustomerOrders();
  }
}

function closeCustomerOrdersModal() {
  const modal = document.getElementById('modal-customer-orders');
  if (modal) modal.classList.add('hidden');
}

async function loadCustomerOrders() {
  const customer = getCurrentCustomer();
  const container = document.getElementById('customer-orders-list');
  const userLabel = document.getElementById('my-orders-username-label');

  if (!customer) {
    if (container) container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Please login to view your orders.</p>';
    return;
  }

  if (userLabel) userLabel.textContent = `${customer.fullname} (@${customer.username})`;
  if (container) container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading your order history...</p>';

  try {
    const res = await fetch(`${API_URL}/customer/orders/${customer.username}`);
    if (!res.ok) throw new Error("Failed to load orders");
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      if (container) {
        container.innerHTML = `
          <div style="text-align:center; padding:35px 20px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px;">
            <i class="fa-solid fa-bag-shopping" style="font-size:32px; color:#94a3b8; margin-bottom:10px;"></i>
            <h4 style="margin:0 0 4px 0; color:#334155;">No Orders Found</h4>
            <p style="margin:0; font-size:13px; color:#64748b;">You haven't placed any orders yet. Add items to your cart and check out!</p>
          </div>
        `;
      }
      return;
    }

    if (container) {
      container.innerHTML = orders.map(order => {
        const orderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
        const rawDate = order.date_created ? new Date(order.date_created).toLocaleString() : '--';
        const total = parseFloat(order.total || 0).toFixed(2);
        const status = (order.status || 'Pending').toUpperCase();

        let badgeBg = '#0284c7';
        let badgeText = status;
        if (status === 'DELIVERED' || status === 'COMPLETED') {
          badgeBg = '#16a34a';
        } else if (status === 'OUT FOR DELIVERY') {
          badgeBg = '#eab308';
        } else if (status === 'PREPARING ORDER' || status === 'PROCESSING') {
          badgeBg = '#9333ea';
        } else if (status === 'CANCELLED') {
          badgeBg = '#ef4444';
        }

        let items = [];
        try {
          items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        } catch (e) {
          items = [];
        }

        const itemsSummary = Array.isArray(items) 
          ? items.map(i => `${i.name} (x${i.qty})`).join(', ') 
          : 'Items breakdown unavailable';

        const orderSafeJson = encodeURIComponent(JSON.stringify({
          id: order.id,
          date: rawDate,
          customerName: order.customer_name || customer.fullname,
          address: order.address,
          total: parseFloat(order.total || 0),
          items: items
        }));

        return `
          <div class="order-history-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="font-size:14px; color:#0f172a;">${orderId}</strong>
                <span style="font-size:11px; color:#64748b;">${rawDate}</span>
              </div>
              <span style="background:${badgeBg}; color:#ffffff; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; letter-spacing:0.5px;">
                ${badgeText}
              </span>
            </div>
            
            <div style="font-size:12px; color:#475569; margin-bottom:6px;">
              <span style="color:#64748b;">Items:</span> <strong>${itemsSummary}</strong>
            </div>

            <div style="font-size:12px; color:#475569; margin-bottom:10px;">
              <span style="color:#64748b;">Delivery Address:</span> ${order.address || 'N/A'}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #e2e8f0; padding-top:8px;">
              <div>
                <span style="font-size:12px; color:#64748b;">Total Amount:</span>
                <strong style="font-size:15px; color:#16a34a; margin-left:4px;">₱${total}</strong>
                <span style="font-size:11px; color:#64748b; margin-left:6px;">(GCash)</span>
              </div>
              <button onclick="viewCustomerOrderReceipt('${orderSafeJson}')" class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 10px;">
                <i class="fa-solid fa-receipt" style="margin-right:4px;"></i> View Receipt
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    if (container) {
      container.innerHTML = '<p class="text-danger" style="text-align:center; padding:20px;">❌ Error loading orders. Please check connection.</p>';
    }
  }
}

function viewCustomerOrderReceipt(encodedOrder) {
  try {
    const order = JSON.parse(decodeURIComponent(encodedOrder));
    openReceiptModal(order);
  } catch (e) {
    console.error("Receipt parsing error:", e);
  }
}

function getDaysToExpiry(expiryDateStr) {
  if (!expiryDateStr || expiryDateStr === 'N/A' || expiryDateStr === 'null') return 999999;
  var today = new Date();
  today.setHours(0,0,0,0);
  var expDate = new Date(expiryDateStr);
  if (isNaN(expDate.getTime())) return 999999;
  expDate.setHours(0,0,0,0);
  return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
}

async function processScannedBarcode(code) {
  var msgEl = document.getElementById('barcode-scan-msg');
  await fetchProductsFromDB();

  var found = products.find(p => p.barcode === code);
  if (found) {
    if (getDaysToExpiry(found.expiry) < 0) {
      if (msgEl) {
        msgEl.className = 'scan-msg text-danger';
        msgEl.textContent = '❌ EXPIRED ITEM: ' + found.name + ' cannot be added.';
      }
    } else if (parseInt(found.stock, 10) <= 0) {
      if (msgEl) {
        msgEl.className = 'scan-msg text-danger';
        msgEl.textContent = '❌ OUT OF STOCK: ' + found.name;
      }
    } else {
      addToCart(found.id);
      if (msgEl) {
        msgEl.className = 'scan-msg text-primary';
        msgEl.textContent = '✅ Scanned & Added: "' + found.name + '"';
      }
    }
  } else if (msgEl) {
    msgEl.className = 'scan-msg text-danger';
    msgEl.textContent = '❌ Unrecognized Barcode: ' + code;
  }
}

function handleBarcodeScan(e) {
  if (e) e.preventDefault();
  var inputEl = document.getElementById('pos-barcode-scanner');
  if (!inputEl) return;
  var code = inputEl.value.trim();
  if (code) processScannedBarcode(code);
  inputEl.value = '';
}

function renderCategoryPills() {
  // Only display categories for available, non-expired in-stock items
  var availableProducts = products.filter(p => parseInt(p.stock, 10) > 0 && getDaysToExpiry(p.expiry) >= 0);
  var categories = ['All', ...new Set(availableProducts.map(p => p.category).filter(Boolean))];
  var container = document.getElementById('category-pills');
  if (container) {
    if (!categories.includes(selectedCategory)) {
      selectedCategory = 'All';
    }
    container.innerHTML = categories.map(cat => 
      `<button type="button" onclick="setCategory('${cat}')" class="pill-btn ${selectedCategory === cat ? 'active' : ''}">${cat}</button>`
    ).join('');
  }
}

function setCategory(cat) {
  selectedCategory = cat;
  renderCategoryPills();
  renderPosCatalog();
}

async function renderPosCatalog() {
  await fetchProductsFromDB();
  renderCategoryPills();

  var searchInput = document.getElementById('pos-search');
  var search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  var catalog = document.getElementById('pos-catalog');

  if (!catalog) return;

  // Filter out any products that are out of stock (stock <= 0) or expired (getDaysToExpiry < 0)
  var filtered = products.filter(p => {
    var isExpired = getDaysToExpiry(p.expiry) < 0;
    var hasStock = parseInt(p.stock, 10) > 0;
    var matchesCat = (selectedCategory === 'All' || p.category === selectedCategory);
    var matchesSearch = (!search || p.name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search)));
    return hasStock && !isExpired && matchesCat && matchesSearch;
  });

  catalog.innerHTML = filtered.map(p => {
    var isExpired = getDaysToExpiry(p.expiry) < 0;
    var canAdd = !isExpired && p.stock > 0;
    
    // Determine image source from database
    var imgSrc = 'https://via.placeholder.com/150';

    if (p.image && typeof p.image === 'string' && p.image.trim() !== '') {
      imgSrc = p.image.startsWith('data:image') 
        ? p.image 
        : `data:image/jpeg;base64,${p.image}`;
    } else if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim() !== '') {
      imgSrc = p.image_url;
    }

    return `
      <div class="product-card ${isExpired ? 'expired' : ''}">
        <div style="width:100%; height:140px; background-color:#f1f5f9; border-radius:6px; overflow:hidden; margin-bottom:10px; display:flex; align-items:center; justify-content:center;">
          <img src="${imgSrc}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://via.placeholder.com/150';">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span class="card-tag">${p.category}</span>
          </div>
          <h4 class="card-title">${p.name}</h4>
          ${isExpired ? '<span class="error-text">EXPIRED</span>' : (p.expiry ? `<small>Exp: ${p.expiry}</small>` : '<small style="color:#64748b;">No Expiration</small>')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; min-height:28px;">
          <span class="card-price">₱${p.price.toFixed(2)}</span>
          ${!isExpired ? `
            <button type="button" onclick="addToCart('${p.id}')" ${!canAdd ? 'disabled' : ''} class="btn btn-primary btn-sm">+</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('') || '<p class="text-muted" style="grid-column:1/-1; text-align:center; padding:20px;">No products found.</p>';
}

function addToCart(id) {
  var prod = products.find(p => p.id === id);
  if (!prod) return;

  if (getDaysToExpiry(prod.expiry) < 0) {
    alert('Sorry, this item is expired and cannot be added to cart.');
    return;
  }

  if (parseInt(prod.stock, 10) <= 0) {
    alert('Sorry, this item is currently out of stock.');
    return;
  }

  var item = cart.find(c => c.id === id);
  if (item) {
    if (item.qty < prod.stock) item.qty++;
    else alert('Stock limit reached.');
  } else {
    cart.push({ id: prod.id, name: prod.name, barcode: prod.barcode, price: prod.price, qty: 1, maxStock: prod.stock });
  }
  renderCart();
}

function updateCartQty(id, delta) {
  var item = cart.find(c => c.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
    else if (item.qty > item.maxStock) item.qty = item.maxStock;
  }
  renderCart();
}

function clearCart() { cart = []; renderCart(); }

function renderCart() {
  var container = document.getElementById('cart-items');
  var totalEl = document.getElementById('cart-total');
  var subEl = document.getElementById('cart-subtotal');
  var btn = document.getElementById('btn-checkout');
  var minMsgEl = document.getElementById('min-delivery-msg');

  if (!container) return;

  var mobileBar = document.getElementById('mobile-cart-bar');

  if (cart.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Cart is empty.</p>';
    if (totalEl) totalEl.textContent = '₱0.00';
    if (subEl) subEl.textContent = '₱0.00';
    if (btn) btn.disabled = true;
    if (minMsgEl) {
      minMsgEl.style.display = 'block';
      minMsgEl.textContent = '⚠️ Minimum order for delivery is ₱150.00';
    }
    if (mobileBar) mobileBar.classList.add('hidden');
    return;
  }

  var grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  var totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  if (mobileBar) {
    var countEl = document.getElementById('mobile-cart-count');
    var mobileTotalEl = document.getElementById('mobile-cart-total');
    if (countEl) countEl.textContent = `${totalItems} item${totalItems > 1 ? 's' : ''}`;
    if (mobileTotalEl) mobileTotalEl.textContent = '₱' + grandTotal.toFixed(2);
    mobileBar.classList.remove('hidden');
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <div>
        <strong>${item.name}</strong><br>
        <small class="font-mono">₱${item.price.toFixed(2)} x ${item.qty}</small>
      </div>
      <div>
        <button onclick="updateCartQty('${item.id}', -1)" class="btn btn-secondary btn-sm">-</button>
        <span>${item.qty}</span>
        <button onclick="updateCartQty('${item.id}', 1)" class="btn btn-secondary btn-sm">+</button>
      </div>
    </div>
  `).join('');

  if (subEl) subEl.textContent = '₱' + grandTotal.toFixed(2);
  if (totalEl) totalEl.textContent = '₱' + grandTotal.toFixed(2);

  if (grandTotal < MIN_DELIVERY_AMOUNT) {
    if (btn) btn.disabled = true;
    if (minMsgEl) {
      const remaining = MIN_DELIVERY_AMOUNT - grandTotal;
      minMsgEl.style.display = 'block';
      minMsgEl.textContent = `⚠️ Add ₱${remaining.toFixed(2)} more to reach the ₱150.00 delivery minimum.`;
    }
  } else {
    if (btn) btn.disabled = false;
    if (minMsgEl) {
      minMsgEl.style.display = 'none';
    }
  }
}

function scrollToCart() {
  var cartSection = document.getElementById('pos-cart-section');
  if (cartSection) {
    cartSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function openGCashModal() {
  if (!checkCustomerAuth()) {
    return;
  }

  var grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (grandTotal < MIN_DELIVERY_AMOUNT) {
    alert(`Minimum order value for delivery is ₱${MIN_DELIVERY_AMOUNT.toFixed(2)}.`);
    return;
  }

  document.getElementById('gcash-modal-amount').textContent = '₱' + grandTotal.toFixed(2);
  
  // Pre-fill delivery details from logged-in customer profile
  const customer = getCurrentCustomer();
  if (customer) {
    document.getElementById('cust-name').value = customer.fullname || '';
    if (customer.city) {
      document.getElementById('cust-city').value = customer.city;
      updateBarangayOptions();
      if (customer.barangay) {
        document.getElementById('cust-brgy').value = customer.barangay;
      }
    } else {
      document.getElementById('cust-city').value = '';
      document.getElementById('cust-brgy').innerHTML = '<option value="">Select City First</option>';
      document.getElementById('cust-brgy').disabled = true;
    }
    document.getElementById('cust-street').value = customer.street || '';
  } else {
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-city').value = '';
    document.getElementById('cust-brgy').innerHTML = '<option value="">Select City First</option>';
    document.getElementById('cust-brgy').disabled = true;
    document.getElementById('cust-street').value = '';
  }
  
  const proofInput = document.getElementById('gcash-proof-input');
  if (proofInput) proofInput.value = '';

  document.getElementById('modal-gcash').classList.remove('hidden');
}

function closeGCashModal() { document.getElementById('modal-gcash').classList.add('hidden'); }

async function processGCashPayment() {
  const customer = getCurrentCustomer();
  if (!customer) {
    checkCustomerAuth();
    return;
  }

  const name = document.getElementById('cust-name').value.trim();
  const city = document.getElementById('cust-city').value;
  const brgy = document.getElementById('cust-brgy').value;
  const street = document.getElementById('cust-street').value.trim();
  const proofFileInput = document.getElementById('gcash-proof-input');

  if (!name || !city || !brgy || !street) {
    alert('Please complete all delivery fields including your Full Name.');
    return;
  }

  if (!proofFileInput || proofFileInput.files.length === 0) {
    alert('Please upload a screenshot of your GCash payment proof.');
    return;
  }

  const file = proofFileInput.files[0];
  if (file.size > 5 * 1024 * 1024) {
    alert('Uploaded image exceeds 5MB limit. Please upload a smaller screenshot.');
    return;
  }

  const fullAddress = `${street}, Brgy. ${brgy}, ${city}, Bulacan`;
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Validate that the uploaded file is strictly an image
  if (file.type && !file.type.startsWith('image/')) {
    alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP) for your GCash screenshot.');
    return;
  }

  try {
    const proofBase64 = await fileToBase64(file);

    if (!proofBase64 || typeof proofBase64 !== 'string' || !proofBase64.startsWith('data:image')) {
      alert('Failed to process image receipt. Please select a valid GCash screenshot.');
      return;
    }

    const newTxn = {
      id: 'WOBS-' + Math.floor(100000 + Math.random() * 900000),
      customerId: customer.id,
      customerUsername: customer.username,
      customerName: name,
      address: fullAddress,
      items: cart,
      total: grandTotal,
      gcashRef: 'SCREENSHOT_ATTACHED',
      paymentProof: proofBase64,
      paymentMethod: 'GCash',
      status: 'Pending'
    };

    const res = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTxn)
    });

    if (!res.ok) {
      let errorMsg = 'Server could not process your order.';
      try {
        const errorData = await res.json();
        if (errorData && errorData.error) errorMsg = errorData.error;
      } catch (_) {}
      alert(`⚠️ Checkout Error: ${errorMsg}`);
      return;
    }

    openReceiptModal({ ...newTxn, date: new Date().toLocaleString() });
    clearCart();
    closeGCashModal();
    renderPosCatalog();
    loadCustomerOrders();
  } catch (err) {
    console.error("Checkout submission failed:", err);
    alert('⚠️ Checkout failed: Could not connect to server or upload receipt. Please check your connection and try again.');
  }
}

function openReceiptModal(txn) {
  document.getElementById('receipt-id').textContent = '#' + txn.id;
  document.getElementById('receipt-date').textContent = txn.date;
  document.getElementById('receipt-address').textContent = `${txn.customerName || txn.customer_name} | ${txn.address}`;
  document.getElementById('receipt-gcash-ref').textContent = 'Verified Screenshot';
  document.getElementById('receipt-total-amount').textContent = '₱' + parseFloat(txn.total).toFixed(2);
  const items = Array.isArray(txn.items) ? txn.items : (typeof txn.items === 'string' ? JSON.parse(txn.items) : []);
  document.getElementById('receipt-items-list').innerHTML = items.map(i => `<p>${i.name} (x${i.qty}) - ₱${(i.price * i.qty).toFixed(2)}</p>`).join('');
  document.getElementById('modal-receipt').classList.remove('hidden');
}

function closeReceiptModal() { document.getElementById('modal-receipt').classList.add('hidden'); }

window.onload = function() {
  checkCustomerAuth();
  renderPosCatalog();
  renderCart();

  var manualInput = document.getElementById('pos-barcode-scanner');
  if (manualInput) {
    manualInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleBarcodeScan(e);
    });
  }

  // Live Catalog Filter Listener
  var searchInput = document.getElementById('pos-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      renderPosCatalog();
    });
  }
};

// Order Status Modal Handlers
function openOrderStatusModal() {
  document.getElementById('track-txn-id').value = '';
  document.getElementById('status-result-box').classList.add('hidden');
  document.getElementById('status-error-msg').classList.add('hidden');
  document.getElementById('modal-order-status').classList.remove('hidden');
}

function closeOrderStatusModal() {
  document.getElementById('modal-order-status').classList.add('hidden');
}

async function checkOrderStatus() {
  const inputEl = document.getElementById('track-txn-id');
  const resultBox = document.getElementById('status-result-box');
  const errorMsg = document.getElementById('status-error-msg');
  
  if (!inputEl) return;
  let rawQuery = inputEl.value.trim().toUpperCase();
  
  if (!rawQuery) {
    errorMsg.textContent = "Please enter a Transaction ID.";
    errorMsg.classList.remove('hidden');
    resultBox.classList.add('hidden');
    return;
  }

  // Extract pure numbers/digits from input for universal matching (e.g., 334864)
  const numericId = rawQuery.replace(/[^0-9]/g, '');

  try {
    // 1. Fetch live transactions from PostgreSQL server
    let txn = null;
    const res = await fetch(`${API_URL}/transactions`);
    
    if (res.ok) {
      const serverTxns = await res.json();
      // Flexible ID match supporting full "#WOBS-334864", "WOBS-334864", or "334864"
      txn = serverTxns.find(t => {
        const cleanTId = String(t.id).replace(/[^0-9]/g, '');
        return cleanTId === numericId || String(t.id).toUpperCase().includes(rawQuery);
      });
    }

    // 2. Check localStorage fallback if backend fetch fails
    if (!txn) {
      const localTxns = JSON.parse(localStorage.getItem('wobs_transactions') || '[]');
      txn = localTxns.find(l => {
        const cleanLId = String(l.id).replace(/[^0-9]/g, '');
        return cleanLId === numericId || String(l.id).toUpperCase().includes(rawQuery);
      });
    }

    if (txn) {
      errorMsg.classList.add('hidden');
      
      const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items;
      const itemListStr = items.map(i => `${i.name} (x${i.qty})`).join(', ');

      document.getElementById('status-txn-title').textContent = txn.id.startsWith('#') ? txn.id : `#${txn.id}`;
      document.getElementById('status-cust-name').textContent = txn.customer_name || txn.customerName || 'Guest Customer';
      document.getElementById('status-address').textContent = txn.address || 'N/A';
      document.getElementById('status-total').textContent = `₱${parseFloat(txn.total).toFixed(2)}`;
      document.getElementById('status-items-list').textContent = itemListStr;

      // Check localStorage for recent admin status override
      const localTxns = JSON.parse(localStorage.getItem('wobs_transactions') || '[]');
      const localMatch = localTxns.find(l => String(l.id).replace(/[^0-9]/g, '') === numericId);
      const activeStatus = localMatch && localMatch.status ? localMatch.status : (txn.status || 'Pending');

      // Status Badge Styling
      const badge = document.getElementById('status-badge');
      const statusText = activeStatus.toUpperCase();
      badge.textContent = statusText;
      
      if (statusText === 'DELIVERED') {
        badge.style.background = '#22c55e'; // Green
      } else if (statusText === 'OUT FOR DELIVERY') {
        badge.style.background = '#eab308'; // Amber
      } else if (statusText === 'PREPARING ORDER') {
        badge.style.background = '#a855f7'; // Purple
      } else {
        badge.style.background = '#0284c7'; // Blue (Pending)
      }

      resultBox.classList.remove('hidden');
    } else {
      resultBox.classList.add('hidden');
      errorMsg.textContent = "❌ Transaction ID not found. Please check your receipt number.";
      errorMsg.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Error looking up order status:", err);
    resultBox.classList.add('hidden');
    errorMsg.textContent = "❌ Unable to lookup order status.";
    errorMsg.classList.remove('hidden');
  }
}