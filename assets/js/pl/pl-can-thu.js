/* =============================================================================
   PL-Can-Thu JavaScript
   Xử lý logic cho trang Phế liệu - Cần thu
================================================================================ */

// Thay bằng URL Google Apps Script sau khi deploy
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby5-QUtirqC4wkyFUpJdC8tf4AHXJDvuobcvizk3ctJe3_MEcWdiw1QZCoa4Z5qYG550Q/exec';

/* =============================================================================
   LOADING OVERLAY FUNCTIONS
================================================================================ */

function showLoadingOverlay(message) {
  // Remove existing overlay if any
  const existingOverlay = document.getElementById('loadingOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div style="
        background-color: white;
        padding: 20px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
        font-size: 18px;
        font-weight: 500;
        color: #333;
      ">
        <div style="
          width: 40px;
          height: 40px;
          margin: 0 auto 15px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        ${message}
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho ứng dụng
================================================================================ */

// Sheet ID và GID từ Google Sheets
const SHEET_ID = '1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE';
const SHEET_GID = '573099918';

// URL để tải file .xlsx (giữ nguyên định dạng từ Google Sheets)
const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================

// ==================== COLUMN DEFINITIONS ====================
// Định nghĩa các cột dữ liệu từ Google Sheet
// Cần điều chỉnh theo cấu trúc thực tế của sheet
// Thứ tự: STT, Ngày, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú
const COLUMN_DEFINITIONS = [
  { key: 'stt', label: 'STT', type: 'number', common: true },
  { key: 'ngay', label: 'Ngày', type: 'date', common: true },
  { key: 'xuong', label: 'Xưởng', type: 'text', common: true },
  { key: 'loai', label: 'Loại phế liệu', type: 'text', detail: true },
  { key: 'soluong', label: 'Số lượng (kg)', type: 'number', detail: true },
  { key: 'ghichu', label: 'Ghi chú', type: 'text', additional: true }
];

// Các cột hiển thị trong bảng (thứ tự: STT, Ngày, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú)
const TABLE_COLUMNS = ['stt', 'ngay', 'xuong', 'loai', 'soluong', 'ghichu'];

/* =============================================================================
   GLOBAL VARIABLES
   Biến toàn cục quản lý state của ứng dụng
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];           // lưu dữ liệu gốc từ Google Sheet
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị (trang hiện tại)
let selectedRowIndex = -1;     // index theo tableData (không theo dữ liệu đã lọc)
let selectedRowIndexes = [];   // mảng các index đã chọn (cho xóa nhiều dòng)

// Loại management for Add Data Modal
let loaiCount = 0;

// Edit Loại management for Edit Data Modal
let editLoaiCount = 0;

// Unique values for filters
let xuongList = [];

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích dùng chung trong ứng dụng
================================================================================ */

// Debounce helper function - Giới hạn tần suất gọi hàm
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Chuyển đổi ngày tháng từ Excel/sheet sang định dạng dd/mm/yyyy
function formatDate(dateValue) {
  if (!dateValue) return '';

  let date = null;

  if (typeof dateValue === 'number') {
    // Excel serial date
    date = new Date((dateValue - 25569) * 86400 * 1000);
  } else if (typeof dateValue === 'string') {
    date = parseRowDate(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    return dateValue ?? '';
  }

  if (!date || isNaN(date.getTime())) {
    return dateValue ?? '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Parse ngày tháng từ các định dạng khác nhau
function parseRowDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  
  // Excel serial number
  if (typeof raw === 'number') {
    return new Date((raw - 25569) * 86400 * 1000);
  }
  
  // String format: dd/mm/yyyy or dd-mm-yyyy
  if (typeof raw === 'string') {
    // Check for dd/mm/yyyy or dd-mm-yyyy
    const parts = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const year = parseInt(parts[3], 10);
      return new Date(year, month, day);
    }
    
    // ISO format: yyyy-mm-dd
    const isoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }
  }
  
  return null;
}

// Format number with thousand separators
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  if (typeof num === 'string') {
    num = parseFloat(num.replace(/,/g, ''));
  }
  if (isNaN(num)) return '';
  return num.toLocaleString('vi-VN');
}

// Parse number from string
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const num = parseFloat(value.toString().replace(/,/g, '').replace(/ kg/g, ''));
  return isNaN(num) ? null : num;
}

/* =============================================================================
   DATA LOADING FUNCTIONS
   Các hàm tải dữ liệu từ Google Sheet
================================================================================ */

