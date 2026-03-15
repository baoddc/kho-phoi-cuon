/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho ứng dụng
================================================================================ */

// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';   // ← THAY Ở ĐÂY
const SHEET_GID = '1888497588';                     // gid của sheet (thường là 0 cho sheet đầu)
const XG_TON_GID = '1968603689';                    // gid của sheet xg_ton

// URL để tải file .xlsx (giữ nguyên định dạng từ Google Sheets)
const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;
const XG_TON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${XG_TON_GID}`;

// OPTIONAL: If you want new rows submitted from the UI to be appended
// directly into the Google Sheet, create a Google Apps Script web app
// (see docs/append_to_sheet.md) and paste its URL here.
const APPS_SCRIPT_URL1 = 'https://script.google.com/macros/s/AKfycbwfxUXMJY3x28Nu9O1D-lOT1zcKUv8pg-VhL0Nzd7WCPPGPrkqzmTOLNzQ0KjfRAW5I/exec';

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================


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

// Roll management for Add Data Modal
let rollCount = 0;
let xgTonMaVatTuList = []; // Danh sách Mã vật tư duy nhất từ sheet xg_ton
let xgTonRows = [];         // Tất cả các dòng từ sheet xg_ton: [{maVatTu, kg, cuonId, rowIndex}]

// Edit Roll management for Edit Data Modal
let editRollCount = 0;

/* =============================================================================
   LOADING OVERLAY FUNCTIONS
   Hiển thị overlay khi đang xử lý dữ liệu
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
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1], 10);
      let mo = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(y, mo, d);
    }
    // ISO format or other
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return dt;
    return null;
  }
  return null;
}

// Parse input thành số, hỗ trợ cả dấu phẩy và chấm
function parseNumericInput(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  text = text.replace(/\s+/g, '');

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    // Cả hai dấu - lấy cái nào ở sau cùng
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Chỉ có dấu phẩy
    const parts = text.split(',');
    if (parts.length === 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, '');
    }
  }

  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

// Chuẩn hóa text header để so sánh
function normalizeHeaderText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Tìm index của cột số lượng trong header
function findQuantityColumnIndex(headers) {
  const normalizedHeaders = (headers || []).map(normalizeHeaderText);
  const strongPatterns = [
    /so\s*luong.*kg/,
    /so\s*luong/
  ];

  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (strongPatterns.some(pattern => pattern.test(normalizedHeaders[i]))) {
      return i;
    }
  }
  return -1;
}


/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
================================================================================ */

// Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    window.location.href = '/pages/dang_nhap.html';
    return;
  }
  
  // Hiển thị username
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) usernameEl.textContent = currentUser;
  
  // Xử lý nút đăng xuất
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.replace('/pages/dang_nhap.html');
    });
  }
  
  // Logo click to go home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      window.location.href = '/pages/home.html';
    });
  }
  
  loadGoogleSheet();
});


/* =============================================================================
   DATA LOADING
   Tải dữ liệu từ Google Sheet
================================================================================ */

// Tải dữ liệu khi trang mở
async function loadGoogleSheet() {
  try {
    const response = await fetch(XLSX_EXPORT_URL);
    if (!response.ok) throw new Error("Không thể truy cập Google Sheet (XLSX export)");

    const arrayBuffer = await response.arrayBuffer();

    // Dùng SheetJS đọc file xlsx để giữ định dạng hiển thị (cell.w)
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Chuyển thành mảng 2 chiều; raw:false để lấy text đã format từ sheet (cell.w)
    tableData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    
    if (tableData.length === 0) {
      document.getElementById('loading').innerHTML = "Không có dữ liệu hoặc sheet rỗng";
      return;
    }

    // Filter for XUAT data: Only keep rows containing PX in "Mã chứng từ" column
    const header = tableData[0] || [];
    const voucherColIndex = header.findIndex(h => String(h ?? '').trim().toLowerCase() === 'mã chứng từ'.trim().toLowerCase());
    
    if (voucherColIndex >= 0) {
      const filteredTableData = [tableData[0]]; // Keep header row
      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i];
        let voucherValue = row[voucherColIndex];
        if (voucherValue !== undefined && voucherValue !== null) {
          if (typeof voucherValue !== 'string') {
            voucherValue = String(voucherValue);
          }
          voucherValue = voucherValue.trim();
          // Only keep rows containing PX (Xuất)
          if (voucherValue.includes('PX')) {
            // Skip empty rows (all cells are null, undefined, or empty string)
            const isEmptyRow = row.every(cell => {
              return cell === undefined || cell === null || String(cell).trim() === '';
            });
            if (isEmptyRow) {
              continue;
            }
            filteredTableData.push(row);
          }
        }
      }
      tableData = filteredTableData;
    } else {
      // If no voucher column, still filter empty rows
      const filteredTableData = [tableData[0]]; // Keep header row
      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i];
        
        // Skip empty rows (all cells are null, undefined, or empty string)
        const isEmptyRow = row.every(cell => {
          return cell === undefined || cell === null || String(cell).trim() === '';
        });
        if (isEmptyRow) {
          continue;
        }
        
        filteredTableData.push(row);
      }
      tableData = filteredTableData;
    }

    // Populate filters (dropdowns) from the filtered data
    populateTypeDropdown('Mã chứng từ', 'voucherFilterMenu', 'voucherFilterBtn', 'voucherFilterCount', tableData);

    renderTable(tableData);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('btnExport').disabled = false;
    
    // Gắn sự kiện cho bộ lọc ngày
    setupFilterEventListeners();
    
  } catch (error) {
    document.getElementById('loading').innerHTML = 
      `Lỗi: ${error.message}<br>Kiểm tra xem sheet đã được Publish to web chưa.`;
    console.error(error);
  }
}

// Thiết lập các sự kiện cho bộ lọc
function setupFilterEventListeners() {
  const btnReset = document.getElementById('btnResetFilter');
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const searchInput = document.getElementById('searchInput');
  
  // Nút reset bộ lọc
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      if (searchInput) searchInput.value = '';
      
      // Reset voucher filter
      const voucherMenu = document.getElementById('voucherFilterMenu');
      if (voucherMenu) {
        voucherMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const count = document.getElementById('voucherFilterCount'); 
        if (count) count.textContent = '0';
      }
      
      renderTable(tableData);
    });
  }
  
  // Sự kiện thay đổi ngày
  if (fromInput) fromInput.addEventListener('change', filterTable);
  if (toInput) toInput.addEventListener('change', filterTable);
  
  // Sự kiện search với debounce
  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }
}


/* =============================================================================
   TABLE RENDERING
   Hiển thị dữ liệu ra bảng
================================================================================ */

// Render bảng dữ liệu
// resetPage: nếu true sẽ reset về trang 1, false giữ nguyên trang hiện tại
function renderTable(data, resetPage = true) {
  // Store filtered data for pagination
  filteredData = data;
  if (resetPage) {
    currentPage = 1;
  }
  renderTableWithPagination();
}

// Render dữ liệu của trang hiện tại
function renderTableData(data) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Header with checkbox
  const headerRow = document.createElement('tr');
  
  // Checkbox column header
  const thCheckbox = document.createElement('th');
  thCheckbox.style.width = '50px';
  thCheckbox.innerHTML = '<input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả">';
  headerRow.appendChild(thCheckbox);
  
  // Data column headers
  data[0].forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  // Setup select all checkbox
  setTimeout(() => {
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
        });
        updateSelectedRows();
      });
    }
  }, 0);

  // Cập nhật dữ liệu đang hiển thị
  selectedRowIndex = -1;
  selectedRowIndexes = [];
  document.getElementById('btnEditData').disabled = true;
  document.getElementById('btnDeleteData').disabled = true;
  document.getElementById('btnDeleteData').textContent = 'Xóa dữ liệu';

  // Dữ liệu (bỏ dòng đầu)
  for (let i = 1; i < data.length; i++) {
    const originalIndex = tableData.indexOf(data[i]);
    const row = document.createElement('tr');
    row.dataset.rowIndex = String(originalIndex);
    
    // Checkbox cell
    const tdCheckbox = document.createElement('td');
    tdCheckbox.innerHTML = `<input type="checkbox" class="row-checkbox" value="${originalIndex}">`;
    row.appendChild(tdCheckbox);
    
    data[i].forEach((cell, colIndex) => {
      const td = document.createElement('td');
      // Cột ngày (index 2) - format đặc biệt
      if (colIndex === 2) {
        if (cell === undefined || cell === null) {
          td.textContent = '';
        } else if (typeof cell === 'string') {
          td.textContent = cell;
        } else {
          td.textContent = formatDate(cell);
        }
      } else {
        td.textContent = cell ?? '';
      }
      row.appendChild(td);
    });
    
    // Sự kiện click chọn dòng (only if not clicking checkbox)
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-checkbox')) return;
      document.querySelectorAll('#dataTable tbody tr').forEach(r => r.classList.remove('table-active'));
      row.classList.add('table-active');
      selectedRowIndex = Number(row.dataset.rowIndex);
      document.getElementById('btnEditData').disabled = false;
      document.getElementById('btnDeleteData').disabled = false;
    });
    
    tbody.appendChild(row);
  }

  // Add event delegation for checkbox changes
  tbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) {
      updateSelectedRows();
    }
  });

  enableColumnResize(table);
  updateCellTitles(table);
}

// Cập nhật title cho các cell bị tràn
function updateCellTitles(table) {
  if (!table) return;
  table.querySelectorAll('th, td').forEach(cell => {
    if (cell.scrollWidth > cell.clientWidth + 1) cell.title = (cell.textContent || '').trim();
    else cell.removeAttribute('title');
  });
}

// Update selected rows from checkboxes
function updateSelectedRows() {
  const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
  selectedRowIndexes = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedRowIndexes.push(parseInt(cb.value, 10));
    }
  });
  
  // Enable/disable buttons based on selection
  const btnEdit = document.getElementById('btnEditData');
  const btnDelete = document.getElementById('btnDeleteData');
  
  if (selectedRowIndexes.length > 0) {
    btnDelete.disabled = false;
    // Edit only enabled for single selection
    btnEdit.disabled = selectedRowIndexes.length !== 1;
    // Update button text to show count
    if (selectedRowIndexes.length > 1) {
      btnDelete.textContent = `Xóa (${selectedRowIndexes.length})`;
    } else {
      btnDelete.textContent = 'Xóa dữ liệu';
    }
  } else {
    btnEdit.disabled = true;
    btnDelete.disabled = true;
    btnDelete.textContent = 'Xóa dữ liệu';
  }
  
  // Update selectedRowIndex for single selection
  if (selectedRowIndexes.length === 1) {
    selectedRowIndex = selectedRowIndexes[0];
  } else {
    selectedRowIndex = -1;
  }
}

// Window resize - cập nhật titles
window.addEventListener('resize', () => updateCellTitles(document.getElementById('dataTable')));


/* =============================================================================
   COLUMN RESIZE
   Chức năng thay đổi độ rộng cột
================================================================================ */

// Attach resizer handles to table header cells to allow dragging column widths
function enableColumnResize(table) {
  if (!table) return;
  const thead = table.querySelector('thead');
  if (!thead) return;
  const ths = Array.from(thead.querySelectorAll('th'));

  ths.forEach((th, index) => {
    const old = th.querySelector('.col-resizer');
    if (old) old.remove();

    th.style.position = th.style.position || 'sticky';

    const resizer = document.createElement('div');
    resizer.className = 'col-resizer';
    th.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    function onMouseMove(e) {
      const newWidth = Math.max(40, startWidth + (e.clientX - startX));
      th.style.width = newWidth + 'px';
      const tb = table.tBodies?.[0];
      if (tb) for (const row of tb.rows) {
        const cell = row.children[index]; if (cell) cell.style.width = newWidth + 'px';
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault(); 
      startX = e.clientX; 
      startWidth = th.offsetWidth;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}


/* =============================================================================
   PAGINATION
   Các chức năng phân trang
================================================================================ */

function calculatePagination(data) {
  totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
}

function getPageData(data) {
  if (!data || data.length === 0) return [];
  
  calculatePagination(data);
  
  // Data includes header row at index 0
  const startRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow = Math.min(startRow + ROWS_PER_PAGE, data.length);
  
  return data.slice(0, 1).concat(data.slice(startRow, endRow));
}

function updatePaginationControls() {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');
  
  if (pageInfo) {
    pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
  
  // Update page select dropdown if exists
  if (pageSelect) {
    const currentVal = parseInt(pageSelect.value, 10);
    if (currentVal !== currentPage || pageSelect.options.length !== totalPages) {
      pageSelect.innerHTML = '';
      for (let i = 1; i <= totalPages; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Trang ${i}`;
        if (i === currentPage) opt.selected = true;
        pageSelect.appendChild(opt);
      }
    }
  }
}

