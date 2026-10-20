// Replace with your exact Render Web Service URL
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

let API_URL = isLocalhost
  ? `http://${(window.location.hostname && !window.location.hostname.includes('file')) ? window.location.hostname : 'localhost'}:5000/api` 
  : `${RENDER_BACKEND_URL}/api`;

async function fetchWithFallback(endpoint, options) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    return res;
  } catch (err) {
    if (API_URL !== `${RENDER_BACKEND_URL}/api`) {
      console.warn(`Local API (${API_URL}) failed, falling back to Render backend...`);
      API_URL = `${RENDER_BACKEND_URL}/api`;
      return await fetch(`${API_URL}${endpoint}`, options);
    }
    throw err;
  }
}

let productsData = [];
let transactionsData = [];

// Session-Based Admin Authentication Guard
function checkAdminAccess() {
  const isAuth = sessionStorage.getItem('wobs_admin_authenticated');
  if (isAuth !== 'true') {
    alert("❌ Access Denied: Please log in as an Admin first.");
    window.location.href = "Welcomepage.html";
  }
}

// Tab Switcher
function switchAdminTab(tabName) {
  const btnPos = document.getElementById('tab-btn-pos');
  const btnProducts = document.getElementById('tab-btn-products');
  const btnTxns = document.getElementById('tab-btn-txns');
  const btnWalkin = document.getElementById('tab-btn-walkin');
  const btnAnalytics = document.getElementById('tab-btn-analytics');

  const secPos = document.getElementById('section-pos');
  const secProducts = document.getElementById('section-products');
  const secTxns = document.getElementById('section-txns');
  const secWalkin = document.getElementById('section-walkin');
  const secAnalytics = document.getElementById('section-analytics');

  if (btnPos) btnPos.className = tabName === 'pos' ? "btn btn-primary" : "btn btn-secondary";
  if (btnProducts) btnProducts.className = tabName === 'products' ? "btn btn-primary" : "btn btn-secondary";
  if (btnTxns) btnTxns.className = tabName === 'txns' ? "btn btn-primary" : "btn btn-secondary";
  if (btnWalkin) btnWalkin.className = tabName === 'walkin' ? "btn btn-primary" : "btn btn-secondary";
  if (btnAnalytics) btnAnalytics.className = tabName === 'analytics' ? "btn btn-primary" : "btn btn-secondary";

  if (secPos) secPos.classList.toggle('hidden', tabName !== 'pos');
  if (secProducts) secProducts.classList.toggle('hidden', tabName !== 'products');
  if (secTxns) secTxns.classList.toggle('hidden', tabName !== 'txns');
  if (secWalkin) secWalkin.classList.toggle('hidden', tabName !== 'walkin');
  if (secAnalytics) secAnalytics.classList.toggle('hidden', tabName !== 'analytics');

  if (tabName === 'pos') {
    initAdminPos();
  }
  if (tabName === 'products') {
    fetchProducts();
    fetchPendingAdmins();
  }
  if (tabName === 'txns' || tabName === 'walkin') {
    fetchTransactions();
  }
  if (tabName === 'analytics') {
    renderAnalytics();
  }
}