// Fetch dữ liệu từ Google Sheet
async function fetchSheetData() {
  const loadingEl = document.getElementById('loading');
  if (!loadingEl) return;
  
  loadingEl.innerHTML = 'Đang tải dữ liệu...';
  
  try {
    const response = await fetch(XLSX_EXPORT_URL);
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu từ Google Sheet');
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Parse Excel file using XLSX
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      tableData = [];
      return;
    }
    
    // First row is header
    const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
    
    // Parse data rows
    tableData = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;
      
      const rowData = { _rowIndex: i + 1 }; // Excel row index (1-based)
      
      headers.forEach((header, index) => {
        const value = row[index];
        rowData[header] = value;
      });
      
      // Normalize keys
      const normalizedRow = normalizeRowData(rowData);
      if (normalizedRow.xuong || normalizedRow.loai) {
        tableData.push(normalizedRow);
      }
    }
    
    // Update filter values
    updateFilterValues();
    
    // Enable export button
    const exportBtn = document.getElementById('btnExport');
    if (exportBtn) exportBtn.disabled = false;
    
    // Apply initial filter and display
    applyFilters();
    
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu:', error);
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="alert alert-danger">Lỗi khi tải dữ liệu: ${error.message}</div>`;
    }
  } finally {
    // Ẩn loading indicator sau khi tải xong (thành công hoặc lỗi)
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }
}

// Normalize row data keys
function normalizeRowData(row) {
  const result = {};
  
  // Map various header names to standard keys
  const keyMap = {
    'stt': 'stt',
    'số thứ tự': 'stt',
    'xuong': 'xuong',
    'xưởng': 'xuong',
    'ngay': 'ngay',
    'ngày': 'ngay',
    'loai': 'loai',
    'loại': 'loai',
    'loại phế liệu': 'loai',
    'soluong': 'soluong',
    'số lượng': 'soluong',
    'số lượng (kg)': 'soluong',
    'kg': 'soluong',
    'ghichu': 'ghichu',
    'ghi chú': 'ghichu',
    'ghi chú': 'ghichu'
  };
  
  // First, preserve the _rowIndex (Excel row number) before normalization
  if (row._rowIndex !== undefined) {
    result._rowIndex = row._rowIndex;
  }
  
  for (const [key, value] of Object.entries(row)) {
    // Skip _rowIndex as it's already handled
    if (key === '_rowIndex') continue;
    
    const normalizedKey = key.toLowerCase().trim();
    const mappedKey = keyMap[normalizedKey] || normalizedKey;
    result[mappedKey] = value;
  }
  
  // Format date
  if (result.ngay) {
    result.ngay = formatDate(result.ngay);
  }
  
  // Parse number
  if (result.soluong) {
    result.soluong = parseNumber(result.soluong);
  }
  
  return result;
}

// Update filter dropdown values
function updateFilterValues() {
  // Extract unique xưởng values
  const xuongSet = new Set();
  tableData.forEach(row => {
    if (row.xuong) {
      xuongSet.add(row.xuong);
    }
  });
  xuongList = Array.from(xuongSet).sort();
  
  // Render xưởng filter
  renderXuongFilter();
}

// Render xưởng filter dropdown
function renderXuongFilter() {
  const menu = document.getElementById('xuongFilterMenu');
  if (!menu) return;
  
  // Clear existing content
  menu.innerHTML = '';
  
  // Check if we have xuongList
  if (!xuongList || xuongList.length === 0) {
    const none = document.createElement('div'); 
    none.className = 'text-muted small'; 
    none.textContent = 'Không có dữ liệu';
    menu.appendChild(none);
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = '0';
    return;
  }
  
  // Controls: Select All / Clear
  const ctrl = document.createElement('div');
  ctrl.className = 'd-flex gap-1 mb-2';
  const selAll = document.createElement('button'); 
  selAll.type = 'button'; 
  selAll.className = 'btn btn-sm btn-link p-0'; 
  selAll.textContent = 'Chọn tất cả';
  const clr = document.createElement('button'); 
  clr.type = 'button'; 
  clr.className = 'btn btn-sm btn-link p-0 text-danger'; 
  clr.textContent = 'Bỏ chọn';
  ctrl.appendChild(selAll); 
  ctrl.appendChild(document.createTextNode(' · ')); 
  ctrl.appendChild(clr);
  menu.appendChild(ctrl);

  selAll.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
    applyFilters();
  });
  clr.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = '0';
    applyFilters();
  });
  
  // Checkbox options
  xuongList.forEach((xuong, i) => {
    const id = `xuongOpt_${i}`;
    const wrap = document.createElement('div'); 
    wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input xuong-filter-checkbox'; 
    input.type = 'checkbox'; 
    input.value = xuong; 
    input.id = id;
    const label = document.createElement('label'); 
    label.className = 'form-check-label'; 
    label.htmlFor = id; 
    label.textContent = xuong;
    wrap.appendChild(input); 
    wrap.appendChild(label);
    menu.appendChild(wrap);

    input.addEventListener('change', () => {
      const countEl = document.getElementById('xuongFilterCount');
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      applyFilters();
    });
  });
  
  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = '0';
}

// Update xưởng filter count
function updateXuongFilterCount() {
  const checked = document.querySelectorAll('.xuong-filter-checkbox:checked');
  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = checked.length;
}

/* =============================================================================
   FILTERING & PAGINATION
   Các hàm lọc dữ liệu và phân trang
================================================================================ */

// Apply all filters
function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  
  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const fromDate = fromDateInput?.value;
  const toDate = toDateInput?.value;
  const checkedXuongs = Array.from(document.querySelectorAll('.xuong-filter-checkbox:checked')).map(cb => cb.value);
  
  filteredData = tableData.filter(row => {
    // Search filter
    if (searchTerm) {
      const searchFields = [row.xuong, row.loai, row.ghichu].filter(f => f).join(' ').toLowerCase();
      if (!searchFields.includes(searchTerm)) {
        return false;
      }
    }
    
    // Date filter
    if (fromDate || toDate) {
      const rowDate = parseRowDate(row.ngay);
      if (rowDate) {
        // Use local date components to avoid timezone issues with toISOString()
        const rowYear = rowDate.getFullYear();
        const rowMonth = String(rowDate.getMonth() + 1).padStart(2, '0');
        const rowDay = String(rowDate.getDate()).padStart(2, '0');
        const rowDateStr = `${rowYear}-${rowMonth}-${rowDay}`;
        
        if (fromDate && rowDateStr < fromDate) return false;
        if (toDate && rowDateStr > toDate) return false;
      } else {
        return false; // Skip rows with invalid dates when filter is applied
      }
    }
    
    // Xưởng filter
    if (checkedXuongs.length > 0) {
      if (!row.xuong || !checkedXuongs.includes(row.xuong)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Reset to first page
  currentPage = 1;
  
  // Calculate pagination
  totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
  
  // Update display
  updatePagination();
  renderTable();
}

// Update pagination controls
function updatePagination() {
  const pageSelect = document.getElementById('pageSelect');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if (!pageSelect || !pageInfo) return;
  
  // Update page select options
  let options = '';
  for (let i = 1; i <= totalPages; i++) {
    options += `<option value="${i}" ${i === currentPage ? 'selected' : ''}>Trang ${i}</option>`;
  }
  pageSelect.innerHTML = options;
  
  // Update page info
  pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  
  // Update button states
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

// Render table with pagination
function renderTable() {
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  displayedData = filteredData.slice(startIndex, endIndex);
  
  renderTableBody();
}

// Render table body
function renderTableBody() {
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const tbody = document.querySelector('#dataTable tbody');
  const theadTr = document.querySelector('#dataTable thead tr');
  
  if (!tbody || !theadTr) return;
  
  // Luôn cập nhật header trước khi hiển thị dữ liệu
  let headerHtml = '<th style="width: 50px;"><input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả"></th>';
  TABLE_COLUMNS.forEach(col => {
    const colDef = COLUMN_DEFINITIONS.find(c => c.key === col);
    headerHtml += `<th>${colDef?.label || col}</th>`;
  });
  theadTr.innerHTML = headerHtml;
  
  // Đảm bảo loading indicator được ẩn
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  
  // Render body
  if (displayedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Không có dữ liệu</td></tr>';
    return;
  }
  
  tbody.innerHTML = displayedData.map((row, index) => {
    let cells = `<td><input type="checkbox" class="row-checkbox" data-index="${startIndex + index}"></td>`;
    
    TABLE_COLUMNS.forEach(col => {
      let value = row[col];
      
      if (col === 'soluong' && value !== null && value !== undefined) {
        value = formatNumber(value);
      }
      
      cells += `<td>${escapeHtml(value ?? '')}</td>`;
    });
    
    return `<tr data-index="${startIndex + index}">${cells}</tr>`;
  }).join('');
  
  // Add row click handler
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const checkbox = tr.querySelector('.row-checkbox');
      if (checkbox) checkbox.checked = !checkbox.checked;
      updateButtonStates();
    });
  });
  
  // Add checkbox handler
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateButtonStates();
    });
  }
  
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', updateButtonStates);
  });
}

// Update button states based on selection
function updateButtonStates() {
  const checked = document.querySelectorAll('.row-checkbox:checked');
  const count = checked.length;
  
  const editBtn = document.getElementById('btnEditData');
  const deleteBtn = document.getElementById('btnDeleteData');
  
  if (editBtn) editBtn.disabled = count !== 1;
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
    if (count > 0) {
      deleteBtn.textContent = `Xóa đã chọn (${count})`;
    } else {
      deleteBtn.textContent = 'Xóa dữ liệu';
    }
  }
  
  selectedRowIndexes = Array.from(checked).map(cb => parseInt(cb.dataset.index, 10));
  selectedRowIndex = count === 1 ? selectedRowIndexes[0] : -1;
}

/* =============================================================================
   MODAL & FORM HANDLING
   Các hàm xử lý modal và form
================================================================================ */

// Show add data modal
function showAddDataModal() {
  const modalEl = document.getElementById('addDataModal');
  if (!modalEl) return;
  
  const modal = new bootstrap.Modal(modalEl);
  
  // Reset form
  const form = document.getElementById('addDataForm');
  if (form) form.reset();
  
  // Reset loại table
  loaiCount = 0;
  const loaiTableBody = document.getElementById('loaiTableBody');
  if (loaiTableBody) loaiTableBody.innerHTML = '';
  updateLoaiTotals();
  
  // Add first loại row
  addLoaiRow();
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const ngayInput = document.querySelector('#addDataForm input[name="ngay"]');
  if (ngayInput) ngayInput.value = today;
  
  modal.show();
}

// Show edit data modal
function showEditDataModal() {
  if (selectedRowIndex < 0 || selectedRowIndex >= filteredData.length) return;
  
  const modalEl = document.getElementById('editDataModal');
  if (!modalEl) return;
  
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const row = filteredData[selectedRowIndex];
  
  // Populate common fields (ngay, xuong)
  const xuongInput = document.querySelector('#editDataForm input[name="xuong"]');
  const ngayInput = document.querySelector('#editDataForm input[name="ngay"]');
  const ghichuInput = document.querySelector('#editDataForm textarea[name="ghichu"]');
  
  if (xuongInput) xuongInput.value = row.xuong || '';
  if (ngayInput) {
    // Convert date from dd/mm/yyyy to yyyy-mm-dd for input type=date
    const dateValue = row.ngay;
    if (dateValue) {
      const parsedDate = parseRowDate(dateValue);
      if (parsedDate) {
        ngayInput.value = parsedDate.toISOString().split('T')[0];
      } else {
        ngayInput.value = '';
      }
    } else {
      ngayInput.value = '';
    }
  }
  if (ghichuInput) ghichuInput.value = row.ghichu || '';
  
  // Reset edit loại table
  editLoaiCount = 0;
  const editLoaiTableBody = document.getElementById('editLoaiTableBody');
  if (editLoaiTableBody) editLoaiTableBody.innerHTML = '';
  
  // Add loại row for each loại in the data
  addEditLoaiRow(row.loai || '', row.soluong || '');
  
  updateEditLoaiTotals();
  
  modal.show();
}

// Add loại row in add modal
function addLoaiRow(loaiValue = '', kgValue = '') {
  loaiCount++;
  const tbody = document.getElementById('loaiTableBody');
  if (!tbody) return;
  
  const tr = document.createElement('tr');
  tr.dataset.loaiId = loaiCount;
  tr.innerHTML = `
    <td class="text-center loai-stt">${loaiCount}</td>
    <td>
      <input type="text" class="form-control form-control-sm loai-input" 
             placeholder="Nhập loại phế liệu" value="${escapeHtml(loaiValue)}">
    </td>
    <td>
      <input type="number" class="form-control form-control-sm loai-input kg-input" 
             placeholder="Số kg" step="0.01" min="0" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-loai" 
              onclick="removeLoaiRow(${loaiCount})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateLoaiTotals();
}