function goToPage(page) {
  const newPage = parseInt(page, 10);
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderTableWithPagination();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderTableWithPagination();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTableWithPagination();
  }
}

function renderTableWithPagination() {
  // Use filteredData if available, otherwise use tableData
  const dataToPaginate = filteredData.length > 0 ? filteredData : tableData;
  const pageData = getPageData(dataToPaginate);
  
  renderTableData(pageData);
  updatePaginationControls();
  
  // Update displayedData to include all filtered data for export
  displayedData = dataToPaginate;
}


/* =============================================================================
   FILTERING
   Các chức năng lọc dữ liệu
================================================================================ */

// Debounced filter function for better performance
const debouncedFilter = debounce(filterTable, 300);

function filterTable() {
  const fromVal = document.getElementById('fromDate')?.value || '';
  const toVal = document.getElementById('toDate')?.value || '';
  const searchVal = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';
  
  // Voucher filter
  const voucherMenu = document.getElementById('voucherFilterMenu');
  const voucherSelected = voucherMenu ? Array.from(voucherMenu.querySelectorAll('input[type="checkbox"]:checked')).map(i => String(i.value).trim()).filter(Boolean) : [];
  const voucherColIndex = voucherMenu && voucherMenu.dataset && voucherMenu.dataset.colIndex ? parseInt(voucherMenu.dataset.colIndex, 10) : -1;
  
  const from = fromVal ? new Date(fromVal) : null;
  const to = toVal ? new Date(toVal) : null;
  if (from) from.setHours(0,0,0,0);
  if (to) to.setHours(23,59,59,999);
  const needsDateFilter = !!from || !!to;
  
  // Search columns: column 6 (index 5) = Mã vật tư, column 7 (index 6) = Tên vật tư
  const searchColIndex1 = 5; // Column 6 (0-indexed)
  const searchColIndex2 = 6; // Column 7 (0-indexed)
  const needsSearchFilter = searchVal !== '';

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];

    // Date filter
    if (needsDateFilter) {
      const rawDate = row[2];
      const d = parseRowDate(rawDate);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
    }

    // Voucher filter
    if (voucherSelected.length > 0 && voucherColIndex >= 0) {
      let vv = row[voucherColIndex];
      if (vv === undefined || vv === null) continue;
      if (typeof vv !== 'string') {
        if (typeof vv === 'number') vv = String(vv);
        else if (vv instanceof Date) vv = formatDate(vv);
        else vv = String(vv);
      }
      if (!voucherSelected.includes(vv.trim())) continue;
    }
    
    // Search filter: check columns 6 (Mã vật tư) and 7 (Tên vật tư)
    if (needsSearchFilter) {
      let matchFound = false;
      
      // Check column 6 (Mã vật tư)
      if (searchColIndex1 < row.length) {
        let val1 = row[searchColIndex1];
        if (val1 !== undefined && val1 !== null) {
          if (typeof val1 !== 'string') val1 = String(val1);
          if (val1.toLowerCase().includes(searchVal)) {
            matchFound = true;
          }
        }
      }
      
      // Check column 7 (Tên vật tư) if not found in column 6
      if (!matchFound && searchColIndex2 < row.length) {
        let val2 = row[searchColIndex2];
        if (val2 !== undefined && val2 !== null) {
          if (typeof val2 !== 'string') val2 = String(val2);
          if (val2.toLowerCase().includes(searchVal)) {
            matchFound = true;
          }
        }
      }
      
      if (!matchFound) continue;
    }

    filtered.push(row);
  }

  renderTable(filtered);
}

