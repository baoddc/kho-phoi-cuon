/* =============================================================================
   PL-PHIEU-IN.JS
   JavaScript for Phiếu In page
================================================================================ */

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

// Google Sheet configuration
const SHEET_ID = '1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE';
const SHEET_GID = '0';  // gid của sheet đầu tiên (main sheet)

// URL để tải file .xlsx (sheet data)
const XLSX_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

// URL export phiếu in (để in phiếu)
// Sheet phieu-in có gid = 862703781
const PHIEU_IN_SHEET_GID = '862703781';
const XLSX_PHIEU_IN_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${PHIEU_IN_SHEET_GID}`;

// URL export phiếu in (sheet phieu-in - cần tạo Apps Script riêng)
// const PHIEU_IN_SHEET_GID = '0';  // gid của sheet phieu-in (khi đã tạo)
// const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${PHIEU_IN_SHEET_GID}`;

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================

// Apps Script URL cho việc ghi dữ liệu vào Google Sheets
// Cần tạo Google Apps Script để write vào các ô cụ thể
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfI4zSAhGHXGbKsO358L91li56f9r8qEwYuqdXbfg7FPMlTXGuPGy9Tg2ivRWf28qOmg/exec'; // Điền URL Apps Script sau khi deploy

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

let tableData = [];  // Lưu dữ liệu từ Google Sheet
let currentPage = 1;
let totalPages = 1;
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị (trang hiện tại)

// Selected row management for edit/delete
let selectedRowIndex = -1;
let selectedRowIndexes = [];

// Edit hang hoa row counter
let editRollCount = 0;

// =============================================================================
// LOADING OVERLAY FUNCTIONS
// =============================================================================

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

// =============================================================================
// DOM ELEMENTS
// =============================================================================

let form;
let hangHoaContainer;
let btnAddRow;
let successMessage;
let errorMessage;
let errorText;
let btnXemTruoc;

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
  // Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    window.location.href = '/pages/dang_nhap.html';
    return;
  }
  
  // Cache DOM elements
  form = document.getElementById('phieuInForm');
  hangHoaContainer = document.getElementById('hangHoaContainer');
  btnAddRow = document.getElementById('btnAddRow');
  successMessage = document.getElementById('successMessage');
  errorMessage = document.getElementById('errorMessage');
  errorText = document.getElementById('errorText');
  btnXemTruoc = document.getElementById('btnXemTruoc');
  
  // Initialize
  init();
});

function init() {
  // Set ngày hiện tại
  const today = new Date().toISOString().split('T')[0];
  const ngayInput = document.getElementById('ngay');
  if (ngayInput) {
    ngayInput.value = today;
  }
  
  // Cập nhật nút xóa
  updateRemoveButtons();
  
  // Kiểm tra đăng nhập
  const currentUser = localStorage.getItem('currentUser');
  const usernameElement = document.getElementById('currentUsername');
  if (usernameElement && currentUser) {
    usernameElement.textContent = currentUser;
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup add data form
  setupAddDataForm();
  
  // Setup hamburger menu
  setupHamburgerMenu();
  
  // Setup logout
  setupLogout();
  
  // Tải dữ liệu từ Google Sheet
  loadGoogleSheet();
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function setupEventListeners() {
  // Thêm dòng mới
  if (btnAddRow) {
    btnAddRow.addEventListener('click', function() {
      addHangHoaRow();
    });
  }
  
  // Xóa dòng (sử dụng event delegation)
  if (hangHoaContainer) {
    hangHoaContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-remove-row')) {
        const rows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
        if (rows.length > 1) {
          e.target.closest('.hang-hoa-row').remove();
          updateRemoveButtons();
        }
      }
    });
  }

  // Xóa tất cả nút xóa khi modal Tạo phiếu in được mở
  const phieuInModal = document.getElementById('phieuInModal');
  if (phieuInModal) {
    phieuInModal.addEventListener('shown.bs.modal', function() {
      // Xóa trắng form khi mở modal
      document.getElementById('phieuInForm').reset();
      
      // Đặt ngày hôm nay
      const today = new Date().toISOString().split('T')[0];
      const ngayInput = document.getElementById('ngay');
      if (ngayInput) {
        ngayInput.value = today;
      }
      
      // Xóa các dòng hàng hóa thừa, chỉ giữ lại 1 dòng
      const hangHoaContainer = document.getElementById('hangHoaContainer');
      hangHoaContainer.innerHTML = `
        <div class="row hang-hoa-row">
          <div class="col-md-4">
            <div class="form-group">
              <label class="form-label">Mặt hàng</label>
              <input type="text" class="form-control mat-hang" name="matHang[]" required>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label class="form-label">ĐVT</label>
              <input type="text" class="form-control dvt" name="dvt[]" required>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label class="form-label">Trọng lượng</label>
              <input type="number" class="form-control trongLuong" name="trongLuong[]" step="0.1" required>
            </div>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <div class="form-group">
            </div>
          </div>
        </div>
      `;
      
      const removeButtons = hangHoaContainer.querySelectorAll('.btn-remove-row');
      removeButtons.forEach(btn => {
        btn.style.display = 'none';
      });
      
      // Đặt các trường về chế độ có thể chỉnh sửa
      setFieldsEditable();
    });
  }
  
  // Tự động điền Số phiếu khi modal Thêm dữ liệu được mở
  const addDataModal = document.getElementById('addDataModal');
  if (addDataModal) {
    addDataModal.addEventListener('shown.bs.modal', function() {
      // Đợi form được render xong
      setTimeout(() => {
        autoGenerateSoPhieu();
      }, 100);
    });
  }
  
  // Submit form
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      await submitToGoogleSheet();
    });
  }
  
  // Xem trước
  if (btnXemTruoc) {
    btnXemTruoc.addEventListener('click', function() {
      const formData = getFormData();
      showPreviewModal(formData);
    });
  }
  
  // Tự động điền form khi nhập số phiếu
  const soPhieuInput = document.getElementById('soPhieu');
  if (soPhieuInput) {
    soPhieuInput.addEventListener('input', function() {
      const soPhieuValue = this.value.trim();
      if (soPhieuValue) {
        fillFormBySoPhieu(soPhieuValue);
      } else {
        // Khi xóa số phiếu, cho phép chỉnh sửa các trường khác
        setFieldsEditable();
      }
    });
    
    // Cũng hỗ trợ sự kiện change để bắt khi người dùng chọn từ dropdown
    soPhieuInput.addEventListener('change', function() {
      const soPhieuValue = this.value.trim();
      if (soPhieuValue) {
        fillFormBySoPhieu(soPhieuValue);
      } else {
        // Khi xóa số phiếu, cho phép chỉnh sửa các trường khác
        setFieldsEditable();
      }
    });
  }
  
  // Pagination event listeners
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function() {
      if (currentPage > 1) {
        currentPage--;
        renderDataTable();
      }
    });
  }
  
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
      if (currentPage < totalPages) {
        currentPage++;
        renderDataTable();
      }
    });
  }
  
  if (pageSelect) {
    pageSelect.addEventListener('change', function() {
      currentPage = parseInt(this.value, 10);
      renderDataTable();
    });
  }
  
  // Edit data button
  const btnEditData = document.getElementById('btnEditData');
  if (btnEditData) {
    btnEditData.addEventListener('click', function() {
      openEditDataModal();
    });
  }
  
  // Delete data button
  const btnDeleteData = document.getElementById('btnDeleteData');
  if (btnDeleteData) {
    btnDeleteData.addEventListener('click', function() {
      openDeleteDataModal();
    });
  }
  
  // Confirm delete button
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', function() {
      confirmDelete();
    });
  }
  
  // Edit data form submit
  const editDataForm = document.getElementById('editDataForm');
  if (editDataForm) {
    editDataForm.addEventListener('submit', function(e) {
      handleEditFormSubmit(e);
    });
  }
}

function setupHamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', function() {
      mainNav.classList.toggle('active');
      hamburger.classList.toggle('active');
    });
  }
}

function setupLogout() {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function() {
      localStorage.removeItem('currentUser');
      window.location.href = '/pages/dang_nhap.html';
    });
  }
  
  // Logo click to go home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', function() {
      window.location.href = '/pages/home.html';
    });
  }
}

// =============================================================================
// ADD DATA FORM FUNCTIONS
// =============================================================================

let sheetHeaders = [];  // Lưu header của sheet

function setupAddDataForm() {
  // Handle add row button in modal
  const btnAddRowModal = document.getElementById('btnAddRowModal');
  if (btnAddRowModal) {
    btnAddRowModal.addEventListener('click', function() {
      addHangHoaRowToModal();
    });
  }
  
  // Handle remove row in modal (event delegation)
  const addHangHoaContainer = document.getElementById('addHangHoaContainer');
  if (addHangHoaContainer) {
    addHangHoaContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-remove-add-row')) {
        const rows = addHangHoaContainer.querySelectorAll('.add-hang-hoa-row');
        if (rows.length > 1) {
          e.target.closest('.add-hang-hoa-row').remove();
          updateRemoveButtonsModal();
        }
      }
    });
  }
  
  // Handle form submit
  const addDataForm = document.getElementById('addDataForm');
  if (addDataForm) {
    addDataForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await submitAddData();
    });
  }
  
  // Update remove buttons initially
  updateRemoveButtonsModal();
}

// Tạo form fields động dựa trên header của Google Sheet
function renderAddDataForm() {
  if (tableData.length < 1) return;
  
  const headerRow = tableData[0];
  sheetHeaders = headerRow;
  
  const mainFieldsContainer = document.getElementById('addDataMainFields');
  if (!mainFieldsContainer) return;
  
  let html = '<div class="row">';
  
  // Tạo các trường dựa trên header (giả định 4 cột đầu là thông tin chính)
  const mainFieldCount = Math.min(4, headerRow.length);
  for (let i = 0; i < mainFieldCount; i++) {
    const header = headerRow[i] || `Cột ${i + 1}`;
    const headerLower = String(header).toLowerCase();
    const fieldName = `col_${i}`;
    
    // Xác định loại input dựa trên tên cột
    let inputType = 'text';
    
    if (headerLower.includes('ngày') || headerLower.includes('date')) {
      inputType = 'date';
      const today = new Date().toISOString().split('T')[0];
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header}</label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}" value="${today}">
          </div>
        </div>
      `;
    } else if (headerLower.includes('trọng lượng') || headerLower.includes('khối lượng') || headerLower.includes('số lượng')) {
      inputType = 'number';
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header}</label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}" step="0.01">
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header}</label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}">
          </div>
        </div>
      `;
    }
  }
  
  html += '</div>';
  mainFieldsContainer.innerHTML = html;
}

// Tự động điền Số phiếu theo định dạng YYMM-XX
function autoGenerateSoPhieu() {
  if (tableData.length < 1) return;
  
  const headerRow = tableData[0];
  
  // Tìm cột Số phiếu
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      const headerLower = String(h || '').toLowerCase().trim();
      return keywords.some(k => headerLower.includes(k.toLowerCase()));
    });
  };
  
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  if (soPhieuIdx < 0 || soPhieuIdx >= 4) {
    // Số phiếu không nằm trong 4 cột đầu tiên, không tự động điền
    return;
  }
  
  // Lấy năm và tháng hiện tại
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // 2 số cuối của năm
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Tháng từ 01-12
  const yearMonthPrefix = year + month; // Ví dụ: "2603"
  
  // Tìm số phiếu lớn nhất trong tháng hiện tại
  let maxSeq = 0;
  
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (!row || row.length <= soPhieuIdx) continue;
    
    const soPhieuValue = String(row[soPhieuIdx] || '').trim();
    
    // Kiểm tra định dạng YYMM-XX
    const match = soPhieuValue.match(/^(\d{2})(\d{2})-(\d+)$/);
    if (match) {
      const rowYearMonth = match[1] + match[2];
      const seqNum = parseInt(match[3], 10);
      
      // Chỉ đếm nếu cùng năm-tháng
      if (rowYearMonth === yearMonthPrefix && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }
  
  // Tạo số phiếu tiếp theo
  const nextSeq = maxSeq + 1;
  const soPhieuNew = `${yearMonthPrefix}-${String(nextSeq).padStart(2, '0')}`;
  
  // Điền vào trường Số phiếu (col_0 là cột đầu tiên)
  const fieldId = `col_${soPhieuIdx}`;
  const soPhieuInput = document.getElementById(fieldId);
  if (soPhieuInput) {
    soPhieuInput.value = soPhieuNew;
    console.log('Đã tự động điền Số phiếu:', soPhieuNew);
  }
}

