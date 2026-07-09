/* =============================================================================
   DASHBOARD BIỂU ĐỒ XÀ GỒ
   JavaScript xử lý dữ liệu và hiển thị biểu đồ
================================================================================ */

/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho dashboard
================================================================================ */

// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';

// GID cho các sheet
const SHEET_GID_NHAP = '0';          // Sheet Nhập
const SHEET_GID_XUAT = '1888497588'; // Sheet Xuất
const SHEET_GID_TON = '1968603689';  // Sheet Tồn

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
let importRollsData = []; // Dữ liệu chi tiết cuộn nhập
let exportRollsData = []; // Dữ liệu chi tiết cuộn xuất

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
let workshopChart = null;
let importMaterialChart = null;
let exportMaterialChart = null;

// Filter variables
let filterFromDate = null;
let filterToDate = null;

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích
================================================================================ */

// Normalize text: remove accents and convert to lowercase for matching
function cleanText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
    .toLowerCase()
    .trim();
}

function findColIndex(headers, possibleNames) {
  if (!headers) return -1;
  const cleanedNames = possibleNames.map(n => cleanText(n));
  for (let i = 0; i < headers.length; i++) {
    const cleanedHeader = cleanText(headers[i]);
    if (cleanedNames.some(name => cleanedHeader.includes(name))) {
      return i;
    }
  }
  return -1;
}

// Parse ngày tháng từ các định dạng khác nhau
function parseRowDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null;

  // Excel serial number
  if (typeof raw === 'number') {
    return new Date((raw - 25569) * 86400 * 1000);
  }

  // String format: dd/mm/yyyy or dd-mm-yyyy or mm/dd/yyyy
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let p1 = parseInt(m[1], 10);
      let p2 = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      
      let d, mo;
      // Nếu phần thứ 2 lớn hơn 12, chắc chắn đó là Ngày (định dạng MM/DD/YYYY)
      if (p2 > 12) {
        d = p2;
        mo = p1 - 1;
      } else {
        // Mặc định giả định là DD/MM/YYYY
        d = p1;
        mo = p2 - 1;
      }
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
    window.location.href = '/pages/index.html';
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
      window.location.replace('/pages/index.html');
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
    // Tải toàn bộ workbook chứa tất cả các sheet
    const XLSX_URL_FULL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
    const response = await fetch(XLSX_URL_FULL);
    if (!response.ok) throw new Error("Không thể tải dữ liệu từ Google Sheets");

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Hàm tiện ích tìm sheet không phân biệt chữ hoa thường
    const findSheetByName = (wb, keyword) => {
      const lowerKeyword = keyword.toLowerCase().replace(/[\-_]/g, '');
      const exactMatch = wb.SheetNames.find(name => name.toLowerCase().replace(/[\-_]/g, '') === lowerKeyword);
      if (exactMatch) return wb.Sheets[exactMatch];
      const partialMatch = wb.SheetNames.find(name => name.toLowerCase().replace(/[\-_]/g, '').includes(lowerKeyword));
      return partialMatch ? wb.Sheets[partialMatch] : null;
    };

    // Lấy các worksheet chính
    const importWorksheet = findSheetByName(workbook, 'xg-nhap') || workbook.Sheets[workbook.SheetNames[0]];
    const exportWorksheet = findSheetByName(workbook, 'xg-xuat');
    const tonWorksheet = findSheetByName(workbook, 'xg_ton');
    const importRollsWorksheet = findSheetByName(workbook, 'xg_nhap_ct_cuon');
    const exportRollsWorksheet = findSheetByName(workbook, 'xg_xuat_ct_cuon');

    if (!importWorksheet) throw new Error("Không tìm thấy sheet Nhập (xg-nhap)");
    if (!exportWorksheet) throw new Error("Không tìm thấy sheet Xuất (xg-xuat)");
    if (!tonWorksheet) throw new Error("Không tìm thấy sheet Tồn (xg_ton)");

    importData = XLSX.utils.sheet_to_json(importWorksheet, { header: 1, raw: false });
    exportData = XLSX.utils.sheet_to_json(exportWorksheet, { header: 1, raw: false });
    tonData = XLSX.utils.sheet_to_json(tonWorksheet, { header: 1, raw: false });

    if (importRollsWorksheet) {
      importRollsData = XLSX.utils.sheet_to_json(importRollsWorksheet, { header: 1, raw: false });
    }
    if (exportRollsWorksheet) {
      exportRollsData = XLSX.utils.sheet_to_json(exportRollsWorksheet, { header: 1, raw: false });
    }

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

  const dateColIndex = 0;
  
  // Xác định động cột số lượng tồn để tránh lỗi hardcode
  const tonHeaders = tonData[0] || [];
  let qtyColIndex = 7; // Mặc định cột 8 (index 7)
  for (let i = 0; i < tonHeaders.length; i++) {
    const h = String(tonHeaders[i] || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (h.includes('khoi luong') || h.includes('trong luong') || h.includes('kg')) {
      qtyColIndex = i;
      break;
    }
  }

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

    // SUMIF: date < fromDate (hoặc date <= fromDate nếu không lọc, để lấy đến ngày hiện tại)
    const compareDate = new Date(fromDate);
    if (!fromDateInput) {
      // Nếu không lọc, lấy đến hết ngày hiện tại
      compareDate.setHours(23, 59, 59, 999);
      if (date <= compareDate) {
        const quantity = parseNumericInput(row[qtyColIndex]);
        total += quantity;
      }
    } else {
      if (date < compareDate) {
        const quantity = parseNumericInput(row[qtyColIndex]);
        total += quantity;
      }
    }
  }

  return total;
}

