const API_URL = "http://localhost:5000/api";
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
    "Hulo", "Iba", "Malhacan", "Poblacion", "Saluysoy"
  ],
  "Bocaue": [
    "Bambang", "Biñang 1st", "Biñang 2nd", "Bundukan", 
    "Igulot", "Poblacion", "Taal", "Turo"
  ]
};

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
    const data = await res.json();
    products = data.map(p => ({
      ...p,
      cost: parseFloat(p.cost),
      price: parseFloat(p.price),
      expiry: p.expiry.split('T')[0]
    }));
    return products;
  } catch (err) {
    console.error("Failed to connect to PostgreSQL backend:", err);
    return [];
  }
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
  var today = new Date();
  today.setHours(0,0,0,0);
  var expDate = new Date(expiryDateStr);
  expDate.setHours(0,0,0,0);
  return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
}

function checkForPendingScan() {
  var pendingCode = localStorage.getItem('wobs_pending_scan');
  if (pendingCode) {
    localStorage.removeItem('wobs_pending_scan');
    processScannedBarcode(pendingCode);
  }
}

async function processScannedBarcode(code) {
  var msgEl = document.getElementById('barcode-scan-msg');
  await fetchProductsFromDB();

  var found = products.find(p => p.barcode === code);
  if (found) {
    if (getDaysToExpiry(found.expiry) < 0) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = ' EXPIRED ITEM: ' + found.name + ' cannot be added.';
    } else if (found.stock <= 0) {
      msgEl.className = 'scan-msg text-danger';
      msgEl.textContent = ' OUT OF STOCK: ' + found.name;
    } else {
      addToCart(found.id);
      msgEl.className = 'scan-msg text-primary';
      msgEl.textContent = ' Scanned & Added: "' + found.name + '"';
    }
  } else {
    msgEl.className = 'scan-msg text-danger';
    msgEl.textContent = ' Unrecognized Barcode: ' + code;
  }
}

function handleBarcodeScan(e) {
  if (e) e.preventDefault();
  var inputEl = document.getElementById('pos-barcode-scanner');
  var code = inputEl.value.trim();
  if (code) processScannedBarcode(code);
  inputEl.value = '';
}

function renderCategoryPills() {
  var categories = ['All', ...new Set(products.map(p => p.category))];
  var container = document.getElementById('category-pills');
  container.innerHTML = categories.map(cat => 
    `<button type="button" onclick="setCategory('${cat}')" class="pill-btn ${selectedCategory === cat ? 'active' : ''}">${cat}</button>`
  ).join('');
}

function setCategory(cat) {
  selectedCategory = cat;
  renderCategoryPills();
  renderPosCatalog();
}

async function renderPosCatalog() {
  await fetchProductsFromDB();
  renderCategoryPills();
  var search = document.getElementById('pos-search').value.toLowerCase();
  var catalog = document.getElementById('pos-catalog');

  var filtered = products.filter(p => 
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(search) || p.barcode.includes(search))
  );

  catalog.innerHTML = filtered.map(p => {
    var isExpired = getDaysToExpiry(p.expiry) < 0;
    var canAdd = !isExpired && p.stock > 0;
    return `
      <div class="product-card ${isExpired ? 'expired' : ''}">
        <div>
          <div style="display:flex; justify-content:space-between;">
            <span class="card-tag">${p.category}</span>
            <span class="card-barcode">${p.barcode}</span>
          </div>
          <h4 class="card-title">${p.name}</h4>
          ${isExpired ? '<span class="error-text">EXPIRED</span>' : `<small>Exp: ${p.expiry}</small>`}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:10px;">
          <span class="card-price">₱${p.price.toFixed(2)}</span>
          <button type="button" onclick="addToCart('${p.id}')" ${!canAdd ? 'disabled' : ''} class="btn btn-primary btn-sm">+</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-muted">No products found.</p>';
}

function addToCart(id) {
  var prod = products.find(p => p.id === id);
  if (!prod) return;

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

  if (cart.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Cart is empty.</p>';
    totalEl.textContent = '₱0.00';
    subEl.textContent = '₱0.00';
    btn.disabled = true;
    if (minMsgEl) {
      minMsgEl.style.display = 'block';
      minMsgEl.textContent = ' Minimum order for delivery is ₱150.00';
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

  subEl.textContent = '₱' + grandTotal.toFixed(2);
  totalEl.textContent = '₱' + grandTotal.toFixed(2);

  // Enforce ₱150.00 minimum delivery rule
  if (grandTotal < MIN_DELIVERY_AMOUNT) {
    btn.disabled = true;
    if (minMsgEl) {
      const remaining = MIN_DELIVERY_AMOUNT - grandTotal;
      minMsgEl.style.display = 'block';
      minMsgEl.textContent = `⚠️ Add ₱${remaining.toFixed(2)} more to reach the ₱150.00 delivery minimum.`;
    }
  } else {
    btn.disabled = false;
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

  try {
    const proofBase64 = await fileToBase64(file);
    const fullAddress = `${street}, Brgy. ${brgy}, ${city}, Bulacan`;
    const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const newTxn = {
      id: 'WOBS-' + Math.floor(100000 + Math.random() * 900000),
      customerName: name, // Sends customer_name parameter to PostgreSQL
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

    if (res.ok) {
      openReceiptModal({ ...newTxn, date: new Date().toLocaleString() });
      clearCart();
      closeGCashModal();
      renderPosCatalog();
    } else {
      const errData = await res.json();
      alert("Checkout Error: " + (errData.error || "Server rejected request."));
    }
  } catch (err) {
    console.error("Checkout request failed:", err);
    alert("Checkout failed: Unable to connect to backend server.");
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
  checkForPendingScan();

  var manualInput = document.getElementById('pos-barcode-scanner');
  if (manualInput) {
    manualInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleBarcodeScan(e);
    });
  }
};