function addHangHoaRowToModal() {
  const container = document.getElementById('addHangHoaContainer');
  const row = document.createElement('div');
  row.className = 'row add-hang-hoa-row mb-2 align-items-center';
  row.innerHTML = `
    <div class="col-md-4">
      <input type="text" class="form-control" placeholder="Mặt hàng" name="matHang[]">
    </div>
    <div class="col-md-3">
      <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]">
    </div>
    <div class="col-md-3">
      <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01">
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-remove-add-row">Xóa</button>
    </div>
  `;
  container.appendChild(row);
  
  // Cuộn xuống modal-body
  const modalBody = container.closest('.modal-body');
  if (modalBody) {
    modalBody.scrollTop = modalBody.scrollHeight;
  }
  
  // Focus vào ô nhập liệu đầu tiên của dòng mới
  const firstInput = row.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
  
  updateRemoveButtonsModal();
}

function updateRemoveButtonsModal() {
  const container = document.getElementById('addHangHoaContainer');
  if (!container) return;
  
  const rows = container.querySelectorAll('.add-hang-hoa-row');
  const removeButtons = container.querySelectorAll('.btn-remove-add-row');
  
  removeButtons.forEach(btn => {
    btn.style.display = rows.length > 1 ? 'block' : 'none';
  });
}

async function submitAddData() {
  if (!APPS_SCRIPT_URL) {
    alert('Chức năng thêm dữ liệu cần cấu hình Apps Script URL. Vui lòng liên hệ quản trị viên.');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang thêm dữ liệu...');

  try {
    // Lấy dữ liệu từ các trường chính (4 cột đầu)
    const mainFieldCount = Math.min(4, sheetHeaders.length);
    
    // Lấy số xe
    const soXe = document.getElementById('addSoXe')?.value || '';
    
    // Lấy dữ liệu hàng hóa
    const matHangInputs = document.querySelectorAll('#addHangHoaContainer input[name="matHang[]"]');
    const dvtInputs = document.querySelectorAll('#addHangHoaContainer input[name="dvt[]"]');
    const trongLuongInputs = document.querySelectorAll('#addHangHoaContainer input[name="trongLuong[]"]');
    
    // Tìm index của các cột trong header
    const matHangIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng') || String(h || '').toLowerCase().includes('tên hàng') || String(h || '').toLowerCase().includes('mat hang'));
    const dvtIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('đvt') || String(h || '').toLowerCase().includes('đơn vị') || String(h || '').toLowerCase().includes('don vi'));
    const trongLuongIdx = 6; // Cột 7 trong Google Sheet
    const soXeIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('số xe') || String(h || '').toLowerCase().includes('so xe'));
    
    // Tìm cột ngày để format
    const ngayIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('ngày') || String(h || '').toLowerCase().includes('date'));
    
    // Lấy giá trị từ các trường chính
    const mainFields = [];
    for (let i = 0; i < mainFieldCount; i++) {
      const fieldName = `col_${i}`;
      const input = document.getElementById(fieldName);
      let value = input ? input.value : '';
      
      // Nếu là trường ngày (cột i chứa "ngày" hoặc "date"), chuyển đổi từ yyyy-mm-dd sang dd/mm/yyyy
      if (ngayIdx >= 0 && i === ngayIdx && value) {
        const dateParts = value.split('-');
        if (dateParts.length === 3) {
          value = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }
      
      mainFields.push(value);
    }
    
    // Tạo mảng các dòng để thêm vào sheet
    const rowsToAdd = [];
    
    // Với mỗi hàng hóa, tạo một dòng dữ liệu
    for (let i = 0; i < matHangInputs.length; i++) {
      const rowData = [...mainFields]; // Copy main fields
      
      // Đảm bảo rowData đủ độ dài
      while (rowData.length < sheetHeaders.length) {
        rowData.push('');
      }
      
      // Điền thông tin hàng hóa vào đúng cột
      if (matHangIdx >= 0) rowData[matHangIdx] = matHangInputs[i]?.value || '';
      if (dvtIdx >= 0) rowData[dvtIdx] = dvtInputs[i]?.value || '';
      if (trongLuongIdx >= 0) rowData[trongLuongIdx] = trongLuongInputs[i]?.value || '';
      if (soXeIdx >= 0) rowData[soXeIdx] = soXe;
      
      // Chỉ thêm dòng nếu có ít nhất một giá trị hàng hóa
      if (matHangInputs[i]?.value || dvtInputs[i]?.value || trongLuongInputs[i]?.value) {
        rowsToAdd.push(rowData);
      }
    }
    
    // Nếu không có hàng hóa nào, vẫn thêm một dòng với main fields
    if (rowsToAdd.length === 0) {
      const rowData = [...mainFields];
      while (rowData.length < sheetHeaders.length) {
        rowData.push('');
      }
      if (soXeIdx >= 0) rowData[soXeIdx] = soXe;
      rowsToAdd.push(rowData);
    }
    
    // Gửi từng dòng lên Google Sheet
    for (const rowData of rowsToAdd) {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `values=${encodeURIComponent(JSON.stringify(rowData))}`
      });
      
      const result = await response.json();
      
      if (result.result !== 'success') {
        throw new Error(result.error || 'Unknown error');
      }
    }
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addDataModal'));
    if (modal) {
      modal.hide();
    }
    
    // Reset form
    document.getElementById('addDataForm').reset();
    
    // Tái tạo form
    renderAddDataForm();
    
    // Reset hàng hóa về 1 dòng
    const container = document.getElementById('addHangHoaContainer');
    container.innerHTML = `
      <div class="row add-hang-hoa-row mb-2 align-items-center">
        <div class="col-md-4">
          <input type="text" class="form-control" placeholder="Mặt hàng" name="matHang[]">
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]">
        </div>
        <div class="col-md-3">
          <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01">
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-danger btn-remove-add-row" style="display:none;">Xóa</button>
        </div>
      </div>
    `;
    updateRemoveButtonsModal();
    
    // Reload data
    await loadGoogleSheet();
    
    // Reload data
    await loadGoogleSheet();
    
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Error:', error);
    hideLoadingOverlay();
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadGoogleSheet() {
  try {
    const response = await fetch(XLSX_DATA_URL);
    if (!response.ok) throw new Error("Không thể truy cập Google Sheet");

    const arrayBuffer = await response.arrayBuffer();

    // Dùng SheetJS đọc file xlsx
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Chuyển thành mảng 2 chiều
    tableData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    
    if (tableData.length === 0) {
      console.log("Không có dữ liệu hoặc sheet rỗng");
      return;
    }

    // Lọc bỏ các dòng trống
    const filteredData = [tableData[0]]; // Giữ lại header row
    for (let i = 1; i < tableData.length; i++) {
      const row = tableData[i];
      const isEmptyRow = row.every(cell => {
        return cell === undefined || cell === null || String(cell).trim() === '';
      });
      if (!isEmptyRow) {
        filteredData.push(row);
      }
    }
    tableData = filteredData;
    
    console.log('Dữ liệu đã tải:', tableData);
    
    // Hiển thị dữ liệu trong bảng
    renderDataTable();
    
    // Tạo form thêm dữ liệu động
    renderAddDataForm();
    
    // Nếu có dữ liệu, điền vào form
    if (tableData.length > 1) {
      populateFormWithLatestData();
    }
    
  } catch (error) {
    console.error('Lỗi tải dữ liệu:', error);
  }
}

