document.addEventListener('DOMContentLoaded', () => {
    const signerInfoPage = document.getElementById('signer-info-page');
    const drugDataPage = document.getElementById('drug-data-page');
    const downloadPage = document.getElementById('download-page');
    const viewRecordsPage = document.getElementById('view-records-page');
    const signerForm = document.getElementById('signer-form');
    const drugForm = document.getElementById('drug-form');
    const downloadForm = document.getElementById('download-form');
    const viewRecordsForm = document.getElementById('view-records-form');
    const downloadButton = document.getElementById('download-button');
    const viewRecordsButton = document.getElementById('view-records-button');
    const backButton = document.getElementById('back-button');
    const backToMainButton = document.getElementById('back-to-main-button');
    const recordsResult = document.getElementById('records-result');
    const recordsList = document.getElementById('records-list');

    signerForm.addEventListener('submit', handleSignerForm);
    drugForm.addEventListener('submit', handleDrugForm);
    downloadForm.addEventListener('submit', handleDownloadForm);
    viewRecordsForm.addEventListener('submit', handleViewRecordsForm);
    downloadButton.addEventListener('click', showDownloadPage);
    viewRecordsButton.addEventListener('click', showViewRecordsPage);
    backButton.addEventListener('click', goToSignerInfoPage);
    backToMainButton.addEventListener('click', goToSignerInfoPage);

    function handleSignerForm(e) {
        e.preventDefault();
        const personnelNumber = document.getElementById('personnel-number').value;
        const date = document.getElementById('date').value;

        if (personnelNumber && date) {
            signerInfoPage.classList.add('hidden');
            drugDataPage.classList.remove('hidden');
            document.getElementById('signing-date').value = date;
            fetchDrugData(date);
        } else {
            alert('請填寫所有欄位');
        }
    }

    function fetchDrugData(date) {
        fetch(`/api/drug-data?date=${date}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(({ drugList, pharmacist }) => {
                const drugListElement = document.getElementById('drug-list');
                const pharmacistLabel = document.getElementById('pharmacist-label');
               drugListElement.innerHTML = '';
               pharmacistLabel.textContent = `發藥藥師：${pharmacist || '未提供'}`;;

                drugList.forEach(drug => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${drug.name}</td>
                        <td>${drug.quantity}</td>
                        <td><button class="check-button">✔</button></td>
                    `;
                    drugListElement.appendChild(row);
                });

                document.querySelectorAll('.check-button').forEach(button => {
                    button.addEventListener('click', function() {
                        this.disabled = true;
                    });
                });
            })
            .catch(error => {
                console.error('Error fetching drug data:', error);
                  alert('獲取數據時出現錯誤喔');
            });
    }

    function handleDrugForm(e) {
        e.preventDefault();
        const signingDate = document.getElementById('signing-date').value;
        const personnelNumber = document.getElementById('personnel-number').value;
        const date = document.getElementById('date').value;
        const checkedButtons = document.querySelectorAll('.check-button:disabled');

        if (signingDate && personnelNumber && date && checkedButtons.length === document.querySelectorAll('.check-button').length) {
            const record = {
                personnelNumber,
                date: signingDate,
                drugs: Array.from(document.querySelectorAll('#drug-list tr')).map(row => ({
                    name: row.cells[0].textContent,
                    quantity: row.cells[1].textContent,
                    confirmed: row.querySelector('.check-button').disabled
                }))
            };

            fetch('/api/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(record)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                alert(`${data.message}\n人事號: ${personnelNumber}\n日期: ${date}\n簽收日期: ${signingDate}`);
                resetAndGoToSignerInfoPage();
            })
            .catch(error => {
                console.error('Error saving record:', error);
                alert('儲存紀錄時出現錯誤');
            });
        } else {
            alert('請填寫所有欄位並確認所有藥品數量');
        }
    }

    function handleDownloadForm(e) {
        e.preventDefault();
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        if (startDate && endDate) {
            window.location.href = `/api/download?startDate=${startDate}&endDate=${endDate}`;
        } else {
            alert('請選擇開始和結束日期');
        }
    }

    function handleViewRecordsForm(e) {
        e.preventDefault();
        const startDate = document.getElementById('query-start-date').value;
        const endDate = document.getElementById('query-end-date').value;

        fetch(`/api/records?start_date=${startDate}&end_date=${endDate}`)
            .then(response => response.json())
            .then(data => {
                recordsList.innerHTML = ''; // 清空現有紀錄
                if (data.length === 0) {
                    recordsList.innerHTML = '<tr><td colspan="4">沒有找到符合條件的紀錄</td></tr>';
                } else {
                    data.forEach(record => {
                        record.drugs.forEach(drug => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${record.date}</td>
                                <td>${record.personnelNumber}</td>
                                <td>${drug.name}</td>
                                <td>${drug.quantity}</td>
                            `;
                            recordsList.appendChild(row);
                        });
                    });
                }
                recordsResult.classList.remove('hidden');
            })
            .catch(error => {
                console.error('Error fetching records:', error);
            });
    }

    function showDownloadPage() {
        signerInfoPage.classList.add('hidden');
        downloadPage.classList.remove('hidden');
    }

    function showViewRecordsPage() {
        signerInfoPage.classList.add('hidden');
        viewRecordsPage.classList.remove('hidden');
    }

    function goToSignerInfoPage() {
        downloadPage.classList.add('hidden');
        viewRecordsPage.classList.add('hidden');
        signerInfoPage.classList.remove('hidden');
    }

    function resetAndGoToSignerInfoPage() {
        signerForm.reset();
        drugForm.reset();
        signerInfoPage.classList.remove('hidden');
        drugDataPage.classList.add('hidden');
    }
});