// Add loại row in edit modal
function addEditLoaiRow(loaiValue = '', kgValue = '') {
  editLoaiCount++;
  const tbody = document.getElementById('editLoaiTableBody');
  if (!tbody) return;
  
  const tr = document.createElement('tr');
  tr.dataset.loaiId = editLoaiCount;
  tr.innerHTML = `
    <td class="text-center loai-stt">${editLoaiCount}</td>
    <td>
      <input type="text" class="form-control form-control-sm loai-input" 
             placeholder="Nhập loại phế liệu" value="${escapeHtml(loaiValue)}">
    </td>
    <td>
      <input type="number" class="form-control form-control-sm loai-input kg-input" 
             placeholder="Số kg" step="0.01" min="0" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-loai" 
              onclick="removeEditLoaiRow(${editLoaiCount})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateEditLoaiTotals();
}

// Remove loại row from add modal
function removeLoaiRow(loaiId) {
  const row = document.querySelector(`#loaiTableBody tr[data-loai-id="${loaiId}"]`);
  if (row) {
    row.remove();
    updateLoaiRowNumbers();
    updateLoaiTotals();
  }
}

// Remove loại row from edit modal
function removeEditLoaiRow(loaiId) {
  const row = document.querySelector(`#editLoaiTableBody tr[data-loai-id="${loaiId}"]`);
  if (row) {
    row.remove();
    updateEditLoaiRowNumbers();
    updateEditLoaiTotals();
  }
}

