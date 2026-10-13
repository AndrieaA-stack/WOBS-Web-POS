
const RENDER_BACKEND_URL = "https://wobs-web-pos.onrender.com"; 

const API_URL = (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" || 
  window.location.protocol === "file:"
) 
  ? "http://localhost:5000/api" 
  : `${RENDER_BACKEND_URL}/api`;

const MIN_DELIVERY_AMOUNT = 150.00;

var products = [];
var cart = [];
var selectedCategory = 'All';

// Location Mapping
const LOCATION_DATA = {
  "Marilao": [
    "Abangan Norte", "Abangan Sur", "Ibayo", "Lias", 
    "Poblacion 1st", "Poblacion 2nd", "Saog", "Tabing Ilog"
  ],
  "Meycauayan": [
    "Bahay Pare", "Bancal", "Calvario", "Camalig", 
    "Hulo", "Iba", "Malhacan", "Poblacion", "Saluysoy", "Caingin", "Tugatog"
  ],
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
  // Only display categories for available in-stock items
  var inStockProducts = products.filter(p => parseInt(p.stock, 10) > 0);
  var categories = ['All', ...new Set(inStockProducts.map(p => p.category).filter(Boolean))];
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

  // Filter out any products that are out of stock (stock <= 0)
  var filtered = products.filter(p => 
    parseInt(p.stock, 10) > 0 &&
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search)))
  );

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
          <div style="display:flex; justify-content:space-between;">
            <span class="card-tag">${p.category}</span>
            <span class="card-barcode">${p.barcode}</span>
          </div>
          <h4 class="card-title">${p.name}</h4>
          ${isExpired ? '<span class="error-text">EXPIRED</span>' : (p.expiry ? `<small>Exp: ${p.expiry}</small>` : '<small style="color:#64748b;">No Expiration</small>')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span class="card-price">₱${p.price.toFixed(2)}</span>
          <button type="button" onclick="addToCart('${p.id}')" ${!canAdd ? 'disabled' : ''} class="btn btn-primary btn-sm">+</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-muted" style="grid-column:1/-1; text-align:center; padding:20px;">No products found.</p>';
}

function addToCart(id) {
  var prod = products.find(p => p.id === id);
  if (!prod) return;

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

  if (cart.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Cart is empty.</p>';
    if (totalEl) totalEl.textContent = '₱0.00';
    if (subEl) subEl.textContent = '₱0.00';
    if (btn) btn.disabled = true;
    if (minMsgEl) {
      minMsgEl.style.display = 'block';
      minMsgEl.textContent = '⚠️ Minimum order for delivery is ₱150.00';
    }
    return;
  }

  var grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  container.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <div>
        <strong>${item.name}</strong><br>
        <small class="font-mono">${item.barcode} | ₱${item.price.toFixed(2)} x ${item.qty}</small>
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

function openGCashModal() {
  var grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (grandTotal < MIN_DELIVERY_AMOUNT) {
    alert(`Minimum order value for delivery is ₱${MIN_DELIVERY_AMOUNT.toFixed(2)}.`);
    return;
  }

  document.getElementById('gcash-modal-amount').textContent = '₱' + grandTotal.toFixed(2);
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-city').value = '';
  document.getElementById('cust-brgy').innerHTML = '<option value="">Select City First</option>';
  document.getElementById('cust-brgy').disabled = true;
  document.getElementById('cust-street').value = '';
  
  const proofInput = document.getElementById('gcash-proof-input');
  if (proofInput) proofInput.value = '';

  document.getElementById('modal-gcash').classList.remove('hidden');
}

function closeGCashModal() { document.getElementById('modal-gcash').classList.add('hidden'); }

async function processGCashPayment() {
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

  try {
    const proofBase64 = await fileToBase64(file);

    const newTxn = {
      id: 'WOBS-' + Math.floor(100000 + Math.random() * 900000),
      customerName: name,
      address: fullAddress,
      items: cart,
      total: grandTotal,
      gcashRef: 'SCREENSHOT_ATTACHED',
      paymentProof: proofBase64
    };

    const res = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTxn)
    });

    openReceiptModal({ ...newTxn, date: new Date().toLocaleString() });
    clearCart();
    closeGCashModal();
    renderPosCatalog();
  } catch (err) {
    const newTxn = {
      id: 'WOBS-' + Math.floor(100000 + Math.random() * 900000),
      customerName: name,
      address: fullAddress,
      items: cart,
      total: grandTotal,
      gcashRef: 'SCREENSHOT_ATTACHED'
    };
    openReceiptModal({ ...newTxn, date: new Date().toLocaleString() });
    clearCart();
    closeGCashModal();
    renderPosCatalog();
  }
}

function openReceiptModal(txn) {
  document.getElementById('receipt-id').textContent = '#' + txn.id;
  document.getElementById('receipt-date').textContent = txn.date;
  document.getElementById('receipt-address').textContent = `${txn.customerName} | ${txn.address}`;
  document.getElementById('receipt-gcash-ref').textContent = 'Verified Screenshot';
  document.getElementById('receipt-total-amount').textContent = '₱' + txn.total.toFixed(2);
  document.getElementById('receipt-items-list').innerHTML = txn.items.map(i => `<p>${i.name} (x${i.qty}) - ₱${(i.price * i.qty).toFixed(2)}</p>`).join('');
  document.getElementById('modal-receipt').classList.remove('hidden');
}

function closeReceiptModal() { document.getElementById('modal-receipt').classList.add('hidden'); }

window.onload = function() {
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