function populateFormWithLatestData() {
  if (tableData.length < 2) return;
  
  // Lấy dòng dữ liệu mới nhất (dòng cuối cùng)
  const latestRow = tableData[tableData.length - 1];
  const headerRow = tableData[0];
  
  // Tìm index của các cột dựa trên header
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };
  
  // Tìm các cột tương ứng
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = 6; // Cột 7 trong Google Sheet
  
  // Điền dữ liệu vào form
  if (soPhieuIdx >= 0) {
    document.getElementById('soPhieu').value = latestRow[soPhieuIdx] || '';
  }
  
  if (soXeIdx >= 0) {
    document.getElementById('soXe').value = latestRow[soXeIdx] || '';
  }
  
  if (ngayIdx >= 0) {
    const ngayValue = latestRow[ngayIdx];
    if (ngayValue) {
      // Chuyển đổi ngày sang định dạng yyyy-mm-dd
      const dateObj = parseDate(ngayValue);
      if (dateObj) {
        document.getElementById('ngay').value = dateObj.toISOString().split('T')[0];
      }
    }
  }
  
  if (benNhanIdx >= 0) {
    document.getElementById('benNhan').value = latestRow[benNhanIdx] || '';
  }
  
  // Điền hàng hóa (nếu có)
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const matHang = latestRow[matHangIdx] || '';
    const dvt = latestRow[dvtIdx] || '';
    const trongLuong = latestRow[trongLuongIdx] || '';
    
    // Điền vào dòng đầu tiên
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');
    
    if (matHangInput) matHangInput.value = matHang;
    if (dvtInput) dvtInput.value = dvt;
    if (trongLuongInput) trongLuongInput.value = trongLuong;
  }
}

// Đặt các trường (trừ số phiếu) thành read-only
function setFieldsReadOnly() {
  const fieldsToMakeReadOnly = [
    'soXe', 'ngay', 'benNhan', 'loaiXuat', 'benGiao'
  ];
  
  // Các trường đơn lẻ
  fieldsToMakeReadOnly.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.setAttribute('readonly', 'readonly');
      input.classList.add('read-only-field');
    }
  });
  
  // Các trường hàng hóa (mat-hang, dvt, trongLuong)
  const matHangInputs = document.querySelectorAll('.mat-hang');
  const dvtInputs = document.querySelectorAll('.dvt');
  const trongLuongInputs = document.querySelectorAll('.trongLuong');
  
  matHangInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });
  
  dvtInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });
  
  trongLuongInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });
  
  // Ẩn nút thêm dòng hàng hóa
  const btnAddRow = document.getElementById('btnAddRow');
  if (btnAddRow) {
    btnAddRow.style.display = 'none';
  }
  
  // Ẩn nút xóa dòng
  const removeButtons = document.querySelectorAll('.btn-remove-row');
  removeButtons.forEach(btn => {
    btn.style.display = 'none';
  });
}

// Đặt các trường về chế độ có thể chỉnh sửa
function setFieldsEditable() {
  const fieldsToMakeEditable = [
    'soXe', 'ngay', 'benNhan', 'loaiXuat', 'benGiao'
  ];
  
  // Các trường đơn lẻ
  fieldsToMakeEditable.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.removeAttribute('readonly');
      input.classList.remove('read-only-field');
    }
  });
  
  // Các trường hàng hóa (mat-hang, dvt, trongLuong)
  const matHangInputs = document.querySelectorAll('.mat-hang');
  const dvtInputs = document.querySelectorAll('.dvt');
  const trongLuongInputs = document.querySelectorAll('.trongLuong');
  
  matHangInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });
  
  dvtInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });
  
  trongLuongInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });
  
  // Hiện nút thêm dòng hàng hóa
  const btnAddRow = document.getElementById('btnAddRow');
  if (btnAddRow) {
    btnAddRow.style.display = '';
  }
  
  // Hiện nút xóa dòng (nếu có nhiều hơn 1 dòng)
  updateRemoveButtons();
}