// Populate dropdown cho filter
function populateTypeDropdown(headerName, menuId, btnId, countId, data) {
  if (!data || data.length === 0) return;
  const header = data[0] || [];
  const idx = header.findIndex(h => String(h ?? '').trim().toLowerCase() === String(headerName).trim().toLowerCase());
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById(countId);
  if (!menu) return;
  menu.innerHTML = '';
  if (idx === -1) {
    const none = document.createElement('div'); 
    none.className = 'text-muted small'; 
    none.textContent = 'Không tìm thấy cột';
    menu.appendChild(none);
    if (countEl) countEl.textContent = '0';
    return;
  }

  const set = new Set();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let v = row[idx];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      if (typeof v === 'number') v = String(v);
      else if (v instanceof Date) v = formatDate(v);
    }
    v = v.trim();
    if (v === '') continue;
    
    set.add(v);
  }

  const arr = Array.from(set).sort((a,b) => a.localeCompare(b, 'vi'));

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
    if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
    filterTable();
  });
  clr.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    if (countEl) countEl.textContent = '0';
    filterTable();
  });

  // Checkbox options
  arr.forEach((v, i) => {
    const id = `typeOpt_${i}`;
    const wrap = document.createElement('div'); 
    wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input'; 
    input.type = 'checkbox'; 
    input.value = v; 
    input.id = id;
    const label = document.createElement('label'); 
    label.className = 'form-check-label'; 
    label.htmlFor = id; 
    label.textContent = v;
    wrap.appendChild(input); 
    wrap.appendChild(label);
    menu.appendChild(wrap);

    input.addEventListener('change', () => {
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      filterTable();
    });
  });

  if (countEl) countEl.textContent = '0';
  menu.dataset.colIndex = String(idx);
}


/* =============================================================================
   EXPORT
   Chức năng xuất dữ liệu ra file Excel
================================================================================ */

document.getElementById('btnExport').addEventListener('click', () => {
  if (!displayedData || displayedData.length === 0) return;

  const ws = XLSX.utils.aoa_to_sheet(displayedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu");

  // Auto-fit column widths
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({c:C, r:R})];
      if (cell && cell.v) {
        const len = String(cell.v).length;
        if (len > maxWidth) maxWidth = len;
      }
    }
    ws['!cols'] = ws['!cols'] || [];
    ws['!cols'][C] = { wch: Math.min(60, maxWidth + 2) };
  }

  XLSX.writeFile(wb, "xg_du_lieu_xuat.xlsx");
});


/* =============================================================================
   MODAL MANAGEMENT
   Quản lý các modal (Add/Edit/Delete)
================================================================================ */

// Hàm helper để kiểm tra quyền và vô hiệu hóa input trong modal
function setupModalPermissions(modalEl) {
  const currentUser = localStorage.getItem('currentUser');
  const isAdmin = currentUser === 'bao.lt';
  
  if (!modalEl) return isAdmin;
  
  // Vô hiệu hóa tất cả các input, select, textarea trong modal
  const inputs = modalEl.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.disabled = !isAdmin;
  });
  
  // Ẩn/hiện các nút hành động
  const submitBtn = modalEl.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.style.display = isAdmin ? '' : 'none';
  }
  
  // Ẩn nút thêm cuộn (btnAddRoll, btnEditAddRoll)
  const btnAddRoll = modalEl.querySelector('#btnAddRoll, #btnEditAddRoll, #addRollBtn, #editAddRollBtn');
  if (btnAddRoll) {
    btnAddRoll.style.display = isAdmin ? '' : 'none';
  }
  
  // Ẩn nút xóa cuộn (btnRemoveRoll)
  const btnRemoveRolls = modalEl.querySelectorAll('.btn-remove-roll, .remove-roll-btn');
  btnRemoveRolls.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });
  
  return isAdmin;
}

