import cv2
import numpy as np

def process_ecg_image(image_path):
    """
    Process the uploaded ECG image to extract the signal.
    """
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not load image")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply adaptive thresholding to isolate grid/signal
    # Gaussian thresholding: 
    #   blockSize needs to be odd (e.g., 15)
    #   C is constant subtracted from mean (e.g., 5)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY_INV, 51, 10)
    
    # Grid removal (optional/simplified)
    # Morphological operations to remove small noise
    kernel = np.ones((2,2), np.uint8)
    processed_img = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    # Signal Extraction (Column-wise scanning)
    # Assumption: The signal is the darkest/most prominent feature.
    # We iterate through each column and find the row index of the signal pixel.
    
    signal = []
    height, width = processed_img.shape
    
    # We scan the middle 80% of the image width to avoid edges
    # margin = int(width * 0.05)
    
    for col in range(width):
        # Get pixels in this column
        column_pixels = processed_img[:, col]
        
        # Find indices where pixel is white (part of signal/grid)
        # Note: We inverted binary, so signal is white (255)
        # But wait, original image signal is black. thresh handles this.
        # adaptiveThreshold with THRESH_BINARY_INV makes dark regions white (255).
        
        signal_pixels = np.where(column_pixels > 0)[0]
        
        if len(signal_pixels) > 0:
            # If multiple pixels found (grid lines etc), take the median or max intensity
            # A simple heuristic: signal is usually thicker or roughly continuous
            # averaged position
            y_pos = np.mean(signal_pixels)
            signal.append(height - y_pos) # Invert Y axis so up is positive
        else:
            # If no signal found in column, use previous value or 0
            # Interpolate later or hold last value
            if len(signal) > 0:
                signal.append(signal[-1])
            else:
                signal.append(height / 2)

    # Normalize/Calibration
    # Centering the signal
    signal = np.array(signal)
    mean_val = np.mean(signal)
    signal = signal - mean_val
    
    # Downsample if too large (e.g., max 2000 points for chart)
    if len(signal) > 2000:
        indices = np.linspace(0, len(signal)-1, 2000).astype(int)
        signal = signal[indices]
    
    return signal.tolist()
