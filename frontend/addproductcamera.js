// ==========================================
// 1. PRODUCT PHOTO CAMERA (DATABASE IMAGE)
// ==========================================
let mediaStream = null;

async function startCamera() {
  // CRITICAL: Stop barcode scanner first to prevent camera hardware collision!
  stopBarcodeScanner();

  const video = document.getElementById('camera-video');
  const placeholder = document.getElementById('camera-placeholder');
  const startBtn = document.getElementById('btn-start-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const imagePreview = document.getElementById('image-preview');

  try {

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = mediaStream;


    video.onloadedmetadata = () => {
      video.play();
      video.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
      if (imagePreview) imagePreview.classList.add('hidden');

      if (startBtn) startBtn.classList.add('hidden');
      if (retakeBtn) retakeBtn.classList.add('hidden');
      if (captureBtn) captureBtn.classList.remove('hidden');
    };
  } catch (err) {
    alert('Unable to access camera for photo. Please check camera permissions in your browser.');
    console.error('Photo Camera Access Error:', err);
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const imagePreview = document.getElementById('image-preview');
  const photoInput = document.getElementById('prod-photo-base64');

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Image = canvas.toDataURL('image/jpeg', 0.85);


  if (photoInput) {
    photoInput.value = base64Image;
    console.log("📸 Image written to input! Length:", photoInput.value.length);
  } else {
    console.error("❌ Could not find element #prod-photo-base64");
  }

  if (imagePreview) {
    imagePreview.src = base64Image;
    imagePreview.classList.remove('hidden');
  }

  video.classList.add('hidden');

  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  if (captureBtn) captureBtn.classList.add('hidden');
  if (retakeBtn) retakeBtn.classList.remove('hidden');

  stopCameraStream();
}

function retakePhoto() {
  const photoInput = document.getElementById('prod-photo-base64');
  const retakeBtn = document.getElementById('btn-retake-photo');

  if (photoInput) photoInput.value = '';
  if (retakeBtn) retakeBtn.classList.add('hidden');

  startCamera();
}

function stopCameraStream() {
  if (mediaStream) {
    try {
      mediaStream.getTracks().forEach(track => {
        track.stop();
      });
    } catch (e) {
      console.warn("Error stopping photo camera tracks:", e);
    }
    mediaStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) {
    video.srcObject = null;
  }
}

// Clean up both cameras and UI state when product modal closes
function closeProductModal() {
  stopCameraStream();
  stopBarcodeScanner();

  const video = document.getElementById('camera-video');
  const preview = document.getElementById('image-preview');
  const placeholder = document.getElementById('camera-placeholder');
  const startBtn = document.getElementById('btn-start-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const modal = document.getElementById('modal-product');

  if (video) video.classList.add('hidden');
  if (preview) preview.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');

  if (startBtn) startBtn.classList.remove('hidden');
  if (captureBtn) captureBtn.classList.add('hidden');
  if (retakeBtn) retakeBtn.classList.add('hidden');

  if (modal) modal.classList.add('hidden');
}

// ==========================================
// 2. LIVE BARCODE SCANNER (ZXing Engine from Camera.js)
// ==========================================
let barcodeReader = null;
let barcodeDeviceId = null;
let barcodeStreamTrack = null;
let barcodeSoundEnabled = true;
let barcodeTorchActive = false;
let isBarcodeScanning = false;
let audioCtx = null;

function playBeepSound() {
  if (!barcodeSoundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

async function openBarcodeScannerModal() {
  // CRITICAL: Stop photo camera before opening barcode scanner to prevent hardware collision!
  stopCameraStream();

  const photoVideo = document.getElementById('camera-video');
  const startBtn = document.getElementById('btn-start-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const placeholder = document.getElementById('camera-placeholder');
  const preview = document.getElementById('image-preview');

  if (photoVideo) photoVideo.classList.add('hidden');
  if (captureBtn) captureBtn.classList.add('hidden');
  if (preview && preview.src && !preview.classList.contains('hidden')) {
    if (retakeBtn) retakeBtn.classList.remove('hidden');
  } else {
    if (placeholder) placeholder.classList.remove('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
  }

  // Open the scanner modal
  const modal = document.getElementById('modal-barcode-scanner');
  if (modal) modal.classList.remove('hidden');

  // Reset notices
  const notice = document.getElementById('barcode-scanner-notice');
  if (notice) notice.classList.add('hidden');

  await startBarcodeScanner();
}

function closeBarcodeScannerModal() {
  stopBarcodeScanner();
  const modal = document.getElementById('modal-barcode-scanner');
  if (modal) modal.classList.add('hidden');
}

async function startBarcodeScanner() {
  stopBarcodeScanner();

  if (typeof ZXing === 'undefined') {
    showBarcodeNotice("Library Error", "ZXing Barcode library is loading or blocked. Please refresh.");
    return;
  }

  try {
    if (!barcodeReader) {
      barcodeReader = new ZXing.BrowserMultiFormatReader();
    }

    const videoInputDevices = await barcodeReader.listVideoInputDevices();
    const cameraSelect = document.getElementById('barcode-camera-select');
    if (cameraSelect) cameraSelect.innerHTML = '';

    if (!videoInputDevices || videoInputDevices.length === 0) {
      showBarcodeNotice("No Camera Found", "No video camera detected on this system.");
      return;
    }

    // Default to back/rear camera if available
    let backCam = videoInputDevices.find(dev => {
      const label = (dev.label || '').toLowerCase();
      return label.includes('back') || label.includes('rear') || label.includes('environment');
    });
    barcodeDeviceId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;

    if (cameraSelect) {
      videoInputDevices.forEach((device, idx) => {
        const opt = document.createElement('option');
        opt.value = device.deviceId;
        opt.text = device.label || `Camera ${idx + 1}`;
        if (device.deviceId === barcodeDeviceId) opt.selected = true;
        cameraSelect.appendChild(opt);
      });
    }

    const notice = document.getElementById('barcode-scanner-notice');
    if (notice) notice.classList.add('hidden');

    isBarcodeScanning = true;
    barcodeTorchActive = false;

    barcodeReader.decodeFromVideoDevice(barcodeDeviceId, 'barcode-scanner-video', (result, err) => {
      if (result && isBarcodeScanning) {
        const text = result.getText();
        if (text && text.trim() !== '') {
          handleBarcodeDetected(text.trim());
        }
      }
    }).then(controls => {
      const videoElem = document.getElementById('barcode-scanner-video');
      if (videoElem && videoElem.srcObject) {
        const tracks = videoElem.srcObject.getVideoTracks();
        if (tracks.length > 0) {
          barcodeStreamTrack = tracks[0];
          const capabilities = barcodeStreamTrack.getCapabilities ? barcodeStreamTrack.getCapabilities() : {};
          const torchBtn = document.getElementById('btn-barcode-torch');
          if (torchBtn) {
            torchBtn.disabled = !capabilities.torch;
          }
        }
      }
    }).catch(err => {
      console.error("Barcode decode error:", err);
      showBarcodeNotice("Camera In Use", "Could not access camera. Please make sure no other app or tab is using it.");
    });

  } catch (err) {
    console.error("Barcode Scanner Init Error:", err);
    showBarcodeNotice("Camera Permission Denied", "Please allow camera access in your browser address bar.");
  }
}

function stopBarcodeScanner() {
  isBarcodeScanning = false;
  if (barcodeReader) {
    try {
      barcodeReader.reset();
    } catch (e) {
      console.warn("Barcode reader reset error:", e);
    }
  }

  if (barcodeStreamTrack) {
    try {
      barcodeStreamTrack.stop();
    } catch (e) { }
    barcodeStreamTrack = null;
  }

  const barcodeVideo = document.getElementById('barcode-scanner-video');
  if (barcodeVideo && barcodeVideo.srcObject) {
    try {
      barcodeVideo.srcObject.getTracks().forEach(t => t.stop());
    } catch (e) { }
    barcodeVideo.srcObject = null;
  }
}

function changeBarcodeCamera(newDeviceId) {
  if (!newDeviceId || newDeviceId === barcodeDeviceId) return;
  barcodeDeviceId = newDeviceId;
  startBarcodeScanner();
}

function toggleBarcodeTorch() {
  if (!barcodeStreamTrack) return;
  const capabilities = barcodeStreamTrack.getCapabilities ? barcodeStreamTrack.getCapabilities() : {};
  if (!capabilities.torch) return;

  barcodeTorchActive = !barcodeTorchActive;
  barcodeStreamTrack.applyConstraints({
    advanced: [{ torch: barcodeTorchActive }]
  }).then(() => {
    const torchBtn = document.getElementById('btn-barcode-torch');
    if (torchBtn) {
      torchBtn.classList.toggle('btn-primary', barcodeTorchActive);
      torchBtn.classList.toggle('btn-secondary', !barcodeTorchActive);
    }
  }).catch(e => console.warn("Torch error:", e));
}

function toggleBarcodeSound() {
  barcodeSoundEnabled = !barcodeSoundEnabled;
  const soundBtn = document.getElementById('btn-barcode-sound');
  if (soundBtn) {
    soundBtn.innerHTML = barcodeSoundEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark" style="color: #ef4444;"></i>';
  }
}

function showBarcodeNotice(title, msg) {
  const notice = document.getElementById('barcode-scanner-notice');
  const noticeTitle = document.getElementById('barcode-notice-title');
  const noticeMsg = document.getElementById('barcode-notice-msg');
  if (noticeTitle) noticeTitle.innerText = title;
  if (noticeMsg) noticeMsg.innerText = msg;
  if (notice) notice.classList.remove('hidden');
}

function triggerBarcodeFlash() {
  const flash = document.getElementById('barcode-flash-overlay');
  if (flash) {
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
  }
}

function handleBarcodeDetected(scannedCode) {
  if (!scannedCode) return;

  // Audio feedback
  playBeepSound();

  // Visual flash
  triggerBarcodeFlash();

  // Populate barcode input in Product modal
  const input = document.getElementById('prod-barcode');
  if (input) {
    input.value = scannedCode;
    input.classList.add('input-highlight-pulse');
    setTimeout(() => input.classList.remove('input-highlight-pulse'), 1500);
  }

  // Show success indicator message below barcode input
  const successBox = document.getElementById('barcode-scan-success-msg');
  const successText = document.getElementById('barcode-scan-success-text');
  if (successBox && successText) {
    successText.textContent = `Scanned Barcode: ${scannedCode}`;
    successBox.classList.remove('hidden');
  }

  // Cleanly shut down barcode camera immediately
  stopBarcodeScanner();

  // Close scanner modal
  closeBarcodeScannerModal();
}

// Full Scanner App (Camera.html) Integration
function openFullScannerPage() {
  // Save draft form values
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

  // Stop both cameras completely before navigating
  stopCameraStream();
  stopBarcodeScanner();

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
        successText.textContent = `Scanned Barcode: ${scannedCode}`;
        successBox.classList.remove('hidden');
      }
    }

    if (window.history.replaceState && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}