// ===== ADD DATA MODAL =====

function openAddDataModal() {
  const modalEl = document.getElementById('addDataModal'); 
  if (!modalEl) return;
  
  // Thiết lập quyền cho modal
  setupModalPermissions(modalEl);
  
  const commonFieldsContainer = document.getElementById('addDataCommonFields'); 
  const additionalFieldsContainer = document.getElementById('addDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;
  
  // Reset form
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';
  
  const rollsTableBody = document.getElementById('rollsTableBody');
  if (rollsTableBody) rollsTableBody.innerHTML = '';
  rollCount = 0;
  updateRollTotals();
  
  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const quantityColIndex = findQuantityColumnIndex(headers);
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];
  
  // Get next sequence number
  function getNextSequence() {
    if (!tableData || tableData.length <= 1) return 1;
    let max = 0;
    for (let r = 1; r < tableData.length; r++) {
      const v = tableData[r][0];
      if (v === undefined || v === null) continue;
      const n = (typeof v === 'number') ? v : (typeof v === 'string' ? parseInt(String(v).replace(/\D+/g, ''), 10) : NaN);
      if (!isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }
  const nextSeq = getNextSequence();

  // STT column (readonly)
  const sttCol = document.createElement('div'); 
  sttCol.className = 'col-12 col-md-6';
  sttCol.innerHTML = `
    <label class="form-label">${headers[0] || 'STT'}</label>
    <input type="number" class="form-control form-control-sm fw-bold" name="col_0" 
           step="1" value="${nextSeq}" readonly>
  `;
  commonFieldsContainer.appendChild(sttCol);

  // Common columns
  commonColIndices.forEach(colIdx => {
    if (colIdx >= headers.length) return;
    
    const col = document.createElement('div'); 
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label'); 
    label.className = 'form-label';
    label.textContent = headers[colIdx] || `Cột ${colIdx+1}`;

    // Column 1: Loại nhập/xuất (PX dropdown for xuất)
    if (colIdx === 1) {
      const select = document.createElement('select');
      select.className = 'form-select form-select-sm fw-bold';
      select.name = `col_${colIdx}`;
      ['PX'].forEach(v => {
        const opt = document.createElement('option'); 
        opt.value = v; 
        opt.textContent = v; 
        select.appendChild(opt);
      });
      col.appendChild(label); 
      col.appendChild(select); 
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 2: Ngày (date input)
    if (colIdx === 2) {
      const dateInput = document.createElement('input');
      dateInput.className = 'form-control form-control-sm fw-bold';
      dateInput.name = `col_${colIdx}`;
      dateInput.type = 'date';
      col.appendChild(label); 
      col.appendChild(dateInput); 
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 3: Mã chứng từ (dropdown)
    if (colIdx === 3) {
      const headerName = String(headers[colIdx] || '').toLowerCase().trim();
      if (headerName.includes('mã chứng từ')) {
        const voucherSet = new Set();
        for (let i = 1; i < tableData.length; i++) {
          let v = tableData[i][colIdx];
          if (v === undefined || v === null) continue;
          if (typeof v !== 'string') v = String(v);
          v = v.trim();
          if (v === '') continue;
          voucherSet.add(v);
        }
        
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Chọn mã --';
        select.appendChild(defaultOpt);
        
        Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          select.appendChild(opt);
        });
        
        col.appendChild(label); 
        col.appendChild(select); 
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Default: text input
    const input = document.createElement('input');
    input.className = 'form-control form-control-sm fw-bold';
    input.name = `col_${colIdx}`;
    input.type = 'text';
    col.appendChild(label); 
    col.appendChild(input); 
    commonFieldsContainer.appendChild(col);
  });

  // Additional columns (after quantity)
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i+1}`).toLowerCase().trim();
    
    const col = document.createElement('div'); 
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label'); 
    label.className = 'form-label';
    
    let input;
    // Số cuộn - readonly
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i+1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
    }
    
    col.appendChild(label); 
    col.appendChild(input); 
    additionalFieldsContainer.appendChild(col);
  }
  
  modalEl.dataset.quantityColIndex = quantityColIndex;
  
  // Populate roll dropdown from xg_ton
  populateRollDropdown();

  // Prevent dropdown from closing when clicking inside
  const rollSelectMenu = document.getElementById('rollSelectMenu');
  if (rollSelectMenu) {
    rollSelectMenu.addEventListener('click', e => e.stopPropagation());
  }

  // Roll search filter (hidden input, synced from Mã vật tư field)
  const rollSearchInput = document.getElementById('rollSearchInput');
  if (rollSearchInput) {
    rollSearchInput.value = '';
    rollSearchInput.oninput = () => filterRollDropdown();
  }

  // Auto-filter roll dropdown when Mã vật tư field (col_5) changes
  const maVatTuInput = commonFieldsContainer.querySelector('input[name="col_5"]') ||
                       commonFieldsContainer.querySelector('select[name="col_5"]');
  if (maVatTuInput) {
    const syncMaVatTu = () => {
      const val = maVatTuInput.value.trim();
      if (rollSearchInput) {
        rollSearchInput.value = val;
      }
      filterRollDropdown();
    };
    maVatTuInput.addEventListener('input', syncMaVatTu);
    maVatTuInput.addEventListener('change', syncMaVatTu);
  }

  // Show warning in dropdown if Mã vật tư not filled when dropdown opens
  const addRollDropdownWrapper = document.getElementById('addRollDropdownWrapper');
  if (addRollDropdownWrapper) {
    addRollDropdownWrapper.addEventListener('show.bs.dropdown', () => {
      const val = maVatTuInput ? maVatTuInput.value.trim() : '';
      if (!val) {
        const listEl = document.getElementById('rollCheckboxList');
        if (listEl) {
          listEl.innerHTML = '<div class="text-warning fw-bold small text-center py-2">Vui lòng nhập mã vật tư</div>';
        }
      }
    });
  }

  // Show modal
  const bsModal = new bootstrap.Modal(modalEl); 
  bsModal.show();
}


// ===== EDIT DATA MODAL =====

function openEditDataModal() {
  const currentUser = localStorage.getItem('currentUser');
  
  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa');
    return;
  }
  
  const modalEl = document.getElementById('editDataModal'); 
  if (!modalEl) return;
  
  // Thiết lập quyền cho modal (sẽ vô hiệu hóa input nếu không phải bao.lt)
  setupModalPermissions(modalEl);
  
  const commonFieldsContainer = document.getElementById('editDataCommonFields'); 
  const additionalFieldsContainer = document.getElementById('editDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;
  
  // Reset form
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';
  
  const editRollsTableBody = document.getElementById('editRollsTableBody');
  if (editRollsTableBody) editRollsTableBody.innerHTML = '';
  editRollCount = 0;
  updateEditRollTotals();
  
  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const quantityColIndex = findQuantityColumnIndex(headers);
  const rowData = tableData[selectedRowIndex];
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];
  
  // STT column
  const sttCol = document.createElement('div'); 
  sttCol.className = 'col-12 col-md-6';
  sttCol.innerHTML = `
    <label class="form-label">${headers[0] || 'STT'}</label>
    <input type="number" class="form-control form-control-sm fw-bold" name="col_0" 
           step="1" value="${rowData[0] ?? ''}" readonly>
  `;
  commonFieldsContainer.appendChild(sttCol);

  // Common columns
  commonColIndices.forEach(colIdx => {
    if (colIdx >= headers.length) return;
    
    const col = document.createElement('div'); 
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label'); 
    label.className = 'form-label';
    label.textContent = headers[colIdx] || `Cột ${colIdx+1}`;

    // Column 1: Loại nhập/xuất (PX for xuất)
    if (colIdx === 1) {
      const select = document.createElement('select');
      select.className = 'form-select form-select-sm fw-bold';
      select.name = `col_${colIdx}`;
      ['PX'].forEach(v => {
        const opt = document.createElement('option'); 
        opt.value = v; 
        opt.textContent = v; 
        select.appendChild(opt);
      });
      select.value = rowData[colIdx] ?? '';
      col.appendChild(label); 
      col.appendChild(select); 
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 2: Ngày
    if (colIdx === 2) {
      const dateInput = document.createElement('input');
      dateInput.className = 'form-control form-control-sm fw-bold';
      dateInput.name = `col_${colIdx}`;
      dateInput.type = 'date';
      
      // Convert dd/mm/yyyy to yyyy-mm-dd
      const dateStr = rowData[colIdx];
      if (dateStr && typeof dateStr === 'string') {
        const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let d = String(m[1]).padStart(2, '0');
          let mo = String(m[2]).padStart(2, '0');
          let y = m[3]; 
          if (y.length === 2) y = (parseInt(y, 10) < 50 ? '20' : '19') + y;
          dateInput.value = `${y}-${mo}-${d}`;
        }
      }
      
      col.appendChild(label); 
      col.appendChild(dateInput); 
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 3: Mã chứng từ
    if (colIdx === 3) {
      const headerName = String(headers[colIdx] || '').toLowerCase().trim();
      if (headerName.includes('mã chứng từ')) {
        const voucherSet = new Set();
        for (let i = 1; i < tableData.length; i++) {
          let v = tableData[i][colIdx];
          if (v === undefined || v === null) continue;
          if (typeof v !== 'string') v = String(v);
          v = v.trim();
          if (v === '') continue;
          voucherSet.add(v);
        }
        
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Chọn mã --';
        select.appendChild(defaultOpt);
        
        Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          select.appendChild(opt);
        });
        
        select.value = rowData[colIdx] ?? '';
        col.appendChild(label); 
        col.appendChild(select); 
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Default: text input
    const input = document.createElement('input');
    input.className = 'form-control form-control-sm fw-bold';
    input.name = `col_${colIdx}`;
    input.type = 'text';
    input.value = rowData[colIdx] ?? '';
    col.appendChild(label); 
    col.appendChild(input); 
    commonFieldsContainer.appendChild(col);
  });

  // Existing kg - add as first roll
  let existingKg = '';
  if (quantityColIndex >= 0 && rowData[quantityColIndex] !== undefined) {
    const parsed = parseNumericInput(rowData[quantityColIndex]);
    if (parsed !== null && parsed > 0) {
      existingKg = String(parsed);
    }
  }
  addEditRollRow(existingKg);

  // Additional columns
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i+1}`).toLowerCase().trim();
    
    const col = document.createElement('div'); 
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label'); 
    label.className = 'form-label';
    
    let input;
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i+1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';
    }
    
    col.appendChild(label); 
    col.appendChild(input); 
    additionalFieldsContainer.appendChild(col);
  }
  
  modalEl.dataset.quantityColIndex = quantityColIndex;
  
  // Add roll button
  const btnEditAddRoll = document.getElementById('btnEditAddRoll');
  if (btnEditAddRoll) {
    btnEditAddRoll.onclick = () => addEditRollRow();
  }

  // Show modal
  const bsModal = new bootstrap.Modal(modalEl); 
  bsModal.show();
}


