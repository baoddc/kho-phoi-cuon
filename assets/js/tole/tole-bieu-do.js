/* =============================================================================
   DASHBOARD BIỂU ĐỒ TÔLE
   JavaScript xử lý dữ liệu và hiển thị biểu đồ
================================================================================ */

/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho dashboard
================================================================================ */

// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1GgNUPIYxvfJ1eQL4As6Vs0nb10A9ZIvoFQ4r2ZYm2pU';

// GID cho các sheet
const SHEET_GID_NHAP = '425790242';          // Sheet Nhập
const SHEET_GID_XUAT = '353555921';         // Sheet Xuất
const SHEET_GID_TON = '869739970';          // Sheet Tồn

// URL để tải file .xlsx
const XLSX_URL_NHAP = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_NHAP}`;
const XLSX_URL_XUAT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_XUAT}`;
const XLSX_URL_TON = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_TON}`;

/* =============================================================================
   GLOBAL VARIABLES
   Biến toàn cục quản lý dữ liệu
================================================================================ */

let importData = [];   // Dữ liệu nhập
let exportData = [];  // Dữ liệu xuất
let tonData = [];     // Dữ liệu tồn

// Import totals by type
let importByType = {
  ncc: 0,        // Nhập nhà cung cấp
  xuong: 0,      // Nhập xưởng sản xuất
  giaCong: 0,    // Nhập gia công ngoài
  congTrinh: 0   // Nhập công trình
};

// Export totals by type
let exportByType = {
  xuong: 0,        // Xuất xưởng sản xuất
  dieuChuyen: 0,   // Xuất điều chuyển
  giaCong: 0,     // Xuất gia công ngoài
  congTrinh: 0    // Xuất công trình
};

// Chart instances
let barChart = null;
let pieChart = null;
let lineChart = null;

// Filter variables
let filterFromDate = null;
let filterToDate = null;

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích
================================================================================ */

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

// Format date to yyyy-mm
function formatYearMonth(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Format date to display
function formatMonthYear(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Th ${month}/${year}`;
}

// Parse input thành số
function parseNumericInput(value) {
  let text = String(value ?? '').trim();
  if (!text) return 0;
  text = text.replace(/\s+/g, '');

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = text.split(',');
    if (parts.length === 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, '');
    }
  }

  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

// Format số với dấu phẩy ngăn cách
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

// Lấy tháng từ ngày
function getMonthKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Lấy ngày hiện tại (mặc định cho tính tồn đầu kì)
function getDefaultFromDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
================================================================================ */

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
  
  loadAllData();
});

/* =============================================================================
   DATA LOADING
   Tải dữ liệu từ Google Sheets
================================================================================ */

async function loadAllData() {
  try {
    // Load all three sheets in parallel
    const [importResponse, exportResponse, tonResponse] = await Promise.all([
      fetch(XLSX_URL_NHAP),
      fetch(XLSX_URL_XUAT),
      fetch(XLSX_URL_TON)
    ]);

    if (!importResponse.ok) throw new Error("Không thể truy cập sheet Nhập");
    if (!exportResponse.ok) throw new Error("Không thể truy cập sheet Xuất");
    if (!tonResponse.ok) throw new Error("Không thể truy cập sheet Tồn");

    // Parse import data
    const importArrayBuffer = await importResponse.arrayBuffer();
    const importWorkbook = XLSX.read(importArrayBuffer, { type: 'array' });
    const importSheetName = importWorkbook.SheetNames[0];
    const importWorksheet = importWorkbook.Sheets[importSheetName];
    importData = XLSX.utils.sheet_to_json(importWorksheet, { header: 1, raw: false });

    // Parse export data
    const exportArrayBuffer = await exportResponse.arrayBuffer();
    const exportWorkbook = XLSX.read(exportArrayBuffer, { type: 'array' });
    const exportSheetName = exportWorkbook.SheetNames[0];
    const exportWorksheet = exportWorkbook.Sheets[exportSheetName];
    exportData = XLSX.utils.sheet_to_json(exportWorksheet, { header: 1, raw: false });

    // Parse ton data
    const tonArrayBuffer = await tonResponse.arrayBuffer();
    const tonWorkbook = XLSX.read(tonArrayBuffer, { type: 'array' });
    const tonSheetName = tonWorkbook.SheetNames[0];
    const tonWorksheet = tonWorkbook.Sheets[tonSheetName];
    tonData = XLSX.utils.sheet_to_json(tonWorksheet, { header: 1, raw: false });

    // Process data and create charts
    processDataAndCreateCharts();
    
    // Hide loading
    document.getElementById('loading').style.display = 'none';
    
  } catch (error) {
    document.getElementById('loading').innerHTML = 
      `Lỗi: ${error.message}<br>Kiểm tra xem sheet đã được Publish to web chưa.`;
    console.error(error);
  }
}

