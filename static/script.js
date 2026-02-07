document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
    // Results elements
    const bpmValue = document.getElementById('bpm-value');
    const conditionBadge = document.getElementById('condition-badge');
    const stressValue = document.getElementById('stress-value');
    const recommendationText = document.getElementById('recommendation-text');
    let ecgChart = null;

    // Drag & Drop handlers
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
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Click handler
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        // Show loading, hide results
        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        
        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            loadingDiv.classList.add('hidden');
            if (data.success) {
                displayResults(data);
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            loadingDiv.classList.add('hidden');
            console.error('Error:', error);
            alert('An error occurred during analysis.');
        });
    }

    function displayResults(data) {
        resultsDiv.classList.remove('hidden');
        
        const analysis = data.analysis;
        
        // Update metrics
        bpmValue.textContent = Math.round(analysis.heart_rate);
        stressValue.textContent = analysis.stress_level;
        recommendationText.textContent = analysis.recommendation;
        
        // Update condition badge
        conditionBadge.textContent = analysis.abnormality;
        conditionBadge.className = 'status-badge'; // reset
        if (analysis.abnormality === 'Normal') {
            conditionBadge.classList.add('status-normal');
        } else if (analysis.abnormality === 'Bradycardia' || analysis.abnormality === 'Tachycardia') {
            conditionBadge.classList.add('status-warning');
        } else {
            conditionBadge.classList.add('status-danger');
        }

        // Draw Chart
        renderChart(data.signal);
    }

    function renderChart(signalData) {
        const ctx = document.getElementById('ecgChart').getContext('2d');
        
        if (ecgChart) {
            ecgChart.destroy();
        }

        // Create labels (time points)
        const labels = Array.from({length: signalData.length}, (_, i) => i);

        ecgChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ECG Signal (mV)',
                    data: signalData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        intersect: false,
                        mode: 'index',
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            color: '#e2e8f0'
                        },
                        beginAtZero: false
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
});
