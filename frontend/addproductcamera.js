// ==============================================================
// UNIFIED SMART CAMERA SYSTEM FOR WOBS PRODUCT MANAGEMENT
// Merged Barcode Scanning (ZXing) + Product Photo Capture
// Single camera stream to completely eliminate hardware conflicts!
// ==============================================================

let codeReader = null;
let currentCameraStream = null;
let currentCameraTrack = null;
let selectedCameraDeviceId = null;
let isCameraActive = false;
let isTorchActive = false;
let audioContext = null;
let lastDetectedBarcode = "";
let lastDetectedTime = 0;

// Web Audio API beep sound for barcode detection
function playBeepSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio Context warning:", e);
  }
}

// Start the unified camera for BOTH barcode scanning and photo capture
async function startUnifiedCamera() {
  const video = document.getElementById('camera-video');
  const placeholder = document.getElementById('camera-placeholder');
  const imagePreview = document.getElementById('image-preview');
  const startBtn = document.getElementById('btn-start-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const stopBtn = document.getElementById('btn-stop-camera');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const reticle = document.getElementById('camera-reticle');
  const toolbar = document.getElementById('camera-active-toolbar');

  // If already active, don't restart
  if (isCameraActive && video && video.srcObject) {
    return;
  }

  // Ensure any previous stream is stopped first
  stopUnifiedCamera();

  // Reset UI elements
  if (placeholder) placeholder.classList.add('hidden');
  if (imagePreview) imagePreview.classList.add('hidden');
  if (startBtn) startBtn.classList.add('hidden');
  if (retakeBtn) retakeBtn.classList.add('hidden');
  if (video) video.classList.remove('hidden');

  try {
    if (typeof ZXing === 'undefined') {
      console.warn("ZXing library not yet loaded. Falling back to standard camera.");
      await startFallbackPhotoCamera();
      return;
    }

    if (!codeReader) {
      codeReader = new ZXing.BrowserMultiFormatReader();
    }

    // List available video devices
    let videoInputDevices = [];
    try {
      videoInputDevices = await codeReader.listVideoInputDevices();
    } catch (e) {
      console.warn("Could not list video devices:", e);
    }

    const deviceSelect = document.getElementById('camera-device-select');
    if (deviceSelect) {
      deviceSelect.innerHTML = '';
      if (videoInputDevices.length > 0) {
        // Prefer rear/environment/physical webcam over virtual camera if multiple exist
        if (!selectedCameraDeviceId) {
          let preferred = videoInputDevices.find(dev => {
            const l = (dev.label || '').toLowerCase();
            return (l.includes('back') || l.includes('rear') || l.includes('environment')) && !l.includes('virtual');
          });
          if (!preferred) {
            preferred = videoInputDevices.find(dev => {
              const l = (dev.label || '').toLowerCase();
              return !l.includes('virtual') && !l.includes('bytecast') && !l.includes('obs');
            });
          }
          selectedCameraDeviceId = preferred ? preferred.deviceId : videoInputDevices[0].deviceId;
        }

        videoInputDevices.forEach((dev, idx) => {
          const opt = document.createElement('option');
          opt.value = dev.deviceId;
          opt.text = dev.label || `Camera ${idx + 1}`;
          if (dev.deviceId === selectedCameraDeviceId) opt.selected = true;
          deviceSelect.appendChild(opt);
        });
      } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = 'Default Camera';
        deviceSelect.appendChild(opt);
      }
    }

    isCameraActive = true;

    // Decode from video device directly on 'camera-video'
    codeReader.decodeFromVideoDevice(selectedCameraDeviceId, 'camera-video', (result, err) => {
      if (result && isCameraActive) {
        const text = result.getText();
        if (text && text.trim() !== '') {
          handleUnifiedBarcodeFound(text.trim());
        }
      }
    }).then(controls => {
      if (video && video.srcObject) {
        currentCameraStream = video.srcObject;
        const tracks = currentCameraStream.getVideoTracks();
        if (tracks.length > 0) {
          currentCameraTrack = tracks[0];
          const caps = currentCameraTrack.getCapabilities ? currentCameraTrack.getCapabilities() : {};
          const torchBtn = document.getElementById('btn-camera-torch');
          if (torchBtn) {
            torchBtn.disabled = !caps.torch;
          }
        }
      }

      if (reticle) reticle.classList.remove('hidden');
      if (toolbar) toolbar.classList.remove('hidden');
      if (captureBtn) captureBtn.classList.remove('hidden');
      if (stopBtn) stopBtn.classList.remove('hidden');
    }).catch(async (err) => {
      console.warn("ZXing decodeFromVideoDevice failed, trying fallback stream:", err);
      await startFallbackPhotoCamera();
    });

  } catch (err) {
    console.error("Camera startup error:", err);
    await startFallbackPhotoCamera();
  }
}