/* =============================================================================
   DATA PROCESSING
   Xử lý dữ liệu để tạo biểu đồ
================================================================================ */

// Hàm tính tổng tồn đầu kì (SUMIF: cột 1 < fromDate, cộng cột 7)
function calculateInventoryBegin() {
  // Sử dụng ngày hiện tại làm mặc định nếu không có từ ngày
  let fromDate;
  const fromDateInput = document.getElementById('fromDate')?.value;
  
  if (fromDateInput) {
    fromDate = new Date(fromDateInput);
  } else {
    fromDate = getDefaultFromDate();
  }
  fromDate.setHours(0, 0, 0, 0);
  
  // Column indices: column 1 = index 0, column 8 = index 7
  const dateColIndex = 0;
  const qtyColIndex = 7;
  
  let total = 0;
  
  for (let i = 1; i < tonData.length; i++) {
    const row = tonData[i];
    if (!row || row.length === 0) continue;
    
    // Skip empty rows
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    
    const dateValue = row[dateColIndex];
    const date = parseRowDate(dateValue);
    if (!date) continue;
    
    // SUMIF: date < fromDate
    if (date < fromDate) {
      const quantity = parseNumericInput(row[qtyColIndex]);
      total += quantity;
    }
  }
  
  return total;
}

function processDataAndCreateCharts() {
  // Tìm cột ngày và số lượng (kg)
  const importHeaders = importData[0] || [];
  const exportHeaders = exportData[0] || [];
  
  // Find date column index (column 2 = index 2)
  const dateColIndex = 2;
  
  // Find quantity column index - looking for "Số lượng" or "Số lượng(KG)" or similar
  const findQuantityColIndex = (headers) => {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || '').toLowerCase().trim();
      if (h.includes('số lượng') || h.includes('so luong') || h.includes('kg')) {
        return i;
      }
    }
    return 8; // Default to column 8 (index 8)
  };
  
  // Find "Loại nhập" column index (column 5 = index 4)
  const findLoaiNhapColIndex = (headers) => {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || '').toLowerCase().trim();
      if (h.includes('loại nhập')) {
        return i;
      }
    }
    return 4; // Default to column 5 (index 4)
  };
  
  const importQtyColIndex = findQuantityColIndex(importHeaders);
  const exportQtyColIndex = findQuantityColIndex(exportHeaders);
  const loaiNhapColIndex = findLoaiNhapColIndex(importHeaders);
  const loaiXuatColIndex = findLoaiNhapColIndex(exportHeaders);

  // Reset import by type
  importByType = {
    ncc: 0,        // Nhập nhà cung cấp
    xuong: 0,      // Nhập xưởng sản xuất
    giaCong: 0,    // Nhập gia công ngoài
    congTrinh: 0   // Nhập công trình
  };

  // Reset export by type
  exportByType = {
    xuong: 0,        // Xuất xưởng sản xuất
    dieuChuyen: 0,   // Xuất điều chuyển
    giaCong: 0,     // Xuất gia công ngoài
    congTrinh: 0    // Xuất công trình
  };

  // Process monthly data
  const monthlyData = {};
  
  // Process import data
  for (let i = 1; i < importData.length; i++) {
    const row = importData[i];
    if (!row || row.length === 0) continue;
    
    // Skip empty rows
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    
    const dateValue = row[dateColIndex];
    const date = parseRowDate(dateValue);
    if (!date) continue;
    
    // Apply date filter
    if (!isDateInRange(date)) continue;
    
    const monthKey = getMonthKey(date);
    if (!monthKey) continue;
    
    const quantity = parseNumericInput(row[importQtyColIndex]);
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { import: 0, export: 0, date: date };
    }
    monthlyData[monthKey].import += quantity;
    
    // Calculate import by type (column 5 - "Loại nhập")
    const loaiNhap = String(row[loaiNhapColIndex] || '').toLowerCase().trim();
    if (loaiNhap.includes('nhà cung cấp') || loaiNhap.includes('ncc')) {
      importByType.ncc += quantity;
    } else if (loaiNhap.includes('xưởng') || loaiNhap.includes('sản xuất') || loaiNhap.includes('xuong')) {
      importByType.xuong += quantity;
    } else if (loaiNhap.includes('gia công') || loaiNhap.includes('gia cong') || loaiNhap.includes('giao')) {
      importByType.giaCong += quantity;
    } else if (loaiNhap.includes('công trình') || loaiNhap.includes('cong trinh') || loaiNhap.includes('ct')) {
      importByType.congTrinh += quantity;
    }
  }
  
  // Process export data
  for (let i = 1; i < exportData.length; i++) {
    const row = exportData[i];
    if (!row || row.length === 0) continue;
    
    // Skip empty rows
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    
    const dateValue = row[dateColIndex];
    const date = parseRowDate(dateValue);
    if (!date) continue;
    
    // Apply date filter
    if (!isDateInRange(date)) continue;
    
    const monthKey = getMonthKey(date);
    if (!monthKey) continue;
    
    const quantity = parseNumericInput(row[exportQtyColIndex]);
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { import: 0, export: 0, date: date };
    }
    monthlyData[monthKey].export += quantity;
    
    // Calculate export by type (column 5 - "Loại xuất")
    const loaiXuat = String(row[loaiXuatColIndex] || '').toLowerCase().trim();
    if (loaiXuat.includes('xưởng') || loaiXuat.includes('sản xuất') || loaiXuat.includes('xuong')) {
      exportByType.xuong += quantity;
    } else if (loaiXuat.includes('điều chuyển') || loaiXuat.includes('dieu chuyen') || loaiXuat.includes('dc')) {
      exportByType.dieuChuyen += quantity;
    } else if (loaiXuat.includes('gia công') || loaiXuat.includes('gia cong') || loaiXuat.includes('giao')) {
      exportByType.giaCong += quantity;
    } else if (loaiXuat.includes('công trình') || loaiXuat.includes('cong trinh') || loaiXuat.includes('ct')) {
      exportByType.congTrinh += quantity;
    }
  }

  // Sort by month
  const sortedMonths = Object.keys(monthlyData).sort();
  
  // Calculate totals
  let totalImport = 0;
  let totalExport = 0;
  
  sortedMonths.forEach(month => {
    totalImport += monthlyData[month].import;
    totalExport += monthlyData[month].export;
  });

  // Calculate inventory begin (đầu kì) - sử dụng ngày hiện tại làm mặc định
  const inventoryBegin = calculateInventoryBegin();

  // Update summary cards
  document.getElementById('totalImport').textContent = formatNumber(totalImport);
  document.getElementById('totalExport').textContent = formatNumber(totalExport);
  document.getElementById('inventoryBegin').textContent = formatNumber(inventoryBegin);
  
  // Update import type cards
  document.getElementById('importNCC').textContent = formatNumber(importByType.ncc);
  document.getElementById('importXuong').textContent = formatNumber(importByType.xuong);
  document.getElementById('importGiaCong').textContent = formatNumber(importByType.giaCong);
  document.getElementById('importCongTrinh').textContent = formatNumber(importByType.congTrinh);
  
  // Update export type cards
  document.getElementById('exportXuong').textContent = formatNumber(exportByType.xuong);
  document.getElementById('exportDieuChuyen').textContent = formatNumber(exportByType.dieuChuyen);
  document.getElementById('exportGiaCong').textContent = formatNumber(exportByType.giaCong);
  document.getElementById('exportCongTrinh').textContent = formatNumber(exportByType.congTrinh);

  // Prepare chart data
  const labels = sortedMonths.map(m => formatMonthYear(monthlyData[m].date));
  const importValues = sortedMonths.map(m => monthlyData[m].import);
  const exportValues = sortedMonths.map(m => monthlyData[m].export);

  // Create charts
  createBarChart(labels, importValues, exportValues);
  createPieChart(totalImport, totalExport);
  createLineChart(labels, importValues, exportValues);
}

