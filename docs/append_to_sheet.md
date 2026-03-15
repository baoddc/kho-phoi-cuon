# Append new rows to Google Sheet via Apps Script

This document shows a minimal Google Apps Script web app that accepts POST requests
with a form-encoded payload and appends rows to a Google Sheet. Deploy the script as a Web App
(Execute as: Me, Who has access: Anyone, even anonymous) and paste the URL into
`assets/js/xg_nhap.js` as `APPS_SCRIPT_URL`.

Apps Script (Code.gs):

```javascript
function doPost(e) {
  try {
    // Replace with your spreadsheet ID
    const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID';
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

    // If client sends form-encoded `values` as JSON string: e.parameter.values
    const raw = e.parameter && e.parameter.values ? e.parameter.values : null;
    const values = raw ? JSON.parse(raw) : [];

    // Append row: values should be an array of cell values, matching header order
    sheet.appendRow(values);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

Deployment steps:

1. Open https://script.google.com and create a new project.
2. Paste the code above into `Code.gs` and set `SPREADSHEET_ID` to your sheet's ID.
3. `Deploy` → `New deployment` → select `Web app`.
   - Set `Execute as`: `Me`.
   - Set `Who has access`: `Anyone` or `Anyone, even anonymous` (choose based on privacy).
4. Click `Deploy` and copy the Web App URL. Paste that URL into `APPS_SCRIPT_URL` in `assets/js/xg_nhap.js`.

Security note:
- Allowing anonymous access means anyone with the URL can append rows. Protect the endpoint
  or restrict access if the sheet contains sensitive data.
- For production, consider using authentication (OAuth or a token) and validate the token
  in `doPost` before appending.

Client payload example (sent by the UI as form-encoded):

```
values=%5B%22A%22%2C%22B%22%2C%22C%22%2C%222026-02-10%22%5D
```

The Apps Script will append the array as a row to the first sheet of the spreadsheet.