// Tính chỉ số Vòng quay tồn kho và Số ngày tồn kho trung bình dựa trên mã cuộn
function calculateRollMetrics() {
  if (!importRollsData || importRollsData.length < 2) {
    return { turnover: 0, averageStorageDays: 0 };
  }

  const fromDateInput = document.getElementById('fromDate')?.value;
  const toDateInput = document.getElementById('toDate')?.value;

  const fromDate = fromDateInput ? new Date(fromDateInput) : null;
  const toDate = toDateInput ? new Date(toDateInput) : null;

  if (fromDate) fromDate.setHours(0, 0, 0, 0);
  
  let evaluationEndDate;
  if (toDate) {
    evaluationEndDate = new Date(toDate);
    evaluationEndDate.setHours(23, 59, 59, 999);
  } else {
    evaluationEndDate = new Date();
    evaluationEndDate.setHours(23, 59, 59, 999);
  }

  const nhapHeaders = importRollsData[0] || [];
  const xuatHeaders = exportRollsData[0] || [];

  const nhapDateColIdx = findColIndex(nhapHeaders, ['ngày', 'ngay']) !== -1 ? findColIndex(nhapHeaders, ['ngày', 'ngay']) : 0;
  const nhapRollColIdx = findColIndex(nhapHeaders, ['cuộn id', 'cuon id']) !== -1 ? findColIndex(nhapHeaders, ['cuộn id', 'cuon id']) : 4;
  const nhapWeightColIdx = findColIndex(nhapHeaders, ['khối lượng', 'khoi luong', 'trọng lượng', 'trong luong', 'kg']) !== -1 ? findColIndex(nhapHeaders, ['khối lượng', 'khoi luong', 'trọng lượng', 'trong luong', 'kg']) : 6;

  const xuatDateColIdx = findColIndex(xuatHeaders, ['ngày', 'ngay']) !== -1 ? findColIndex(xuatHeaders, ['ngày', 'ngay']) : 0;
  const xuatRollColIdx = findColIndex(xuatHeaders, ['cuộn id', 'cuon id']) !== -1 ? findColIndex(xuatHeaders, ['cuộn id', 'cuon id']) : 4;
  const xuatWeightColIdx = findColIndex(xuatHeaders, ['khối lượng', 'khoi luong', 'trọng lượng', 'trong luong', 'kg']) !== -1 ? findColIndex(xuatHeaders, ['khối lượng', 'khoi luong', 'trọng lượng', 'trong luong', 'kg']) : 6;

  // 1. Map all imported rolls and find earliest date
  const importsMap = {};
  let earliestDate = new Date('2099-12-31');
  for (let i = 1; i < importRollsData.length; i++) {
    const row = importRollsData[i];
    if (!row || row.length === 0) continue;
    let rollId = String(row[nhapRollColIdx] || '').trim();
    const parsedRollId = Number(rollId);
    if (!isNaN(parsedRollId) && rollId !== '') {
      rollId = String(parsedRollId);
    }
    if (!rollId) continue;
    const dateIn = parseRowDate(row[nhapDateColIdx]);
    if (!dateIn) continue;
    const weight = parseNumericInput(row[nhapWeightColIdx]);

    if (dateIn < earliestDate) earliestDate = dateIn;
    importsMap[rollId] = { dateIn, weight, rollId };
  }

  if (earliestDate.getFullYear() === 2099) {
    earliestDate = new Date();
  }
  earliestDate.setHours(0, 0, 0, 0);

  const evaluationStartDate = fromDate || earliestDate;

  // 2. Map all exported rolls
  const exportsMap = {};
  if (exportRollsData && exportRollsData.length > 1) {
    for (let i = 1; i < exportRollsData.length; i++) {
      const row = exportRollsData[i];
      if (!row || row.length === 0) continue;
      let rollId = String(row[xuatRollColIdx] || '').trim();
      const parsedRollId = Number(rollId);
      if (!isNaN(parsedRollId) && rollId !== '') {
        rollId = String(parsedRollId);
      }
      if (!rollId) continue;
      const dateOut = parseRowDate(row[xuatDateColIdx]);
      if (!dateOut) continue;
      const weight = parseNumericInput(row[xuatWeightColIdx]);

      exportsMap[rollId] = { dateOut, weight, rollId };
    }
  }

  // 3. Calculate metrics
  let W_begin = 0;
  let W_end = 0;
  let W_export = 0;

  let totalDays = 0;
  let count = 0;

  // W_begin (rolls in stock at evaluationStartDate)
  for (const rollId in importsMap) {
    const imp = importsMap[rollId];
    const exp = exportsMap[rollId];

    if (imp.dateIn < evaluationStartDate) {
      if (!exp || exp.dateOut >= evaluationStartDate) {
        W_begin += imp.weight;
      }
    }
  }

  // W_end (rolls in stock at evaluationEndDate)
  for (const rollId in importsMap) {
    const imp = importsMap[rollId];
    const exp = exportsMap[rollId];

    if (imp.dateIn <= evaluationEndDate) {
      if (!exp || exp.dateOut > evaluationEndDate) {
        W_end += imp.weight;
      }
    }
  }

  // W_export (rolls exported during [evaluationStartDate, evaluationEndDate])
  for (const rollId in exportsMap) {
    const exp = exportsMap[rollId];
    if (exp.dateOut >= evaluationStartDate && exp.dateOut <= evaluationEndDate) {
      W_export += exp.weight;
    }
  }

  // Average Storage Days for active rolls during the period
  for (const rollId in importsMap) {
    const imp = importsMap[rollId];
    const exp = exportsMap[rollId];

    if (imp.dateIn > evaluationEndDate) continue;
    if (exp && exp.dateOut < evaluationStartDate) continue;

    let storageStart = imp.dateIn < evaluationStartDate ? evaluationStartDate : imp.dateIn;
    let storageEnd = (exp && exp.dateOut <= evaluationEndDate) ? exp.dateOut : evaluationEndDate;

    let storageDays = (storageEnd - storageStart) / (1000 * 60 * 60 * 24);
    if (storageDays < 0) storageDays = 0;

    totalDays += storageDays;
    count++;
  }

  const averageStorageDays = count > 0 ? (totalDays / count) : 0;

  // Tính Vòng quay tồn kho = (Đến ngày - Từ ngày) / Số ngày trung bình
  const diffTime = Math.abs(evaluationEndDate - evaluationStartDate);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  const turnover = averageStorageDays > 0 ? (days / averageStorageDays) : 0;

  return { turnover, averageStorageDays };
}

