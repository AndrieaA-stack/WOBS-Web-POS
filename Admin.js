const API_URL = "http://localhost:5000/api";
let productsData = [];
let transactionsData = [];

// Admin Authentication Guard
const ADMIN_PASSWORD = "GABRIEL";
function checkAdminAccess() {
  const inputPass = prompt(" Restricted Area: Enter Admin Password to access:");
  if (inputPass !== ADMIN_PASSWORD) {
    alert("❌ Incorrect Password! Redirecting to store...");
    window.location.href = "Customer.html";
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

  btnProducts.className = tabName === 'products' ? "btn btn-primary" : "btn btn-secondary";
  btnTxns.className = tabName === 'txns' ? "btn btn-primary" : "btn btn-secondary";
  btnAnalytics.className = tabName === 'analytics' ? "btn btn-primary" : "btn btn-secondary";

  secProducts.classList.toggle('hidden', tabName !== 'products');
  secTxns.classList.toggle('hidden', tabName !== 'txns');
  secAnalytics.classList.toggle('hidden', tabName !== 'analytics');

  if (tabName === 'products') fetchProducts();
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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = productsData.map(p => {
    const expiryStr = p.expiry ? p.expiry.split('T')[0] : 'N/A';
    return `
      <tr style="border-bottom: 1px solid #334155;">
        <td><small>${p.id}</small></td>
        <td><code>${p.barcode}</code></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="card-tag">${p.category}</span></td>
        <td>₱${parseFloat(p.cost).toFixed(2)}</td>
        <td><strong>₱${parseFloat(p.price).toFixed(2)}</strong></td>
        <td><span style="color: ${p.stock < 10 ? '#f87171' : '#4ade80'}">${p.stock}</span></td>
        <td><small>${expiryStr}</small></td>
        <td style="text-align:right;">
          <button onclick="editProduct('${p.id}')" class="btn btn-secondary btn-sm">Edit</button>
          <button onclick="deleteProduct('${p.id}')" class="btn btn-danger btn-sm">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openProductModal() {
  document.getElementById('modal-product-title').textContent = "Add New Product";
  document.getElementById('prod-id').value = "p_" + Date.now();
  document.getElementById('prod-barcode').value = "";
  document.getElementById('prod-name').value = "";
  document.getElementById('prod-category').value = "";
  document.getElementById('prod-cost').value = "";
  document.getElementById('prod-price').value = "";
  document.getElementById('prod-stock').value = "";
  document.getElementById('prod-expiry').value = "";
  document.getElementById('modal-product').classList.remove('hidden');
}

function editProduct(id) {
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
  document.getElementById('modal-product').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('modal-product').classList.add('hidden');
}

async function saveProduct() {
  const productPayload = {
    id: document.getElementById('prod-id').value,
    barcode: document.getElementById('prod-barcode').value.trim(),
    name: document.getElementById('prod-name').value.trim(),
    category: document.getElementById('prod-category').value.trim(),
    cost: parseFloat(document.getElementById('prod-cost').value),
    price: parseFloat(document.getElementById('prod-price').value),
    stock: parseInt(document.getElementById('prod-stock').value),
    expiry: document.getElementById('prod-expiry').value
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
    transactionsData = await res.json();
    renderTransactionsTable();
  } catch (err) {
    console.error("Error fetching transactions:", err);
  }
}

function renderTransactionsTable() {
  const tbody = document.getElementById('admin-txns-list');
  if (!tbody) return;

  if (transactionsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No transactions recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = transactionsData.map(txn => {
    const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items;
    const itemListStr = items.map(i => `${i.name} (x${i.qty})`).join(', ');
    const formattedDate = new Date(txn.date_created).toLocaleString();
    const hasProof = txn.payment_proof && txn.payment_proof.startsWith('data:image');
    const custName = txn.customer_name || 'Guest Customer';

    return `
      <tr style="border-bottom: 1px solid #334155;">
        <td><strong>#${txn.id}</strong></td>
        <td><small>${formattedDate}</small></td>
        <td><strong>${custName}</strong></td>
        <td><small>${txn.address}</small></td>
        <td><strong>₱${parseFloat(txn.total).toFixed(2)}</strong></td>
        <td>
          ${hasProof 
            ? `<button onclick="viewProofImage('${txn.id}')" class="btn btn-primary btn-sm"> View Screenshot</button>` 
            : `<span class="text-muted">No Image</span>`
          }
        </td>
        <td><small>${itemListStr}</small></td>
      </tr>
    `;
  }).join('');
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

// Analytics Renderer
async function renderAnalytics() {
  await fetchProducts();
  await fetchTransactions();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthlyTotal = 0;
  const productSalesCount = {};

  productsData.forEach(p => {
    productSalesCount[p.name] = 0;
  });

  transactionsData.forEach(txn => {
    const txnDate = new Date(txn.date_created);
    
    if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
      monthlyTotal += parseFloat(txn.total);
    }

    const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items;
    items.forEach(i => {
      productSalesCount[i.name] = (productSalesCount[i.name] || 0) + i.qty;
    });
  });

  document.getElementById('monthly-sales-amount').textContent = '₱' + monthlyTotal.toFixed(2);

  const sortedProducts = Object.keys(productSalesCount).map(name => ({
    name: name,
    qty: productSalesCount[name]
  })).sort((a, b) => b.qty - a.qty);

  // Top 5 Best Sellers
  const bestSellers = sortedProducts.slice(0, 5);
  document.getElementById('best-selling-list').innerHTML = bestSellers.map(p => `
    <tr style="border-bottom: 1px solid #334155;">
      <td><strong>${p.name}</strong></td>
      <td style="text-align:right; color:#4ade80;"><strong>${p.qty} sold</strong></td>
    </tr>
  `).join('') || '<tr><td colspan="2">No sales recorded</td></tr>';

  // Top 5 Least Sellers
  const leastSellers = [...sortedProducts].reverse().slice(0, 5);
  document.getElementById('least-selling-list').innerHTML = leastSellers.map(p => `
    <tr style="border-bottom: 1px solid #334155;">
      <td><strong>${p.name}</strong></td>
      <td style="text-align:right; color:#f87171;"><strong>${p.qty} sold</strong></td>
    </tr>
  `).join('') || '<tr><td colspan="2">No sales recorded</td></tr>';
}

window.onload = function() {
  checkAdminAccess();
  fetchProducts();
};