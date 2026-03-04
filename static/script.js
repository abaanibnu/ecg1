
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const validationMsg = document.getElementById('validation-msg');
    const previewSection = document.getElementById('preview-section');
    const imagePreview = document.getElementById('image-preview');
    const btnRemove = document.getElementById('btn-remove');
    const btnProceed = document.getElementById('btn-proceed');

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingSpinner = document.getElementById('loading-spinner');

    let selectedFile = null;

    if (dropZone) {
        // Drag & Drop Handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        // Click to browse
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileSelection(e.target.files[0]);
            }
        });

        btnRemove.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            previewSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
            hideError();
        });

        btnProceed.addEventListener('click', () => {
            if (!selectedFile) return;

            // UI state: uploading
            btnProceed.disabled = true;
            btnRemove.classList.add('hidden');
            progressContainer.classList.remove('hidden');
            loadingSpinner.classList.remove('hidden');
            hideError();

            // Prepare FormData
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Upload using XHR
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.floor((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = percentComplete + '%';
                }
            };

            xhr.onload = function () {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            localStorage.setItem('ecg_filename', response.filename || selectedFile.name);
                            sessionStorage.setItem('ecg_filename', response.filename || selectedFile.name);

                            progressBar.style.width = '100%';
                            progressText.textContent = '100%';

                            setTimeout(() => {
                                window.location.href = '/process';
                            }, 500);

                        } else {
                            showError(response.error || 'Upload failed');
                            resetUploadUI();
                        }
                    } catch (err) {
                        showError('Server returned an invalid response.');
                        resetUploadUI();
                    }
                } else {
                    showError('Server error during upload. Status: ' + xhr.status);
                    resetUploadUI();
                }
            };

            xhr.onerror = function () {
                showError('Network error occurred during upload.');
                resetUploadUI();
            };

            xhr.send(formData);
        });
    }

    function handleFileSelection(file) {
        // File type validation
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const validExtensions = ['.jpg', '.jpeg', '.png'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            showError('Invalid file type. Please upload a JPG, JPEG, or PNG image.');
            return;
        }

        hideError();
        selectedFile = file;

        // Create Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            dropZone.classList.add('hidden');
            previewSection.classList.remove('hidden');
            btnProceed.disabled = false;

            // Reset Progress UI
            if (progressContainer && loadingSpinner && progressBar && progressText) {
                progressContainer.classList.add('hidden');
                loadingSpinner.classList.add('hidden');
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
            }
        };
        reader.readAsDataURL(file);
    }

    function showError(msg) {
        if (validationMsg) {
            validationMsg.textContent = msg;
            validationMsg.classList.remove('hidden');
        }
    }

    function hideError() {
        if (validationMsg) {
            validationMsg.classList.add('hidden');
        }
    }

    function resetUploadUI() {
        if (btnProceed && btnRemove && progressContainer && loadingSpinner && progressBar && progressText) {
            btnProceed.disabled = false;
            btnRemove.classList.remove('hidden');
            progressContainer.classList.add('hidden');
            loadingSpinner.classList.add('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
        }
    }

    // --- Dashboard Logic ---
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
        initDashboard();
    }

    function initDashboard() {
        const loader = document.getElementById('loader-container');
        const alertPanel = document.getElementById('alert-panel');
        const alertMessage = document.getElementById('alert-message');

        const metricHr = document.getElementById('val-hr');
        const metricSdnn = document.getElementById('val-sdnn');
        const metricStress = document.getElementById('val-stress');
        const metricCondition = document.getElementById('val-condition');
        const recommendationText = document.getElementById('val-recommendation');
        const btnResetZoom = document.getElementById('reset-zoom');

        let ecgChart = null;

        const filename = localStorage.getItem('ecg_filename') || sessionStorage.getItem('ecg_filename');

        if (!filename) {
            window.location.href = '/';
            return;
        }

        let latestAnalysis = null;

        // Fetch analysis from backend
        fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    latestAnalysis = data.analysis;
                    renderDashboard(data);
                } else {
                    alert('Analysis failed: ' + data.error);
                    window.location.href = '/';
                }
            })
            .catch(error => {
                console.error('Error fetching analysis:', error);
                alert('A network error occurred.');
                window.location.href = '/';
            });

        function renderDashboard(data) {
            const analysis = data.analysis;
            const signal = data.signal;

            // Hide loader, show dashboard
            loader.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');

            // Update Metrics
            metricHr.textContent = analysis.heart_rate;
            metricSdnn.textContent = analysis.sdnn_ms;

            // Stress Level Pill
            metricStress.textContent = analysis.stress_level;
            metricStress.className = 'status-pill';
            if (analysis.stress_level === 'Low') metricStress.classList.add('status-normal');
            else if (analysis.stress_level === 'Moderate') metricStress.classList.add('status-moderate');
            else metricStress.classList.add('status-critical');

            // Condition Pill
            metricCondition.textContent = analysis.abnormality;
            metricCondition.className = 'status-pill';
            if (analysis.abnormality === 'Normal') metricCondition.classList.add('status-normal');
            else metricCondition.classList.add('status-critical');

            // Recommendation
            recommendationText.textContent = analysis.recommendation;

            // Alert Panel handled
            if (analysis.abnormality !== 'Normal') {
                alertPanel.classList.remove('hidden');
                alertMessage.textContent = analysis.recommendation;
            }

            // Render Chart
            renderChart(signal);
        }

        function renderChart(signalData) {
            const ctx = document.getElementById('ecgChart').getContext('2d');

            // Create time labels (ms assuming 100Hz)
            const labels = Array.from({ length: signalData.length }, (_, i) => (i * 10).toFixed(0));

            ecgChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'ECG Signal (mV)',
                        data: signalData,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 1000 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            intersect: false,
                            mode: 'index',
                            callbacks: {
                                label: (context) => `Signal: ${context.parsed.y.toFixed(2)} mV`
                            }
                        },
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: 'x',
                            },
                            zoom: {
                                wheel: { enabled: true },
                                pinch: { enabled: true },
                                mode: 'x',
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Time (ms)', color: '#64748b' },
                            grid: { display: false },
                            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                        },
                        y: {
                            title: { display: true, text: 'Amplitude (mV)', color: '#64748b' },
                            grid: { color: '#f1f5f9' },
                            beginAtZero: false
                        }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });

            btnResetZoom.addEventListener('click', () => {
                ecgChart.resetZoom();
            });
        }

        // PDF Generation Logic
        const btnDownloadPdf = document.getElementById('btn-download-pdf');
        const pdfSpinner = document.getElementById('pdf-spinner');

        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', () => {
                if (!latestAnalysis) return;

                // UI Loading State
                btnDownloadPdf.disabled = true;
                pdfSpinner.classList.remove('hidden');

                // 1. Capture Chart Image
                // We reset zoom first to ensure the full waveform is captured in the report
                if (ecgChart) ecgChart.resetZoom();

                const chartCanvas = document.getElementById('ecgChart');
                const chartImage = chartCanvas.toDataURL('image/png');

                // 2. Gather Patient Data
                const patientData = {
                    name: document.getElementById('patient-name').value || 'N/A',
                    age: document.getElementById('patient-age').value || 'N/A',
                    gender: document.getElementById('patient-gender').value || 'N/A'
                };

                // 3. Send to Backend
                fetch('/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patient: patientData,
                        analysis: latestAnalysis,
                        chartImage: chartImage
                    })
                })
                    .then(response => {
                        if (response.ok) return response.blob();
                        throw new Error('PDF generation failed');
                    })
                    .then(blob => {
                        // Create download link
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        a.href = url;
                        a.download = `ECG_Medical_Report_${timestamp}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                    })
                    .catch(err => {
                        console.error('PDF Error:', err);
                        alert('Error generating PDF report. Please try again.');
                    })
                    .finally(() => {
                        // Reset UI State
                        btnDownloadPdf.disabled = false;
                        pdfSpinner.classList.add('hidden');
                    });
            });
        }
    }
});