// ===== DELETE DATA MODAL =====

function openDeleteDataModal() {
  // Get selected rows from checkboxes
  updateSelectedRows();
  
  if (selectedRowIndexes.length === 0) {
    alert('Vui lòng chọn ít nhất một dòng để xóa');
    return;
  }
  
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
  
  // Thiết lập quyền cho modal xóa - ẩn nút xóa nếu không phải bao.lt
  const currentUser = localStorage.getItem('currentUser');
  const isAdmin = currentUser === 'bao.lt';
  const deleteBtn = modalEl.querySelector('#btnConfirmDelete');
  if (deleteBtn) {
    deleteBtn.style.display = isAdmin ? '' : 'none';
  }
  
  const bsModal = new bootstrap.Modal(modalEl); 
  bsModal.show();
}


/* =============================================================================
   ROLL MANAGEMENT
   Quản lý danh sách cuộn (Add/Edit)
================================================================================ */

// ===== ADD ROLL =====

// Fetch tất cả dòng từ sheet xg_ton (column 4 = index 3 = Mã vật tư)
async function fetchXgTonMaVatTu() {
  if (xgTonRows.length > 0) return; // already loaded
  try {
    const resp = await fetch(XG_TON_URL);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) return;

    // Find kg column and cuonId column from header row
    const headerRow = rows[0].map(h => String(h || '').toLowerCase().trim());
    let kgColIndex = -1;
    let cuonIdColIndex = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const h = headerRow[c];
      if (kgColIndex < 0 && (h.includes('kg') || h.includes('số lượng') || h.includes('tồn'))) {
        kgColIndex = c;
      }
      if (cuonIdColIndex < 0 && (h.includes('cuộn') || h.includes('cuon') || h === 'id' || h.includes('cuon id') || h.includes('cuộn id') || h.includes('roll id'))) {
        cuonIdColIndex = c;
      }
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const val = rows[i][3];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const maVatTu = String(val).trim();
        let kg = null;
        if (kgColIndex >= 0) {
          const kgVal = rows[i][kgColIndex];
          const parsed = parseFloat(String(kgVal || '').replace(',', '.'));
          if (!isNaN(parsed)) kg = parsed;
        }
        let cuonId = '';
        if (cuonIdColIndex >= 0) {
          cuonId = String(rows[i][cuonIdColIndex] || '').trim();
        }
        result.push({ maVatTu, kg, cuonId, rowIndex: i });
      }
    }
    xgTonRows = result;
    xgTonMaVatTuList = [...new Set(result.map(r => r.maVatTu))].sort((a, b) => a.localeCompare(b, 'vi'));
  } catch (e) {
    console.error('Lỗi tải xg_ton:', e);
  }
}