/* =============================================================================
   CHART CREATION
   Tạo các biểu đồ bằng Chart.js
================================================================================ */

// Bar Chart - Nhập vs Xuất theo tháng
function createBarChart(labels, importValues, exportValues) {
  const ctx = document.getElementById('barChart').getContext('2d');
  
  if (barChart) {
    barChart.destroy();
  }
  
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Nhập',
          data: importValues,
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          borderColor: '#3498db',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Xuất',
          data: exportValues,
          backgroundColor: 'rgba(231, 76, 60, 0.8)',
          borderColor: '#e74c3c',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 11
            },
            callback: function(value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Pie Chart - Tỷ lệ Nhập/Xuất
function createPieChart(totalImport, totalExport) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  
  if (pieChart) {
    pieChart.destroy();
  }
  
  // Ensure positive values for pie chart
  const importVal = Math.max(0, totalImport);
  const exportVal = Math.max(0, totalExport);
  
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Nhập', 'Xuất'],
      datasets: [{
        data: [importVal, exportVal],
        backgroundColor: [
          'rgba(52, 152, 219, 0.9)',  // Blue - Import
          'rgba(231, 76, 60, 0.9)'    // Red - Export
        ],
        borderColor: [
          '#3498db',
          '#e74c3c'
        ],
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#aaa',
            padding: 15,
            font: {
              size: 12
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
              return context.label + ': ' + formatNumber(context.raw) + ' kg (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// Line Chart - Xu hướng Nhập/Xuất theo thời gian
function createLineChart(labels, importValues, exportValues) {
  const ctx = document.getElementById('lineChart').getContext('2d');
  
  if (lineChart) {
    lineChart.destroy();
  }
  
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Nhập',
          data: importValues,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3498db',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Xuất',
          data: exportValues,
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#e74c3c',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 11
            },
            callback: function(value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

/* =============================================================================
   DATE FILTER FUNCTIONS
   Xử lý lọc dữ liệu theo ngày
================================================================================ */

// Check if a date is within the filter range
function isDateInRange(date) {
  if (!date) return false;
  
  const fromDateInput = document.getElementById('fromDate')?.value;
  const toDateInput = document.getElementById('toDate')?.value;
  
  const fromDate = fromDateInput ? new Date(fromDateInput) : null;
  const toDate = toDateInput ? new Date(toDateInput) : null;
  
  // Set time to start/end of day for accurate comparison
  if (fromDate) {
    fromDate.setHours(0, 0, 0, 0);
  }
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }
  
  // Check if date is in range
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  
  return true;
}

// Apply filter to data and update charts
function applyDateFilter() {
  const fromDateInput = document.getElementById('fromDate')?.value;
  const toDateInput = document.getElementById('toDate')?.value;
  
  filterFromDate = fromDateInput ? new Date(fromDateInput) : null;
  filterToDate = toDateInput ? new Date(toDateInput) : null;
  
  // Reprocess data with filters
  processDataAndCreateCharts();
}

// Reset filter
function resetDateFilter() {
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  filterFromDate = null;
  filterToDate = null;
  
  // Reprocess data without filters
  processDataAndCreateCharts();
}

/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const toleDropdown = document.getElementById('toleDropdown');
  
  // Hamburger menu toggle
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('active');
    });
  }
  
  // Dropdown click for mobile
  if (toleDropdown) {
    const dropdownToggle = toleDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          toleDropdown.classList.toggle('active');
        }
      });
    }
  }
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mainNav && !mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active');
        hamburger.classList.remove('active');
      }
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
  
  // Date filter event listeners
  const btnApplyFilter = document.getElementById('btnApplyFilter');
  const btnResetFilter = document.getElementById('btnResetFilter');
  
  if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', applyDateFilter);
  }
  
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', resetDateFilter);
  }
});

