# Hướng dẫn chi tiết thiết lập API Google Apps Script

## Tổng quan

Để ứng dụng xuất hàng (xg-xuat.js) có thể đọc và ghi dữ liệu từ Google Sheet, bạn cần thực hiện 2 bước:

1. **Publish Google Sheet** - Để đọc dữ liệu (đã có sẵn trong code)
2. **Tạo Google Apps Script** - Để ghi/thêm/sửa/xóa dữ liệu

---

## Bước 1: Publish Google Sheet (Đọc dữ liệu)

### Hiện tại code đã có:
```
javascript
const SHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';
const SHEET_GID = '1888497588';
```

Nếu bạn muốn sử dụng sheet khác:

1. Mở Google Sheet của bạn
2. Copy ID từ URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
   - SHEET_ID là chuỗi ký tự giữa `/d/` và `/edit`
3. Để lấy SHEET_GID:
   - Mở sheet cần xuất
   - Xem trong URL: `.../edit#gid=[SHEET_GID]`
4. Cập nhật vào file `assets/js/xg/xg-xuat.js`

### Publish to Web:
1. Trong Google Sheet, vào **File** → **Share** → **Publish to web**
2. Tab **Entire document** → chọn sheet cần xuất
3. Format: **Microsoft Excel (.xlsx)**
4. Nhấn **Publish** → xác nhận

---

## Bước 2: Tạo Google Apps Script (Ghi dữ liệu)

### 2.1. Tạo Project mới

1. Truy cập: https://script.google.com
2. Nhấn **New project**
3. Đặt tên: "XuatHangAPI" hoặc tên tùy chọn
4. Xóa toàn bộ code mặc định

### 2.2. Paste Code

Copy toàn bộ code dưới đây và paste vào `Code.gs`:

```
javascript
function doPost(e) {
  try {
    // ================= THAY ĐỔI SHEET ID TẠI ĐÂY =================
    const SPREADSHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';
    // ==============================================================
    
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    
    // Lấy tham số từ request
    const action = e.parameter && e.parameter.action ? e.parameter.action : 'append';
    const raw = e.parameter && e.parameter.values ? e.parameter.values : null;
    const values = raw ? JSON.parse(raw) : [];
    
    // Xử lý theo action
    if (action === 'delete') {
      // Xóa dòng
      const rowIndex = parseInt(e.parameter.rowIndex, 10);
      if (rowIndex > 0) {
        sheet.deleteRow(rowIndex);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'success', action: 'delete' }))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else if (action === 'update') {
      // Cập nhật dòng
      const rowIndex = parseInt(e.parameter.rowIndex, 10);
      if (rowIndex > 0) {
        // Đảm bảo dòng có đủ cột
        const lastCol = sheet.getLastColumn();
        const currentRow = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
        
        // Merge giá trị mới vào dòng hiện tại
        for (let i = 0; i < values.length && i < lastCol; i++) {
          currentRow[i] = values[i];
        }
        
        sheet.getRange(rowIndex, 1, 1, lastCol).setValues([currentRow]);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'success', action: 'update' }))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else {
      // Thêm mới dòng (append)
      sheet.appendRow(values);
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'success', action: 'append' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

**Quan trọng:** Thay đổi `SPREADSHEET_ID` thành ID Google Sheet của bạn!

### 2.3. Deploy (Triển khai)

1. Nhấn nút **Deploy** (màu xanh bên trái)
2. Chọn **New deployment**
3. Click icon **Select type** → chọn **Web app**
4. Cấu hình:
   - **Description**: `Version 1 - Xuat Hang API`
   - **Execute as**: **Me** (quan trọng!)
   - **Who has access**: **Anyone** (hoặc "Anyone, even anonymous" nếu muốn không cần đăng nhập)
5. Nhấn **Deploy**
6. Nhấn **Copy** để copy Web App URL

### 2.4. Cập nhật URL vào file xg-xuat.js

1. Mở file `assets/js/xg/xg-xuat.js`
2. Tìm dòng:
```
javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_URL_HERE/exec';
```
3. Thay thế bằng URL bạn vừa copy:
```
javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

---

## Bước 3: Kiểm tra hoạt động

### Test đọc dữ liệu:
1. Mở file `pages/xg/xg-xuat.html` trong trình duyệt
2. Dữ liệu từ Google Sheet sẽ hiển thị tự động

### Test thêm dữ liệu:
1. Nhấn nút **"+" Thêm mới**
2. Nhập thông tin và số kg
3. Nhấn **Lưu**
4. Dữ liệu sẽ được thêm vào Google Sheet

### Test sửa dữ liệu:
1. Click chọn một dòng trong bảng
2. Nhấn nút **Sửa** (chỉ user `bao.lt` mới có quyền)
3. Thay đổi thông tin
4. Nhấn **Cập nhật**

### Test xóa dữ liệu:
1. Click chọn một dòng
2. Nhấn nút **Xóa** (chỉ user `bao.lt` mới có quyền)
3. Xác nhận xóa

---

## Xử lý sự cố thường gặp

### Lỗi "Không thể truy cập Google Sheet"
- Kiểm tra sheet đã được Publish to Web chưa
- Kiểm tra SHEET_ID có chính xác không

### Lỗi khi thêm/sửa/xóa dữ liệu
- Kiểm tra Apps Script đã Deploy chưa
- Kiểm tra APPS_SCRIPT_URL đã chính xác chưa
- Mở Apps Script → Executions để xem log lỗi

### Không thể xóa/sửa dữ liệu
- Chỉ user `bao.lt` mới có quyền xóa/sửa
- Kiểm tra đã đăng nhập đúng tài khoản chưa

---

## Lưu ý bảo mật

⚠️ **Quan trọng:**
- Khi set "Who has access" là "Anyone, even anonymous", **bất kỳ ai** có URL đều có thể thêm dữ liệu vào sheet của bạn
- Nếu cần bảo mật hơn:
  - Sử dụng "Anyone" (phải đăng nhập Google)
  - Hoặc thêm token xác thực trong code Apps Script
  - Hoặc hạn chế quyền edit cho người dùng cụ thể trong Google Sheet