// Fallback to standard getUserMedia if ZXing device binding encounters an issue
async function startFallbackPhotoCamera() {
  const video = document.getElementById('camera-video');
  const captureBtn = document.getElementById('btn-capture-photo');
  const stopBtn = document.getElementById('btn-stop-camera');
  const placeholder = document.getElementById('camera-placeholder');

  try {
    currentCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (video) {
      video.srcObject = currentCameraStream;
      video.play();
      video.classList.remove('hidden');
    }
    isCameraActive = true;
    if (placeholder) placeholder.classList.add('hidden');
    if (captureBtn) captureBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
  } catch (e) {
    alert("Unable to open camera. Please ensure camera permissions are allowed in your browser.");
    stopUnifiedCamera();
  }
}

// Handle detected barcode from the live video stream
function handleUnifiedBarcodeFound(barcodeText) {
  const now = Date.now();
  if (barcodeText === lastDetectedBarcode && (now - lastDetectedTime) < 2000) {
    return;
  }
  lastDetectedBarcode = barcodeText;
  lastDetectedTime = now;

  // 1. Audio feedback
  playBeepSound();

  // 2. Visual flash feedback on the viewfinder
  triggerCameraFlash();

  // 3. Fill the barcode input field
  const barcodeInput = document.getElementById('prod-barcode');
  if (barcodeInput) {
    barcodeInput.value = barcodeText;
    barcodeInput.classList.add('input-highlight-pulse');
    setTimeout(() => barcodeInput.classList.remove('input-highlight-pulse'), 1500);
  }

  // 4. Update status badges
  const successBox = document.getElementById('barcode-scan-success-msg');
  const successText = document.getElementById('barcode-scan-success-text');
  if (successBox && successText) {
    successText.textContent = `Barcode Detected: ${barcodeText}`;
    successBox.classList.remove('hidden');
  }

  const statusBadge = document.getElementById('camera-scan-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = `<i class="fa-solid fa-check"></i> Scanned: ${barcodeText}`;
    statusBadge.style.background = '#16a34a';
  }
}

// Trigger button on the barcode input field to focus or start camera
function triggerBarcodeScanFromField() {
  const video = document.getElementById('camera-video');
  if (!isCameraActive || (video && video.classList.contains('hidden'))) {
    startUnifiedCamera();
  } else {
    // Already running, flash the reticle to indicate ready to scan
    triggerCameraFlash();
    const barcodeInput = document.getElementById('prod-barcode');
    if (barcodeInput) barcodeInput.focus();
  }
}

// Snap photo from the live video frame and save to Base64 (products.image)
function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const imagePreview = document.getElementById('image-preview');
  const photoInput = document.getElementById('prod-photo-base64');
  const retakeBtn = document.getElementById('btn-retake-photo');

  if (!video || !canvas) return;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Image = canvas.toDataURL('image/jpeg', 0.85);

  if (photoInput) {
    photoInput.value = base64Image;
    console.log("📸 Product photo captured to Base64! Length:", photoInput.value.length);
  }

  if (imagePreview) {
    imagePreview.src = base64Image;
    imagePreview.classList.remove('hidden');
  }

  // Stop camera stream now that photo is captured
  stopUnifiedCamera();

  if (retakeBtn) retakeBtn.classList.remove('hidden');
}

// Retake photo
function retakePhoto() {
  const photoInput = document.getElementById('prod-photo-base64');
  const retakeBtn = document.getElementById('btn-retake-photo');

  if (photoInput) photoInput.value = '';
  if (retakeBtn) retakeBtn.classList.add('hidden');

  startUnifiedCamera();
}

// Switch camera device (e.g. from front to rear camera)
function changeCameraDevice(newDeviceId) {
  if (!newDeviceId || newDeviceId === selectedCameraDeviceId) return;
  selectedCameraDeviceId = newDeviceId;
  stopUnifiedCamera();
  setTimeout(() => {
    startUnifiedCamera();
  }, 200);
}

// Toggle torch/flashlight if supported
function toggleCameraTorch() {
  if (!currentCameraTrack) return;
  const caps = currentCameraTrack.getCapabilities ? currentCameraTrack.getCapabilities() : {};
  if (!caps.torch) return;

  isTorchActive = !isTorchActive;
  currentCameraTrack.applyConstraints({
    advanced: [{ torch: isTorchActive }]
  }).then(() => {
    const torchBtn = document.getElementById('btn-camera-torch');
    if (torchBtn) {
      torchBtn.style.color = isTorchActive ? '#fbbf24' : '#ffffff';
    }
  }).catch(e => console.warn("Torch constraint error:", e));
}

// Flash overlay animation on barcode detection
function triggerCameraFlash() {
  const flash = document.getElementById('camera-flash-overlay');
  if (flash) {
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
  }
}