// Update loại row numbers
function updateLoaiRowNumbers() {
  let num = 1;
  document.querySelectorAll('#loaiTableBody tr').forEach(tr => {
    tr.querySelector('.loai-stt').textContent = num++;
  });
  loaiCount = num - 1;
}

// Update edit loại row numbers
function updateEditLoaiRowNumbers() {
  let num = 1;
  document.querySelectorAll('#editLoaiTableBody tr').forEach(tr => {
    tr.querySelector('.loai-stt').textContent = num++;
  });
  editLoaiCount = num - 1;
}

// Update loại totals
function updateLoaiTotals() {
  const rows = document.querySelectorAll('#loaiTableBody tr');
  let totalKg = 0;
  
  rows.forEach(tr => {
    const kgInput = tr.querySelector('.kg-input');
    if (kgInput && kgInput.value) {
      totalKg += parseFloat(kgInput.value) || 0;
    }
  });
  
  const totalLoaiCountEl = document.getElementById('totalLoaiCount');
  const totalKgEl = document.getElementById('totalKg');
  
  if (totalLoaiCountEl) totalLoaiCountEl.textContent = rows.length;
  if (totalKgEl) totalKgEl.textContent = formatNumber(totalKg);
}

// Update edit loại totals
function updateEditLoaiTotals() {
  const rows = document.querySelectorAll('#editLoaiTableBody tr');
  let totalKg = 0;
  
  rows.forEach(tr => {
    const kgInput = tr.querySelector('.kg-input');
    if (kgInput && kgInput.value) {
      totalKg += parseFloat(kgInput.value) || 0;
    }
  });
  
  const totalLoaiCountEl = document.getElementById('editTotalLoaiCount');
  const totalKgEl = document.getElementById('editTotalKg');
  
  if (totalLoaiCountEl) totalLoaiCountEl.textContent = rows.length;
  if (totalKgEl) totalKgEl.textContent = formatNumber(totalKg);
}

