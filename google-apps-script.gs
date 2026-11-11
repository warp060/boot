/**
 * AI Builder Bootcamp — Google Apps Script Web App
 * Target Spreadsheet ID: 1Y9bPPNPnmSx4kKvrE6NNxGyM57CuHvLtuyAuuP64m68
 *
 * Setup:
 * 1. Open your Google Sheet -> Extensions -> Apps Script.
 * 2. Paste this entire file into Code.gs and save.
 * 3. Run `setupSheet` once from the editor to initialize headers & formatting.
 * 4. Click Deploy -> New deployment -> Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App `/exec` URL into `GOOGLE_SCRIPT_URL` in `register.html`.
 */

const SPREADSHEET_ID = '1Y9bPPNPnmSx4kKvrE6NNxGyM57CuHvLtuyAuuP64m68';
const SHEET_NAME = 'Registrations';

const HEADERS = [
  'Submitted At',
  'Full Name',
  'Email Address',
  'WhatsApp / Mobile',
  'City, State & Country',
  'Current Category',
  'College / Organization & Role',
  'Preferred Language Track',
  'Prior AI Experience',
  '5-Day Build Goals',
  'LinkedIn URL',
  'GitHub / Portfolio URL',
  'Cloud / Deployed Project',
  'Consent Agreed',
  'Application Status',
  'Rubric Score (/100)',
  'Reviewer Notes',
];

const COL_WIDTHS = [
  175, // Submitted At
  180, // Full Name
  220, // Email Address
  165, // WhatsApp / Mobile
  200, // City, State & Country
  190, // Current Category
  230, // College / Organization & Role
  210, // Preferred Language Track
  200, // Prior AI Experience
  340, // 5-Day Build Goals
  230, // LinkedIn URL
  230, // GitHub / Portfolio URL
  260, // Cloud / Deployed Project
  120, // Consent Agreed
  170, // Application Status
  140, // Rubric Score (/100)
  260, // Reviewer Notes
];

const STATUS_OPTIONS = [
  'New',
  'Under Review',
  'Shortlisted (₹500)',
  'Waitlisted',
  'Paid',
  'Confirmed',
];

/**
 * Manual initializer you can run once in Apps Script editor to format the sheet.
 */
function setupSheet() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss);
  ensureHeaders_(sheet);
  return 'Configured sheet "' + sheet.getName() + '" successfully.';
}

/**
 * Health check endpoint for verifying the deployed Web App URL.
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    status: 'AI Builder Bootcamp registration endpoint ready',
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
  });
}

/**
 * Receives registration POST payloads from register.html and appends a formatted row.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const payload = parsePayload_(e);
    const fullName = cleanText_(payload.fullName);
    const email = cleanText_(payload.email);
    const phone = cleanText_(payload.phone);

    if (!fullName || !email || !phone) {
      return jsonResponse_({
        ok: false,
        error: 'Missing required fields (fullName, email, or phone).',
      });
    }

    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss);
    ensureHeaders_(sheet);

    const submittedAt =
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss') + ' IST';
    const consentValue =
      payload.consent === true ||
      String(payload.consent).toLowerCase() === 'true' ||
      String(payload.consent).toLowerCase() === 'yes' ||
      String(payload.consent).toLowerCase() === 'on'
        ? 'Yes'
        : 'No';

    const rowValues = [
      submittedAt,
      fullName,
      email,
      phone,
      cleanText_(payload.location),
      cleanText_(payload.category),
      cleanText_(payload.org),
      cleanText_(payload.language),
      cleanText_(payload.experience) || 'Not specified',
      cleanText_(payload.goals),
      cleanText_(payload.linkedin),
      cleanText_(payload.portfolio),
      cleanText_(payload.cloudProject) || 'Not yet',
      consentValue,
      'New',
      '',
      '',
    ];

    const nextRow = Math.max(sheet.getLastRow() + 1, 2);

    // Format text columns as plain text beforehand so "+91..." phone numbers are never parsed as formulas.
    sheet.getRange(nextRow, 2, 1, 13).setNumberFormat('@');
    const rowRange = sheet.getRange(nextRow, 1, 1, rowValues.length);
    rowRange.setValues([rowValues]);
    rowRange.setVerticalAlignment('top');
    rowRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

    return jsonResponse_({
      ok: true,
      row: nextRow,
      sheet: sheet.getName(),
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {
      // Lock was never acquired.
    }
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(ss) {
  const existing = ss.getSheetByName(SHEET_NAME);
  if (existing) return existing;

  const sheets = ss.getSheets();
  if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
    sheets[0].setName(SHEET_NAME);
    return sheets[0];
  }

  return ss.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const firstCell = cleanText_(sheet.getRange(1, 1).getValue());
  if (sheet.getLastRow() > 0 && firstCell !== '') {
    return;
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setFontColor('#ffffff');
  headerRange.setBackground('#0f172a');
  headerRange.setVerticalAlignment('middle');
  headerRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);

  for (let i = 0; i < COL_WIDTHS.length; i++) {
    sheet.setColumnWidth(i + 1, COL_WIDTHS[i]);
  }

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 15, 999, 1).setDataValidation(statusRule);
}

function parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {
      // Fall through to form parameters.
    }
  }
  return (e && e.parameter) || {};
}

function cleanText_(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

