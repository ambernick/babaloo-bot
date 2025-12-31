// Babaloo Bot Twitch Extension - Panel
// This extension connects to the Extension Backend Service (EBS)

// Configuration
// DEV VERSION - Always uses dev server
const EBS_URL = 'https://babaloo-bot-dev-production.up.railway.app';

// Global state
let auth = null;
let userState = {
  linked: false,
  currency: 0,
  premium_currency: 0,
  level: 1,
  username: ''
};
let shopItems = [];
let redemptions = [];
let selectedItem = null;

// Initialize Twitch Extension
window.Twitch.ext.onAuthorized((authData) => {
  auth = authData;
  console.log('Extension authorized:', authData);
  init();
});

// Initialize the extension
async function init() {
  try {
    await loadUserData();
    await loadShopItems();

    if (userState.linked) {
      showScreen('main-app');
      setupTabs();
    } else {
      showScreen('not-linked');
    }
  } catch (error) {
    console.error('Init error:', error);
    showError('Failed to load extension. Please refresh.');
  }
}

// Fetch data from EBS
async function fetchEBS(endpoint, options = {}) {
  const url = `${EBS_URL}/extension${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Load user data
async function loadUserData() {
  try {
    const data = await fetchEBS('/user');

    if (!data.linked) {
      userState.linked = false;
      return;
    }

    userState = {
      linked: true,
      ...data.user
    };

    updateBalanceDisplay();
  } catch (error) {
    console.error('Failed to load user data:', error);
    throw error;
  }
}

// Load shop items
async function loadShopItems() {
  try {
    const data = await fetchEBS('/shop');
    shopItems = data.items || [];
    renderShopItems();
  } catch (error) {
    console.error('Failed to load shop items:', error);
    shopItems = [];
    renderShopItems();
  }
}

// Load redemption history
async function loadRedemptions() {
  if (!userState.linked) return;

  try {
    const data = await fetchEBS('/redemptions?limit=20');
    redemptions = data.redemptions || [];
    renderRedemptions();
  } catch (error) {
    console.error('Failed to load redemptions:', error);
    redemptions = [];
    renderRedemptions();
  }
}

// Update balance display
function updateBalanceDisplay() {
  document.getElementById('currency').textContent = userState.currency.toLocaleString();
  document.getElementById('premium-currency').textContent = userState.premium_currency.toLocaleString();
  document.getElementById('level').textContent = userState.level;
}

// Render shop items
function renderShopItems() {
  const container = document.getElementById('shop-items');
  const noItems = document.getElementById('no-items');

  if (shopItems.length === 0) {
    container.innerHTML = '';
    noItems.classList.remove('hidden');
    return;
  }

  noItems.classList.add('hidden');

  container.innerHTML = shopItems.map(item => {
    const currencySymbol = item.currency_type === 'premium' ? '💎' : '🪙';
    const costClass = item.currency_type === 'premium' ? 'premium' : '';

    let stockText = '';
    if (item.stock !== -1) {
      stockText = `<span class="shop-item-stock ${item.stock < 5 ? 'low' : ''}">
        ${item.stock > 0 ? `${item.stock} left` : 'Out of stock'}
      </span>`;
    }

    const disabled = item.stock === 0 ? 'disabled' : '';

    return `
      <div class="shop-item ${disabled}" data-item-id="${item.id}">
        <div class="shop-item-header">
          <div class="shop-item-name">${escapeHtml(item.name)}</div>
          <div class="shop-item-cost ${costClass}">
            ${currencySymbol} ${item.cost.toLocaleString()}
          </div>
        </div>
        <div class="shop-item-description">${escapeHtml(item.description || '')}</div>
        <div class="shop-item-footer">
          ${stockText}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.shop-item:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      const itemId = parseInt(el.dataset.itemId);
      openRedemptionModal(itemId);
    });
  });
}