// Handle add form submit
async function handleAddSubmit(e) {
  e.preventDefault();
  
  const xuongInput = document.querySelector('#addDataForm input[name="xuong"]');
  const ngayInput = document.querySelector('#addDataForm input[name="ngay"]');
  const ghichuInput = document.querySelector('#addDataForm textarea[name="ghichu"]');
  
  const xuong = xuongInput?.value?.trim();
  const ngay = ngayInput?.value;
  const ghichu = ghichuInput?.value?.trim() || '';
  
  // Get all loại rows
  const loaiRows = [];
  document.querySelectorAll('#loaiTableBody tr').forEach(tr => {
    const loaiInput = tr.querySelector('.loai-input');
    const kgInput = tr.querySelector('.kg-input');
    const loai = loaiInput?.value?.trim();
    const kg = parseFloat(kgInput?.value) || 0;
    if (loai && kg > 0) {
      loaiRows.push({ loai, kg });
    }
  });
  
  if (!xuong) {
    alert('Vui lòng nhập tên xưởng');
    return;
  }
  
  if (loaiRows.length === 0) {
    alert('Vui lòng thêm ít nhất một loại phế liệu');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang thêm dữ liệu...');
  
  try {
    // Check if APPS_SCRIPT_URL is configured
    if (APPS_SCRIPT_URL === 'https://script.google.com/macros/s/XXXXXXXXXXXXX/exec' || !APPS_SCRIPT_URL) {
      alert('Chưa cấu hình APPS_SCRIPT_URL. Vui lòng deploy Google Apps Script và cập nhật URL trong file JS.');
      hideLoadingOverlay();
      return;
    }
    
    // Create multiple rows (one for each loại)
    const results = [];
    for (const item of loaiRows) {
      const values = [
        tableData.length + results.length + 1, // STT
        ngay,      // Ngày
        xuong,     // Xưởng
        item.loai, // Loại phế liệu
        item.kg,   // Số lượng (kg)
        ghichu     // Ghi chú
      ];
      
      const body = new URLSearchParams();
      body.set('values', JSON.stringify(values));
      
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: body,
        redirect: 'follow'
      });
      
      // Handle empty response
      const text = await response.text();
      if (!text) {
        throw new Error('Server trả về response rỗng');
      }
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse response:', text);
        throw new Error('Server trả về dữ liệu không hợp lệ: ' + text.substring(0, 100));
      }
      
      if (result.result === 'error') {
        throw new Error(result.error || 'Lỗi từ Apps Script');
      }
      
      if (result.result !== 'success') {
        throw new Error(result.error || 'Lỗi khi thêm dữ liệu');
      }
      
      results.push(result);
    }
    
    // Close modal and reload
    const modalEl = document.getElementById('addDataModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    await fetchSheetData();
    
  } catch (error) {
    console.error('Lỗi:', error);
    
    // Check for specific error types
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      alert('Lỗi kết nối đến Apps Script. Có thể do:\n1. Apps Script chưa được deploy đúng cách\n2. Lỗi CORS - hãy thử deploy lại Apps Script\n3. Kiểm tra console (F12) để xem chi tiết lỗi\n\nHãy đảm bảo đã deploy Google Apps Script và cập nhật APPS_SCRIPT_URL.');
    } else {
      alert('Lỗi khi thêm dữ liệu: ' + error.message + '\n\nHãy đảm bảo đã deploy Google Apps Script và cập nhật APPS_SCRIPT_URL.');
    }
  } finally {
    hideLoadingOverlay();
  }
}

