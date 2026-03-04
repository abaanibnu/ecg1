import os
import cv2
import numpy as np
import io
import base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from utils.image_processing import process_ecg_image
from utils.signal_analysis import analyze_ecg_signal

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.units import inch

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        return jsonify({'success': True, 'filename': filename})
            
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/process')
def process_page():
    return render_template('process.html')

@app.route('/api/process', methods=['POST'])
def process_file():
    data = request.json
    if not data or 'filename' not in data:
        return jsonify({'error': 'No filename provided'}), 400
        
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(data['filename']))
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        signal_data = process_ecg_image(filepath)
        analysis_results = analyze_ecg_signal(signal_data)
        return jsonify({
            'success': True,
            'signal': signal_data,
            'analysis': analysis_results
        })
    except Exception as e:
        print(f"Error processing file: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    data = request.json
    try:
        # Extract data
        patient = data.get('patient', {})
        analysis = data.get('analysis', {})
        chart_image_data = data.get('chartImage') # Base64 string

        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        elements = []
        styles = getSampleStyleSheet()

        # Custom Styles
        header_style = ParagraphStyle('HeaderStyle', parent=styles['Heading1'], textColor=colors.hexColor('#0284c7'), fontSize=24, spaceAfter=5)
        sub_header_style = ParagraphStyle('SubHeaderStyle', parent=styles['Normal'], textColor=colors.hexColor('#64748b'), fontSize=12, spaceAfter=20)
        section_title_style = ParagraphStyle('SectionTitle', parent=styles['Heading2'], textColor=colors.hexColor('#1e293b'), fontSize=14, spaceBefore=15, spaceAfter=10, borderPadding=5)

        # 1. Header Section
        elements.append(Paragraph("ECG Scan Helper", header_style))
        elements.append(Paragraph("Automated ECG Analysis Digital Report", sub_header_style))
        elements.append(Paragraph(f"Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        elements.append(Spacer(1, 0.2*inch))

        # 2. Patient Information
        elements.append(Paragraph("Patient Information", section_title_style))
        patient_data = [
            ['Name:', patient.get('name', 'N/A'), 'Age:', patient.get('age', 'N/A')],
            ['Gender:', patient.get('gender', 'N/A'), '', '']
        ]
        patient_table = Table(patient_data, colWidths=[1*inch, 2*inch, 1*inch, 1*inch])
        patient_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('TEXTCOLOR', (0,0), (0,-1), colors.grey),
            ('TEXTCOLOR', (2,0), (2,-1), colors.grey),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        elements.append(patient_table)
        elements.append(Spacer(1, 0.2*inch))

        # 3. ECG Metrics
        elements.append(Paragraph("Cardiac Metrics", section_title_style))
        
        # Determine condition color
        cond_color = colors.green
        if analysis.get('abnormality') != 'Normal':
            cond_color = colors.red

        metrics_data = [
            ['Metric', 'Value', 'Status'],
            ['Heart Rate', f"{analysis.get('heart_rate')} BPM", 'Normal Range (60-100)'],
            ['HRV (SDNN)', f"{analysis.get('sdnn_ms')} ms", 'Autonomic Balance'],
            ['Stress Level', analysis.get('stress_level'), '-'],
            ['Result', analysis.get('abnormality'), '']
        ]
        metrics_table = Table(metrics_data, colWidths=[1.5*inch, 1.5*inch, 2*inch])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.hexColor('#f8fafc')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.hexColor('#475569')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('GRID', (0,0), (-1,-1), 0.5, colors.hexColor('#e2e8f0')),
            ('PADDING', (0,0), (-1,-1), 8),
            ('TEXTCOLOR', (1,4), (1,4), cond_color),
            ('FONTNAME', (1,4), (1,4), 'Helvetica-Bold'),
        ]))
        elements.append(metrics_table)
        elements.append(Spacer(1, 0.3*inch))

        # 4. ECG Waveform
        if chart_image_data:
            elements.append(Paragraph("ECG Waveform Snapshot", section_title_style))
            # Convert base64 to image
            header, encoded = chart_image_data.split(",", 1)
            img_data = base64.b64decode(encoded)
            img_io = io.BytesIO(img_data)
            rl_img = RLImage(img_io, width=6*inch, height=2.5*inch)
            elements.append(rl_img)
            elements.append(Spacer(1, 0.3*inch))

        # 5. Interpretation
        elements.append(Paragraph("Clinical Interpretation", section_title_style))
        elements.append(Paragraph(analysis.get('recommendation', 'No recommendation available.'), styles['Normal']))
        elements.append(Spacer(1, 0.5*inch))

        # 6. Disclaimer
        disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
        elements.append(Paragraph("<b>Disclaimer:</b> This is an automated preliminary digital analysis provided by ECG Scan Helper. It is intended for informational purposes only and should not replace professional medical diagnosis, advice, or consultation.", disclaimer_style))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        return send_file(buffer, as_attachment=True, download_name=f"ECG_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf", mimetype='application/pdf')

    except Exception as e:
        print(f"Error generating PDF: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