// Tìm và điền form dựa trên số phiếu
function fillFormBySoPhieu(soPhieuValue) {
  if (tableData.length < 2) return;
  
  // Khi tìm thấy dữ liệu, set các trường khác thành read-only
  setFieldsReadOnly();
  
  const headerRow = tableData[0];
  
  // Tìm index của các cột dựa trên header
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };
  
  // Tìm các cột tương ứng
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const loaiXuatIdx = findColIndex(['loại xuất', 'loaixuat', 'loai xuat', 'loại', 'loai']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = 6; // Cột 7 trong Google Sheet
  
  if (soPhieuIdx < 0) {
    console.log('Không tìm thấy cột số phiếu');
    return;
  }
  
  // Tìm tất cả các dòng dữ liệu có số phiếu khớp với giá trị nhập vào
  // Chuyển cả hai về lowercase và trim để so sánh không phân biệt hoa thường
  const normalizedSoPhieu = String(soPhieuValue).trim().toLowerCase();
  
  const foundRows = [];
  for (let i = 1; i < tableData.length; i++) {
    const rowSoPhieu = String(tableData[i][soPhieuIdx] || '').trim().toLowerCase();
    if (rowSoPhieu === normalizedSoPhieu) {
      foundRows.push(tableData[i]);
    }
  }
  
  if (foundRows.length === 0) {
    console.log('Không tìm thấy phiếu với số phiếu: ' + soPhieuValue);
    // Xóa tất cả các trường khác khi không tìm thấy dữ liệu (giống VLOOKUP trong Excel)
    const soXeInput = document.getElementById('soXe');
    if (soXeInput) soXeInput.value = '';
    
    const ngayInput = document.getElementById('ngay');
    if (ngayInput) {
      const today = new Date().toISOString().split('T')[0];
      ngayInput.value = today;
    }
    
    const benNhanInput = document.getElementById('benNhan');
    if (benNhanInput) benNhanInput.value = '';
    
    const loaiXuatInput = document.getElementById('loaiXuat');
    if (loaiXuatInput) loaiXuatInput.value = '';
    
    // Xóa dữ liệu hàng hóa
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');
    
    if (matHangInput) matHangInput.value = '';
    if (dvtInput) dvtInput.value = '';
    if (trongLuongInput) trongLuongInput.value = '';
    
    // Xóa các dòng hàng hóa thừa
    const hangHoaContainer = document.getElementById('hangHoaContainer');
    const existingRows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
    for (let i = 1; i < existingRows.length; i++) {
      existingRows[i].remove();
    }
    
    // Cho phép chỉnh sửa các trường khi không tìm thấy dữ liệu
    setFieldsEditable();
    
    return;
  }
  
  console.log('Tìm thấy phiếu:', foundRows.length, 'dòng dữ liệu');
  
  // Lấy dòng đầu tiên để điền thông tin chung
  const firstRow = foundRows[0];
  
  // Điền dữ liệu vào form
  // Số xe
  if (soXeIdx >= 0) {
    const soXeInput = document.getElementById('soXe');
    if (soXeInput) soXeInput.value = firstRow[soXeIdx] || '';
  }
  
  // Ngày
  if (ngayIdx >= 0) {
    const ngayInput = document.getElementById('ngay');
    if (ngayInput) {
      const ngayValue = firstRow[ngayIdx];
      if (ngayValue) {
        const dateObj = parseDate(ngayValue);
        if (dateObj) {
          ngayInput.value = dateObj.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // Bên nhận
  if (benNhanIdx >= 0) {
    const benNhanInput = document.getElementById('benNhan');
    if (benNhanInput) benNhanInput.value = firstRow[benNhanIdx] || '';
  }
  
  // Loại xuất
  if (loaiXuatIdx >= 0) {
    const loaiXuatInput = document.getElementById('loaiXuat');
    if (loaiXuatInput) loaiXuatInput.value = firstRow[loaiXuatIdx] || '';
  }
  
  // Xóa tất cả các dòng hàng hóa hiện có (trừ dòng đầu tiên)
  const hangHoaContainer = document.getElementById('hangHoaContainer');
  const existingRows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
  for (let i = 1; i < existingRows.length; i++) {
    existingRows[i].remove();
  }
  
  // Điền dòng đầu tiên với dữ liệu từ dòng đầu tiên tìm thấy
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');
    
    if (matHangInput) matHangInput.value = firstRow[matHangIdx] || '';
    if (dvtInput) dvtInput.value = firstRow[dvtIdx] || '';
    if (trongLuongInput) trongLuongInput.value = firstRow[trongLuongIdx] || '';
  }
  
  // Đảm bảo các trường vẫn là read-only sau khi điền dữ liệu
  setFieldsReadOnly();
  
  // Thêm các dòng hàng hóa còn lại (nếu có nhiều hơn 1 dòng)
  if (foundRows.length > 1) {
    for (let i = 1; i < foundRows.length; i++) {
      const row = foundRows[i];
      const matHang = row[matHangIdx] || '';
      const dvt = row[dvtIdx] || '';
      const trongLuong = row[trongLuongIdx] || '';
      
      // Chỉ thêm dòng nếu có dữ liệu hàng hóa
      if (matHang || dvt || trongLuong) {
        const newRow = document.createElement('div');
        newRow.className = 'row hang-hoa-row';
        newRow.innerHTML = `
          <div class="col-md-4">
            <div class="form-group">
              <input type="text" class="form-control mat-hang read-only-field" name="matHang[]" required value="${matHang}" readonly>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <input type="text" class="form-control dvt read-only-field" name="dvt[]" required value="${dvt}" readonly>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <input type="number" class="form-control trongLuong read-only-field" name="trongLuong[]" step="0.1" required value="${trongLuong}" readonly>
            </div>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <div class="form-group">
            </div>
          </div>
        `;
        hangHoaContainer.appendChild(newRow);
      }
    }
  }
  
  // Cập nhật trạng thái nút xóa
  updateRemoveButtons();
}

function parseDate(dateValue) {
  if (!dateValue) return null;
  
  // Nếu là số (Excel serial date)
  if (typeof dateValue === 'number') {
    return new Date((dateValue - 25569) * 86400 * 1000);
  }
  
  // Nếu là chuỗi
  if (typeof dateValue === 'string') {
    // Thử các định dạng khác nhau
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,           // yyyy-mm-dd
      /^(\d{2})\/(\d{2})\/(\d{4})$/,        // dd/mm/yyyy
      /^(\d{2})-(\d{2})-(\d{4})$/,           // dd-mm-yyyy
    ];
    
    for (const format of formats) {
      const match = dateValue.match(format);
      if (match) {
        if (format === formats[0]) {
          return new Date(match[1], match[2] - 1, match[3]);
        } else {
          return new Date(match[3], match[2] - 1, match[1]);
        }
      }
    }
    
    // Thử parse trực tiếp
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

// =============================================================================
// RENDER DATA TABLE
// =============================================================================

function renderDataTable() {
  if (tableData.length < 2) return;
  
  // Store all data for pagination
  filteredData = tableData;
  
  // Calculate pagination
  calculatePagination(filteredData);
  
  // Get data for current page
  const pageData = getPageData(filteredData);
  
  renderTableData(pageData);
  
  // Update pagination controls
  updatePaginationControls();
}

// Render dữ liệu của trang hiện tại
function renderTableData(data) {
  const headerRow = data[0];
  const tbody = document.getElementById('dataTableBody');
  const thead = document.querySelector('#dataTable thead tr');
  if (!tbody || !thead) return;
  
  // Xóa header cũ
  thead.innerHTML = '';
  
  // Tạo header động từ Google Sheet (với cột checkbox)
  let headerHtml = '<th style="width: 50px;"><input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả"></th>';
  headerHtml += '<th>STT</th>';
  headerRow.forEach((header, index) => {
    headerHtml += `<th>${header || `Cột ${index + 1}`}</th>`;
  });
  thead.innerHTML = headerHtml;
  
  // Xóa dữ liệu cũ
  tbody.innerHTML = '';
  
  // Duyệt qua các dòng dữ liệu (bắt đầu từ dòng 1, bỏ qua header)
  // Tính STT dựa trên vị trí trong filteredData
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE + 1;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Bỏ qua dòng trống
    const isEmptyRow = row.every(cell => {
      return cell === undefined || cell === null || String(cell).trim() === '';
    });
    if (isEmptyRow) continue;
    
    const tr = document.createElement('tr');
    // Lưu index trong tableData
    const originalIndex = tableData.indexOf(row);
    tr.dataset.rowIndex = String(originalIndex);
    
    // Checkbox
    const stt = startIndex + i - 1;
    let html = `<td><input type="checkbox" class="row-checkbox" value="${originalIndex}"></td>`;
    html += `<td>${stt}</td>`;
    
    // Các cột dữ liệu
    for (let j = 0; j < headerRow.length; j++) {
      let cellValue = row[j] || '';
      
      // Format ngày nếu cột là ngày
      const headerLower = String(headerRow[j] || '').toLowerCase();
      if (headerLower.includes('ngày') || headerLower.includes('date')) {
        cellValue = formatDateDisplay(cellValue);
      }
      
      html += `<td>${cellValue}</td>`;
    }
    
    tr.innerHTML = html;
    
    // Add click event for row selection
    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-checkbox')) return;
      document.querySelectorAll('#dataTable tbody tr').forEach(r => r.classList.remove('table-active'));
      tr.classList.add('table-active');
      selectedRowIndex = Number(tr.dataset.rowIndex);
      document.getElementById('btnEditData').disabled = false;
      document.getElementById('btnDeleteData').disabled = false;
    });
    
    // Checkbox change event
    const checkbox = tr.querySelector('.row-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectedRows();
    });
    
    tbody.appendChild(tr);
  }
  
  // Select all checkbox handler
  setTimeout(() => {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
        });
        updateSelectedRows();
      });
    }
  }, 0);
  
  // Reset selection
  selectedRowIndex = -1;
  selectedRowIndexes = [];
  document.getElementById('btnEditData').disabled = true;
  document.getElementById('btnDeleteData').disabled = true;
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
    btnDelete.textContent = `Xóa đã chọn (${selectedRowIndexes.length})`;
    // Edit only enabled for single selection
    btnEdit.disabled = selectedRowIndexes.length !== 1;
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

