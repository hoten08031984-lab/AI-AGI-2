// State Management
let allData = window.RAW_DATA || [];
let filteredData = [...allData];

let currentFilters = {
  year: 'ALL',
  category: 'ALL',
  warehouse: 'ALL',
  search: '',
  thang: new Set(),
  tieu_muc: new Set(),
  chi_tiet_hd: new Set()
};

let tableState = {
  page: 1,
  pageSize: 12,
  sortCol: 'thang',
  sortDir: 'asc'
};


// Formatters
const formatVND = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const formatShortVND = (amount) => {
  if (amount >= 1e9) return (amount / 1e9).toFixed(2) + ' Tỷ';
  if (amount >= 1e6) return (amount / 1e6).toFixed(1) + ' Tr';
  if (amount >= 1e3) return (amount / 1e3).toFixed(0) + ' K';
  return amount.toLocaleString('vi-VN') + ' ₫';
};

const formatSoHD = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  let s = String(val).trim();
  if (s.endsWith('.0')) {
    s = s.slice(0, -2);
  } else if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, '');
  }
  return s || '-';
};

const formatDateDDMMYYYY = (val) => {
  if (!val || val === '-' || val === 'None') return '-';
  let s = String(val).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  }

  const mdyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mdyMatch) {
    const p1 = parseInt(mdyMatch[1], 10);
    const p2 = parseInt(mdyMatch[2], 10);
    const yyyy = mdyMatch[3];
    let dd, mm;
    if (p1 > 12) {
      dd = String(p1).padStart(2, '0');
      mm = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      mm = String(p1).padStart(2, '0');
      dd = String(p2).padStart(2, '0');
    } else {
      mm = String(p1).padStart(2, '0');
      dd = String(p2).padStart(2, '0');
    }
    return `${dd}-${mm}-${yyyy}`;
  }

  return s;
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initFilterDropdowns();
  setupEventListeners();
  updateSyncBadge();
  applyFilters();
});

function updateSyncBadge() {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;
  if (window.SYNC_INFO && window.SYNC_INFO.last_updated) {
    badge.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981; margin-right:4px;"></i> Đã đồng bộ lúc: ${window.SYNC_INFO.last_updated}`;
  } else {
    badge.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981; margin-right:4px;"></i> Dữ liệu sẵn sàng`;
  }
}