// Handle edit form submit
async function handleEditSubmit(e) {
  e.preventDefault();
  
  if (selectedRowIndex < 0) return;
  
  const originalRow = filteredData[selectedRowIndex];
  
  const xuongInput = document.querySelector('#editDataForm input[name="xuong"]');
  const ngayInput = document.querySelector('#editDataForm input[name="ngay"]');
  const ghichuInput = document.querySelector('#editDataForm textarea[name="ghichu"]');
  
  const xuong = xuongInput?.value?.trim();
  const ngay = ngayInput?.value;
  const ghichu = ghichuInput?.value?.trim() || '';
  
  // Get all loại rows
  const loaiRows = [];
  document.querySelectorAll('#editLoaiTableBody tr').forEach(tr => {
    const loaiInput = tr.querySelector('.loai-input');
    const kgInput = tr.querySelector('.kg-input');
    const loai = loaiInput?.value?.trim();
    const kg = parseFloat(kgInput?.value) || 0;
    if (loai && kg > 0) {
      loaiRows.push({ loai, kg });
    }
  });
  
  if (!xuong) {
    alert('Vui lòng nhập tên xưởng');
    return;
  }
  
  if (loaiRows.length === 0) {
    alert('Vui lòng thêm ít nhất một loại phế liệu');
    return;
  }
  
  // Show loading overlay
  showLoadingOverlay('Đang cập nhật dữ liệu...');
  
  try {
    // Check if APPS_SCRIPT_URL is configured
    if (APPS_SCRIPT_URL === 'https://script.google.com/macros/s/XXXXXXXXXXXXX/exec' || !APPS_SCRIPT_URL) {
      alert('Chưa cấu hình APPS_SCRIPT_URL. Vui lòng deploy Google Apps Script và cập nhật URL trong file JS.');
      hideLoadingOverlay();
      return;
    }
    
    console.log('Sending to Apps Script URL:', APPS_SCRIPT_URL);
    
    // For now, we'll just update the first row with first loại
    // A more complete implementation would handle multiple rows
    const values = [
      originalRow.stt || selectedRowIndex + 1, // STT
      ngay,      // Ngày
      xuong,     // Xưởng
      loaiRows[0].loai,   // Loại phế liệu
      loaiRows[0].kg,     // Số lượng (kg)
      ghichu     // Ghi chú
    ];
    
    console.log('Update - originalRow:', originalRow);
    console.log('Update - rowIndex:', originalRow._rowIndex);
    console.log('Update - values:', values);
    
    const body = new URLSearchParams();
    body.set('action', 'update');
    body.set('rowIndex', String(originalRow._rowIndex));
    body.set('values', JSON.stringify(values));
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: body,
      redirect: 'follow'
    });
    
    // Handle response
    const text = await response.text();
    console.log('Update response:', text);
    
    if (!text) {
      throw new Error('Server trả về response rỗng');
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse response:', text);
      throw new Error('Server trả về dữ liệu không hợp lệ: ' + text.substring(0, 100));
    }
    
    if (result.result === 'error') {
      throw new Error(result.error || 'Lỗi từ Apps Script');
    }
    
    if (result.result !== 'success') {
      throw new Error(result.error || 'Lỗi khi cập nhật dữ liệu');
    }
    
    // Close modal and reload
    const modalEl = document.getElementById('editDataModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    await fetchSheetData();
    
  } catch (error) {
    console.error('Lỗi:', error);
    
    // Check for specific error types
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      alert('Lỗi kết nối đến Apps Script. Có thể do:\n1. Apps Script chưa được deploy đúng cách\n2. Lỗi CORS - hãy thử deploy lại Apps Script\n3. Kiểm tra console (F12) để xem chi tiết lỗi');
    } else {
      alert('Lỗi khi cập nhật dữ liệu: ' + error.message);
    }
  } finally {
    hideLoadingOverlay();
  }
}

