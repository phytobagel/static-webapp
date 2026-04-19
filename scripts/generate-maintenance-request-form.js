const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'forms',
  'maintenance-request-form-8705-georgetown-pike.pdf'
);

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 40;
const RIGHT = 572;
const FIELD_HEIGHT = 18;
const DEFAULT_FIELD_FONT_SIZE = 11;
let defaultFieldFont = undefined;

function drawText(page, text, x, y, options = {}) {
  page.drawText(text, {
    x,
    y,
    size: options.size || 10,
    font: options.font,
    color: options.color || rgb(0, 0, 0),
  });
}

function drawLine(page, y) {
  page.drawLine({
    start: { x: LEFT, y },
    end: { x: RIGHT, y },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.8),
  });
}

function addTextField(form, page, name, x, y, width, opts = {}) {
  const field = form.createTextField(name);
  if (opts.multiline) {
    field.enableMultiline();
  }
  field.addToPage(page, {
    x,
    y,
    width,
    height: opts.height || FIELD_HEIGHT,
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    font: opts.font || defaultFieldFont,
  });
  field.setFontSize(opts.fontSize || DEFAULT_FIELD_FONT_SIZE);
  field.setText(opts.defaultText || '');
  return field;
}

function addCheckBox(form, page, name, x, y) {
  const box = form.createCheckBox(name);
  box.addToPage(page, {
    x,
    y,
    width: 12,
    height: 12,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
    backgroundColor: rgb(1, 1, 1),
  });
  return box;
}

async function buildForm() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  defaultFieldFont = font;

  let y = PAGE_HEIGHT - 44;
  drawText(page, 'Tenant Maintenance Request Form', LEFT, y, {
    size: 18,
    font: fontBold,
  });
  y -= 22;
  drawLine(page, y);

  y -= 24;
  drawText(page, 'Property:', LEFT, y + 4, { font: fontBold });
  drawText(page, '8705 Georgetown Pike, McLean VA 22102', LEFT + 54, y + 4, {
    font,
  });

  y -= 18;
  drawText(page, 'Owner:', LEFT, y + 4, { font: fontBold });
  drawText(page, 'Peggy Sue McNulty', LEFT + 42, y + 4, { font });
  drawText(page, 'Renter(s):', LEFT + 210, y + 4, { font: fontBold });
  drawText(page, 'Joseph Sawin & Ellen-Gray Mills', LEFT + 265, y + 4, {
    font,
  });

  y -= 22;
  drawLine(page, y);

  y -= 24;
  drawText(page, 'Request Information', LEFT, y + 4, { font: fontBold, size: 12 });

  y -= 24;
  drawText(page, 'Date Submitted', LEFT, y + 5, { font });
  addTextField(form, page, 'date_submitted', LEFT + 90, y, 478);

  y -= 28;
  drawText(page, 'Tenant Name', LEFT, y + 5, { font });
  addTextField(
    form,
    page,
    'tenant_name',
    LEFT + 90,
    y,
    478,
    { defaultText: 'Joseph Sawin & Ellen-Gray Mills' }
  );

  y -= 28;
  drawText(page, 'Date Issue Started', LEFT, y + 5, { font });
  addTextField(form, page, 'issue_started_date', LEFT + 100, y, 160);
  drawText(page, 'Priority', LEFT + 285, y + 5, { font });
  addCheckBox(form, page, 'priority_low', LEFT + 325, y + 2);
  drawText(page, 'Low', LEFT + 342, y + 5, { font });
  addCheckBox(form, page, 'priority_medium', LEFT + 370, y + 2);
  drawText(page, 'Med', LEFT + 387, y + 5, { font });
  addCheckBox(form, page, 'priority_high', LEFT + 414, y + 2);
  drawText(page, 'High', LEFT + 431, y + 5, { font });
  addCheckBox(form, page, 'priority_emergency', LEFT + 462, y + 2);
  drawText(page, 'Emergency', LEFT + 479, y + 5, { font, size: 9 });

  y -= 36;
  drawLine(page, y + 12);
  drawText(page, 'Maintenance Details', LEFT, y - 2, { font: fontBold, size: 12 });

  y -= 28;
  drawText(page, 'Issue Description / Location of Issue', LEFT, y + 5, { font });
  addTextField(form, page, 'issue_description_location', LEFT, y - 50, 528, {
    height: 44,
    multiline: true,
  });

  // Keep enough vertical spacing so the next single-line field
  // does not overlap the multiline issue description box.
  y -= 74;
  drawText(page, 'Has this happened before?', LEFT, y + 5, { font });
  addTextField(form, page, 'happened_before', LEFT + 150, y, 418);

  y -= 28;
  drawText(page, 'Troubleshooting already attempted', LEFT, y + 5, { font });
  addTextField(form, page, 'troubleshooting_attempted', LEFT + 178, y, 390);

  y -= 34;
  drawLine(page, y + 10);
  drawText(page, 'Tenant Acknowledgment', LEFT, y - 4, { font: fontBold, size: 12 });

  y -= 30;
  drawText(page, 'Signature', LEFT, y + 5, { font });
  addTextField(form, page, 'tenant_signature', LEFT + 55, y, 280);
  drawText(page, 'Date', LEFT + 355, y + 5, { font });
  addTextField(form, page, 'tenant_signature_date', LEFT + 385, y, 183);

  y -= 32;
  drawText(
    page,
    'By signing, tenant confirms the information above is accurate to the best of their knowledge.',
    LEFT,
    y + 5,
    { font, size: 9, color: rgb(0.25, 0.25, 0.25) }
  );

  y -= 26;
  drawLine(page, y + 10);
  drawText(page, 'For Property Management Use Only', LEFT, y - 4, {
    font: fontBold,
    size: 12,
  });

  y -= 30;
  drawText(page, 'Work Order #', LEFT, y + 5, { font });
  addTextField(form, page, 'work_order_number', LEFT + 68, y, 190);
  drawText(page, 'Date Received', LEFT + 280, y + 5, { font });
  addTextField(form, page, 'date_received', LEFT + 362, y, 206);

  y -= 28;
  drawText(page, 'Scheduled Date', LEFT, y + 5, { font });
  addTextField(form, page, 'scheduled_date', LEFT + 85, y, 180);
  drawText(page, 'Completed Date', LEFT + 275, y + 5, { font });
  addTextField(form, page, 'completed_date', LEFT + 355, y, 213);

  y -= 30;
  drawText(page, 'Status', LEFT, y + 5, { font });
  addCheckBox(form, page, 'status_in_progress', LEFT + 52, y + 2);
  drawText(page, 'In Progress', LEFT + 69, y + 5, { font });
  addCheckBox(form, page, 'status_completed', LEFT + 155, y + 2);
  drawText(page, 'Completed', LEFT + 172, y + 5, { font });
  addCheckBox(form, page, 'status_closed', LEFT + 250, y + 2);
  drawText(page, 'Closed', LEFT + 267, y + 5, { font });

  y -= 36;
  drawText(page, 'Resolution Notes', LEFT, y + 5, { font });
  addTextField(form, page, 'resolution_notes', LEFT, y - 56, 528, {
    height: 56,
    multiline: true,
  });

  form.updateFieldAppearances(font);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUTPUT_PATH, pdfBytes);
}

buildForm()
  .then(() => {
    process.stdout.write(`Created fillable PDF: ${OUTPUT_PATH}\n`);
  })
  .catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exit(1);
  });