// Stop unified camera completely and release all tracks
function stopUnifiedCamera() {
  isCameraActive = false;

  if (codeReader) {
    try {
      codeReader.reset();
    } catch (e) {}
  }

  if (currentCameraTrack) {
    try {
      currentCameraTrack.stop();
    } catch (e) {}
    currentCameraTrack = null;
  }

  if (currentCameraStream) {
    try {
      currentCameraStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    currentCameraStream = null;
  }

  const video = document.getElementById('camera-video');
  if (video) {
    if (video.srcObject) {
      try {
        video.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      video.srcObject = null;
    }
    video.pause();
    video.classList.add('hidden');
  }

  const reticle = document.getElementById('camera-reticle');
  const toolbar = document.getElementById('camera-active-toolbar');
  const captureBtn = document.getElementById('btn-capture-photo');
  const stopBtn = document.getElementById('btn-stop-camera');
  const startBtn = document.getElementById('btn-start-camera');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const imagePreview = document.getElementById('image-preview');
  const placeholder = document.getElementById('camera-placeholder');

  if (reticle) reticle.classList.add('hidden');
  if (toolbar) toolbar.classList.add('hidden');
  if (captureBtn) captureBtn.classList.add('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');

  // If there's an image preview, show retake button; otherwise show start button & placeholder
  if (imagePreview && imagePreview.src && !imagePreview.classList.contains('hidden')) {
    if (retakeBtn) retakeBtn.classList.remove('hidden');
  } else {
    if (placeholder) placeholder.classList.remove('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
  }
}

// Backward-compatible aliases
function startCamera() {
  return startUnifiedCamera();
}

function stopCameraStream() {
  return stopUnifiedCamera();
}

function stopBarcodeScanner() {
  return stopUnifiedCamera();
}

function openBarcodeScannerModal() {
  return triggerBarcodeScanFromField();
}

function closeBarcodeScannerModal() {
  return stopUnifiedCamera();
}

// Clean up state when closing product modal
function closeProductModal() {
  stopUnifiedCamera();

  const modal = document.getElementById('modal-product');
  if (modal) modal.classList.add('hidden');
}

// Standalone Scanner App (Camera.html) Integration
function openFullScannerPage() {
  const draft = {
    id: document.getElementById('prod-id')?.value || '',
    name: document.getElementById('prod-name')?.value || '',
    category: document.getElementById('prod-category')?.value || '',
    cost: document.getElementById('prod-cost')?.value || '',
    price: document.getElementById('prod-price')?.value || '',
    stock: document.getElementById('prod-stock')?.value || '',
    expiry: document.getElementById('prod-expiry')?.value || '',
    photo: document.getElementById('prod-photo-base64')?.value || ''
  };
  sessionStorage.setItem('wobs_product_draft', JSON.stringify(draft));

  stopUnifiedCamera();
  window.location.href = "Camera.html?target=addproduct";
}

function checkScannedBarcodeReturn() {
  const scannedCode = sessionStorage.getItem('wobs_scanned_barcode') || new URLSearchParams(window.location.search).get('barcode');
  const draftStr = sessionStorage.getItem('wobs_product_draft');

  if (scannedCode || draftStr) {
    sessionStorage.removeItem('wobs_scanned_barcode');
    sessionStorage.removeItem('wobs_product_draft');

    const modal = document.getElementById('modal-product');
    if (modal) modal.classList.remove('hidden');

    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.id) document.getElementById('prod-id').value = draft.id;
        if (draft.name) document.getElementById('prod-name').value = draft.name;
        if (draft.category) document.getElementById('prod-category').value = draft.category;
        if (draft.cost) document.getElementById('prod-cost').value = draft.cost;
        if (draft.price) document.getElementById('prod-price').value = draft.price;
        if (draft.stock) document.getElementById('prod-stock').value = draft.stock;
        if (draft.expiry) document.getElementById('prod-expiry').value = draft.expiry;

        if (draft.photo && draft.photo.trim() !== '') {
          const photoInput = document.getElementById('prod-photo-base64');
          const preview = document.getElementById('image-preview');
          const placeholder = document.getElementById('camera-placeholder');
          const startBtn = document.getElementById('btn-start-camera');
          const retakeBtn = document.getElementById('btn-retake-photo');

          if (photoInput) photoInput.value = draft.photo;
          if (preview) {
            preview.src = draft.photo.startsWith('data:') ? draft.photo : `data:image/jpeg;base64,${draft.photo}`;
            preview.classList.remove('hidden');
          }
          if (placeholder) placeholder.classList.add('hidden');
          if (startBtn) startBtn.classList.add('hidden');
          if (retakeBtn) retakeBtn.classList.remove('hidden');
        }
      } catch (e) {
        console.error("Draft restore error:", e);
      }
    }

    if (scannedCode) {
      const input = document.getElementById('prod-barcode');
      if (input) {
        input.value = scannedCode;
        input.classList.add('input-highlight-pulse');
        setTimeout(() => input.classList.remove('input-highlight-pulse'), 1500);
      }
      const successBox = document.getElementById('barcode-scan-success-msg');
      const successText = document.getElementById('barcode-scan-success-text');
      if (successBox && successText) {
        successText.textContent = `Barcode Detected: ${scannedCode}`;
        successBox.classList.remove('hidden');
      }
    }

    if (window.history.replaceState && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}