// Handle delete
async function handleDelete() {
  if (selectedRowIndexes.length === 0) return;
  
  // Update modal body message to show count
  const modalBody = document.querySelector('#deleteDataModal .modal-body p');
  if (modalBody) {
    if (selectedRowIndexes.length === 1) {
      modalBody.textContent = 'Bạn có chắc chắn muốn xóa dòng dữ liệu này? Hành động này không thể hoàn tác.';
    } else {
      modalBody.textContent = `Bạn có chắc chắn muốn xóa ${selectedRowIndexes.length} dòng dữ liệu đã chọn? Hành động này không thể hoàn tác.`;
    }
  }
  
  const modalEl = document.getElementById('deleteDataModal'); 
  if (!modalEl) return;
  
  const bsModal = new bootstrap.Modal(modalEl); 
  bsModal.show();
}

// Handle confirm delete from modal
async function handleConfirmDelete() {
  // Check if APPS_SCRIPT_URL is configured
  if (APPS_SCRIPT_URL === 'https://script.google.com/macros/s/XXXXXXXXXXXXX/exec' || !APPS_SCRIPT_URL) {
    alert('Chưa cấu hình APPS_SCRIPT_URL. Vui lòng deploy Google Apps Script và cập nhật URL trong file JS.');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang xóa dữ liệu...');
  
  try {
    // Sort indexes in descending order to avoid index shifting
    const sortedIndexes = [...selectedRowIndexes].sort((a, b) => b - a);
    
    for (const index of sortedIndexes) {
      const row = filteredData[index];
      if (!row || !row._rowIndex) continue;
      
      console.log('Delete - row:', row);
      console.log('Delete - rowIndex:', row._rowIndex);
      
      const body = new URLSearchParams();
      body.set('action', 'delete');
      body.set('rowIndex', String(row._rowIndex));
      console.log('Deleting row:', row._rowIndex);
      
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: body,
        redirect: 'follow'
      });
      
      // Handle empty response
      const text = await response.text();
      if (!text) {
        throw new Error('Server trả về response rỗng');
      }
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse response:', text);
        throw new Error('Server trả về dữ liệu không hợp lệ: ' + text.substring(0, 100));
      }
      
      if (result.result === 'error') {
        throw new Error(result.error || 'Lỗi từ Apps Script');
      }
      
      if (result.result !== 'success') {
        throw new Error(result.error || 'Lỗi khi xóa dữ liệu');
      }
    }
    
    // Reload data
    await fetchSheetData();
    
    // Close modal
    const deleteDataModalEl = document.getElementById('deleteDataModal');
    const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl);
    if (bsDeleteData) bsDeleteData.hide();
    
  } catch (error) {
    console.error('Lỗi:', error);
    
    // Check for specific error types
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      alert('Lỗi kết nối đến Apps Script. Có thể do:\n1. Apps Script chưa được deploy đúng cách\n2. Lỗi CORS - hãy thử deploy lại Apps Script\n3. Kiểm tra console (F12) để xem chi tiết lỗi');
    } else {
      alert('Lỗi khi xóa dữ liệu: ' + error.message);
    }
  } finally {
    hideLoadingOverlay();
  }
}

