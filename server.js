const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
//googlesheet function
async function appendToGoogleSheet(record) {
  const client = await auth.getClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = '簽收紀錄';  // 請對應你試算表的工作表名稱

  // 格式依照你前端傳來的結構調整
  const values = record.drugs.map(drug => [
    record.date,
    record.personnelNumber,
    drug.name,
    drug.quantity,
    drug.confirmed
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
}

const port = process.env.PORT || 3000;

// 中間件
app.use(express.json());
app.use(express.static('public'));

// 環境變量
const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
const sheetId = process.env.GOOGLE_SHEET_ID;

// Google Sheets API 設置
// 替代原本的 auth，改用 service account
const keyFilePath = '/tmp/service-account.json';
if (!fs.existsSync(keyFilePath)) {
  fs.writeFileSync(keyFilePath, Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT, 'base64'));
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// 本地記錄文件路徑
const RECORDS_FILE = path.join(__dirname, 'records.json');

// 確保記錄文件存在且為有效的 JSON
if (!fs.existsSync(RECORDS_FILE) || fs.statSync(RECORDS_FILE).size === 0) {
    fs.writeFileSync(RECORDS_FILE, '[]');
}

// 測試路由
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// 獲取藥品數據
app.get('/api/drug-data', async (req, res) => {
  try {
    const { date } = req.query;
    console.log('Requesting data for date:', date);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:N',
    });
    console.log('Received data from Google Sheets:', response.data);
    const rows = response.data.values;
    const headers = rows[0];
    const drugData = rows.find(row => row[0] === date);
    if (!drugData) {
      console.log('No data found for date:', date);
      return res.status(404).json({ message: '找不到該日期的數據' });
    }
    const pharmacist = drugData[headers.length - 3];
    console.log('Pharmacist:', pharmacist);// 調試輸出
    const formattedData = headers.slice(1, -3).map((drug, index) => ({
      name: drug,
      quantity: drugData[index + 1]
    }));
    console.log('Formatted data:', formattedData);
    res.json({ drugList: formattedData, pharmacist });
  } catch (error) {
    console.error('Error fetching drug data:', error);
    res.status(500).json({ message: '獲取數據時出現錯誤', error: error.message });
  }
});

// 保存簽收記錄到本地
app.post('/api/record', async (req, res) => {
  try {
    const newRecord = req.body;

    await appendToGoogleSheet(newRecord);  // ← 寫入 Google Sheets

    console.log('Record saved to Google Sheets');
    res.status(200).json({ message: '記錄已儲存至 Google Sheets' });

  } catch (error) {
    console.error('Error saving record to Google Sheets:', error);
    res.status(500).json({
      message: '儲存記錄時發生錯誤',
      error: error.message
    });
  }
});

// 下載記錄
app.get('/api/download', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    console.log('Downloading records for date range:', startDate, 'to', endDate);
    
    let records = [];
    if (fs.existsSync(RECORDS_FILE) && fs.statSync(RECORDS_FILE).size > 0) {
      const fileContent = fs.readFileSync(RECORDS_FILE, 'utf8');
      try {
        records = JSON.parse(fileContent);
      } catch (parseError) {
        console.error('Error parsing records for download:', parseError);
        return res.status(500).json({ message: '解析記錄時出現錯誤' });
      }
    }

    records = records.filter(record => {
      const recordDate = record.date;
      return recordDate >= startDate && recordDate <= endDate;
    });

    let csvContent = '\ufeff'; // 添加 BOM 以正確處理 UTF-8
    csvContent += 'Date,Personnel Number,Drug Name,Quantity,Confirmed\n';
    records.forEach(record => {
      record.drugs.forEach(drug => {
        csvContent += `${record.date},${record.personnelNumber},${drug.name},${drug.quantity},${drug.confirmed}\n`;
      });
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=records_${startDate}_to_${endDate}.csv`);
    res.send(csvContent);
    console.log('CSV generated and sent successfully');
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ message: '生成 CSV 時出現錯誤', error: error.message });
  }
});

// 查詢記錄
app.get('/api/records', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    console.log('Querying records for date range:', start_date, 'to', end_date);

    let records = [];
    if (fs.existsSync(RECORDS_FILE) && fs.statSync(RECORDS_FILE).size > 0) {
      const fileContent = fs.readFileSync(RECORDS_FILE, 'utf8');
      try {
        records = JSON.parse(fileContent);
      } catch (parseError) {
        console.error('Error parsing records:', parseError);
        return res.status(500).json({ message: '解析記錄時出現錯誤' });
      }
    }

    records = records.filter(record => {
      const recordDate = record.date;
      return recordDate >= start_date && recordDate <= end_date;
    });

    res.json(records);
    console.log('Records queried successfully');
  } catch (error) {
    console.error('Error querying records:', error);
    res.status(500).json({ message: '查詢記錄時出現錯誤', error: error.message });
  }
});

// 啟動服務器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
