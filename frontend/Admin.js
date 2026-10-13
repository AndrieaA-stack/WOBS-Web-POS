// Replace with your exact Render Web Service URL
const RENDER_BACKEND_URL = "https://wobs-web-pos.onrender.com"; 

const API_URL = (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" || 
  window.location.protocol === "file:"
) 
  ? "http://localhost:5000/api" 
  : `${RENDER_BACKEND_URL}/api`;

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
  const btnProducts = document.getElementById('tab-btn-products');
  const btnTxns = document.getElementById('tab-btn-txns');
  const btnAnalytics = document.getElementById('tab-btn-analytics');

  const secProducts = document.getElementById('section-products');
  const secTxns = document.getElementById('section-txns');
  const secAnalytics = document.getElementById('section-analytics');

  if (btnProducts) btnProducts.className = tabName === 'products' ? "btn btn-primary" : "btn btn-secondary";
  if (btnTxns) btnTxns.className = tabName === 'txns' ? "btn btn-primary" : "btn btn-secondary";
  if (btnAnalytics) btnAnalytics.className = tabName === 'analytics' ? "btn btn-primary" : "btn btn-secondary";

  if (secProducts) secProducts.classList.toggle('hidden', tabName !== 'products');
  if (secTxns) secTxns.classList.toggle('hidden', tabName !== 'txns');
  if (secAnalytics) secAnalytics.classList.toggle('hidden', tabName !== 'analytics');

  if (tabName === 'products') {
    fetchProducts();
    fetchPendingAdmins();
  }
  if (tabName === 'txns') fetchTransactions();
  if (tabName === 'analytics') renderAnalytics();
}