// Handle export
function handleExport() {
  window.open(XLSX_EXPORT_URL, '_blank');
}

// Reset filters
function resetFilters() {
  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  
  if (searchInput) searchInput.value = '';
  if (fromDateInput) fromDateInput.value = '';
  if (toDateInput) toDateInput.value = '';
  
  document.querySelectorAll('.xuong-filter-checkbox').forEach(cb => cb.checked = false);
  
  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = '0';
  
  applyFilters();
}

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích bổ sung
================================================================================ */

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/* =============================================================================
   EVENT LISTENERS
   Khởi tạo các event listeners
================================================================================ */

// Wait for DOM and XLSX to be ready
function initApp() {
  if (typeof XLSX === 'undefined') {
    // XLSX not loaded yet, try again
    setTimeout(initApp, 100);
    return;
  }
  
  // DOM is ready and XLSX is loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      window.location.href = '/pages/dang_nhap.html';
      return;
    }
    
    // Hiển thị tên đăng nhập
    const usernameElement = document.getElementById('currentUsername');
    if (usernameElement && currentUser) {
      usernameElement.textContent = currentUser;
    }
    
    // Load data
    fetchSheetData();
    
    // Button event listeners
    document.getElementById('btnAddData')?.addEventListener('click', showAddDataModal);
    document.getElementById('btnEditData')?.addEventListener('click', showEditDataModal);
    document.getElementById('btnDeleteData')?.addEventListener('click', handleDelete);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);
    document.getElementById('btnExport')?.addEventListener('click', handleExport);
    document.getElementById('btnResetFilter')?.addEventListener('click', resetFilters);
    
    // Form submit handlers
    document.getElementById('addDataForm')?.addEventListener('submit', handleAddSubmit);
    document.getElementById('editDataForm')?.addEventListener('submit', handleEditSubmit);
    
    // Add loại button
    document.getElementById('btnAddLoai')?.addEventListener('click', () => addLoaiRow());
    document.getElementById('btnEditAddLoai')?.addEventListener('click', () => addEditLoaiRow());
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    // Date filters
    document.getElementById('fromDate')?.addEventListener('change', applyFilters);
    document.getElementById('toDate')?.addEventListener('change', applyFilters);
    
    // Pagination
    document.getElementById('pageSelect')?.addEventListener('change', (e) => {
      currentPage = parseInt(e.target.value, 10);
      renderTable();
      updatePagination();
    });
    
    document.getElementById('prevPage')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
      }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
      }
    });
    
    // Logout button
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        localStorage.removeItem('currentUser');
        window.location.href = '/pages/dang_nhap.html';
      }
    });
    
    // Logo click to go home
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', function() {
        window.location.href = '/pages/home.html';
      });
    }
    
    // Hamburger menu
    document.getElementById('hamburger')?.addEventListener('click', () => {
      document.getElementById('mainNav')?.classList.toggle('active');
    });
    
    // Load username (giữ để tương thích ngược)
    const username = localStorage.getItem('currentUser');
    const usernameEl = document.getElementById('currentUsername');
    if (usernameEl) {
      usernameEl.textContent = username || 'Khách';
    }
    
    // Add input event listeners for live total update (add modal)
    document.getElementById('loaiTableBody')?.addEventListener('input', (e) => {
      if (e.target.classList.contains('kg-input')) {
        updateLoaiTotals();
      }
    });
    
    // Add input event listeners for live total update (edit modal)
    document.getElementById('editLoaiTableBody')?.addEventListener('input', (e) => {
      if (e.target.classList.contains('kg-input')) {
        updateEditLoaiTotals();
      }
    });
  });
}

// Test Apps Script connection - gọi từ console: testAppsScript()
window.testAppsScript = async function() {
  console.log('Testing Apps Script connection...');
  console.log('URL:', APPS_SCRIPT_URL);
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const text = await response.text();
    console.log('Apps Script response:', text);
    alert('Kết nối thành công! Xem console để biết chi tiết.');
    return text;
  } catch (error) {
    console.error('Lỗi kết nối:', error);
    alert('Lỗi kết nối: ' + error.message);
    return null;
  }
};

// Start the app
initApp();