// Populate Filter Options dynamically
function initFilterDropdowns() {
  const years = setOfValues('nam').sort((a, b) => b - a);
  const selYear = document.getElementById('filter-year');
  selYear.innerHTML = '<option value="ALL">-- Tất Cả Các Năm --</option>';

  years.forEach(y => {
    if (y && y !== 'N/A' && Number(y) > 1900) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Năm ${y}`;
      selYear.appendChild(opt);
    }
  });

  updateDependentDropdowns();
}

function updateDependentDropdowns() {
  const selCat = document.getElementById('filter-category');
  const selWh = document.getElementById('filter-warehouse');

  const currYear = currentFilters.year;
  const currCat = currentFilters.category;
  const currWh = currentFilters.warehouse;

  // 1. Data subset for Category dropdown (filtered by active Year and Search)
  let catData = allData;
  if (currYear !== 'ALL') {
    catData = catData.filter(item => String(item.nam) === String(currYear));
  }
  if (currentFilters.search) {
    const s = currentFilters.search;
    catData = catData.filter(item =>
      (item.loai_cp && item.loai_cp.toLowerCase().includes(s)) ||
      (item.tieu_muc && item.tieu_muc.toLowerCase().includes(s)) ||
      (item.so_hd && item.so_hd.toLowerCase().includes(s)) ||
      (item.ly_do && item.ly_do.toLowerCase().includes(s)) ||
      (item.chi_tiet && item.chi_tiet.toLowerCase().includes(s)) ||
      (item.kho && item.kho.toLowerCase().includes(s)) ||
      (item.nguoi_thu_huong && item.nguoi_thu_huong.toLowerCase().includes(s))
    );
  }

  const validCategories = new Set(catData.map(i => i.loai_cp).filter(Boolean));
  const sortedCategories = Array.from(validCategories).sort();

  selCat.innerHTML = '<option value="ALL">-- Tất Cả Loại CP --</option>';
  sortedCategories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === currCat) opt.selected = true;
    selCat.appendChild(opt);
  });

  if (currCat !== 'ALL' && !validCategories.has(currCat)) {
    currentFilters.category = 'ALL';
    selCat.value = 'ALL';
  }

  // 2. Data subset for Warehouse dropdown (filtered by active Year, Category, and Search)
  let whData = catData;
  if (currentFilters.category !== 'ALL') {
    whData = whData.filter(item => item.loai_cp === currentFilters.category);
  }

  const validWarehouses = new Set(whData.map(i => i.kho).filter(Boolean));
  const sortedWarehouses = Array.from(validWarehouses).sort();

  selWh.innerHTML = '<option value="ALL">-- Tất Cả Kho --</option>';
  sortedWarehouses.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w;
    if (w === currWh) opt.selected = true;
    selWh.appendChild(opt);
  });

  if (currWh !== 'ALL' && !validWarehouses.has(currWh)) {
    currentFilters.warehouse = 'ALL';
    selWh.value = 'ALL';
  }

  // 3. Populate Tháng MultiSelect
  let thangData = whData;
  if (currentFilters.warehouse !== 'ALL') thangData = thangData.filter(i => i.kho === currentFilters.warehouse);
  const validThangs = Array.from(new Set(thangData.map(i => i.thang).filter(Boolean)))
    .sort((a, b) => {
      const parse = s => { const p = s.split('/'); return p.length === 2 ? [+p[1], +p[0]] : [0,0]; };
      const [ya, ma] = parse(a); const [yb, mb] = parse(b);
      return ya !== yb ? ya - yb : ma - mb;
    });
  window._validThangs = validThangs;
  renderMsOptions('thang', validThangs, '-- Tất Cả Tháng --', 'tháng');

  // 4. Populate Tiểu mục CP MultiSelect
  let tieuMucData = thangData;
  if (currentFilters.thang.size > 0) tieuMucData = tieuMucData.filter(i => currentFilters.thang.has(i.thang));
  const validTieuMuc = Array.from(new Set(tieuMucData.map(i => i.tieu_muc).filter(Boolean))).sort();
  window._validTieuMuc = validTieuMuc;
  renderMsOptions('tieu_muc', validTieuMuc, '-- Tất Cả Tiểu Mục --', 'tiểu mục');

  // 5. Populate Chi tiết HĐ MultiSelect
  let chiTietData = tieuMucData;
  if (currentFilters.tieu_muc.size > 0) chiTietData = chiTietData.filter(i => currentFilters.tieu_muc.has(i.tieu_muc));
  const validChiTiet = Array.from(new Set(chiTietData.map(i => (i.chi_tiet_hd || i.chi_tiet || '')).filter(Boolean))).sort();
  window._validChiTiet = validChiTiet;
  renderMsOptions('chi_tiet_hd', validChiTiet, '-- Tất Cả Chi Tiết --', 'chi tiết');
}

// MultiSelect Helper Functions
function toggleMsDropdown(key) {
  const container = document.getElementById(`ms-container-${key}`);
  if (!container) return;
  const isActive = container.classList.contains('active');
  document.querySelectorAll('.ms-container').forEach(c => c.classList.remove('active'));
  if (!isActive) {
    container.classList.add('active');
    const searchInput = document.getElementById(`ms-search-${key}`);
    if (searchInput) {
      searchInput.value = '';
      filterMsOptions(key, '');
      searchInput.focus();
    }
  }
}

function filterMsOptions(key, query) {
  const container = document.getElementById(`ms-options-${key}`);
  if (!container) return;
  const q = query.toLowerCase().trim();
  container.querySelectorAll('.ms-option').forEach(opt => {
    const text = opt.textContent.toLowerCase();
    opt.style.display = text.includes(q) ? 'flex' : 'none';
  });
}

function renderMsOptions(key, validValues, defaultLabel, singularUnit) {
  const optionsDiv = document.getElementById(`ms-options-${key}`);
  if (!optionsDiv) return;

  const currentSet = currentFilters[key];

  // Remove invalid values from currentSet
  const validSet = new Set(validValues);
  for (let val of currentSet) {
    if (!validSet.has(val)) currentSet.delete(val);
  }

  if (validValues.length === 0) {
    optionsDiv.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:0.5rem; text-align:center;">Không có dữ liệu</div>';
  } else {
    optionsDiv.innerHTML = validValues.map(val => {
      const isChecked = currentSet.has(val);
      const displayVal = val.length > 60 ? val.substring(0, 60) + '...' : val;
      return `
        <label class="ms-option">
          <input type="checkbox" data-key="${key}" data-val="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''} onchange="onMsChange('${key}', this)">
          <span class="ms-option-text" title="${val}">${displayVal}</span>
        </label>
      `;
    }).join('');
  }

  updateMsLabel(key, validValues, defaultLabel, singularUnit);
}

function updateMsLabel(key, validValues, defaultLabel, singularUnit) {
  const labelSpan = document.getElementById(`ms-label-${key}`);
  if (!labelSpan) return;

  const currentSet = currentFilters[key];
  const count = currentSet.size;

  if (count === 0 || count === validValues.length) {
    labelSpan.textContent = defaultLabel;
    labelSpan.classList.remove('has-selection');
  } else if (count === 1) {
    labelSpan.textContent = Array.from(currentSet)[0];
    labelSpan.classList.add('has-selection');
  } else if (count === 2) {
    labelSpan.textContent = Array.from(currentSet).join(', ');
    labelSpan.classList.add('has-selection');
  } else {
    labelSpan.textContent = `Đã chọn (${count}) ${singularUnit}`;
    labelSpan.classList.add('has-selection');
  }
}

function onMsChange(key, checkbox) {
  const val = decodeURIComponent(checkbox.getAttribute('data-val'));
  if (checkbox.checked) {
    currentFilters[key].add(val);
  } else {
    currentFilters[key].delete(val);
  }
  applyFilters();
}

function selectAllMs(key, validValues) {
  validValues.forEach(val => currentFilters[key].add(val));
  applyFilters();
}

function clearMs(key) {
  currentFilters[key].clear();
  applyFilters();
}

function setOfValues(key) {
  const set = new Set();
  allData.forEach(item => {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      set.add(item[key]);
    }
  });
  return Array.from(set);
}

// Event Listeners
function setupEventListeners() {
  document.getElementById('filter-year').addEventListener('change', (e) => {
    currentFilters.year = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-category').addEventListener('change', (e) => {
    currentFilters.category = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-warehouse').addEventListener('change', (e) => {
    currentFilters.warehouse = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-search').addEventListener('input', (e) => {
    currentFilters.search = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('filter-year').value = 'ALL';
    document.getElementById('filter-category').value = 'ALL';
    document.getElementById('filter-warehouse').value = 'ALL';
    document.getElementById('filter-search').value = '';
    currentFilters = {
      year: 'ALL',
      category: 'ALL',
      warehouse: 'ALL',
      search: '',
      thang: new Set(),
      tieu_muc: new Set(),
      chi_tiet_hd: new Set()
    };
    applyFilters();
  });

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      const icon = document.getElementById('icon-refresh');
      if (icon) icon.classList.add('fa-spin');
      try {
        await fetch('/api/refresh?t=' + Date.now(), { cache: 'no-store' });
      } catch (e) {}
      window.location.href = window.location.pathname + '?t=' + Date.now();
    });
  }

  document.getElementById('btn-export').addEventListener('click', exportToCSV);

  // MultiSelect dropdown event listeners
  ['thang', 'tieu_muc', 'chi_tiet_hd'].forEach(key => {
    const trigger = document.getElementById(`ms-trigger-${key}`);
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMsDropdown(key);
      });
    }

    const dropdown = document.getElementById(`ms-dropdown-${key}`);
    if (dropdown) {
      dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    const searchInput = document.getElementById(`ms-search-${key}`);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => filterMsOptions(key, e.target.value));
    }

    const btnAll = document.getElementById(`ms-btn-all-${key}`);
    if (btnAll) {
      btnAll.addEventListener('click', () => {
        const valid = key === 'thang' ? window._validThangs : (key === 'tieu_muc' ? window._validTieuMuc : window._validChiTiet);
        selectAllMs(key, valid || []);
      });
    }

    const btnClear = document.getElementById(`ms-btn-clear-${key}`);
    if (btnClear) {
      btnClear.addEventListener('click', () => clearMs(key));
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms-container').forEach(c => c.classList.remove('active'));
  });

  // Table header sorting
  document.querySelectorAll('#detail-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (tableState.sortCol === col) {
        tableState.sortDir = tableState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        tableState.sortCol = col;
        tableState.sortDir = 'asc';
      }
      renderDataTable();
    });
  });
}

// Apply Filters
function applyFilters() {
  updateDependentDropdowns();

  filteredData = allData.filter(item => {
    if (currentFilters.year !== 'ALL' && String(item.nam) !== String(currentFilters.year)) return false;
    if (currentFilters.category !== 'ALL' && item.loai_cp !== currentFilters.category) return false;
    if (currentFilters.warehouse !== 'ALL' && item.kho !== currentFilters.warehouse) return false;
    if (currentFilters.thang.size > 0 && !currentFilters.thang.has(item.thang)) return false;
    if (currentFilters.tieu_muc.size > 0 && !currentFilters.tieu_muc.has(item.tieu_muc)) return false;
    if (currentFilters.chi_tiet_hd.size > 0) {
      const val = item.chi_tiet_hd || item.chi_tiet || '';
      if (!currentFilters.chi_tiet_hd.has(val)) return false;
    }

    if (currentFilters.search) {
      const s = currentFilters.search;
      const match = 
        (item.loai_cp && item.loai_cp.toLowerCase().includes(s)) ||
        (item.tieu_muc && item.tieu_muc.toLowerCase().includes(s)) ||
        (item.so_hd && item.so_hd.toLowerCase().includes(s)) ||
        (item.ly_do && item.ly_do.toLowerCase().includes(s)) ||
        (item.chi_tiet && item.chi_tiet.toLowerCase().includes(s)) ||
        (item.kho && item.kho.toLowerCase().includes(s)) ||
        (item.nguoi_thu_huong && item.nguoi_thu_huong.toLowerCase().includes(s));
      if (!match) return false;
    }
    return true;
  });

  tableState.page = 1;

  updateKPIs();
  renderMatrixPivot();
  renderDataTable();
}

// Update KPI Metric Cards
function updateKPIs() {
  const totalAmount = filteredData.reduce((sum, item) => sum + (item.st_vat || 0), 0);
  const totalItems = filteredData.length;
  const avgAmount = totalItems > 0 ? totalAmount / totalItems : 0;

  // Category with highest spending in filtered data
  const catMap = {};
  filteredData.forEach(item => {
    catMap[item.loai_cp] = (catMap[item.loai_cp] || 0) + (item.st_vat || 0);
  });
  let topCat = 'N/A';
  let topCatAmt = 0;
  Object.entries(catMap).forEach(([cat, val]) => {
    if (val > topCatAmt) {
      topCatAmt = val;
      topCat = cat;
    }
  });

  document.getElementById('kpi-total-amount').textContent = formatVND(totalAmount);
  document.getElementById('kpi-total-items').textContent = totalItems.toLocaleString('vi-VN') + ' mục';
  document.getElementById('kpi-avg-amount').textContent = formatVND(avgAmount);
  document.getElementById('kpi-top-category').textContent = topCat;
  document.getElementById('kpi-top-category-sub').textContent = topCatAmt > 0 ? `Tổng: ${formatShortVND(topCatAmt)}` : '';
}

// Render Matrix Pivot Table (Kho / Địa Điểm x Năm)
function renderMatrixPivot() {
  const years = [2023, 2024, 2025, 2026].filter(y => {
    if (currentFilters.year !== 'ALL') return String(y) === String(currentFilters.year);
    return true;
  });

  // Group filtered data by Warehouse (Kho) and Year
  const matrix = {};
  const khoTotals = {};
  const yearTotals = {};
  years.forEach(y => yearTotals[y] = 0);
  let grandTotal = 0;

  filteredData.forEach(item => {
    const kho = item.kho || 'Khác';
    const yr = item.nam;

    if (!matrix[kho]) {
      matrix[kho] = {};
      years.forEach(y => matrix[kho][y] = 0);
      khoTotals[kho] = 0;
    }

    if (matrix[kho][yr] !== undefined) {
      matrix[kho][yr] += (item.st_vat || 0);
      khoTotals[kho] += (item.st_vat || 0);
      yearTotals[yr] += (item.st_vat || 0);
      grandTotal += (item.st_vat || 0);
    }
  });

  // Build Table HTML
  const thead = document.getElementById('matrix-thead');
  const tbody = document.getElementById('matrix-tbody');

  let headHTML = `<tr><th>Kho / Địa Điểm</th>`;
  years.forEach(y => headHTML += `<th style="text-align:right">Năm ${y}</th>`);
  headHTML += `<th style="text-align:right">TỔNG CỘNG</th><th style="text-align:right">% TỶ TRỌNG</th></tr>`;
  thead.innerHTML = headHTML;

  let bodyHTML = '';
  const sortedKho = Object.keys(matrix).sort((a, b) => khoTotals[b] - khoTotals[a]);

  sortedKho.forEach(kho => {
    const tot = khoTotals[kho];
    const pct = grandTotal > 0 ? ((tot / grandTotal) * 100).toFixed(1) + '%' : '0%';

    bodyHTML += `<tr>`;
    bodyHTML += `<td><strong>${kho}</strong></td>`;
    years.forEach(y => {
      const val = matrix[kho][y];
      bodyHTML += `<td>${val > 0 ? formatShortVND(val) : '-'}</td>`;
    });
    bodyHTML += `<td class="highlight">${formatVND(tot)}</td>`;
    bodyHTML += `<td style="color:var(--text-muted); font-size:0.82rem">${pct}</td>`;
    bodyHTML += `</tr>`;
  });

  // Total Row
  bodyHTML += `<tr class="total-row"><td>TỔNG CỘNG BỘ PHẬN</td>`;
  years.forEach(y => {
    bodyHTML += `<td>${formatShortVND(yearTotals[y])}</td>`;
  });
  bodyHTML += `<td>${formatVND(grandTotal)}</td><td>100%</td></tr>`;

  tbody.innerHTML = bodyHTML;
}

// Render Chart.js Visualizations
function renderCharts() {
  const textColor = '#94a3b8';
  const gridColor = 'rgba(255, 255, 255, 0.07)';

  // Chart 1: Category Expenditure across Years (Bar Chart)
  const categories = setOfValues('loai_cp').sort();
  const years = [2023, 2024, 2025, 2026];
  const yearColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981'];

  const datasets = years.map((yr, idx) => {
    const data = categories.map(cat => {
      return filteredData
        .filter(item => item.loai_cp === cat && item.nam === yr)
        .reduce((sum, item) => sum + (item.st_vat || 0), 0) / 1e6; // In Millions
    });
    return {
      label: `Năm ${yr}`,
      data: data,
      backgroundColor: yearColors[idx % yearColors.length],
      borderRadius: 6,
      borderWidth: 0
    };
  });

  const ctxBar = document.getElementById('chartCategoryYear').getContext('2d');
  if (chartCategoryYear) chartCategoryYear.destroy();

  chartCategoryYear = new Chart(ctxBar, {
    type: 'bar',
    data: { labels: categories, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#06b6d4',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toLocaleString('vi-VN')} Triệu VNĐ`
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { 
          ticks: { 
            color: textColor,
            callback: (val) => val >= 1000 ? (val/1000).toFixed(1) + ' Tỷ' : val + ' Tr'
          }, 
          grid: { color: gridColor } 
        }
      }
    }
  });

  // Chart 2: Category % Share (Donut Chart)
  const catMap = {};
  filteredData.forEach(item => {
    catMap[item.loai_cp] = (catMap[item.loai_cp] || 0) + (item.st_vat || 0);
  });
  const donutLabels = Object.keys(catMap);
  const donutValues = Object.values(catMap).map(v => (v / 1e6).toFixed(1));

  const ctxDonut = document.getElementById('chartDonutCategory').getContext('2d');
  if (chartDonutCategory) chartDonutCategory.destroy();

  chartDonutCategory = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: donutLabels,
      datasets: [{
        data: donutValues,
        backgroundColor: [
          '#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', 
          '#ec4899', '#f43f5e', '#a855f7', '#64748b', '#14b8a6'
        ],
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { size: 11, family: 'Plus Jakarta Sans' } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${parseFloat(ctx.raw).toLocaleString('vi-VN')} Triệu VNĐ`
          }
        }
      },
      cutout: '68%'
    }
  });

  // Chart 3: Top Warehouses (Horizontal Bar)
  const whMap = {};
  filteredData.forEach(item => {
    const k = item.kho || 'Khác';
    whMap[k] = (whMap[k] || 0) + (item.st_vat || 0);
  });
  const sortedWh = Object.entries(whMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctxWh = document.getElementById('chartTopWarehouse').getContext('2d');
  if (chartTopWarehouse) chartTopWarehouse.destroy();

  chartTopWarehouse = new Chart(ctxWh, {
    type: 'bar',
    data: {
      labels: sortedWh.map(x => x[0]),
      datasets: [{
        label: 'Tổng Chi Phí',
        data: sortedWh.map(x => (x[1] / 1e6).toFixed(1)),
        backgroundColor: 'rgba(6, 182, 212, 0.85)',
        borderColor: '#06b6d4',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => ` Chi phí: ${parseFloat(ctx.raw).toLocaleString('vi-VN')} Triệu VNĐ`
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { display: false } }
      }
    }
  });

  // Chart 4: Monthly Trend Line Chart
  const monthMap = {};
  filteredData.forEach(item => {
    if (item.thang) {
      monthMap[item.thang] = (monthMap[item.thang] || 0) + (item.st_vat || 0);
    }
  });
  const sortedMonths = Object.keys(monthMap).sort();

  const ctxTrend = document.getElementById('chartMonthlyTrend').getContext('2d');
  if (chartMonthlyTrend) chartMonthlyTrend.destroy();

  chartMonthlyTrend = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{
        label: 'Chi phí theo Tháng',
        data: sortedMonths.map(m => (monthMap[m] / 1e6).toFixed(1)),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans' } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(16, 185, 129, 0.4)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.raw} Triệu VNĐ`
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}

// Render Data Table with Pagination & Sorting
function renderDataTable() {
  const sorted = [...filteredData].sort((a, b) => {
    let valA = a[tableState.sortCol];
    let valB = b[tableState.sortCol];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return tableState.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return tableState.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / tableState.pageSize) || 1;
  if (tableState.page > totalPages) tableState.page = totalPages;

  const startIdx = (tableState.page - 1) * tableState.pageSize;
  const pageItems = sorted.slice(startIdx, startIdx + tableState.pageSize);

  const tbody = document.getElementById('detail-tbody');
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted)">Không tìm thấy dữ liệu phù hợp</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(item => {
      const chiTietHD = item.chi_tiet_hd || item.chi_tiet || '-';
      const lyDo = item.ly_do || '-';
      return `
        <tr>
          <td><span class="badge badge-emerald">${item.thang || '-'}</span></td>
          <td>${item.tieu_muc || '-'}</td>
          <td><strong>${formatSoHD(item.so_hd)}</strong></td>
          <td>${formatDateDDMMYYYY(item.ngay_hd)}</td>
          <td title="${lyDo}">${lyDo.length > 30 ? lyDo.substring(0, 30) + '...' : lyDo}</td>
          <td title="${chiTietHD}">${chiTietHD.length > 30 ? chiTietHD.substring(0, 30) + '...' : chiTietHD}</td>
          <td style="font-weight:600; text-align:right; color:#38bdf8">${formatVND(item.st_no_vat)}</td>
          <td style="font-weight:600; text-align:right; color:#f59e0b">${formatVND(item.vat)}</td>
          <td style="font-weight:700; text-align:right; color:#34d399">${formatVND(item.st_vat)}</td>
        </tr>
      `;
    }).join('');
  }

  // Calculate Grand Totals for Footer Row across all filtered items
  const totalStNoVat = filteredData.reduce((sum, item) => sum + (item.st_no_vat || 0), 0);
  const totalVat = filteredData.reduce((sum, item) => sum + (item.vat || 0), 0);
  const totalStVat = filteredData.reduce((sum, item) => sum + (item.st_vat || 0), 0);

  const tfoot = document.getElementById('detail-tfoot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr class="table-total-row">
        <td colspan="6" style="text-align:right; font-weight:800; color:var(--accent-cyan);">TỔNG CỘNG (${filteredData.length.toLocaleString('vi-VN')} MỤC):</td>
        <td style="text-align:right; font-weight:800; color:#38bdf8;">${formatVND(totalStNoVat)}</td>
        <td style="text-align:right; font-weight:800; color:#f59e0b;">${formatVND(totalVat)}</td>
        <td style="text-align:right; font-weight:800; color:#34d399;">${formatVND(totalStVat)}</td>
      </tr>
    `;
  }

  // Update Pagination Info
  document.getElementById('table-info').textContent = 
    `Hiển thị ${sorted.length > 0 ? startIdx + 1 : 0} - ${Math.min(startIdx + tableState.pageSize, sorted.length)} trên tổng số ${sorted.length} mục`;

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const container = document.getElementById('pagination-btns');
  let html = '';

  html += `<button class="page-btn" ${tableState.page === 1 ? 'disabled' : ''} onclick="changePage(${tableState.page - 1})"><i class="fas fa-chevron-left"></i></button>`;

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= tableState.page - 1 && p <= tableState.page + 1)) {
      html += `<button class="page-btn ${p === tableState.page ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
    } else if (p === tableState.page - 2 || p === tableState.page + 2) {
      html += `<span style="color:var(--text-muted)">...</span>`;
    }
  }

  html += `<button class="page-btn" ${tableState.page === totalPages ? 'disabled' : ''} onclick="changePage(${tableState.page + 1})"><i class="fas fa-chevron-right"></i></button>`;

  container.innerHTML = html;
}