// Populate dropdown checkbox list
async function populateRollDropdown() {
  const listEl = document.getElementById('rollCheckboxList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="text-warning fw-bold small text-center py-2">Vui lòng nhập mã vật tư</div>';
  fetchXgTonMaVatTu();
}

function renderRollCheckboxList(items) {
  const listEl = document.getElementById('rollCheckboxList');
  if (!listEl) return;
  if (!items || items.length === 0) {
    listEl.innerHTML = '<div class="text-muted small text-center py-2">Không có dữ liệu</div>';
    return;
  }
  listEl.innerHTML = '';
  items.forEach(item => {
    const { maVatTu, kg, cuonId, rowIndex } = item;
    const rowKey = `${maVatTu}__${rowIndex}`;
    const alreadyAdded = !!document.querySelector(`#rollsTableBody tr[data-rowkey="${CSS.escape(rowKey)}"]`);
    const kgLabel = (kg !== null && kg !== undefined) ? ` <span class="text-muted">(${kg.toLocaleString('vi-VN')} kg)</span>` : '';
    const cbId = `rollcb_${rowKey.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `
      <input class="form-check-input roll-select-cb" type="checkbox"
             id="${cbId}" data-rowkey="${rowKey}" value="${maVatTu}" ${alreadyAdded ? 'checked' : ''}>
      <label class="form-check-label small" for="${cbId}">${maVatTu}${kgLabel}</label>
    `;
    const cb = div.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) {
        addRollRow(maVatTu, kg !== null && kg !== undefined ? String(kg) : '', rowKey, cuonId || '');
      } else {
        const existingRow = document.querySelector(`#rollsTableBody tr[data-rowkey="${CSS.escape(rowKey)}"]`);
        if (existingRow) {
          existingRow.remove();
          updateRollNumbers();
          updateRollTotals();
        }
      }
    });
    listEl.appendChild(div);
  });
}

function filterRollDropdown() {
  const q = (document.getElementById('rollSearchInput')?.value || '').trim();
  const listEl = document.getElementById('rollCheckboxList');
  if (!q) {
    if (listEl) {
      listEl.innerHTML = '<div class="text-warning fw-bold small text-center py-2">Vui lòng nhập mã vật tư</div>';
    }
    return;
  }
  // Exact match (case-insensitive)
  const filtered = xgTonRows.filter(r => r.maVatTu.toLowerCase() === q.toLowerCase());
  if (filtered.length === 0) {
    if (listEl) {
      listEl.innerHTML = '<div class="text-danger fw-bold small text-center py-2">Mã vật tư không tồn tại trong kho</div>';
    }
    return;
  }
  renderRollCheckboxList(filtered);
}

function addRollRow(maVatTu = '', kgValue = '', rowKey = '', cuonIdValue = '') {
  // Avoid duplicate by rowKey (if provided)
  if (rowKey && document.querySelector(`#rollsTableBody tr[data-rowkey="${CSS.escape(rowKey)}"]`)) return;
  rollCount++;
  const tbody = document.getElementById('rollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = rollCount;
  if (maVatTu) tr.dataset.mavt = maVatTu;
  if (rowKey) tr.dataset.rowkey = rowKey;
  tr.innerHTML = `
    <td class="text-center roll-stt">${rollCount}</td>
    <td class="roll-mavt-cell">${maVatTu || ''}</td>
    <td>
      <input type="text" class="form-control form-control-sm roll-cuon-id"
             placeholder="Cuộn ID" value="${cuonIdValue}">
    </td>
    <td>
      <input type="number" class="form-control form-control-sm roll-kg"
             step="any" min="0" inputMode="decimal"
             placeholder="Nhập số kg" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-roll">X</button>
    </td>
  `;
  tbody.appendChild(tr);
  
  // Remove button
  tr.querySelector('.btn-remove-roll').addEventListener('click', () => {
    const rk = tr.dataset.rowkey;
    tr.remove();
    updateRollNumbers();
    updateRollTotals();
    if (rk) {
      const cb = document.querySelector(`#rollCheckboxList input[data-rowkey="${CSS.escape(rk)}"]`);
      if (cb) cb.checked = false;
    }
  });
  
  // Input change
  tr.querySelector('.roll-kg').addEventListener('input', updateRollTotals);
  
  updateRollTotals();
}

function updateRollNumbers() {
  const rows = document.querySelectorAll('#rollsTableBody tr');
  rows.forEach((row, index) => {
    row.querySelector('.roll-stt').textContent = index + 1;
  });
}

function updateRollTotals() {
  const rows = document.querySelectorAll('#rollsTableBody tr');
  let totalKg = 0;
  let rollsWithKg = 0;
  
  rows.forEach(row => {
    const kgInput = row.querySelector('.roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) {
        totalKg += parsed;
        rollsWithKg++;
      }
    }
  });
  
  document.getElementById('totalRollsCount').textContent = rollsWithKg;
  document.getElementById('totalKg').textContent = totalKg.toFixed(2);
  
  // Update readonly "Số cuộn" field
  const allInputs = document.querySelectorAll('#addDataAdditionalFields input');
  allInputs.forEach(input => {
    if (input.readOnly && input.style.backgroundColor === 'rgb(233, 236, 239)') {
      input.value = rollsWithKg;
    }
  });
}

// ===== EDIT ROLL =====

