# Append/Edit/Delete rows in Google Sheet via Apps Script

This document shows a Google Apps Script web app that handles adding, editing, and deleting rows in a specific sheet tab.

### Deployment Steps:

1. Open https://script.google.com and create a new project.
2. Paste the code below into `Code.gs`.
3. Set `SPREADSHEET_ID` to your Google Sheet's ID (found in the URL).
4. `Deploy` → `New deployment` → select `Web app`.
   - `Execute as`: `Me`.
   - `Who has access`: `Anyone`.
5. Click `Deploy`, copy the URL, and paste it into `APPS_SCRIPT_URL` in your JS files.

### New Code.gs for Google Apps Script:

```javascript
/**
 * Google Apps Script - Multi-Sheet API
 * Handles Add, Edit, and Delete operations for specific sheet names.
 */
function doPost(e) {
  try {
    // 1. Spreadsheet ID - REPLACE WITH YOUR ACTUAL ID
    const SPREADSHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU'; 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 2. Parse parameters from POST request
    const params = e.parameter;
    const action = params.action || 'add';
    const sheetName = params.sheetName || 'xg-nhap'; 
    const rawValues = params.values || '[]';
    const values = JSON.parse(rawValues);
    
    // 3. Get the target sheet by name
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        result: 'error', 
        error: 'Sheet "' + sheetName + '" not found. Check your tab names!' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Perform action
    if (action === 'add') {
      // Body example: values=["A", "B", "C"]
      sheet.appendRow(values);
      
    } else if (action === 'edit') {
      // Body example: action=edit, rowIndex=5, values=["New", "Data"]
      const rowIndex = parseInt(params.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 1) throw new Error('Invalid rowIndex');
      const range = sheet.getRange(rowIndex, 1, 1, values.length);
      range.setValues([values]);
      
    } else if (action === 'delete') {
      // Body example: action=delete, rowIndex=5
      const rowIndex = parseInt(params.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 1) throw new Error('Invalid rowIndex');
      sheet.deleteRow(rowIndex);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      result: 'error', 
      error: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Security Note:
- "Anyone" access means anyone with the URL can append rows. If you need more security, consider using an API key check at the top of the `doPost` function.