/* =============================================================================
   EDIT DATA MODAL
   Chức năng sửa dữ liệu
================================================================================ */

function openEditDataModal() {
  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa');
    return;
  }
  
  const modalEl = document.getElementById('editDataModal'); 
  if (!modalEl) return;
  
  const mainFieldsContainer = document.getElementById('editDataMainFields');
  if (!mainFieldsContainer) return;
  
  // Reset form
  mainFieldsContainer.innerHTML = '';
  
  // Clear goods container
  const editHangHoaContainer = document.getElementById('editHangHoaContainer');
  if (editHangHoaContainer) editHangHoaContainer.innerHTML = '';
  editRollCount = 0;
  
  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const rowData = tableData[selectedRowIndex];
  
  // Find columns for goods details (Mặt hàng, ĐVT, Trọng lượng)
  const matHangIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng'));
  const dvtIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('đvt'));
  const trongLuongIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('trọng lượng') || String(h || '').toLowerCase().includes('kg'));
  const soXeIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('số xe'));
  
  // If we have goods detail columns, populate them
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    // Add first row with existing data
    addEditHangHoaRow(
      rowData[matHangIdx] || '',
      rowData[dvtIdx] || '',
      rowData[trongLuongIdx] || ''
    );
  }
  
  // Setup add row button
  const btnEditAddRowModal = document.getElementById('btnEditAddRowModal');
  if (btnEditAddRowModal) {
    btnEditAddRowModal.onclick = () => addEditHangHoaRow();
  }
  
  // Create form fields for each column (excluding goods details which are handled separately)
  // Use same format as add modal: row wrapper, col-md-6, mb-3, form-label (not fw-bold)
  let fieldsHtml = '<div class="row">';
  
  headers.forEach((header, colIdx) => {
    // Skip goods detail columns and số xe - they're handled separately
    if (colIdx === matHangIdx || colIdx === dvtIdx || colIdx === trongLuongIdx || colIdx === soXeIdx) {
      return;
    }
    
    const headerLower = String(header || '').toLowerCase();
    let inputType = 'text';
    
    // Determine input type based on column name
    if (headerLower.includes('ngày') || headerLower.includes('date')) {
      inputType = 'date';
    } else if (headerLower.includes('trọng lượng') || headerLower.includes('khối lượng') || headerLower.includes('số lượng')) {
      inputType = 'number';
    }
    
    // Format date values
    let inputValue = rowData[colIdx] ?? '';
    if (inputType === 'date' && inputValue) {
      const dateStr = inputValue;
      if (typeof dateStr === 'string') {
        const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let d = String(m[1]).padStart(2, '0');
          let mo = String(m[2]).padStart(2, '0');
          let y = m[3]; 
          if (y.length === 2) y = (parseInt(y, 10) < 50 ? '20' : '19') + y;
          inputValue = `${y}-${mo}-${d}`;
        }
      }
    }
    
    fieldsHtml += `
      <div class="col-md-6">
        <div class="mb-3">
          <label for="edit_col_${colIdx}" class="form-label">${header || `Cột ${colIdx + 1}`}</label>
          <input type="${inputType}" class="form-control" id="edit_col_${colIdx}" name="col_${colIdx}" value="${inputValue}" ${inputType === 'number' ? 'step="0.01"' : ''}>
        </div>
      </div>
    `;
  });
  
  fieldsHtml += '</div>';
  mainFieldsContainer.innerHTML = fieldsHtml;
  
  // Set Số xe value
  const editSoXe = document.getElementById('editSoXe');
  if (editSoXe && soXeIdx >= 0) {
    editSoXe.value = rowData[soXeIdx] || '';
  }
  
  // Show modal using Bootstrap
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Add a row to edit goods table (matching Add Data modal format)
function addEditHangHoaRow(matHang = '', dvt = '', trongLuong = '') {
  editRollCount++;
  const container = document.getElementById('editHangHoaContainer');
  if (!container) return;
  
  const row = document.createElement('div');
  row.className = 'row add-hang-hoa-row mb-2 align-items-center edit-hang-hoa-row';
  row.dataset.rollId = editRollCount;
  row.innerHTML = `
    <div class="col-md-4">
      <input type="text" class="form-control" placeholder="Mặt hàng" name="matHang[]" value="${matHang}">
    </div>
    <div class="col-md-3">
      <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]" value="${dvt}">
    </div>
    <div class="col-md-3">
      <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01" value="${trongLuong}">
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-remove-edit-row">Xóa</button>
    </div>
  `;
  container.appendChild(row);
  
  // Remove button
  row.querySelector('.btn-remove-edit-row').addEventListener('click', () => {
    row.remove();
    updateEditHangHoaNumbers();
  });
  
  updateEditHangHoaNumbers();
}

