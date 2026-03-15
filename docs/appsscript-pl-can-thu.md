# Google Apps Script for PL-Can-Thu (Phế liệu Cần thu)

## Cấu hình

- **SPREADSHEET_ID**: `1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE`
- **SHEET_GID**: `573099918`

## Code.gs (Google Apps Script)

```javascript
// ============================================
// Google Apps Script cho PL-Can-Thu
// Sheet ID: 1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE
// Sheet GID: 573099918
// ============================================

const SPREADSHEET_ID = '1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE';

function doPost(e) {
  try {
    // Debug: Log all parameters
    console.log('=== doPost called ===');
    console.log('Parameters:', JSON.stringify(e.parameter));
    
    // Mở spreadsheet và lấy sheet đầu tiên
    // Lưu ý: SPREADSHEET_ID sẽ tự động lấy sheet đầu tiên
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Lấy sheet theo gid (hoặc lấy sheet đầu tiên nếu không tìm thấy)
    const sheets = spreadsheet.getSheets();
    let sheet = sheets[0]; // Mặc định lấy sheet đầu tiên
    
    // Thử tìm sheet theo gid
    const targetGid = 573099918; // as number
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === targetGid) {
        sheet = sheets[i];
        break;
      }
    }
    
    console.log('Sheet name:', sheet.getName());
    console.log('Last row:', sheet.getLastRow());
    console.log('Last column:', sheet.getLastColumn());
    
    // Lấy action từ request
    const action = e.parameter && e.parameter.action ? e.parameter.action : 'append';
    console.log('Action:', action);
    
    // Lấy values từ request
    const raw = e.parameter && e.parameter.values ? e.parameter.values : null;
    const values = raw ? JSON.parse(raw) : [];
    console.log('Values:', JSON.stringify(values));
    
    let result = { result: 'success' };
    let message = '';
    
    if (action === 'append') {
      // Thêm dòng mới
      if (values && values.length > 0) {
        sheet.appendRow(values);
        message = 'Added row';
        console.log(message);
      }
    } 
    else if (action === 'update') {
      // Cập nhật dòng hiện có
      const rowIndex = e.parameter.rowIndex ? parseInt(e.parameter.rowIndex, 10) : null;
      console.log('Row index to update:', rowIndex);
      
      if (!rowIndex || rowIndex <= 0) {
        throw new Error('Invalid row index: ' + rowIndex);
      }
      
      if (values && values.length > 0) {
        const lastCol = sheet.getLastColumn();
        console.log('Last column in sheet:', lastCol);
        
        // Check if row exists
        if (rowIndex > sheet.getLastRow()) {
          throw new Error('Row ' + rowIndex + ' does not exist. Last row: ' + sheet.getLastRow());
        }
        
        const currentRow = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
        console.log('Current row before update:', JSON.stringify(currentRow));
        
        // Merge giá trị mới vào dòng hiện tại
        for (let i = 0; i < values.length && i < lastCol; i++) {
          currentRow[i] = values[i];
        }
        
        console.log('Current row after merge:', JSON.stringify(currentRow));
        
        sheet.getRange(rowIndex, 1, 1, lastCol).setValues([currentRow]);
        message = 'Updated row ' + rowIndex;
        console.log(message);
      }
    }
    else if (action === 'delete') {
      // Xóa dòng
      const rowIndex = e.parameter.rowIndex ? parseInt(e.parameter.rowIndex, 10) : null;
      console.log('Row index to delete:', rowIndex);
      
      if (!rowIndex || rowIndex <= 0) {
        throw new Error('Invalid row index: ' + rowIndex);
      }
      
      // Check if row exists
      if (rowIndex > sheet.getLastRow()) {
        throw new Error('Row ' + rowIndex + ' does not exist. Last row: ' + sheet.getLastRow());
      }
      
      sheet.deleteRow(rowIndex);
      message = 'Deleted row ' + rowIndex;
      console.log(message);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', message: message }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error('Error:', err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      result: 'success', 
      message: 'Google Apps Script đang chạy',
      spreadsheet: SPREADSHEET_ID,
      gid: '573099918'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Cách deploy

1. Vào https://script.google.com
2. Tạo project mới
3. Đặt tên: "PL-Can-Thu-API" hoặc tên tùy chọn
4. Xóa hết code mặc định, dán toàn bộ code trên vào
5. Click **Deploy** → **New deployment**
6. Chọn **Select type** → **Web app**
7. Cấu hình:
   - **Description**: PL-Can-Thu API v1
   - **Execute as**: Me
   - **Who has access**: Anyone hoặc Anyone, even anonymous
8. Click **Deploy**
9. Copy **Web App URL** (ví dụ: `https://script.google.com/macros/s/ABC.../exec`)

## Cách sử dụng trong JavaScript

Sau khi deploy, dán URL vào file `assets/js/pl/pl-can-thu.js`:

```javascript
// Trong assets/js/pl/pl-can-thu.js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXX...XXX/exec';
```

### Các action:

| Action | Mô tả | Parameters |
|--------|-------|------------|
| `append` (mặc định) | Thêm dòng mới | `values` (JSON array) |
| `update` | Cập nhật dòng | `values`, `rowIndex` |
| `delete` | Xóa dòng | `rowIndex` |

## Ví dụ request từ JavaScript:

```javascript
// Thêm dòng mới
const body = new URLSearchParams();
body.set('values', JSON.stringify(['1', '2026-03-13', 'Xưởng A', 'Sắt vụn', '100', 'Ghi chú']));
fetch(APPS_SCRIPT_URL, { method: 'POST', body });

// Cập nhật dòng
const body = new URLSearchParams();
body.set('action', 'update');
body.set('rowIndex', '5');
body.set('values', JSON.stringify(['1', '2026-03-13', 'Xưởng A', 'Sắt vụn', '100', 'Ghi chú']));
fetch(APPS_SCRIPT_URL, { method: 'POST', body });

// Xóa dòng
const body = new URLSearchParams();
body.set('action', 'delete');
body.set('rowIndex', '5');
fetch(APPS_SCRIPT_URL, { method: 'POST', body });
```

## Cấu trúc dữ liệu Google Sheet (PL-Can-Thu)

Sheet: "Cần thu" 
Các cột dự kiến:
| STT | Ngày | Xưởng | Loại phế liệu | Số lượng (kg) | Ghi chú |
|-----|------|-------|---------------|---------------|---------|
| 1 | 2026-03-13 | Xưởng A | Sắt vụn | 100 | |
| 2 | 2026-03-13 | Xưởng A | Đồng | 50 | |
| 3 | 2026-03-13 | Xưởng B | Nhôm | 75 | |

## Lưu ý bảo mật

⚠️ **Quan trọng:**
- Khi set "Who has access" là "Anyone, even anonymous", **bất kỳ ai** có URL đều có thể thêm dữ liệu vào sheet của bạn
- Nếu cần bảo mật hơn:
  - Sử dụng "Anyone" (phải đăng nhập Google)
  - Hoặc thêm token xác thực trong code Apps Script
  - Hoặc hạn chế quyền edit cho người dùng cụ thể trong Google Sheet