async function fetchProducts() {
  try {
    const res = await fetchWithFallback(`/products`);
    productsData = await res.json();
    renderProductsTable();
    if (typeof renderAdminPosCatalog === 'function') {
      if (typeof renderAdminPosCategoryPills === 'function') {
        renderAdminPosCategoryPills();
      }
      renderAdminPosCatalog();
    }
  } catch (err) {
    console.error("Error fetching products:", err);
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('admin-products-list');
  if (!tbody) return;

  if (productsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px 20px; color:#64748b;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <i class="fa-solid fa-box-open" style="font-size:32px; color:#cbd5e1;"></i>
            <strong style="font-size:14px; color:#334155;">No Products in Catalog</strong>
            <span style="font-size:12px; color:#94a3b8;">Click "+ Add New Product" to add your first item.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productsData.map(p => {
    const hasExpiry = p.expiry && String(p.expiry).trim() !== '' && p.expiry !== 'null' && p.expiry !== 'N/A';
    const expiryStr = hasExpiry ? p.expiry.split('T')[0] : 'No Expiry';
    const isExpired = hasExpiry && new Date(p.expiry) < new Date();
    const stockNum = parseInt(p.stock || 0, 10);

    // Stock Badge
    let stockBadge = '';
    if (stockNum <= 0) {
      stockBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-weight:700; padding:4px 8px; border-radius:12px;"><i class="fa-solid fa-circle-xmark" style="margin-right:4px;"></i>Out of Stock</span>`;
    } else if (stockNum < 10) {
      stockBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; padding:4px 8px; border-radius:12px;"><i class="fa-solid fa-circle-exclamation" style="margin-right:4px;"></i>Low (${stockNum})</span>`;
    } else {
      stockBadge = `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; padding:4px 8px; border-radius:12px;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>${stockNum} in stock</span>`;
    }

    // Expiry Display
    const expiryBadge = !hasExpiry
      ? `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; font-size:11px; padding:3px 7px; border-radius:4px;"><i class="fa-solid fa-infinity" style="margin-right:4px; font-size:10px;"></i>No Expiry</span>`
      : isExpired
        ? `<span class="badge" style="background:#fee2e2; color:#dc2626; font-size:11px; padding:3px 6px; border-radius:4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:3px;"></i>${expiryStr}</span>`
        : `<span style="font-size:12px; color:#475569;"><i class="fa-regular fa-calendar" style="color:#94a3b8; margin-right:4px;"></i>${expiryStr}</span>`;

    // Clean display ID
    const cleanId = String(p.id).startsWith('p_') && String(p.id).length > 8 
      ? `p#${String(p.id).slice(-4)}` 
      : p.id;

    return `
      <tr>
        <td>
          <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; font-family:monospace; font-size:11px; padding:3px 6px; border-radius:4px;" title="${p.id}">${cleanId}</span>
        </td>
        <td>
          <span style="font-family:monospace; font-size:12px; color:#334155; font-weight:600;">
            <i class="fa-solid fa-barcode" style="color:#94a3b8; margin-right:4px;"></i>${p.barcode || 'N/A'}
          </span>
        </td>
        <td>
          <strong style="color:#0f172a; font-size:13px;">${p.name}</strong>
        </td>
        <td>
          <span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:600; font-size:11px; padding:3px 8px; border-radius:6px;">${p.category || 'General'}</span>
        </td>
        <td style="text-align:right; color:#64748b; font-size:13px;">
          ₱${parseFloat(p.cost || 0).toFixed(2)}
        </td>
        <td style="text-align:right; font-weight:700; color:#0f172a; font-size:13px;">
          ₱${parseFloat(p.price || 0).toFixed(2)}
        </td>
        <td style="text-align:center;">
          ${stockBadge}
        </td>
        <td>
          ${expiryBadge}
        </td>
        <td style="text-align:center;">
          <div class="action-btn-group">
            <button onclick="editProduct('${p.id}')" class="btn-action-edit" title="Edit Product">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button onclick="deleteProduct('${p.id}')" class="btn-action-delete" title="Delete Product">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleNoExpiry(isNoExpiry) {
  const expiryInput = document.getElementById('prod-expiry');
  const noExpiryCheckbox = document.getElementById('prod-no-expiry');
  if (noExpiryCheckbox) noExpiryCheckbox.checked = isNoExpiry;
  if (expiryInput) {
    if (isNoExpiry) {
      expiryInput.value = '';
      expiryInput.disabled = true;
      expiryInput.style.backgroundColor = '#f1f5f9';
      expiryInput.style.color = '#94a3b8';
      expiryInput.style.cursor = 'not-allowed';
    } else {
      expiryInput.disabled = false;
      expiryInput.style.backgroundColor = '';
      expiryInput.style.color = '';
      expiryInput.style.cursor = '';
    }
  }
}

function openProductModal() {
  if (typeof stopCameraStream === 'function') stopCameraStream();
  if (typeof stopBarcodeScanner === 'function') stopBarcodeScanner();

  const successBox = document.getElementById('barcode-scan-success-msg');
  if (successBox) successBox.classList.add('hidden');

  document.getElementById('modal-product-title').textContent = "Add New Product";
  document.getElementById('prod-id').value = "p_" + Date.now();
  document.getElementById('prod-barcode').value = "";
  document.getElementById('prod-name').value = "";
  document.getElementById('prod-category').value = "";
  document.getElementById('prod-cost').value = "";
  document.getElementById('prod-price').value = "";
  document.getElementById('prod-stock').value = "";
  document.getElementById('prod-expiry').value = "";
  toggleNoExpiry(false);

  if (document.getElementById('prod-photo-base64')) {
    document.getElementById('prod-photo-base64').value = "";
  }
  if (document.getElementById('camera-placeholder')) {
    document.getElementById('camera-placeholder').classList.remove('hidden');
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('camera-video').classList.add('hidden');
    document.getElementById('btn-start-camera').classList.remove('hidden');
    document.getElementById('btn-capture-photo').classList.add('hidden');
    document.getElementById('btn-retake-photo').classList.add('hidden');
  }

  document.getElementById('modal-product').classList.remove('hidden');
}

function editProduct(id) {
  if (typeof stopCameraStream === 'function') stopCameraStream();
  if (typeof stopBarcodeScanner === 'function') stopBarcodeScanner();

  const successBox = document.getElementById('barcode-scan-success-msg');
  if (successBox) successBox.classList.add('hidden');

  const p = productsData.find(item => item.id === id);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = "Edit Product";
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-barcode').value = p.barcode;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-cost').value = p.cost;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-stock').value = p.stock;

  const hasExpiry = p.expiry && String(p.expiry).trim() !== '' && p.expiry !== 'null' && p.expiry !== 'N/A';
  if (hasExpiry) {
    document.getElementById('prod-expiry').value = p.expiry.split('T')[0];
    toggleNoExpiry(false);
  } else {
    document.getElementById('prod-expiry').value = "";
    toggleNoExpiry(true);
  }

  const photoInput = document.getElementById('prod-photo-base64');
  const imagePreview = document.getElementById('image-preview');
  const placeholder = document.getElementById('camera-placeholder');

  if (photoInput) photoInput.value = "";

  if (p.image && p.image.trim() !== "") {
    if (photoInput) photoInput.value = p.image;
    if (imagePreview) {
      imagePreview.src = p.image.startsWith('data:image') ? p.image : `data:image/jpeg;base64,${p.image}`;
      imagePreview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    document.getElementById('btn-start-camera').classList.add('hidden');
    document.getElementById('btn-retake-photo').classList.remove('hidden');
  } else {
    if (placeholder) placeholder.classList.remove('hidden');
    if (imagePreview) imagePreview.classList.add('hidden');
    document.getElementById('btn-start-camera').classList.remove('hidden');
    document.getElementById('btn-retake-photo').classList.add('hidden');
  }

  document.getElementById('modal-product').classList.remove('hidden');
}

function closeProductModal() {
  if (typeof stopCameraStream === 'function') {
    stopCameraStream();
  }
  if (typeof stopBarcodeScanner === 'function') {
    stopBarcodeScanner();
  }
  document.getElementById('modal-product').classList.add('hidden');
  const scannerModal = document.getElementById('modal-barcode-scanner');
  if (scannerModal) scannerModal.classList.add('hidden');
}

async function saveProduct() {
  const photoInput = document.getElementById('prod-photo-base64');
  const imagePreview = document.getElementById('image-preview');

  let photoBase64 = "";

  if (photoInput && photoInput.value && photoInput.value.trim() !== "") {
    photoBase64 = photoInput.value;
  } else if (imagePreview && imagePreview.src && imagePreview.src.startsWith('data:image')) {
    photoBase64 = imagePreview.src;
  }

  const isNoExpiry = document.getElementById('prod-no-expiry')?.checked || false;
  const expiryVal = isNoExpiry ? null : (document.getElementById('prod-expiry').value.trim() || null);

  const barcodeVal = document.getElementById('prod-barcode').value.trim();
  const nameVal = document.getElementById('prod-name').value.trim();
  const categoryVal = document.getElementById('prod-category').value.trim();

  if (!nameVal) {
    alert("Please enter a product name.");
    return;
  }
  if (!categoryVal) {
    alert("Please enter a category.");
    return;
  }
  if (!isNoExpiry && !expiryVal) {
    alert("Please select an expiration date, or check 'No Expiration Date'.");
    return;
  }

  const productPayload = {
    id: document.getElementById('prod-id').value,
    ProductID: document.getElementById('prod-id').value,
    barcode: barcodeVal,
    name: nameVal,
    category: categoryVal,
    cost: parseFloat(document.getElementById('prod-cost').value) || 0,
    price: parseFloat(document.getElementById('prod-price').value) || 0,
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    expiry: expiryVal,
    image: photoBase64
  };

  try {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productPayload)
    });

    if (res.ok) {
      closeProductModal();
      fetchProducts();
    } else {
      alert("Failed to save product.");
    }
  } catch (err) {
    console.error("Save error:", err);
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete product?")) return;
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
  } catch (err) {
    console.error("Delete error:", err);
  }
}

async function fetchTransactions() {
  try {
    const res = await fetchWithFallback(`/transactions`);
    let data = await res.json();
    
    // Check local storage status overrides
    const localTxns = JSON.parse(localStorage.getItem('wobs_transactions') || '[]');
    
    transactionsData = data.map(txn => {
      const cleanId = String(txn.id).replace('WOBS-', '').replace('#', '');
      const localMatch = localTxns.find(l => String(l.id).replace('WOBS-', '').replace('#', '') === cleanId);
      
      return {
        ...txn,
        status: localMatch && localMatch.status ? localMatch.status : (txn.status || 'Pending')
      };
    });

    renderTransactionsTable();
  } catch (err) {
    console.error("Error fetching transactions:", err);
  }
}

// Helper to determine if transaction is Walk-in POS vs. Online Customer Order
function isWalkInTransaction(txn) {
  if (!txn) return false;
  const addr = String(txn.address || '').toLowerCase();
  const ref = String(txn.gcash_ref || '').toUpperCase();
  const custName = String(txn.customer_name || '').toLowerCase();
  return (
    addr.includes('walk-in') || 
    addr.includes('in-store') || 
    ref.includes('WALK_IN') || 
    ref.includes('CASH_SALE') || 
    (!txn.customer_id && !txn.customer_username && addr.includes('pos')) ||
    (custName.includes('walk-in') && !txn.customer_id)
  );
}

// 1. Render Transactions Tables (Separated into Online Orders and Walk-in POS)
function renderTransactionsTable() {
  const onlineTxns = transactionsData.filter(t => !isWalkInTransaction(t));
  const walkinTxns = transactionsData.filter(t => isWalkInTransaction(t));

  renderOnlineOrdersTable(onlineTxns);
  renderWalkinTransactionsTable(walkinTxns);
}

function renderOnlineOrdersTable(orders) {
  const tbody = document.getElementById('admin-txns-list');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:35px 20px; color:#64748b;">
          <i class="fa-solid fa-truck-ramp-box" style="font-size:28px; color:#cbd5e1; display:block; margin-bottom:8px;"></i>
          <strong>No Online Customer Orders Found</strong>
          <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">When customers place orders online with GCash proofs, they will appear here.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(txn => {
    let items = [];
    try {
      items = typeof txn.items === 'string' ? JSON.parse(txn.items) : (txn.items || []);
    } catch (e) {
      items = [];
    }
    const itemListStr = Array.isArray(items) ? items.map(i => `${i.name} (x${i.qty})`).join(', ') : 'No items';
    const formattedDate = txn.date_created ? new Date(txn.date_created).toLocaleString() : '--';
    const hasProof = txn.payment_proof && (txn.payment_proof.startsWith('data:image') || txn.payment_proof.startsWith('http'));
    const custName = txn.customer_name || 'Customer';
    const currentStatus = txn.status || 'Pending';

    // Side-by-side Action Buttons
    let actionButtons = '';
    if (currentStatus === 'Pending') {
      actionButtons = `
        <div class="action-btn-group">
          <button onclick="updateOrderStatus('${txn.id}', 'Accepted')" class="btn-action-accept" title="Accept Order">
            <i class="fa-solid fa-check"></i> Accept
          </button>
          <button onclick="updateOrderStatus('${txn.id}', 'Declined')" class="btn-action-decline" title="Decline Order">
            <i class="fa-solid fa-xmark"></i> Decline
          </button>
        </div>
      `;
    } else if (['Accepted', 'Preparing Order', 'Out for Delivery', 'Delivered'].includes(currentStatus)) {
      actionButtons = `<span style="color: #16a34a; font-weight: 700; font-size: 12px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;"><i class="fa-solid fa-square-check"></i> Accepted</span>`;
    } else if (currentStatus === 'Declined') {
      actionButtons = `<span style="color: #dc2626; font-weight: 700; font-size: 12px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;"><i class="fa-solid fa-rectangle-xmark"></i> Declined</span>`;
    }

    return `
      <tr>
        <td style="white-space: nowrap;"><strong style="color: #0284c7; font-family: monospace; font-size: 13px;">#${txn.id}</strong></td>
        <td style="white-space: nowrap;"><small style="color: #475569;">${formattedDate}</small></td>
        <td><strong>${custName}</strong></td>
        <td><small style="color: #334155;">${txn.address || 'N/A'}</small></td>
        <td style="text-align: right; white-space: nowrap;"><strong style="color: #16a34a; font-size: 14px;">₱${parseFloat(txn.total || 0).toFixed(2)}</strong></td>
        <td style="text-align: center; white-space: nowrap;">
          ${hasProof 
            ? `<button onclick="viewProofImage('${txn.id}')" class="btn-proof-view"><i class="fa-solid fa-image"></i> View Screenshot</button>` 
            : `<span style="color: #94a3b8; font-size: 12px;">No Screenshot</span>`
          }
        </td>
        <td><small style="color: #334155;">${itemListStr}</small></td>
        <td style="text-align: center; white-space: nowrap;">
          <select onchange="updateOrderStatus('${txn.id}', this.value)" class="status-select">
            <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Accepted" ${currentStatus === 'Accepted' ? 'selected' : ''}>Accepted</option>
            <option value="Preparing Order" ${currentStatus === 'Preparing Order' ? 'selected' : ''}>Preparing Order</option>
            <option value="Out for Delivery" ${currentStatus === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Declined" ${currentStatus === 'Declined' ? 'selected' : ''}>Declined</option>
          </select>
        </td>
        <td style="text-align: center; white-space: nowrap;">${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

function renderWalkinTransactionsTable(walkins) {
  const tbody = document.getElementById('admin-walkin-list');
  if (!tbody) return;

  if (walkins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:35px 20px; color:#64748b;">
          <i class="fa-solid fa-store" style="font-size:28px; color:#cbd5e1; display:block; margin-bottom:8px;"></i>
          <strong>No Walk-in POS Transactions Recorded Yet</strong>
          <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">Sales completed through Cashier POS (Cash or GCash) will appear here.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = walkins.map(txn => {
    let items = [];
    try {
      items = typeof txn.items === 'string' ? JSON.parse(txn.items) : (txn.items || []);
    } catch (e) {
      items = [];
    }
    const itemListStr = Array.isArray(items) ? items.map(i => `${i.name} (x${i.qty})`).join(', ') : 'No items';
    const formattedDate = txn.date_created ? new Date(txn.date_created).toLocaleString() : '--';
    const hasProof = txn.payment_proof && (txn.payment_proof.startsWith('data:image') || txn.payment_proof.startsWith('http'));
    const isCash = txn.payment_method === 'Cash' || String(txn.gcash_ref).includes('CASH');
    const custName = txn.customer_name || 'Walk-in Customer';

    const payBadge = isCash
      ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700; font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-money-bill-wave" style="margin-right:4px;"></i>Cash</span>`
      : `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:4px;"></i>GCash Walk-in</span>`;

    const proofDisplay = hasProof
      ? `<button onclick="viewProofImage('${txn.id}')" class="btn-proof-view"><i class="fa-solid fa-camera"></i> View Photo</button>`
      : (isCash 
          ? `<span style="color:#94a3b8; font-size:11px;"><i class="fa-solid fa-circle-minus" style="margin-right:3px;"></i>Cash Sale</span>` 
          : `<span style="color:#94a3b8; font-size:11px;">No Photo</span>`);

    return `
      <tr>
        <td style="white-space: nowrap;"><strong style="color: #0284c7; font-family: monospace; font-size: 13px;">#${txn.id}</strong></td>
        <td style="white-space: nowrap;"><small style="color: #475569;">${formattedDate}</small></td>
        <td><strong>${custName}</strong></td>
        <td style="text-align: center; white-space: nowrap;">${payBadge}</td>
        <td style="text-align: right; white-space: nowrap;"><strong style="color: #16a34a; font-size: 14px;">₱${parseFloat(txn.total || 0).toFixed(2)}</strong></td>
        <td style="text-align: center; white-space: nowrap;">${proofDisplay}</td>
        <td><small style="color: #334155;">${itemListStr}</small></td>
        <td style="text-align: center; white-space: nowrap;">
          <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; font-size:11px; padding:3px 8px; border-radius:12px;">
            <i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>Completed
          </span>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button onclick="reprintWalkinReceipt('${txn.id}')" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:4px 9px;" title="Reprint Official POS Receipt">
            <i class="fa-solid fa-print"></i> Receipt
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function reprintWalkinReceipt(txnId) {
  const cleanId = String(txnId).replace('WOBS-', '').replace('#', '');
  const txn = transactionsData.find(t => String(t.id).replace('WOBS-', '').replace('#', '') === cleanId);
  if (!txn) {
    alert("Transaction not found.");
    return;
  }

  let items = [];
  try {
    items = typeof txn.items === 'string' ? JSON.parse(txn.items) : (txn.items || []);
  } catch (e) {
    items = [];
  }

  const isCash = txn.payment_method === 'Cash' || String(txn.gcash_ref).includes('CASH');

  openAdminReceiptModal({
    id: cleanId,
    date: txn.date_created ? new Date(txn.date_created).toLocaleString() : new Date().toLocaleString(),
    cashier: sessionStorage.getItem('wobs_admin_username') || 'Admin',
    customerName: txn.customer_name || 'Walk-in Customer',
    items: items,
    total: parseFloat(txn.total || 0),
    tendered: parseFloat(txn.total || 0),
    change: 0,
    paymentMethod: isCash ? 'Cash' : 'GCash'
  });
}

// 2. Update Order Status and Refresh Data
async function updateOrderStatus(txnId, newStatus) {
  const cleanId = String(txnId).replace('WOBS-', '').replace('#', '');
  
  // Update local state
  const txn = transactionsData.find(t => String(t.id).replace('WOBS-', '').replace('#', '') === cleanId);
  if (txn) {
    txn.status = newStatus;
  }

  // Persist in localStorage for cross-tab sync
  let localTxns = JSON.parse(localStorage.getItem('wobs_transactions') || '[]');
  const localIndex = localTxns.findIndex(l => String(l.id).replace('WOBS-', '').replace('#', '') === cleanId);
  
  if (localIndex !== -1) {
    localTxns[localIndex].status = newStatus;
  } else {
    localTxns.push({ id: txnId, status: newStatus });
  }
  localStorage.setItem('wobs_transactions', JSON.stringify(localTxns));

  // Sync with backend API
  try {
    await fetch(`${API_URL}/transactions/${cleanId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (err) {
    console.warn("Server status sync notice:", err);
  }

  // Refresh tables and analytics dynamically
  renderTransactionsTable();
  if (typeof renderAnalytics === 'function') {
    renderAnalytics();
  }
}

function viewProofImage(txnId) {
  const cleanId = String(txnId).replace('WOBS-', '').replace('#', '');
  const txn = transactionsData.find(t => String(t.id).replace('WOBS-', '').replace('#', '') === cleanId);
  if (txn && txn.payment_proof) {
    document.getElementById('proof-preview-img').src = txn.payment_proof;
    document.getElementById('modal-proof-preview').classList.remove('hidden');
  } else {
    alert("No payment screenshot or receipt photo available.");
  }
}

function closeProofModal() {
  document.getElementById('modal-proof-preview').classList.add('hidden');
}

// Admin Pending Approvals Handler
async function fetchPendingAdmins() {
  try {
    const res = await fetch(`${API_URL}/admin/pending`);
    if (!res.ok) return;
    const list = await res.json();
    const tbody = document.getElementById('pending-admin-list');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding:35px 20px; color:#64748b;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
              <i class="fa-solid fa-user-shield" style="font-size:28px; color:#cbd5e1;"></i>
              <strong style="font-size:14px; color:#334155;">No Pending Account Approvals</strong>
              <span style="font-size:12px; color:#94a3b8;">All admin and staff registration requests have been processed.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(a => `
      <tr>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 10px;">
            <span style="width: 32px; height: 32px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
              ${(a.fullname || 'A')[0].toUpperCase()}
            </span>
            <strong style="color: #0f172a; font-size: 13px;">${a.fullname}</strong>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; font-family: monospace; padding: 5px 12px; font-size: 12px; border-radius: 6px; display: inline-flex; align-items: center;">
            <i class="fa-solid fa-user" style="color: #94a3b8; margin-right: 6px;"></i>${a.username}
          </span>
        </td>
        <td style="text-align: center;">
          <div class="action-btn-group" style="justify-content: center;">
            <button onclick="approveAdmin(${a.id}, 'APPROVED')" class="btn-action-accept" title="Approve Request">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button onclick="approveAdmin(${a.id}, 'REJECTED')" class="btn-action-decline" title="Reject Request">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn("Pending admin check warning:", err);
  }
}

async function approveAdmin(id, action) {
  try {
    const res = await fetch(`${API_URL}/admin/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      fetchPendingAdmins();
    }
  } catch (err) {
    console.error("Approval error:", err);
  }
}

// Timeframe State & Bar Chart Instance
let selectedAnalyticsTimeframe = 'monthly';
let channelTrendChartInstance = null;

function changeAnalyticsTimeframe(timeframe) {
  selectedAnalyticsTimeframe = timeframe;

  // Sync button pills (Daily, Weekly, Monthly, Yearly)
  document.querySelectorAll('.analytics-pill-btn[data-timeframe]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
  });

  const dailyPickerContainer = document.getElementById('analytics-daily-picker-container');
  if (dailyPickerContainer) {
    dailyPickerContainer.classList.toggle('hidden', timeframe !== 'daily');
  }

  renderAnalytics();
}

// 3. Calculate Sales & Products Sold for Chosen Timeframe (Daily, Weekly, Monthly, Yearly)
async function renderAnalytics() {
  await fetchProducts();
  await fetchTransactions();

  // Read current timeframe from global variable
  const timeframe = selectedAnalyticsTimeframe || 'monthly';

  // Sync pill buttons
  document.querySelectorAll('.analytics-pill-btn[data-timeframe]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
  });

  // Read selected year (defaults strictly to 2026 or chosen year from the Year filter)
  const yearSelect = document.getElementById('analytics-year-select');
  const currentYear = yearSelect ? parseInt(yearSelect.value, 10) : 2026;

  const now = new Date();
  const currentMonth = now.getMonth();

  // Reference date anchored to the active year (2026 by default)
  const refDate = new Date(currentYear, currentMonth, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  let filterFn;
  let periodLabelText = "";
  let titleLabelText = "";
  let rangeLabelText = "";
  let badgeText = "";
  let targetDailyDateStr = "";

  const dailyPickerContainer = document.getElementById('analytics-daily-picker-container');
  const dailyDateInput = document.getElementById('analytics-daily-date');

  if (timeframe === 'daily') {
    if (dailyPickerContainer) dailyPickerContainer.classList.remove('hidden');

    let targetYear = refDate.getFullYear();
    let targetMonth = refDate.getMonth();
    let targetDay = refDate.getDate();

    if (dailyDateInput && dailyDateInput.value) {
      const parts = dailyDateInput.value.split('-');
      if (parts.length === 3) {
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10) - 1;
        targetDay = parseInt(parts[2], 10);
      }
    } else if (dailyDateInput) {
      const yStr = String(targetYear);
      const mStr = String(targetMonth + 1).padStart(2, '0');
      const dStr = String(targetDay).padStart(2, '0');
      dailyDateInput.value = `${yStr}-${mStr}-${dStr}`;
    }

    targetDailyDateStr = dailyDateInput ? dailyDateInput.value : '';

    filterFn = (txnDate) => {
      return txnDate.getFullYear() === targetYear &&
             txnDate.getMonth() === targetMonth &&
             txnDate.getDate() === targetDay;
    };

    const isToday = (targetYear === now.getFullYear() && targetMonth === now.getMonth() && targetDay === now.getDate());
    const displayDateObj = new Date(targetYear, targetMonth, targetDay);
    const dateFormatted = displayDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const shortFormatted = displayDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    periodLabelText = "Daily Performance";
    titleLabelText = isToday ? `Today's Daily Sales (${dateFormatted})` : `Daily Sales (${dateFormatted})`;
    rangeLabelText = isToday ? `(Today – ${dateFormatted})` : `(${dateFormatted})`;
    badgeText = isToday ? `Today (${shortFormatted})` : shortFormatted;
  } else {
    if (dailyPickerContainer) dailyPickerContainer.classList.add('hidden');

    if (timeframe === 'weekly') {
      // Last 7 days anchored to refDate in currentYear
      const sevenDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 6, 0, 0, 0, 0);
      filterFn = (txnDate) => txnDate >= sevenDaysAgo && txnDate <= refDate;

      periodLabelText = "Weekly Performance";
      titleLabelText = "Total Weekly Sales";
      const startFormatted = sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endFormatted = refDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      rangeLabelText = `(${startFormatted} – ${endFormatted})`;
      badgeText = "Last 7 Days";
    } else if (timeframe === 'yearly') {
      // Current Calendar Year: 2026 by default
      filterFn = (txnDate) => txnDate.getFullYear() === currentYear;

      periodLabelText = "Yearly Performance";
      titleLabelText = `Total Yearly Sales (${currentYear})`;
      rangeLabelText = `(Jan 1 – Dec 31, ${currentYear})`;
      badgeText = `Year ${currentYear}`;
    } else {
      // Default: 'monthly' (Current Calendar Month in 2026 by default)
      filterFn = (txnDate) => txnDate.getFullYear() === currentYear && txnDate.getMonth() === currentMonth;

      periodLabelText = "Monthly Performance";
      titleLabelText = `Total Monthly Sales (${monthNames[currentMonth]} ${currentYear})`;
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      rangeLabelText = `(${monthNames[currentMonth]} 1 – ${lastDayOfMonth}, ${currentYear})`;
      badgeText = `${monthNames[currentMonth]} ${currentYear}`;
    }
  }

  // Update Dynamic Header Text & Badges
  const periodLabel = document.getElementById('sales-period-label');
  if (periodLabel) periodLabel.textContent = periodLabelText;

  const titleLabel = document.getElementById('sales-title-label');
  if (titleLabel) titleLabel.textContent = titleLabelText;

  const rangeBadge = document.getElementById('sales-date-range-badge');
  if (rangeBadge) rangeBadge.textContent = rangeLabelText;

  const bestBadge = document.getElementById('best-sellers-badge');
  if (bestBadge) bestBadge.textContent = badgeText;

  const leastBadge = document.getElementById('least-sellers-badge');
  if (leastBadge) leastBadge.textContent = badgeText;

  let totalSales = 0;
  let orderCount = 0;
  let totalUnits = 0;
  const productSalesCount = {};

  let walkinSales = 0;
  let walkinOrders = 0;
  let walkinUnits = 0;

  let onlineSales = 0;
  let onlineOrders = 0;
  let onlineUnits = 0;

  // Track today's daily sales across all data for the live chip
  let todaySalesTotal = 0;
  let todayOrdersTotal = 0;

  const periodTxns = [];

  productsData.forEach(p => {
    productSalesCount[p.name] = 0;
  });

  // Valid statuses that count as actual sales revenue
  const VALID_SALES_STATUSES = ['ACCEPTED', 'PREPARING ORDER', 'OUT FOR DELIVERY', 'DELIVERED', 'COMPLETED'];

  transactionsData.forEach(txn => {
    const txnDate = txn.date_created ? new Date(txn.date_created) : null;
    const statusUpper = String(txn.status || 'Pending').trim().toUpperCase();

    // Accumulate sales and items exclusively for fulfilled/accepted orders
    if (VALID_SALES_STATUSES.includes(statusUpper) && txnDate && !isNaN(txnDate.getTime())) {
      // Calculate live today's sales
      if (txnDate.getFullYear() === now.getFullYear() && txnDate.getMonth() === now.getMonth() && txnDate.getDate() === now.getDate()) {
        todaySalesTotal += parseFloat(txn.total || 0);
        todayOrdersTotal++;
      }

      // Check active timeframe filter
      if (filterFn(txnDate)) {
        const txnTotal = parseFloat(txn.total || 0);
        totalSales += txnTotal;
        orderCount++;
        periodTxns.push(txn);

        let items = [];
        try {
          items = typeof txn.items === 'string' ? JSON.parse(txn.items) : (txn.items || []);
        } catch (e) {
          console.warn("Error parsing items for transaction:", txn.id, e);
        }

        let currentTxnUnits = 0;
        items.forEach(i => {
          const qty = parseInt(i.qty || 1, 10);
          productSalesCount[i.name] = (productSalesCount[i.name] || 0) + qty;
          totalUnits += qty;
          currentTxnUnits += qty;
        });

        if (isWalkInTransaction(txn)) {
          walkinSales += txnTotal;
          walkinOrders++;
          walkinUnits += currentTxnUnits;
        } else {
          onlineSales += txnTotal;
          onlineOrders++;
          onlineUnits += currentTxnUnits;
        }
      }
    }
  });

  // Update Live Today's Quick Sales Chip
  const todaySalesEl = document.getElementById('today-quick-sales');
  if (todaySalesEl) {
    todaySalesEl.textContent = '₱' + todaySalesTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const todayOrdersEl = document.getElementById('today-quick-orders');
  if (todayOrdersEl) {
    todayOrdersEl.textContent = `(${todayOrdersTotal} ${todayOrdersTotal === 1 ? 'sale' : 'sales'})`;
  }

  // Display Total Revenue
  const salesEl = document.getElementById('monthly-sales-amount');
  if (salesEl) {
    salesEl.textContent = '₱' + totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Display Walk-in POS Sales KPI
  const walkinRevEl = document.getElementById('analytics-walkin-revenue');
  if (walkinRevEl) {
    walkinRevEl.textContent = '₱' + walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const walkinSubEl = document.getElementById('analytics-walkin-orders-count');
  if (walkinSubEl) {
    const wPct = totalSales > 0 ? ((walkinSales / totalSales) * 100).toFixed(1) : 0;
    walkinSubEl.textContent = `${walkinOrders} ${walkinOrders === 1 ? 'sale' : 'sales'} (${wPct}%)`;
  }

  // Display Online Customer Orders KPI
  const onlineRevEl = document.getElementById('analytics-online-revenue');
  if (onlineRevEl) {
    onlineRevEl.textContent = '₱' + onlineSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const onlineSubEl = document.getElementById('analytics-online-orders-count');
  if (onlineSubEl) {
    const oPct = totalSales > 0 ? ((onlineSales / totalSales) * 100).toFixed(1) : 0;
    onlineSubEl.textContent = `${onlineOrders} ${onlineOrders === 1 ? 'order' : 'orders'} (${oPct}%)`;
  }

  // Display Total Orders Count
  const ordersEl = document.getElementById('analytics-orders-count');
  if (ordersEl) {
    ordersEl.textContent = orderCount;
  }

  // Display Units Count
  const unitsEl = document.getElementById('analytics-units-count');
  if (unitsEl) {
    unitsEl.textContent = `${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`;
  }

  // Render Walk-in vs Online Customer Orders Comparative Section & Charts
  renderChannelComparison({
    walkinSales,
    onlineSales,
    walkinOrders,
    onlineOrders,
    walkinUnits,
    onlineUnits,
    totalSales,
    periodTxns,
    timeframe,
    refDate,
    currentYear,
    currentMonth,
    targetDailyDateStr
  });

  // Rank products by units sold
  const sortedProducts = Object.keys(productSalesCount).map(name => ({
    name: name,
    qty: productSalesCount[name]
  })).sort((a, b) => b.qty - a.qty);

  // Top 5 Best Sellers
  const bestSellersList = document.getElementById('best-selling-list');
  if (bestSellersList) {
    const productsWithSales = sortedProducts.filter(p => p.qty > 0);
    if (productsWithSales.length === 0) {
      bestSellersList.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:16px; color:#64748b;">No sales recorded for this timeframe</td></tr>';
    } else {
      bestSellersList.innerHTML = productsWithSales.slice(0, 5).map((p, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 14px; color: #0f172a;">
            <span style="display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; background:#dcfce7; color:#15803d; font-size:11px; font-weight:bold; margin-right:8px;">#${idx + 1}</span>
            <strong>${p.name}</strong>
          </td>
          <td style="text-align:right; padding: 12px 14px; color:#16a34a;"><strong>${p.qty} sold</strong></td>
        </tr>
      `).join('');
    }
  }

  // Top 5 Least Sellers
  const leastSellersList = document.getElementById('least-selling-list');
  if (leastSellersList) {
    if (sortedProducts.length === 0) {
      leastSellersList.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:16px; color:#64748b;">No products found</td></tr>';
    } else {
      const leastProducts = [...sortedProducts].reverse().slice(0, 5);
      leastSellersList.innerHTML = leastProducts.map((p, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 14px; color: #0f172a;">
            <span style="display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; background:#fee2e2; color:#b91c1c; font-size:11px; font-weight:bold; margin-right:8px;">#${idx + 1}</span>
            <strong>${p.name}</strong>
          </td>
          <td style="text-align:right; padding: 12px 14px; color:#dc2626;"><strong>${p.qty} sold</strong></td>
        </tr>
      `).join('');
    }
  }
}

// 4. Render Walk-in vs. Online Orders Comparison & Charts
function renderChannelComparison(data) {
  const {
    walkinSales,
    onlineSales,
    walkinOrders,
    onlineOrders,
    walkinUnits,
    onlineUnits,
    totalSales,
    periodTxns,
    timeframe,
    refDate,
    currentYear,
    currentMonth,
    targetDailyDateStr
  } = data;

  const walkinShare = totalSales > 0 ? (walkinSales / totalSales) * 100 : 0;
  const onlineShare = totalSales > 0 ? (onlineSales / totalSales) * 100 : 0;
  const walkinAvg = walkinOrders > 0 ? walkinSales / walkinOrders : 0;
  const onlineAvg = onlineOrders > 0 ? onlineSales / onlineOrders : 0;
  const diff = Math.abs(walkinSales - onlineSales);

  // 1. Update Distribution Progress Bar
  const distWalkinLabel = document.getElementById('dist-bar-walkin-label');
  const distOnlineLabel = document.getElementById('dist-bar-online-label');
  const distWalkinFill = document.getElementById('dist-bar-walkin-fill');
  const distOnlineFill = document.getElementById('dist-bar-online-fill');

  if (distWalkinLabel) {
    distWalkinLabel.textContent = `${walkinShare.toFixed(1)}% (₱${walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  if (distOnlineLabel) {
    distOnlineLabel.textContent = `${onlineShare.toFixed(1)}% (₱${onlineSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  if (distWalkinFill && distOnlineFill) {
    if (totalSales > 0) {
      distWalkinFill.style.width = `${walkinShare}%`;
      distOnlineFill.style.width = `${onlineShare}%`;
    } else {
      distWalkinFill.style.width = '50%';
      distOnlineFill.style.width = '50%';
    }
  }

  // 2. Update Channel Breakdown Cards
  const elCardWalkinRev = document.getElementById('card-walkin-revenue');
  const elCardWalkinShare = document.getElementById('card-walkin-share');
  const elCardWalkinOrders = document.getElementById('card-walkin-orders');
  const elCardWalkinUnits = document.getElementById('card-walkin-units');
  const elCardWalkinAvg = document.getElementById('card-walkin-avg');

  if (elCardWalkinRev) elCardWalkinRev.textContent = '₱' + walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (elCardWalkinShare) elCardWalkinShare.textContent = `(${walkinShare.toFixed(1)}% of total sales)`;
  if (elCardWalkinOrders) elCardWalkinOrders.textContent = walkinOrders;
  if (elCardWalkinUnits) elCardWalkinUnits.textContent = `${walkinUnits} ${walkinUnits === 1 ? 'unit' : 'units'}`;
  if (elCardWalkinAvg) elCardWalkinAvg.textContent = '₱' + walkinAvg.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const elCardOnlineRev = document.getElementById('card-online-revenue');
  const elCardOnlineShare = document.getElementById('card-online-share');
  const elCardOnlineOrders = document.getElementById('card-online-orders');
  const elCardOnlineUnits = document.getElementById('card-online-units');
  const elCardOnlineAvg = document.getElementById('card-online-avg');

  if (elCardOnlineRev) elCardOnlineRev.textContent = '₱' + onlineSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (elCardOnlineShare) elCardOnlineShare.textContent = `(${onlineShare.toFixed(1)}% of total sales)`;
  if (elCardOnlineOrders) elCardOnlineOrders.textContent = onlineOrders;
  if (elCardOnlineUnits) elCardOnlineUnits.textContent = `${onlineUnits} ${onlineUnits === 1 ? 'unit' : 'units'}`;
  if (elCardOnlineAvg) elCardOnlineAvg.textContent = '₱' + onlineAvg.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 3. Update Winner / Leader Callout Banner and Status Tags
  const winnerBanner = document.getElementById('channel-winner-banner');
  const walkinTag = document.getElementById('walkin-leader-tag');
  const onlineTag = document.getElementById('online-leader-tag');

  if (winnerBanner) {
    winnerBanner.className = 'channel-winner-banner';
    if (totalSales === 0) {
      winnerBanner.classList.add('winner-none');
      winnerBanner.innerHTML = `
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #64748b; flex-shrink: 0;">
          <i class="fa-solid fa-circle-info"></i>
        </div>
        <div>
          <strong style="color: #334155; font-size: 14px;">No Sales Recorded For This Period</strong>
          <div style="font-size: 12px; color: #64748b;">There are no completed walk-in transactions or accepted customer orders in this timeframe.</div>
        </div>
      `;
      if (walkinTag) {
        walkinTag.className = 'badge';
        walkinTag.style.background = '#f1f5f9';
        walkinTag.style.color = '#64748b';
        walkinTag.textContent = 'No Sales';
      }
      if (onlineTag) {
        onlineTag.className = 'badge';
        onlineTag.style.background = '#f1f5f9';
        onlineTag.style.color = '#64748b';
        onlineTag.textContent = 'No Sales';
      }
    } else if (walkinSales > onlineSales) {
      winnerBanner.classList.add('winner-walkin');
      winnerBanner.innerHTML = `
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #16a34a; flex-shrink: 0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);">
          <i class="fa-solid fa-trophy"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 700; color: #15803d; margin-bottom: 2px;">
            🏆 Walk-in POS Has More Sales! (+₱${diff.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </div>
          <div style="font-size: 12px; color: #334155; line-height: 1.4;">
            Walk-in POS brought in <strong>₱${walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${walkinShare.toFixed(1)}%)</strong>, leading Customer Online Orders (₱${onlineSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${onlineShare.toFixed(1)}%) by <strong>+₱${diff.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
          </div>
        </div>
      `;
      if (walkinTag) {
        walkinTag.className = 'badge';
        walkinTag.style.background = '#dcfce7';
        walkinTag.style.color = '#15803d';
        walkinTag.innerHTML = '<i class="fa-solid fa-crown" style="margin-right: 4px;"></i>Leading Channel';
      }
      if (onlineTag) {
        onlineTag.className = 'badge';
        onlineTag.style.background = '#f1f5f9';
        onlineTag.style.color = '#64748b';
        onlineTag.textContent = 'Trailing Channel';
      }
    } else if (onlineSales > walkinSales) {
      winnerBanner.classList.add('winner-online');
      winnerBanner.innerHTML = `
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #e0f2fe; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #0284c7; flex-shrink: 0; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.2);">
          <i class="fa-solid fa-trophy"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 2px;">
            🏆 Customer Online Orders Has More Sales! (+₱${diff.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </div>
          <div style="font-size: 12px; color: #334155; line-height: 1.4;">
            Customer Online Orders brought in <strong>₱${onlineSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${onlineShare.toFixed(1)}%)</strong>, leading Walk-in POS (₱${walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${walkinShare.toFixed(1)}%) by <strong>+₱${diff.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
          </div>
        </div>
      `;
      if (onlineTag) {
        onlineTag.className = 'badge';
        onlineTag.style.background = '#e0f2fe';
        onlineTag.style.color = '#0369a1';
        onlineTag.innerHTML = '<i class="fa-solid fa-crown" style="margin-right: 4px;"></i>Leading Channel';
      }
      if (walkinTag) {
        walkinTag.className = 'badge';
        walkinTag.style.background = '#f1f5f9';
        walkinTag.style.color = '#64748b';
        walkinTag.textContent = 'Trailing Channel';
      }
    } else {
      winnerBanner.classList.add('winner-tied');
      winnerBanner.innerHTML = `
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #f3e8ff; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #7e22ce; flex-shrink: 0;">
          <i class="fa-solid fa-scale-balanced"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 700; color: #6b21a8; margin-bottom: 2px;">
            ⚖️ Walk-in POS and Customer Online Orders Are Tied!
          </div>
          <div style="font-size: 12px; color: #334155; line-height: 1.4;">
            Both channels produced identical sales of <strong>₱${walkinSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> each (50% / 50% split).
          </div>
        </div>
      `;
      if (walkinTag) {
        walkinTag.className = 'badge';
        walkinTag.style.background = '#f3e8ff';
        walkinTag.style.color = '#7e22ce';
        walkinTag.textContent = 'Tied (50%)';
      }
      if (onlineTag) {
        onlineTag.className = 'badge';
        onlineTag.style.background = '#f3e8ff';
        onlineTag.style.color = '#7e22ce';
        onlineTag.textContent = 'Tied (50%)';
      }
    }
  }

  // 4. Render Chart.js Daily Sales Trend Bar Graph
  renderTrendChart({
    timeframe,
    periodTxns,
    refDate,
    currentYear,
    currentMonth,
    targetDailyDateStr
  });
}

// 6. Render Trend Bar Chart for Timeline/Daily Breakdown
function renderTrendChart(config) {
  const canvas = document.getElementById('channel-trend-chart');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    return;
  }

  if (channelTrendChartInstance) {
    channelTrendChartInstance.destroy();
    channelTrendChartInstance = null;
  }

  const { timeframe, periodTxns, refDate, currentYear, currentMonth } = config;

  let labels = [];
  let walkinVals = [];
  let onlineVals = [];

  if (timeframe === 'weekly') {
    // 7 days ending on refDate
    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      labels.push(dayLabel);

      let wSum = 0;
      let oSum = 0;
      periodTxns.forEach(t => {
        const td = new Date(t.date_created);
        if (td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate()) {
          const amt = parseFloat(t.total || 0);
          if (isWalkInTransaction(t)) wSum += amt;
          else oSum += amt;
        }
      });
      walkinVals.push(wSum);
      onlineVals.push(oSum);
    }
  } else if (timeframe === 'yearly') {
    // 12 Months
    const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    labels = [...monthShorts];
    for (let m = 0; m < 12; m++) {
      let wSum = 0;
      let oSum = 0;
      periodTxns.forEach(t => {
        const td = new Date(t.date_created);
        if (td.getFullYear() === currentYear && td.getMonth() === m) {
          const amt = parseFloat(t.total || 0);
          if (isWalkInTransaction(t)) wSum += amt;
          else oSum += amt;
        }
      });
      walkinVals.push(wSum);
      onlineVals.push(oSum);
    }
  } else if (timeframe === 'daily') {
    // 4 Day Time Slots for the daily timeframe
    labels = ['Night (12am-6am)', 'Morning (6am-12pm)', 'Afternoon (12pm-6pm)', 'Evening (6pm-12am)'];
    walkinVals = [0, 0, 0, 0];
    onlineVals = [0, 0, 0, 0];

    periodTxns.forEach(t => {
      const td = new Date(t.date_created);
      const hour = td.getHours();
      let slotIdx = 1;
      if (hour < 6) slotIdx = 0;
      else if (hour < 12) slotIdx = 1;
      else if (hour < 18) slotIdx = 2;
      else slotIdx = 3;

      const amt = parseFloat(t.total || 0);
      if (isWalkInTransaction(t)) walkinVals[slotIdx] += amt;
      else onlineVals[slotIdx] += amt;
    });
  } else {
    // Default: 'monthly' (Days 1 to lastDayOfMonth)
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
      labels.push(`${dayNum}`);
      let wSum = 0;
      let oSum = 0;
      periodTxns.forEach(t => {
        const td = new Date(t.date_created);
        if (td.getFullYear() === currentYear && td.getMonth() === currentMonth && td.getDate() === dayNum) {
          const amt = parseFloat(t.total || 0);
          if (isWalkInTransaction(t)) wSum += amt;
          else oSum += amt;
        }
      });
      walkinVals.push(wSum);
      onlineVals.push(oSum);
    }
  }

  channelTrendChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Walk-in POS Sales',
          data: walkinVals,
          backgroundColor: '#10b981',
          borderColor: '#059669',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Customer Online Orders (1000 PHP Blue)',
          data: onlineVals,
          backgroundColor: '#0284c7',
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: { color: '#64748b', font: { size: 11, weight: '600' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            color: '#64748b',
            font: { size: 11, weight: '600' },
            callback: (v) => '₱' + Number(v).toLocaleString()
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#0f172a',
            font: { size: 12, weight: '600' },
            usePointStyle: true,
            pointStyle: 'rectRounded'
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#38bdf8',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(56, 189, 248, 0.45)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              return ` ${ctx.dataset.label}: ₱${Number(ctx.parsed.y).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      }
    }
  });
}

// ==============================================================
// IN-STORE CASHIER POS TERMINAL FOR ADMIN
// ==============================================================

let posCart = [];
let posSelectedCategory = 'All';
let posPaymentMethod = 'Cash';
let posScannerReader = null;
let posGcashReceiptPhoto = null;
let posReceiptCameraStream = null;
let posReceiptSelectedDeviceId = null;

function initAdminPos() {
  const cashier = sessionStorage.getItem('wobs_admin_username') || 'Admin';
  const cashierLabel = document.getElementById('admin-pos-cashier-label');
  if (cashierLabel) cashierLabel.textContent = `Cashier: ${cashier}`;

  if (!productsData || productsData.length === 0) {
    fetchProducts().then(() => {
      renderAdminPosCategoryPills();
      renderAdminPosCatalog();
    });
  } else {
    renderAdminPosCategoryPills();
    renderAdminPosCatalog();
  }
  renderAdminPosTicket();
}

function renderAdminPosCategoryPills() {
  const container = document.getElementById('admin-pos-category-pills');
  if (!container) return;

  const categories = ['All', ...new Set(productsData.map(p => p.category).filter(Boolean))];
  container.innerHTML = categories.map(cat => `
    <button type="button" onclick="setAdminPosCategory('${cat}')" class="pill-btn ${posSelectedCategory === cat ? 'active' : ''}">
      ${cat}
    </button>
  `).join('');
}

function setAdminPosCategory(cat) {
  posSelectedCategory = cat;
  renderAdminPosCategoryPills();
  renderAdminPosCatalog();
}

function renderAdminPosCatalog() {
  const container = document.getElementById('admin-pos-catalog');
  const searchInput = document.getElementById('admin-pos-search');
  if (!container) return;

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = productsData.filter(p => {
    const matchesCat = (posSelectedCategory === 'All' || p.category === posSelectedCategory);
    const matchesSearch = (!search || p.name.toLowerCase().includes(search) || (p.barcode && String(p.barcode).toLowerCase().includes(search)));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align:center; padding:30px;">No matching products found in catalog.</p>';
    return;
  }

  container.innerHTML = filtered.map(p => {
    const stock = parseInt(p.stock, 10) || 0;
    const isOutOfStock = stock <= 0;
    const isExpired = p.expiry && (new Date(p.expiry) < new Date().setHours(0,0,0,0));
    const canAdd = !isOutOfStock && !isExpired;

    let imgSrc = 'https://via.placeholder.com/150';
    if (p.image && typeof p.image === 'string' && p.image.trim() !== '') {
      imgSrc = p.image.startsWith('data:image') ? p.image : `data:image/jpeg;base64,${p.image}`;
    } else if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim() !== '') {
      imgSrc = p.image_url;
    }

    return `
      <div class="product-card ${isExpired ? 'expired' : ''}" style="cursor: ${canAdd ? 'pointer' : 'not-allowed'};" onclick="${canAdd ? `addToAdminPosCart('${p.id}')` : ''}">
        <div style="width:100%; height:120px; background-color:#f1f5f9; border-radius:6px; overflow:hidden; margin-bottom:8px; display:flex; align-items:center; justify-content:center;">
          <img src="${imgSrc}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://via.placeholder.com/150';">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="card-tag">${p.category}</span>
            <span class="card-barcode" style="font-size:10px;">${p.barcode}</span>
          </div>
          <h4 class="card-title" style="margin:4px 0; font-size:13px; font-weight:700;">${p.name}</h4>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
            <span style="color:${isOutOfStock ? '#ef4444' : '#16a34a'}; font-weight:600;">
              ${isOutOfStock ? 'OUT OF STOCK' : `Stock: ${stock}`}
            </span>
            ${isExpired ? '<span style="color:#ef4444; font-weight:bold;">EXPIRED</span>' : (p.expiry ? `<span style="color:#64748b;">Exp: ${p.expiry.split('T')[0]}</span>` : '<span style="color:#94a3b8;">No Expiry</span>')}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:6px; border-top:1px dashed #e2e8f0; min-height:28px;">
          <span class="card-price" style="font-size:14px; color:#0f172a;">₱${parseFloat(p.price).toFixed(2)}</span>
          ${!isExpired ? `
            <button type="button" class="btn btn-primary btn-sm" ${!canAdd ? 'disabled' : ''} onclick="event.stopPropagation(); addToAdminPosCart('${p.id}')" style="padding:4px 10px; font-size:11px;">
              <i class="fa-solid fa-plus"></i> Add
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function addToAdminPosCart(productId) {
  const prod = productsData.find(p => String(p.id) === String(productId));
  if (!prod) return;

  const stock = parseInt(prod.stock, 10) || 0;
  if (stock <= 0) {
    showAdminPosFeedback(`❌ Cannot add "${prod.name}": Out of stock!`, 'danger');
    return;
  }

  const isExpired = prod.expiry && (new Date(prod.expiry) < new Date().setHours(0,0,0,0));
  if (isExpired) {
    showAdminPosFeedback(`❌ Cannot add "${prod.name}": Item is expired!`, 'danger');
    return;
  }

  const existing = posCart.find(c => String(c.id) === String(productId));
  if (existing) {
    if (existing.qty < stock) {
      existing.qty++;
      showAdminPosFeedback(`✅ Added another "${prod.name}" (Qty: ${existing.qty})`, 'primary');
    } else {
      showAdminPosFeedback(`⚠️ Maximum available stock reached for "${prod.name}" (${stock})`, 'danger');
      return;
    }
  } else {
    posCart.push({
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      price: parseFloat(prod.price),
      cost: parseFloat(prod.cost || 0),
      qty: 1,
      maxStock: stock
    });
    showAdminPosFeedback(`✅ Added "${prod.name}" to register ticket`, 'primary');
  }

  if (typeof playBeepSound === 'function') {
    playBeepSound();
  }

  renderAdminPosTicket();
}

function updateAdminPosQty(productId, delta) {
  const item = posCart.find(c => String(c.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    posCart = posCart.filter(c => String(c.id) !== String(productId));
  } else if (item.qty > item.maxStock) {
    item.qty = item.maxStock;
    showAdminPosFeedback(`⚠️ Maximum available stock for "${item.name}" is ${item.maxStock}`, 'danger');
  }

  renderAdminPosTicket();
}

function removeAdminPosItem(productId) {
  posCart = posCart.filter(c => String(c.id) !== String(productId));
  renderAdminPosTicket();
}

function clearAdminPosCart() {
  if (posCart.length === 0) return;
  posCart = [];
  const tenderedInput = document.getElementById('admin-pos-cash-tendered');
  if (tenderedInput) tenderedInput.value = '';
  removeGcashReceiptPhoto();
  renderAdminPosTicket();
  showAdminPosFeedback('Register ticket cleared.', 'primary');
}

function renderAdminPosTicket() {
  const itemsContainer = document.getElementById('admin-pos-cart-items');
  const countEl = document.getElementById('admin-pos-items-count');
  const subtotalEl = document.getElementById('admin-pos-subtotal');
  const grandTotalEl = document.getElementById('admin-pos-grand-total');

  if (!itemsContainer) return;

  const totalItems = posCart.reduce((sum, item) => sum + item.qty, 0);
  const grandTotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (countEl) countEl.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
  if (subtotalEl) subtotalEl.textContent = `₱${grandTotal.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.textContent = `₱${grandTotal.toFixed(2)}`;

  if (posCart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:#94a3b8;">
        <i class="fa-solid fa-basket-shopping" style="font-size:28px; margin-bottom:8px;"></i>
        <p style="margin:0; font-size:13px;">Register ticket is empty.<br>Scan barcode or click items to add.</p>
      </div>
    `;
    calculateAdminPosChange();
    return;
  }

  itemsContainer.innerHTML = posCart.map(item => `
    <div class="cart-item-row" style="padding:8px 0; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
      <div style="flex:1; padding-right:8px;">
        <strong style="font-size:13px; color:#0f172a; display:block;">${item.name}</strong>
        <small style="color:#64748b; font-family:monospace; font-size:11px;">
          ${item.barcode} | ₱${item.price.toFixed(2)} ea
        </small>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <button type="button" onclick="updateAdminPosQty('${item.id}', -1)" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-weight:bold;">-</button>
        <span style="font-size:13px; font-weight:bold; min-width:20px; text-align:center;">${item.qty}</span>
        <button type="button" onclick="updateAdminPosQty('${item.id}', 1)" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-weight:bold;">+</button>
        <strong style="font-size:13px; color:#0f172a; min-width:65px; text-align:right;">₱${(item.price * item.qty).toFixed(2)}</strong>
        <button type="button" onclick="removeAdminPosItem('${item.id}')" class="btn-link text-danger" style="margin-left:4px; font-size:13px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `).join('');

  calculateAdminPosChange();
}

function setAdminPosPaymentMethod(method) {
  posPaymentMethod = method;
  const btnCash = document.getElementById('pos-pay-method-cash');
  const btnGCash = document.getElementById('pos-pay-method-gcash');
  const cashDetails = document.getElementById('admin-pos-cash-details');
  const gcashDetails = document.getElementById('admin-pos-gcash-details');
  const btnCheckout = document.getElementById('btn-admin-pos-checkout');

  if (method === 'Cash') {
    if (btnCash) btnCash.className = 'btn btn-primary';
    if (btnGCash) btnGCash.className = 'btn btn-secondary';
    if (cashDetails) cashDetails.classList.remove('hidden');
    if (gcashDetails) gcashDetails.classList.add('hidden');
    if (btnCheckout) btnCheckout.innerHTML = '<i class="fa-solid fa-cash-register" style="margin-right: 6px;"></i> Complete Cash Sale &amp; Print Receipt';
  } else {
    if (btnCash) btnCash.className = 'btn btn-secondary';
    if (btnGCash) btnGCash.className = 'btn btn-primary';
    if (cashDetails) cashDetails.classList.add('hidden');
    if (gcashDetails) gcashDetails.classList.remove('hidden');
    if (btnCheckout) btnCheckout.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Complete GCash Sale &amp; Print Receipt';
  }

  calculateAdminPosChange();
}

function addAdminPosCash(amount) {
  const input = document.getElementById('admin-pos-cash-tendered');
  if (!input) return;
  const current = parseFloat(input.value) || 0;
  input.value = (current + amount).toFixed(2);
  calculateAdminPosChange();
}

function setAdminPosExactAmount() {
  const input = document.getElementById('admin-pos-cash-tendered');
  if (!input) return;
  const grandTotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  input.value = grandTotal.toFixed(2);
  calculateAdminPosChange();
}

function calculateAdminPosChange() {
  const grandTotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const checkoutBtn = document.getElementById('btn-admin-pos-checkout');
  const changeEl = document.getElementById('admin-pos-change');
  const input = document.getElementById('admin-pos-cash-tendered');

  if (posCart.length === 0) {
    if (changeEl) {
      changeEl.textContent = '₱0.00';
      changeEl.style.color = '#16a34a';
    }
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (posPaymentMethod === 'GCash') {
    if (changeEl) changeEl.textContent = '₱0.00 (GCash)';
    if (checkoutBtn) checkoutBtn.disabled = false;
    return;
  }

  const tendered = parseFloat(input ? input.value : 0) || 0;
  const diff = tendered - grandTotal;

  if (tendered === 0) {
    if (changeEl) {
      changeEl.textContent = '₱0.00';
      changeEl.style.color = '#64748b';
    }
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else if (diff < 0) {
    if (changeEl) {
      changeEl.textContent = `Insufficient (Needs ₱${Math.abs(diff).toFixed(2)})`;
      changeEl.style.color = '#ef4444';
    }
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else {
    if (changeEl) {
      changeEl.textContent = `₱${diff.toFixed(2)}`;
      changeEl.style.color = '#16a34a';
    }
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
}

function handleAdminPosBarcodeKeypress(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAdminPosBarcodeManualAdd();
  }
}

function handleAdminPosBarcodeManualAdd() {
  const input = document.getElementById('admin-pos-barcode-input');
  if (!input) return;
  const code = input.value.trim();
  if (!code) return;
  processAdminPosBarcode(code);
  input.value = '';
}

function processAdminPosBarcode(code) {
  const cleanCode = String(code).trim();
  const prod = productsData.find(p => p.barcode && String(p.barcode).trim() === cleanCode);

  if (prod) {
    addToAdminPosCart(prod.id);
  } else {
    showAdminPosFeedback(`❌ Barcode "${cleanCode}" not found in inventory!`, 'danger');
  }
}

function showAdminPosFeedback(msg, type) {
  const el = document.getElementById('admin-pos-scan-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'danger' ? 'scan-msg text-danger' : 'scan-msg text-primary';
  el.classList.remove('hidden');
  setTimeout(() => {
    if (el) el.classList.add('hidden');
  }, 4000);
}

// POS Camera Barcode Scanner
async function openPosCameraScanner() {
  const modal = document.getElementById('modal-pos-camera-scanner');
  const video = document.getElementById('pos-scanner-video');
  const msg = document.getElementById('pos-camera-scanner-msg');

  if (modal) modal.classList.remove('hidden');
  if (msg) msg.textContent = 'Initializing camera barcode scanner...';

  try {
    if (!posScannerReader && window.ZXing) {
      posScannerReader = new ZXing.BrowserMultiFormatReader();
    }

    if (posScannerReader && video) {
      posScannerReader.decodeFromVideoDevice(null, video, (result, err) => {
        if (result && result.text) {
          if (typeof playBeepSound === 'function') playBeepSound();
          processAdminPosBarcode(result.text);
          closePosCameraScanner();
        }
      });
      if (msg) msg.textContent = 'Point camera at product barcode';
    }
  } catch (err) {
    if (msg) msg.textContent = '❌ Camera access error: ' + err.message;
  }
}

function closePosCameraScanner() {
  const modal = document.getElementById('modal-pos-camera-scanner');
  if (modal) modal.classList.add('hidden');

  if (posScannerReader) {
    posScannerReader.reset();
  }
}

// ==================== WALK-IN GCASH RECEIPT CAMERA ====================
async function openGcashReceiptCamera() {
  const modal = document.getElementById('modal-gcash-receipt-camera');
  const video = document.getElementById('pos-receipt-video');
  const msg = document.getElementById('pos-receipt-camera-msg');
  const select = document.getElementById('pos-receipt-camera-select');

  if (modal) modal.classList.remove('hidden');
  if (msg) msg.textContent = 'Starting camera preview...';

  // Stop any lingering camera stream first
  closeGcashReceiptCameraStream();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (msg) msg.textContent = '❌ Camera not supported on this browser or connection.';
    return;
  }

  try {
    // Enumerate available cameras if supported
    if (select && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        select.innerHTML = '<option value="">Default Camera</option>' + 
          videoDevices.map((d, idx) => `
            <option value="${d.deviceId}" ${posReceiptSelectedDeviceId === d.deviceId ? 'selected' : ''}>
              ${d.label || `Camera ${idx + 1}`}
            </option>
          `).join('');
      } catch (devErr) {
        console.warn("Could not enumerate camera devices:", devErr);
      }
    }

    const constraints = {
      video: posReceiptSelectedDeviceId
        ? { deviceId: { exact: posReceiptSelectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    posReceiptCameraStream = stream;

    if (video) {
      video.srcObject = stream;
      await video.play();
      if (msg) msg.textContent = 'Hold receipt in frame and click "Capture Photo"';
    }
  } catch (err) {
    console.warn("Rear camera constraint failed, attempting general camera:", err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
      posReceiptCameraStream = fallbackStream;
      if (video) {
        video.srcObject = fallbackStream;
        await video.play();
        if (msg) msg.textContent = 'Hold receipt in frame and click "Capture Photo"';
      }
    } catch (fbErr) {
      if (msg) msg.textContent = '❌ Unable to access camera: ' + fbErr.message;
    }
  }
}

function changeReceiptCameraDevice(deviceId) {
  posReceiptSelectedDeviceId = deviceId || null;
  openGcashReceiptCamera();
}

function captureGcashReceiptPhoto() {
  const video = document.getElementById('pos-receipt-video');
  const canvas = document.getElementById('pos-receipt-canvas');
  const previewImg = document.getElementById('pos-gcash-receipt-img');
  const previewBox = document.getElementById('pos-gcash-preview-box');
  const badge = document.getElementById('pos-gcash-receipt-status-badge');

  if (!video || !canvas) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;

  if (w === 0 || h === 0) {
    alert("Camera is warming up. Please wait 1 second and try again.");
    return;
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);

  // Compress snapshot as JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  posGcashReceiptPhoto = dataUrl;

  // Display preview & attached badge
  if (previewImg) previewImg.src = dataUrl;
  if (previewBox) previewBox.classList.remove('hidden');
  if (badge) {
    badge.textContent = '✅ Photo Attached';
    badge.style.color = '#15803d';
    badge.style.background = '#dcfce7';
  }

  if (typeof playBeepSound === 'function') {
    playBeepSound();
  }

  closeGcashReceiptCamera();
}

function closeGcashReceiptCamera() {
  const modal = document.getElementById('modal-gcash-receipt-camera');
  if (modal) modal.classList.add('hidden');
  closeGcashReceiptCameraStream();
}

function closeGcashReceiptCameraStream() {
  if (posReceiptCameraStream) {
    posReceiptCameraStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    posReceiptCameraStream = null;
  }
  const video = document.getElementById('pos-receipt-video');
  if (video) {
    video.srcObject = null;
  }
}

function handleGcashReceiptFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    posGcashReceiptPhoto = dataUrl;

    const previewImg = document.getElementById('pos-gcash-receipt-img');
    const previewBox = document.getElementById('pos-gcash-preview-box');
    const badge = document.getElementById('pos-gcash-receipt-status-badge');

    if (previewImg) previewImg.src = dataUrl;
    if (previewBox) previewBox.classList.remove('hidden');
    if (badge) {
      badge.textContent = '✅ Photo Attached';
      badge.style.color = '#15803d';
      badge.style.background = '#dcfce7';
    }
  };
  reader.readAsDataURL(file);
}

function removeGcashReceiptPhoto() {
  posGcashReceiptPhoto = null;
  const previewBox = document.getElementById('pos-gcash-preview-box');
  const previewImg = document.getElementById('pos-gcash-receipt-img');
  const badge = document.getElementById('pos-gcash-receipt-status-badge');
  const fileInput = document.getElementById('pos-gcash-file-input');

  if (previewBox) previewBox.classList.add('hidden');
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (badge) {
    badge.textContent = 'No Receipt Photo';
    badge.style.color = '#64748b';
    badge.style.background = '#e2e8f0';
  }
}

// POS Atomic Sale Checkout
async function processAdminPosCheckout() {
  if (posCart.length === 0) {
    alert("Register ticket is empty.");
    return;
  }

  const grandTotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tenderedInput = document.getElementById('admin-pos-cash-tendered');
  const customerNameInput = document.getElementById('admin-pos-customer-name');
  const tendered = parseFloat(tenderedInput ? tenderedInput.value : 0) || 0;
  const customerName = (customerNameInput && customerNameInput.value.trim()) ? customerNameInput.value.trim() : 'Walk-in Customer';

  if (posPaymentMethod === 'Cash' && tendered < grandTotal) {
    alert(`Insufficient amount tendered. Total is ₱${grandTotal.toFixed(2)}, but received ₱${tendered.toFixed(2)}.`);
    return;
  }

  const changeGiven = posPaymentMethod === 'Cash' ? (tendered - grandTotal) : 0;
  const txnId = 'WOBS-' + Math.floor(100000 + Math.random() * 900000);
  const cashierUsername = sessionStorage.getItem('wobs_admin_username') || 'Admin';

  const checkoutPayload = {
    id: txnId,
    TransactionID: txnId,
    customerId: null,
    customerUsername: null,
    customerName: customerName,
    address: 'In-Store Walk-in POS',
    items: posCart,
    total: grandTotal,
    gcashRef: posPaymentMethod === 'GCash' ? (posGcashReceiptPhoto ? 'RECEIPT_PHOTO_ATTACHED' : 'WALK_IN_GCASH') : 'CASH_SALE',
    paymentProof: posPaymentMethod === 'GCash' ? posGcashReceiptPhoto : null,
    paymentMethod: posPaymentMethod,
    status: 'Completed'
  };

  try {
    const res = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to complete sale');
    }

    // Display Printable Receipt
    openAdminReceiptModal({
      id: txnId,
      date: new Date().toLocaleString(),
      cashier: cashierUsername,
      customerName: customerName,
      items: [...posCart],
      total: grandTotal,
      tendered: tendered,
      change: changeGiven,
      paymentMethod: posPaymentMethod
    });

    // Reset register & clear captured receipt photo
    posCart = [];
    if (tenderedInput) tenderedInput.value = '';
    if (customerNameInput) customerNameInput.value = '';
    removeGcashReceiptPhoto();
    renderAdminPosTicket();

    // Re-sync inventory and analytics
    fetchProducts();
    if (typeof fetchTransactions === 'function') fetchTransactions();
  } catch (err) {
    alert("❌ Error processing in-store checkout: " + err.message);
  }
}

function openAdminReceiptModal(data) {
  document.getElementById('admin-receipt-id').textContent = '#' + data.id;
  document.getElementById('admin-receipt-date').textContent = data.date;
  document.getElementById('admin-receipt-cashier').textContent = data.cashier;
  document.getElementById('admin-receipt-customer').textContent = data.customerName;
  document.getElementById('admin-receipt-payment-method').textContent = data.paymentMethod;
  document.getElementById('admin-receipt-subtotal').textContent = '₱' + data.total.toFixed(2);
  document.getElementById('admin-receipt-grand-total').textContent = '₱' + data.total.toFixed(2);

  const tenderedRow = document.getElementById('admin-receipt-tendered-row');
  const changeRow = document.getElementById('admin-receipt-change-row');

  if (data.paymentMethod === 'Cash') {
    if (tenderedRow) {
      tenderedRow.style.display = 'flex';
      document.getElementById('admin-receipt-tendered').textContent = '₱' + data.tendered.toFixed(2);
    }
    if (changeRow) {
      changeRow.style.display = 'flex';
      document.getElementById('admin-receipt-change').textContent = '₱' + data.change.toFixed(2);
    }
  } else {
    if (tenderedRow) tenderedRow.style.display = 'none';
    if (changeRow) changeRow.style.display = 'none';
  }

  const itemsList = document.getElementById('admin-receipt-items-list');
  if (itemsList) {
    itemsList.innerHTML = data.items.map(item => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>${item.name} &times; ${item.qty}</span>
        <strong>₱${(item.price * item.qty).toFixed(2)}</strong>
      </div>
    `).join('');
  }

  const modal = document.getElementById('modal-admin-receipt');
  if (modal) modal.classList.remove('hidden');
}

function closeAdminReceiptModal() {
  const modal = document.getElementById('modal-admin-receipt');
  if (modal) modal.classList.add('hidden');
}

function handleAdminLogout() {

  if (confirm("Are you sure you want to logout from Admin Access?")) {
    
    sessionStorage.removeItem('wobs_admin_authenticated');
   
    sessionStorage.removeItem('wobs_admin_username');
        
    // Redirect to Welcome landing page
    window.location.href = "Welcomepage.html";
  
  }
}

window.onload = function() {
  checkAdminAccess();
  fetchProducts();
  fetchPendingAdmins();
  if (typeof checkScannedBarcodeReturn === 'function') {
    checkScannedBarcodeReturn();
  }
};