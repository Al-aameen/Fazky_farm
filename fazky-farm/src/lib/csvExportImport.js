import * as XLSX from 'xlsx';

/**
 * Download data as a CSV file
 */
export function exportToCSV(filename, data) {
  if (!data || data.length === 0) {
    alert('No records available to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download data as an Excel (.xlsx) file
 */
export function exportToExcel(filename, sheetName, data) {
  if (!data || data.length === 0) {
    alert('No records available to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Data');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Parse an uploaded CSV or XLSX file into an array of JSON objects
 */
export function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonResults = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonResults);
      } catch (err) {
        reject(new Error('Failed to parse spreadsheet file: ' + err.message));
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Download sample CSV templates for bulk imports
 */
export function downloadCSVTemplate(moduleType) {
  let sampleData = [];
  let filename = `fazky_${moduleType}_template.csv`;

  switch (moduleType) {
    case 'sales':
      sampleData = [
        { date: '2026-08-05', customer_name: 'John Doe', crates: 10, cash_paid: 44000, transfer_amount: 0, deposit_amount: 0, remarks: 'Sample sale' }
      ];
      break;

    case 'expenses':
      sampleData = [
        { date: '2026-08-05', description: 'Diesel for generator', amount: 15000, remarks: 'Daily fueling' }
      ];
      break;

    case 'production':
      sampleData = [
        { date: '2026-08-05', pen_name: 'Muslimat Pen', morning_eggs: 22, evening_eggs: 20, morning_feed: 2.5, evening_feed: 2.5, mortality: 0 }
      ];
      break;

    case 'workers':
      sampleData = [
        { name: 'Suleiman Alabi', email: 'suleiman@fazky.com', role: 'staff', base_salary: 45000, status: 'active' }
      ];
      break;

    case 'maize':
      sampleData = [
        { date: '2026-08-05', seller_name: 'Alhaji Bako', kg_procured: 500, bag_number: 10, total_amount: 150000 }
      ];
      break;

    default:
      sampleData = [{ info: 'Sample Template Data' }];
  }

  exportToCSV(filename, sampleData);
}