function changePage(page) {
  tableState.page = page;
  renderDataTable();
}

// Export Filtered Data to CSV
function exportToCSV() {
  if (filteredData.length === 0) {
    alert('Không có dữ liệu để xuất!');
    return;
  }

  const headers = ['STT', 'Loại CP', 'Tiểu Mục', 'Số HĐ', 'Ngày HĐ', 'Tháng', 'Lý do TT', 'Chi Tiết', 'Kho', 'Số tiền (chưa VAT)', 'VAT', 'Số tiền (VAT)', 'Ngày đề nghị TT', 'Người thụ hưởng', 'Ngân hàng', 'Năm'];
  
  const csvRows = [headers.join(',')];

  filteredData.forEach(item => {
    const row = [
      item.id,
      `"${item.loai_cp.replace(/"/g, '""')}"`,
      `"${item.tieu_muc.replace(/"/g, '""')}"`,
      `"${formatSoHD(item.so_hd).replace(/"/g, '""')}"`,
      `"${formatDateDDMMYYYY(item.ngay_hd)}"`,
      `"${item.thang}"`,
      `"${item.ly_do.replace(/"/g, '""')}"`,
      `"${item.chi_tiet.replace(/"/g, '""')}"`,
      `"${item.kho.replace(/"/g, '""')}"`,
      item.st_no_vat,
      item.vat,
      item.st_vat,
      `"${item.ngay_tt}"`,
      `"${item.nguoi_thu_huong.replace(/"/g, '""')}"`,
      `"${item.ngan_hang.replace(/"/g, '""')}"`,
      item.nam
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bao_Cao_Chi_Phi_${currentFilters.year}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