function processDataAndCreateCharts() {
  const importHeaders = importData[0] || [];
  const exportHeaders = exportData[0] || [];

  // Find date column index
  const dateColIndex = findColIndex(importHeaders, ['ngày', 'ngay']) !== -1 ? findColIndex(importHeaders, ['ngày', 'ngay']) : 2;

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
      if (h.includes('loại nhập') || h.includes('loai nhap')) {
        return i;
      }
    }
    return 4; // Default to column 5 (index 4)
  };

  const importQtyColIndex = findQuantityColIndex(importHeaders);
  const exportQtyColIndex = findQuantityColIndex(exportHeaders);
  const loaiNhapColIndex = findLoaiNhapColIndex(importHeaders);
  const loaiXuatColIndex = findLoaiNhapColIndex(exportHeaders);

  // Dynamic indexes for material code, material name and workshop
  const importMaColIndex = findColIndex(importHeaders, ['mã vật tư', 'ma vat tu', 'mã hàng', 'ma hang']);
  const importTenColIndex = findColIndex(importHeaders, ['tên vật tư', 'ten vat tu', 'tên hàng', 'ten hang']);
  
  const exportMaColIndex = findColIndex(exportHeaders, ['mã vật tư', 'ma vat tu', 'mã hàng', 'ma hang']);
  const exportTenColIndex = findColIndex(exportHeaders, ['tên vật tư', 'ten vat tu', 'tên hàng', 'ten hang']);
  const exportXuongColIndex = findColIndex(exportHeaders, ['tên công trình', 'ten cong trinh', 'đối tác', 'nơi nhận', 'ncc']);

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
  const workshopVolumes = {};
  const importMaterialVolumesByCode = {};
  const importMaterialNamesByCode = {};
  const exportMaterialVolumesByCode = {};
  const exportMaterialNamesByCode = {};

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

    // Material volume
    const ma = importMaColIndex !== -1 ? String(row[importMaColIndex] || '').trim() : '';
    const ten = importTenColIndex !== -1 ? String(row[importTenColIndex] || '').trim() : '';
    const code = ma || ten;
    if (code) {
      importMaterialVolumesByCode[code] = (importMaterialVolumesByCode[code] || 0) + quantity;
      if (ten) {
        if (!importMaterialNamesByCode[code]) {
          importMaterialNamesByCode[code] = [];
        }
        if (!importMaterialNamesByCode[code].includes(ten)) {
          importMaterialNamesByCode[code].push(ten);
        }
      }
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

    // Material volume
    const ma = exportMaColIndex !== -1 ? String(row[exportMaColIndex] || '').trim() : '';
    const ten = exportTenColIndex !== -1 ? String(row[exportTenColIndex] || '').trim() : '';
    const code = ma || ten;
    if (code) {
      exportMaterialVolumesByCode[code] = (exportMaterialVolumesByCode[code] || 0) + quantity;
      if (ten) {
        if (!exportMaterialNamesByCode[code]) {
          exportMaterialNamesByCode[code] = [];
        }
        if (!exportMaterialNamesByCode[code].includes(ten)) {
          exportMaterialNamesByCode[code].push(ten);
        }
      }
    }

    // Workshop volume
    const xuong = exportXuongColIndex !== -1 ? row[exportXuongColIndex] : '';
    const xuongKey = xuong ? String(xuong).trim() : '';
    if (xuongKey) {
      workshopVolumes[xuongKey] = (workshopVolumes[xuongKey] || 0) + quantity;
    }
  }

  // Build final importMaterialVolumes map grouped by code
  const importMaterialVolumes = {};
  for (const [code, quantity] of Object.entries(importMaterialVolumesByCode)) {
    const names = importMaterialNamesByCode[code] || [];
    let bestName = '';
    if (names.length > 0) {
      const validNames = names.filter(n => n.length > 0);
      if (validNames.length > 0) {
        bestName = validNames.reduce((shortest, current) => current.length < shortest.length ? current : shortest, validNames[0]);
      }
    }
    const displayKey = code && bestName && code !== bestName ? `${code} - ${bestName}` : (code || bestName || '');
    if (displayKey) {
      importMaterialVolumes[displayKey] = (importMaterialVolumes[displayKey] || 0) + quantity;
    }
  }

  // Build final exportMaterialVolumes map grouped by code
  const exportMaterialVolumes = {};
  for (const [code, quantity] of Object.entries(exportMaterialVolumesByCode)) {
    const names = exportMaterialNamesByCode[code] || [];
    let bestName = '';
    if (names.length > 0) {
      const validNames = names.filter(n => n.length > 0);
      if (validNames.length > 0) {
        bestName = validNames.reduce((shortest, current) => current.length < shortest.length ? current : shortest, validNames[0]);
      }
    }
    const displayKey = code && bestName && code !== bestName ? `${code} - ${bestName}` : (code || bestName || '');
    if (displayKey) {
      exportMaterialVolumes[displayKey] = (exportMaterialVolumes[displayKey] || 0) + quantity;
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

  // Calculate total current stock from tonData (xg_ton)
  const tonHeaders = tonData[0] || [];
  let tonQtyColIndex = 7; // Default to column 8 (index 7)
  for (let i = 0; i < tonHeaders.length; i++) {
    const h = String(tonHeaders[i] || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (h.includes('khoi luong') || h.includes('trong luong') || h.includes('kg')) {
      tonQtyColIndex = i;
      break;
    }
  }

  let totalCurrentStock = 0;
  for (let i = 1; i < tonData.length; i++) {
    const row = tonData[i];
    if (!row || row.length === 0) continue;
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    const quantity = parseNumericInput(row[tonQtyColIndex]);
    totalCurrentStock += quantity;
  }

  // Aggregate monthly transaction data globally (without date filters) to calculate correct history
  const globalMonthlyData = {};

  // Aggregate global imports
  for (let i = 1; i < importData.length; i++) {
    const row = importData[i];
    if (!row || row.length === 0) continue;
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    const date = parseRowDate(row[dateColIndex]);
    if (!date) continue;
    const monthKey = getMonthKey(date);
    if (!monthKey) continue;
    const quantity = parseNumericInput(row[importQtyColIndex]);
    if (!globalMonthlyData[monthKey]) {
      globalMonthlyData[monthKey] = { import: 0, export: 0, date: date };
    }
    globalMonthlyData[monthKey].import += quantity;
  }

  // Aggregate global exports
  for (let i = 1; i < exportData.length; i++) {
    const row = exportData[i];
    if (!row || row.length === 0) continue;
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;
    const date = parseRowDate(row[dateColIndex]);
    if (!date) continue;
    const monthKey = getMonthKey(date);
    if (!monthKey) continue;
    const quantity = parseNumericInput(row[exportQtyColIndex]);
    if (!globalMonthlyData[monthKey]) {
      globalMonthlyData[monthKey] = { import: 0, export: 0, date: date };
    }
    globalMonthlyData[monthKey].export += quantity;
  }

  const globalMonths = Object.keys(globalMonthlyData).sort();

  // Calculate ending balance for each month working backwards from totalCurrentStock (the stock today)
  const globalTrendBalances = {};
  let balance = totalCurrentStock;
  
  for (let i = globalMonths.length - 1; i >= 0; i--) {
    const m = globalMonths[i];
    globalTrendBalances[m] = balance;
    // Working backwards: Stock(M-1) = Stock(M) - Import(M) + Export(M)
    balance = balance - globalMonthlyData[m].import + globalMonthlyData[m].export;
  }

  // Calculate actual inventory begin (đầu kì) and end (cuối kì) for the selected range
  let inventoryBegin = 0;
  let inventoryEnd = 0;
  
  const fromDateInput = document.getElementById('fromDate')?.value;
  const toDateInput = document.getElementById('toDate')?.value;
  const isFiltered = !!(fromDateInput || toDateInput);

  if (!isFiltered) {
    // Nếu không lọc thì giá trị Đầu kì là Tồn cho đến ngày hiện tại
    inventoryBegin = calculateInventoryBegin();
    inventoryEnd = totalCurrentStock;
  } else {
    if (sortedMonths.length > 0) {
      const firstMonth = sortedMonths[0];
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      inventoryBegin = (globalTrendBalances[firstMonth] || 0) - (monthlyData[firstMonth]?.import || 0) + (monthlyData[firstMonth]?.export || 0);
      inventoryEnd = globalTrendBalances[lastMonth] || 0;
    } else {
      inventoryBegin = totalCurrentStock;
      inventoryEnd = totalCurrentStock;
    }
  }

  // Calculate turnover and DSI
  const averageInventory = (inventoryBegin + inventoryEnd) / 2;
  const turnover = averageInventory > 0 ? (totalExport / averageInventory) : 0;

  let days = 30;
  if (fromDateInput && toDateInput) {
    const diffTime = Math.abs(new Date(toDateInput) - new Date(fromDateInput));
    days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  } else if (sortedMonths.length > 0) {
    days = sortedMonths.length * 30;
  }
  const dsi = turnover > 0 ? (days / turnover) : 0;

  // Update summary cards
  const rollMetrics = calculateRollMetrics();
  document.getElementById('totalImport').textContent = formatNumber(totalImport);
  document.getElementById('totalExport').textContent = formatNumber(totalExport);
  document.getElementById('inventoryBegin').textContent = formatNumber(inventoryBegin);
  document.getElementById('inventoryTurnover').textContent = rollMetrics.turnover > 0 ? formatNumber(rollMetrics.turnover) : '—';
  document.getElementById('inventoryDSI').textContent = rollMetrics.averageStorageDays > 0 ? formatNumber(rollMetrics.averageStorageDays) : '—';

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

  // Calculate monthly inventory ending trend values from global trend data
  const inventoryTrendValues = sortedMonths.map(m => globalTrendBalances[m] || 0);

  // Create charts
  createBarChart(labels, importValues, exportValues);
  
  // Pie chart with dynamic toggle
  const pieSelect = document.getElementById('pieChartSelect');
  if (pieSelect) {
    const newSelect = pieSelect.cloneNode(true);
    pieSelect.parentNode.replaceChild(newSelect, pieSelect);
    newSelect.value = newSelect.value || 'import';
    newSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const titleEl = document.getElementById('pieChartTitle');
      if (titleEl) {
        titleEl.textContent = val === 'import' ? 'CƠ CẤU NHẬP KHO' : 'CƠ CẤU XUẤT KHO';
      }
      createPieChart(val);
    });
    createPieChart(newSelect.value);
  } else {
    createPieChart('import');
  }

  createLineChart(labels, inventoryTrendValues);
  createWorkshopChart(workshopVolumes);
  createImportMaterialChart(importMaterialVolumes);
  createExportMaterialChart(exportMaterialVolumes);
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
            label: function (context) {
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
            callback: function (value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Doughnut Chart - Cơ cấu Nhập / Cơ cấu Xuất
function createPieChart(type = 'import') {
  const ctx = document.getElementById('pieChart').getContext('2d');

  if (pieChart) {
    pieChart.destroy();
  }

  let labels = [];
  let data = [];
  let bgColors = [];
  let borderColors = [];

  if (type === 'import') {
    labels = ['Nhà cung cấp', 'Xưởng SX', 'Gia công ngoài', 'Công trình'];
    data = [importByType.ncc, importByType.xuong, importByType.giaCong, importByType.congTrinh];
    bgColors = [
      'rgba(52, 152, 219, 0.85)',
      'rgba(46, 204, 113, 0.85)',
      'rgba(241, 196, 15, 0.85)',
      'rgba(155, 89, 182, 0.85)'
    ];
    borderColors = ['#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
  } else {
    labels = ['Xưởng SX', 'Điều chuyển', 'Gia công ngoài', 'Công trình'];
    data = [exportByType.xuong, exportByType.dieuChuyen, exportByType.giaCong, exportByType.congTrinh];
    bgColors = [
      'rgba(46, 204, 113, 0.85)',
      'rgba(230, 126, 34, 0.85)',
      'rgba(241, 196, 15, 0.85)',
      'rgba(155, 89, 182, 0.85)'
    ];
    borderColors = ['#2ecc71', '#e67e22', '#f1c40f', '#9b59b6'];
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#aaa',
            padding: 12,
            font: {
              size: 11
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
            label: function (context) {
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

// Line Chart - Biến động Tồn kho cuối kì theo tháng
function createLineChart(labels, inventoryTrendValues) {
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
          label: 'Tồn kho cuối kì',
          data: inventoryTrendValues,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2ecc71',
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
            label: function (context) {
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
            callback: function (value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Horizontal Bar Chart - Phân bổ Xuất kho theo Công trình
function createWorkshopChart(workshopVolumes) {
  const container = document.getElementById('workshopChartContainer');
  if (workshopChart) {
    workshopChart.destroy();
  }

  const sortedWorkshops = Object.keys(workshopVolumes)
    .sort((a, b) => workshopVolumes[b] - workshopVolumes[a]);

  if (container) {
    const newHeight = Math.max(350, sortedWorkshops.length * 35);
    container.style.height = newHeight + 'px';
  }

  const ctx = document.getElementById('workshopChart').getContext('2d');

  const labels = sortedWorkshops;
  const data = sortedWorkshops.map(w => workshopVolumes[w]);

  workshopChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng xuất (kg)',
        data: data,
        backgroundColor: 'rgba(230, 126, 34, 0.8)',
        borderColor: '#e67e22',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
        }
      }
    }
  });
}

// Horizontal Bar Chart - Top 10 Vật tư nhập kho nhiều nhất
function createImportMaterialChart(materialVolumes) {
  const ctx = document.getElementById('importMaterialChart').getContext('2d');

  if (importMaterialChart) {
    importMaterialChart.destroy();
  }

  const sortedMaterials = Object.keys(materialVolumes)
    .sort((a, b) => materialVolumes[b] - materialVolumes[a])
    .slice(0, 10);

  const labels = sortedMaterials;
  const data = sortedMaterials.map(m => materialVolumes[m]);

  importMaterialChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng nhập (kg)',
        data: data,
        backgroundColor: 'rgba(52, 152, 219, 0.8)',
        borderColor: '#3498db',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
        }
      }
    }
  });
}

// Horizontal Bar Chart - Top 10 Vật tư xuất kho nhiều nhất
function createExportMaterialChart(materialVolumes) {
  const ctx = document.getElementById('exportMaterialChart').getContext('2d');

  if (exportMaterialChart) {
    exportMaterialChart.destroy();
  }

  const sortedMaterials = Object.keys(materialVolumes)
    .sort((a, b) => materialVolumes[b] - materialVolumes[a])
    .slice(0, 10);

  const labels = sortedMaterials;
  const data = sortedMaterials.map(m => materialVolumes[m]);

  exportMaterialChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng xuất (kg)',
        data: data,
        backgroundColor: 'rgba(231, 76, 60, 0.8)',
        borderColor: '#e74c3c',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#aaa',
            font: { size: 10 }
          }
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
  const dropdown5S = document.getElementById('5SDropdown');
  const xgDropdown = document.getElementById('xgDropdown');

  // Hamburger menu toggle
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      // hamburger.classList.toggle('active');
      // mainNav.classList.toggle('active');
    });
  }

  // Dropdown click for mobile - 5S
  if (dropdown5S) {
    const dropdownToggle = dropdown5S.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // dropdown5S.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile
  if (xgDropdown) {
    const dropdownToggle = xgDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // xgDropdown.classList.toggle('active');
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


