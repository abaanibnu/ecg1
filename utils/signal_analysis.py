import numpy as np
from scipy.signal import find_peaks

def analyze_ecg_signal(signal_data, fs=100.0):
    """
    Analyze the ECG signal to extract heart rate and detect abnormalities.
    
    Args:
        signal_data (list): One-dimensional list of signal amplitudes.
        fs (float): Sampling frequency in Hz. 
                    Default 100Hz is an assumption based on typical image width 
                    and time coverage if not calibrated.
    """
    if not signal_data or len(signal_data) == 0:
        return {
            'heart_rate': 0,
            'abnormality': 'Unknown',
            'stress_level': 'Unknown',
            'recommendation': 'Could not extract signal.'
        }
        
    signal_arr = np.array(signal_data)
    
    # Simple normalization if not done
    # signal_arr = (signal_arr - np.mean(signal_arr)) / (np.std(signal_arr) + 1e-6)

    # Detect R-peaks
    # distance: min samples between peaks (e.g., assuming max HR 200bpm -> 300ms -> 30 samples at 100Hz)
    # height: min height to be considered a peak (heuristic relative to max)
    max_val = np.max(signal_arr)
    peaks, _ = find_peaks(signal_arr, distance=int(fs * 0.3), height=max_val * 0.5)
    
    if len(peaks) < 2:
        return {
            'heart_rate': 0,
            'abnormality': 'Inconclusive',
            'stress_level': 'Low',
            'recommendation': 'Signal quality too low or too short to detect Heart Rate.'
        }

    # Calculate RR intervals (in seconds)
    rr_intervals = np.diff(peaks) / fs
    mean_rr = np.mean(rr_intervals)
    
    # Calculate Heart Rate (BPM)
    heart_rate = 60.0 / mean_rr
    
    # Abnormality Detection
    abnormality = "Normal"
    recommendation = "Your heart rate is within the normal range. Maintain a healthy lifestyle."
    
    if heart_rate < 60:
        abnormality = "Bradycardia"
        recommendation = "Heart rate is lower than normal. Consult a doctor if you experience dizziness or fatigue."
    elif heart_rate > 100:
        abnormality = "Tachycardia"
        recommendation = "Heart rate is higher than normal. Avoid caffeine/stress and consult a doctor if persistent."
        
    # Stress Level Estimation (Simple Heuristic based on HRV)
    # SDNN (Standard Deviation of NN intervals) is a common HRV metric
    # Lower HRV often correlates with higher stress
    sdnn = np.std(rr_intervals)
    
    # Thresholds are approximate/heuristic for this demo
    # Normal SDNN is often > 50ms (0.05s)
    if sdnn < 0.03: # Very low variability
        stress_level = "High"
    elif sdnn < 0.06:
        stress_level = "Moderate"
    else:
        stress_level = "Low"
        
    # Confidence Score (Placeholder)
    # Based on regularity of peaks?
    
    return {
        'heart_rate': round(heart_rate, 1),
        'sdnn_ms': round(sdnn * 1000, 1), # Conversion to ms
        'abnormality': abnormality,
        'stress_level': stress_level,
        'recommendation': recommendation
    }