function updateEditHangHoaNumbers() {
  const rows = document.querySelectorAll('#editHangHoaContainer .edit-hang-hoa-row');
  rows.forEach((row, index) => {
    // Update visibility of remove buttons
    const removeBtn = row.querySelector('.btn-remove-edit-row');
    if (removeBtn) {
      removeBtn.style.display = rows.length > 1 ? 'block' : 'none';
    }
  });
}

/* =============================================================================
   DELETE DATA MODAL
   Chức năng xóa dữ liệu
================================================================================ */

function openDeleteDataModal() {
  if (selectedRowIndexes.length === 0 && selectedRowIndex < 0) {
    alert('Vui lòng chọn ít nhất một dòng để xóa');
    return;
  }
  
  const modalEl = document.getElementById('deleteDataModal');
  if (!modalEl) return;
  
  // Update modal body message to show count
  const modalBody = modalEl.querySelector('.modal-body p');
  if (modalBody) {
    const count = selectedRowIndexes.length || 1;
    modalBody.textContent = `Bạn có chắc chắn muốn xóa ${count} dòng dữ liệu? Hành động này không thể hoàn tác.`;
  }
  
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Handle delete confirmation
async function confirmDelete() {
  const rowsToDelete = selectedRowIndexes.length > 0 ? selectedRowIndexes : [selectedRowIndex];
  
  if (rowsToDelete.length === 0) {
    alert('Không có dòng nào được chọn để xóa');
    return;
  }

  if (!APPS_SCRIPT_URL) {
    alert('Chức năng xóa dữ liệu cần cấu hình Apps Script URL. Vui lòng liên hệ quản trị viên.');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang xóa dữ liệu...');
  
  // Sort in descending order to delete from bottom up
  rowsToDelete.sort((a, b) => b - a);
  
  try {
    // Delete each row from Google Sheets (from bottom to top)
    for (const idx of rowsToDelete) {
      // tableData includes header at index 0, so sheet row = idx + 1
      const sheetRowIndex = idx + 1;
      
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=delete&rowIndex=${sheetRowIndex}`
      });
      
      const result = await response.json();
      
      if (result.result !== 'success') {
        throw new Error(result.error || 'Unknown error');
      }
    }
    
    // Remove rows from tableData after successful delete from sheet
    rowsToDelete.forEach(idx => {
      if (idx >= 0 && idx < tableData.length) {
        tableData.splice(idx, 1);
      }
    });
    
    // Re-render table
    renderDataTable();
    
    // Reset selection
    selectedRowIndex = -1;
    selectedRowIndexes = [];
    document.getElementById('btnEditData').disabled = true;
    document.getElementById('btnDeleteData').disabled = true;
    document.getElementById('btnDeleteData').textContent = 'Xóa dữ liệu';
    
    // Close modal
    const deleteDataModalEl = document.getElementById('deleteDataModal');
    const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl);
    if (bsDeleteData) bsDeleteData.hide();
    
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Error deleting data:', error);
    hideLoadingOverlay();
    // Reload data to sync with sheet
    await loadGoogleSheet();
  }
}

// Handle edit form submission
async function handleEditFormSubmit(e) {
  e.preventDefault();
  
  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Không có dòng nào được chọn để sửa');
    return;
  }

  if (!APPS_SCRIPT_URL) {
    alert('Chức năng sửa dữ liệu cần cấu hình Apps Script URL. Vui lòng liên hệ quản trị viên.');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang cập nhật dữ liệu...');
  
  const form = e.target;
  const headers = tableData[0] || [];
  const rowData = tableData[selectedRowIndex];
  
  // Find columns for goods details
  const matHangIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng'));
  const dvtIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('đvt'));
  const trongLuongIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('trọng lượng') || String(h || '').toLowerCase().includes('kg'));
  const soXeIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('số xe'));
  
  // Update row data from form inputs (main fields)
  headers.forEach((header, colIdx) => {
    // Skip goods detail columns and số xe - they're handled separately
    if (colIdx === matHangIdx || colIdx === dvtIdx || colIdx === trongLuongIdx || colIdx === soXeIdx) {
      return;
    }
    const input = form.querySelector(`[name="col_${colIdx}"]`);
    if (input) {
      rowData[colIdx] = input.value;
    }
  });
  
  // Collect goods details from the goods container
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const editHangHoaRows = document.querySelectorAll('#editHangHoaContainer .edit-hang-hoa-row');
    
    if (editHangHoaRows.length > 0) {
      // Get first row's values for the main columns
      const firstRow = editHangHoaRows[0];
      if (matHangIdx >= 0) {
        const matHangInput = firstRow.querySelector('input[name="matHang[]"]');
        rowData[matHangIdx] = matHangInput ? matHangInput.value : '';
      }
      if (dvtIdx >= 0) {
        const dvtInput = firstRow.querySelector('input[name="dvt[]"]');
        rowData[dvtIdx] = dvtInput ? dvtInput.value : '';
      }
      if (trongLuongIdx >= 0) {
        const kgInput = firstRow.querySelector('input[name="trongLuong[]"]');
        rowData[trongLuongIdx] = kgInput ? kgInput.value : '';
      }
    }
  }
  
  // Update Số xe
  if (soXeIdx >= 0) {
    const editSoXe = document.getElementById('editSoXe');
    if (editSoXe) {
      rowData[soXeIdx] = editSoXe.value;
    }
  }

  try {
    // Send update to Google Sheets
    // tableData includes header at index 0, so sheet row = selectedRowIndex + 1
    const sheetRowIndex = selectedRowIndex + 1;
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=update&rowIndex=${sheetRowIndex}&values=${encodeURIComponent(JSON.stringify(rowData))}`
    });
    
    const result = await response.json();
    
    if (result.result !== 'success') {
      throw new Error(result.error || 'Unknown error');
    }
    
    // Re-render table
    renderDataTable();
    
    // Reset selection
    selectedRowIndex = -1;
    document.getElementById('btnEditData').disabled = true;
    document.getElementById('btnDeleteData').disabled = true;
    
    // Close modal
    const editDataModalEl = document.getElementById('editDataModal');
    const bsEditData = bootstrap.Modal.getInstance(editDataModalEl);
    if (bsEditData) bsEditData.hide();
    
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Error updating data:', error);
    hideLoadingOverlay();
    // Reload data to sync with sheet
    await loadGoogleSheet();
  }
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

function formatDateDisplay(dateValue) {
  if (!dateValue) return '';
  
  const dateObj = parseDate(dateValue);
  if (dateObj) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(dateValue);
}

function selectAndPrint(rowIndex) {
  if (rowIndex < 1 || rowIndex >= tableData.length) return;
  
  const headerRow = tableData[0];
  const dataRow = tableData[rowIndex];
  
  // Tìm index của các cột
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };
  
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = 6; // Cột 7 trong Google Sheet
  
  // Điền dữ liệu vào form
  if (soPhieuIdx >= 0) {
    document.getElementById('soPhieu').value = dataRow[soPhieuIdx] || '';
  }
  
  if (soXeIdx >= 0) {
    document.getElementById('soXe').value = dataRow[soXeIdx] || '';
  }
  
  if (ngayIdx >= 0) {
    const ngayValue = dataRow[ngayIdx];
    if (ngayValue) {
      const dateObj = parseDate(ngayValue);
      if (dateObj) {
        document.getElementById('ngay').value = dateObj.toISOString().split('T')[0];
      }
    }
  }
  
  if (benNhanIdx >= 0) {
    document.getElementById('benNhan').value = dataRow[benNhanIdx] || '';
  }
  
  // Xóa các dòng hàng hóa cũ và thêm dòng mới
  hangHoaContainer.innerHTML = '';
  addHangHoaRow();
  
  // Điền hàng hóa
  const matHangInput = document.querySelector('.mat-hang');
  const dvtInput = document.querySelector('.dvt');
  const trongLuongInput = document.querySelector('.trongLuong');
  
  if (matHangInput && matHangIdx >= 0) matHangInput.value = dataRow[matHangIdx] || '';
  if (dvtInput && dvtIdx >= 0) dvtInput.value = dataRow[dvtIdx] || '';
  if (trongLuongInput && trongLuongIdx >= 0) trongLuongInput.value = dataRow[trongLuongIdx] || '';
  
  // Cuộn lên đầu form
  document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
}

// =============================================================================
// HANG HOA ROW FUNCTIONS
// =============================================================================

function addHangHoaRow() {
  const row = document.createElement('div');
  row.className = 'row hang-hoa-row';
  // Không có label cho các dòng thêm mới (chỉ dòng đầu tiên mới có label)
  row.innerHTML = `
    <div class="col-md-4">
      <div class="form-group">
        <input type="text" class="form-control mat-hang" name="matHang[]" required>
      </div>
    </div>
    <div class="col-md-3">
      <div class="form-group">
        <input type="text" class="form-control dvt" name="dvt[]" required>
      </div>
    </div>
    <div class="col-md-3">
      <div class="form-group">
        <input type="number" class="form-control trongLuong" name="trongLuong[]" step="0.1" required>
      </div>
    </div>
    <div class="col-md-2 d-flex align-items-end">
      <div class="form-group">
      </div>
    </div>
  `;
  hangHoaContainer.appendChild(row);
  
  // Cuộn xuống dòng mới thêm
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Focus vào ô nhập liệu đầu tiên của dòng mới
  const firstInput = row.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 300);
  }
  
  updateRemoveButtons();
}