// Render redemptions
function renderRedemptions() {
  const container = document.getElementById('redemption-list');
  const noHistory = document.getElementById('no-history');

  if (redemptions.length === 0) {
    container.innerHTML = '';
    noHistory.classList.remove('hidden');
    return;
  }

  noHistory.classList.add('hidden');

  container.innerHTML = redemptions.map(redemption => {
    const date = new Date(redemption.created_at).toLocaleDateString();
    const currencySymbol = redemption.currency_type === 'premium' ? '💎' : '🪙';

    return `
      <div class="redemption-item">
        <div class="redemption-header">
          <div class="redemption-name">${escapeHtml(redemption.item_name || 'Unknown Item')}</div>
          <div class="redemption-status ${redemption.status}">${redemption.status}</div>
        </div>
        <div class="redemption-cost">${currencySymbol} ${redemption.cost.toLocaleString()}</div>
        <div class="redemption-date">${date}</div>
      </div>
    `;
  }).join('');
}

// Open redemption modal
async function openRedemptionModal(itemId) {
  const item = shopItems.find(i => i.id === itemId);
  if (!item) return;

  selectedItem = item;

  // Check if user can redeem
  try {
    const canRedeem = await fetchEBS(`/shop/${itemId}/can-redeem`);

    if (!canRedeem.canRedeem) {
      showToast(canRedeem.reason || 'Cannot redeem this item', true);
      return;
    }
  } catch (error) {
    showToast('Failed to check redemption status', true);
    return;
  }

  const currencySymbol = item.currency_type === 'premium' ? '💎' : '🪙';

  document.getElementById('modal-title').textContent = item.name;
  document.getElementById('modal-description').textContent = item.description || '';
  document.getElementById('modal-cost').textContent = `${currencySymbol} ${item.cost.toLocaleString()}`;

  // Show input if required
  const inputSection = document.getElementById('modal-input-section');
  const inputField = document.getElementById('modal-input');
  const inputLabel = document.getElementById('modal-input-label');

  if (item.requires_input) {
    inputLabel.textContent = item.input_prompt || 'Additional information:';
    inputField.value = '';
    inputSection.classList.remove('hidden');
  } else {
    inputSection.classList.add('hidden');
  }

  document.getElementById('redemption-modal').classList.remove('hidden');
}

// Close redemption modal
function closeRedemptionModal() {
  document.getElementById('redemption-modal').classList.add('hidden');
  selectedItem = null;
}

// Confirm redemption
async function confirmRedemption() {
  if (!selectedItem) return;

  const userInput = selectedItem.requires_input
    ? document.getElementById('modal-input').value.trim()
    : null;

  if (selectedItem.requires_input && !userInput) {
    showToast('Please provide the required information', true);
    return;
  }

  // Show loading
  document.getElementById('modal-loading').classList.remove('hidden');
  document.getElementById('modal-confirm').disabled = true;

  try {
    const result = await fetchEBS(`/shop/${selectedItem.id}/redeem`, {
      method: 'POST',
      body: JSON.stringify({ userInput })
    });

    showToast(result.message || 'Redemption successful!');

    // Refresh data
    await loadUserData();
    await loadShopItems();
    await loadRedemptions();

    closeRedemptionModal();
  } catch (error) {
    console.error('Redemption failed:', error);
    showToast(error.message || 'Redemption failed', true);
  } finally {
    document.getElementById('modal-loading').classList.add('hidden');
    document.getElementById('modal-confirm').disabled = false;
  }
}

// Setup tabs
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      // Update active tab button
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(`${tabName}-tab`).classList.remove('hidden');

      // Load data for history tab
      if (tabName === 'history') {
        loadRedemptions();
      }
    });
  });

  // Setup modal buttons
  document.getElementById('modal-confirm').addEventListener('click', confirmRedemption);
  document.getElementById('modal-cancel').addEventListener('click', closeRedemptionModal);
}

// Show screen
function showScreen(screenId) {
  document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

// Show error
function showError(message) {
  document.getElementById('error-message').textContent = message;
  showScreen('error');
}

// Show toast notification
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}