async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    productsData = await res.json();
    renderProductsTable();
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
    const expiryStr = p.expiry ? p.expiry.split('T')[0] : 'N/A';
    const isExpired = p.expiry && new Date(p.expiry) < new Date();
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
    const expiryBadge = isExpired
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
  document.getElementById('prod-expiry').value = p.expiry ? p.expiry.split('T')[0] : "";

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

  const productPayload = {
    id: document.getElementById('prod-id').value,
    barcode: document.getElementById('prod-barcode').value.trim(),
    name: document.getElementById('prod-name').value.trim(),
    category: document.getElementById('prod-category').value.trim(),
    cost: parseFloat(document.getElementById('prod-cost').value) || 0,
    price: parseFloat(document.getElementById('prod-price').value) || 0,
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    expiry: document.getElementById('prod-expiry').value,
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
    const res = await fetch(`${API_URL}/transactions`);
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

// 1. Render Transactions Table with Accept & Decline Action Buttons
function renderTransactionsTable() {
  const tbody = document.getElementById('admin-txns-list');
  if (!tbody) return;

  if (transactionsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#64748b;">No transactions recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = transactionsData.map(txn => {
    const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items;
    const itemListStr = items.map(i => `${i.name} (x${i.qty})`).join(', ');
    const formattedDate = new Date(txn.date_created).toLocaleString();
    const hasProof = txn.payment_proof && txn.payment_proof.startsWith('data:image');
    const custName = txn.customer_name || 'Guest Customer';
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
        <td><small style="color: #334155;">${txn.address}</small></td>
        <td style="text-align: right; white-space: nowrap;"><strong style="color: #16a34a; font-size: 14px;">₱${parseFloat(txn.total).toFixed(2)}</strong></td>
        <td style="text-align: center; white-space: nowrap;">
          ${hasProof 
            ? `<button onclick="viewProofImage('${txn.id}')" class="btn-proof-view"><i class="fa-solid fa-image"></i> View Screenshot</button>` 
            : `<span style="color: #94a3b8; font-size: 12px;">No Image</span>`
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
  const txn = transactionsData.find(t => t.id === txnId);
  if (txn && txn.payment_proof) {
    document.getElementById('proof-preview-img').src = txn.payment_proof;
    document.getElementById('modal-proof-preview').classList.remove('hidden');
  } else {
    alert("No payment screenshot available.");
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

// Timeframe Switcher & State
let selectedAnalyticsTimeframe = 'monthly';

function changeAnalyticsTimeframe(timeframe) {
  selectedAnalyticsTimeframe = timeframe;

  // Sync dropdown
  const selectEl = document.getElementById('sales-timeframe-select');
  if (selectEl && selectEl.value !== timeframe) {
    selectEl.value = timeframe;
  }

  // Sync button pills
  document.querySelectorAll('.analytics-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
  });

  renderAnalytics();
}

// 3. Calculate Sales & Products Sold for Chosen Timeframe (Weekly, Monthly, Yearly)
async function renderAnalytics() {
  await fetchProducts();
  await fetchTransactions();

  // Read current timeframe from select or global variable
  const selectEl = document.getElementById('sales-timeframe-select');
  const timeframe = selectEl ? selectEl.value : selectedAnalyticsTimeframe;
  selectedAnalyticsTimeframe = timeframe;

  // Sync pill buttons
  document.querySelectorAll('.analytics-pill-btn').forEach(btn => {
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

  productsData.forEach(p => {
    productSalesCount[p.name] = 0;
  });

  // Valid statuses that count as actual sales revenue
  const VALID_SALES_STATUSES = ['ACCEPTED', 'PREPARING ORDER', 'OUT FOR DELIVERY', 'DELIVERED', 'COMPLETED'];

  transactionsData.forEach(txn => {
    const txnDate = txn.date_created ? new Date(txn.date_created) : null;
    const statusUpper = String(txn.status || 'Pending').trim().toUpperCase();

    // Accumulate sales and items exclusively for fulfilled/accepted orders in chosen period
    if (VALID_SALES_STATUSES.includes(statusUpper) && txnDate && !isNaN(txnDate.getTime())) {
      if (filterFn(txnDate)) {
        totalSales += parseFloat(txn.total || 0);
        orderCount++;

        let items = [];
        try {
          items = typeof txn.items === 'string' ? JSON.parse(txn.items) : (txn.items || []);
        } catch (e) {
          console.warn("Error parsing items for transaction:", txn.id, e);
        }

        items.forEach(i => {
          const qty = parseInt(i.qty || 1, 10);
          productSalesCount[i.name] = (productSalesCount[i.name] || 0) + qty;
          totalUnits += qty;
        });
      }
    }
  });

  // Display Total Revenue
  const salesEl = document.getElementById('monthly-sales-amount');
  if (salesEl) {
    salesEl.textContent = '₱' + totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Display Orders Count
  const ordersEl = document.getElementById('analytics-orders-count');
  if (ordersEl) {
    ordersEl.textContent = orderCount;
  }

  // Display Units Count
  const unitsEl = document.getElementById('analytics-units-count');
  if (unitsEl) {
    unitsEl.textContent = `${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`;
  }

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
      bestSellersList.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:16px; color:#94a3b8;">No sales recorded for this timeframe</td></tr>';
    } else {
      bestSellersList.innerHTML = productsWithSales.slice(0, 5).map((p, idx) => `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 12px 14px;">
            <span style="display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; background:#0f172a; color:#4ade80; font-size:11px; font-weight:bold; margin-right:8px;">#${idx + 1}</span>
            <strong>${p.name}</strong>
          </td>
          <td style="text-align:right; padding: 12px 14px; color:#4ade80;"><strong>${p.qty} sold</strong></td>
        </tr>
      `).join('');
    }
  }

  // Top 5 Least Sellers
  const leastSellersList = document.getElementById('least-selling-list');
  if (leastSellersList) {
    if (sortedProducts.length === 0) {
      leastSellersList.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:16px; color:#94a3b8;">No products found</td></tr>';
    } else {
      const leastProducts = [...sortedProducts].reverse().slice(0, 5);
      leastSellersList.innerHTML = leastProducts.map((p, idx) => `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 12px 14px;">
            <span style="display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; background:#0f172a; color:#f87171; font-size:11px; font-weight:bold; margin-right:8px;">#${idx + 1}</span>
            <strong>${p.name}</strong>
          </td>
          <td style="text-align:right; padding: 12px 14px; color:#f87171;"><strong>${p.qty} sold</strong></td>
        </tr>
      `).join('');
    }
  }
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