function addEditRollRow(kgValue = '') {
  editRollCount++;
  const tbody = document.getElementById('editRollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = editRollCount;
  tr.innerHTML = `
    <td class="text-center edit-roll-stt">${editRollCount}</td>
    <td>
      <input type="number" class="form-control form-control-sm edit-roll-kg" 
             step="any" min="0" inputMode="decimal" 
             placeholder="Nhập số kg" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-edit-roll">X</button>
    </td>
  `;
  tbody.appendChild(tr);
  
  // Remove button
  tr.querySelector('.btn-remove-edit-roll').addEventListener('click', () => {
    tr.remove();
    updateEditRollNumbers();
    updateEditRollTotals();
  });
  
  // Input change
  tr.querySelector('.edit-roll-kg').addEventListener('input', updateEditRollTotals);
  
  updateEditRollTotals();
}

function updateEditRollNumbers() {
  const rows = document.querySelectorAll('#editRollsTableBody tr');
  rows.forEach((row, index) => {
    row.querySelector('.edit-roll-stt').textContent = index + 1;
  });
}

function updateEditRollTotals() {
  const rows = document.querySelectorAll('#editRollsTableBody tr');
  let totalKg = 0;
  let rollsWithKg = 0;
  
  rows.forEach(row => {
    const kgInput = row.querySelector('.edit-roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) {
        totalKg += parsed;
        rollsWithKg++;
      }
    }
  });
  
  document.getElementById('editTotalRollsCount').textContent = rollsWithKg;
  document.getElementById('editTotalKg').textContent = totalKg.toFixed(2);
  
  // Update readonly "Số cuộn" field
  const allInputs = document.querySelectorAll('#editDataAdditionalFields input');
  allInputs.forEach(input => {
    if (input.readOnly && input.style.backgroundColor === 'rgb(233, 236, 239)') {
      input.value = rollsWithKg;
    }
  });
}


/* =============================================================================
   FORM HANDLERS
   Xử lý submit form (Add/Edit/Delete)
================================================================================ */

document.addEventListener('submit', async (e) => {
  try {
    // ===== ADD DATA FORM =====
    if (e.target && e.target.id === 'addDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      let originalText = submitBtn ? submitBtn.textContent : 'Thêm';
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang thêm...';
      }
      
      // Show loading overlay
      showLoadingOverlay('Đang thêm dữ liệu...');
      
      // Collect form values
      const commonInputs = Array.from(form.querySelectorAll('#addDataCommonFields input[name^="col_"], #addDataCommonFields select[name^="col_"]'));
      const additionalInputs = Array.from(form.querySelectorAll('#addDataAdditionalFields input[name^="col_"], #addDataAdditionalFields select[name^="col_"]'));
      
      const addDataModalForIndex = document.getElementById('addDataModal');
      const quantityColIndex = parseInt(addDataModalForIndex?.dataset?.quantityColIndex || '-1', 10);
      
      // Get roll kg values + maVatTu + cuonId
      const rollRows = document.querySelectorAll('#rollsTableBody tr');
      const rollData = [];
      rollRows.forEach(row => {
        const kgInput = row.querySelector('.roll-kg');
        const cuonIdInput = row.querySelector('.roll-cuon-id');
        const maVatTu = row.dataset.mavt || '';
        const cuonId = cuonIdInput ? cuonIdInput.value.trim() : '';
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            rollData.push({ kg: parsed, maVatTu, cuonId });
          }
        }
      });
      
      if (rollData.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        return;
      }
      
      // Build row values
      const commonValues = commonInputs.map(inp => inp.value ?? '');
      commonValues.splice(quantityColIndex, 0, '');
      const additionalValues = additionalInputs.map(inp => inp.value ?? '');
      
      // Mã vật tư column index in xuat sheet (index 5)
      const maVatTuColIndex = 5;
      // Cuộn ID column index (column N = index 13)
      const cuonIdColIndex = 13;
      
      // Create one row per roll
      const rowsToAdd = rollData.map(({ kg, maVatTu, cuonId }) => {
        const newRow = [...commonValues];
        newRow[quantityColIndex] = String(kg);
        if (maVatTu && maVatTuColIndex < newRow.length) {
          newRow[maVatTuColIndex] = maVatTu;
        }
        newRow.push(...additionalValues);
        while (newRow.length <= cuonIdColIndex) newRow.push('');
        newRow[cuonIdColIndex] = cuonId || '';
        return newRow;
      });
      
      // Ensure all rows have same length
      const maxCols = Math.max(...rowsToAdd.map(r => r.length));
      rowsToAdd.forEach(row => {
        while (row.length < maxCols) row.push('');
      });
      
      // Convert date to dd/mm/yyyy
      rowsToAdd.forEach(newRow => {
        if (newRow.length > 2 && newRow[2]) {
          const iso = newRow[2];
          const dt = new Date(iso);
          if (!isNaN(dt.getTime())) {
            const d = String(dt.getDate()).padStart(2, '0');
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const y = dt.getFullYear();
            newRow[2] = `${d}/${m}/${y}`;
          }
        }
      });
      
      // Send to Google Apps Script
      if (typeof APPS_SCRIPT_URL1 === 'string' && APPS_SCRIPT_URL1.trim()) {
        for (const newRow of rowsToAdd) {
          const body = new URLSearchParams();
          body.set('values', JSON.stringify(newRow));
          const resp = await fetch(APPS_SCRIPT_URL1, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });
          const text = await resp.text();
          let j = null;
          try { j = JSON.parse(text); } catch (_) { j = null; }
          if (!resp.ok || (j && j.result && j.result !== 'success')) {
            throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
          }
        }
      }

      // Update local data
      rowsToAdd.forEach(newRow => tableData.push(newRow));
      renderTable(tableData, false);
      
      // Close modal
      const addDataModalForHide = document.getElementById('addDataModal');
      const bsAddData = bootstrap.Modal.getInstance(addDataModalForHide);
      if (bsAddData) bsAddData.hide();
      form.reset();
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      
      
      // Hide loading overlay
      hideLoadingOverlay();
      
      window._addFormOriginalText = originalText;
      
    } 
    // ===== EDIT DATA FORM =====
    else if (e.target && e.target.id === 'editDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      let originalText = submitBtn ? submitBtn.textContent : 'Cập nhật';
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang cập nhật...';
      }
      
      // Show loading overlay
      showLoadingOverlay('Đang cập nhật dữ liệu...');
      
      // Get common field values
      const commonInputs = Array.from(form.querySelectorAll('#editDataCommonFields input[name^="col_"], #editDataCommonFields select[name^="col_"]'));
      const additionalInputs = Array.from(form.querySelectorAll('#editDataAdditionalFields input[name^="col_"], #editDataAdditionalFields select[name^="col_"]'));
      
      // Get quantity column index from modal dataset
      const editDataModalForIndex = document.getElementById('editDataModal');
      const quantityColIndex = parseInt(editDataModalForIndex?.dataset?.quantityColIndex || '-1', 10);
      
      // Collect all roll kg values
      const editRollRows = document.querySelectorAll('#editRollsTableBody tr');
      const rollKgValues = [];
      editRollRows.forEach(row => {
        const kgInput = row.querySelector('.edit-roll-kg');
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            rollKgValues.push(parsed);
          }
        }
      });
      
      if (rollKgValues.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        return;
      }
      
      // Build common values array (including empty for quantity column)
      let commonValues = commonInputs.map(inp => inp.value ?? '');
      commonValues.splice(quantityColIndex, 0, '');
      
      // Get additional values
      const additionalValues = additionalInputs.map(inp => inp.value ?? '');
      
      // Sum all roll kg values for the quantity column
      const totalKg = rollKgValues.reduce((sum, kg) => sum + kg, 0);
      
      // Create updated row with total kg in quantity column
      const updatedRow = [...commonValues];
      updatedRow[quantityColIndex] = String(totalKg);
      updatedRow.push(...additionalValues);
      
      // Ensure row has same length
      const maxCols = Math.max(updatedRow.length, (tableData[0] || []).length);
      while (updatedRow.length < maxCols) updatedRow.push('');
      
      // Convert date from ISO to dd/mm/yyyy for column 2
      if (updatedRow.length > 2 && updatedRow[2]) {
        const iso = updatedRow[2];
        const dt = new Date(iso);
        if (!isNaN(dt.getTime())) {
          const d = String(dt.getDate()).padStart(2, '0');
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const y = dt.getFullYear();
          updatedRow[2] = `${d}/${m}/${y}`;
        }
      }
      
      if (selectedRowIndex > 0 && selectedRowIndex < tableData.length) {
        tableData[selectedRowIndex] = updatedRow;
        
        // Send to Google Apps Script
        if (typeof APPS_SCRIPT_URL1 === 'string' && APPS_SCRIPT_URL1.trim()) {
          const body = new URLSearchParams();
          body.set('values', JSON.stringify(updatedRow));
          body.set('action', 'update');
          body.set('rowIndex', String(selectedRowIndex + 1));
          const resp = await fetch(APPS_SCRIPT_URL1, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });
          const text = await resp.text();
          let j = null;
          try { j = JSON.parse(text); } catch (_) { j = null; }
          if (!resp.ok || (j && j.result && j.result !== 'success')) {
            throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
          }
        }
        
        renderTable(tableData, false);
        selectedRowIndex = -1;
        document.getElementById('btnEditData').disabled = true;
        document.getElementById('btnDeleteData').disabled = true;
        const editDataModalEl = document.getElementById('editDataModal');
        const bsEditData = bootstrap.Modal.getInstance(editDataModalEl);
        if (bsEditData) bsEditData.hide();
        form.reset();
        
        // Restore button state
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        
        // Hide loading overlay
        hideLoadingOverlay();
      }
    }
  } catch (err) {
    console.error('Form submit error:', err);
    
    // Hide loading overlay on error
    hideLoadingOverlay();
    
    // Restore button state for Edit form on error
    if (e.target && e.target.id === 'editDataForm') {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
    
    if (e.target && e.target.id === 'addDataForm') {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const savedOriginalText = window._addFormOriginalText;
      if (submitBtn && savedOriginalText) {
        submitBtn.disabled = false;
        submitBtn.textContent = savedOriginalText;
      }
      delete window._addFormOriginalText;
    }
  }
});