function updateRemoveButtons() {
  if (!hangHoaContainer) return;
  
  const rows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
  const removeButtons = hangHoaContainer.querySelectorAll('.btn-remove-row');
  
  removeButtons.forEach(btn => {
    btn.classList.toggle('visible', rows.length > 1);
  });
}

// =============================================================================
// FORM DATA FUNCTIONS
// =============================================================================

function getFormData() {
  const soPhieu = document.getElementById('soPhieu').value;
  const soXe = document.getElementById('soXe').value;
  const ngay = document.getElementById('ngay').value;
  const benNhan = document.getElementById('benNhan').value;
  const loaiXuat = document.getElementById('loaiXuat').value;
  const benGiao = document.getElementById('benGiao').value;
  
  // Lấy danh sách hàng hóa
  const matHangInputs = hangHoaContainer.querySelectorAll('.mat-hang');
  const dvtInputs = hangHoaContainer.querySelectorAll('.dvt');
  const trongLuongInputs = hangHoaContainer.querySelectorAll('.trongLuong');
  
  const hangHoa = [];
  for (let i = 0; i < matHangInputs.length; i++) {
    hangHoa.push({
      matHang: matHangInputs[i].value,
      dvt: dvtInputs[i].value,
      trongLuong: trongLuongInputs[i].value
    });
  }
  
  return {
    soPhieu,
    soXe,
    ngay,
    benNhan,
    loaiXuat,
    benGiao,
    hangHoa
  };
}

// =============================================================================
// GOOGLE SHEET FUNCTIONS
// =============================================================================

async function submitToGoogleSheet() {
  const formData = getFormData();
  
  // Ẩn thông báo cũ
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');
  
  // Hiển thị modal preview phiếu
  showPreviewModal(formData);
}

// =============================================================================
// PREVIEW MODAL FUNCTIONS
// =============================================================================

function showPreviewModal(formData) {
  const previewContent = document.getElementById('previewContent');
  if (!previewContent) return;
  
  // Tạo nội dung phiếu
  let html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="text-align: center; color: #0d47a1; margin-bottom: 20px;">Phiếu in</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Số phiếu:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.soPhieu}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Số xe:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.soXe}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Ngày:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.ngay}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Bên nhận/Xưởng/Đội:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.benNhan}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Loại xuất:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.loaiXuat || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Bên giao:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.benGiao || ''}</td>
        </tr>
      </table>
      
      <h5>Chi tiết hàng hóa:</h5>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">STT</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Mặt hàng</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">ĐVT</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Trọng lượng</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  formData.hangHoa.forEach((item, index) => {
    html += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.matHang}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.dvt}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.trongLuong}</td>
          </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  previewContent.innerHTML = html;
  
  // Hiển thị modal
  const modal = new bootstrap.Modal(document.getElementById('previewModal'));
  modal.show();
}

// Xử lý nút In phiếu trong modal
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'btnInPhieu') {
    const formData = getFormData();
    
    // Mở form-in.html trong cửa sổ mới với tham số autoPrint
    const formInWindow = window.open('form-in.html?autoPrint=true', '_blank');
    
    // Đợi cửa sổ mới tải xong rồi gửi dữ liệu
    if (formInWindow) {
      formInWindow.addEventListener('load', function() {
        formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
      });
      
      // Nếu cửa sổ đã tải xong, gửi dữ liệu ngay
      if (formInWindow.document.readyState === 'complete') {
        formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
      }
    }
    
    // Đóng modal preview
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) {
      modal.hide();
    }
  }
});

// =============================================================================
// PREVIEW FUNCTIONS
// =============================================================================

// Preview is now handled by showPreviewModal() in PREVIEW MODAL FUNCTIONS section