/* =============================================================================
   DELETE HANDLER
   Xử lý xóa dữ liệu
================================================================================ */

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btnConfirmDelete') {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedRowIndex <= 0 || selectedRowIndex >= tableData.length) {
      alert('Không thể xóa dòng này');
      return;
    }

    const btnConfirm = document.getElementById('btnConfirmDelete');
    const originalText = btnConfirm.textContent;
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Đang xóa...';

    // Show loading overlay
    showLoadingOverlay('Đang xóa dữ liệu...');

    try {
      const rowToDelete = tableData[selectedRowIndex];

      // Send to Google Apps Script
      if (typeof APPS_SCRIPT_URL1 === 'string' && APPS_SCRIPT_URL1.trim()) {
        const body = new URLSearchParams();
        body.set('action', 'delete');
        body.set('rowIndex', String(selectedRowIndex + 1));
        body.set('values', JSON.stringify(rowToDelete));
        
        const resp = await fetch(APPS_SCRIPT_URL1, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString()
        });
        
        const text = await resp.text();
        let j = null;
        try { j = JSON.parse(text); } catch (_) { j = null; }
        
        if (!resp.ok || (j && j.result && j.result !== 'success')) {
          throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
        }
      }

      // Remove from local data
      tableData.splice(selectedRowIndex, 1);
      
      // Close modal
      const deleteDataModalEl = document.getElementById('deleteDataModal'); 
      const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl); 
      if (bsDeleteData) bsDeleteData.hide();
      
      renderTable(tableData);
      selectedRowIndex = -1;
      document.getElementById('btnEditData').disabled = true;
      document.getElementById('btnDeleteData').disabled = true;
      
      // Hide loading overlay
      hideLoadingOverlay();
    } catch (err) {
      console.error('Delete error:', err);
      
      // Hide loading overlay on error
      hideLoadingOverlay();
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = originalText;
    }
  }
});


/* =============================================================================
   EVENT LISTENERS
   Đăng ký các sự kiện click
================================================================================ */

// Button click handlers
document.addEventListener('click', (e) => {
  const id = e.target && e.target.id; 
  if (!id) return;
  
  if (id === 'btnAddData') openAddDataModal();
  if (id === 'btnEditData') openEditDataModal();
  if (id === 'btnDeleteData') openDeleteDataModal();
  if (id === 'prevPage') prevPage();
  if (id === 'nextPage') nextPage();
});


/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const xgDropdown = document.getElementById('xgDropdown');
  
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('active');
    });
  }
  
  if (xgDropdown) {
    const dropdownToggle = xgDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          xgDropdown.classList.toggle('active');
        }
      });
    }
  }
  
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mainNav && !mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active');
        hamburger.classList.remove('active');
      }
    }
  });
  
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
});

// Page select dropdown change event
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'pageSelect') {
    goToPage(e.target.value);
  }
});
