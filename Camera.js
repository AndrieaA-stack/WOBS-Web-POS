let html5QrcodeScanner = null;
let isScanning = false;

async function startCamera() {
  if (isScanning) return;

  const idleOverlay = document.getElementById('idleOverlay');
  const btnToggle = document.getElementById('btnToggleCamera');
  const msgEl = document.getElementById('camera-status-msg');

  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    msgEl.className = "scan-msg text-red-400 font-semibold";
    msgEl.textContent = "⚠️ Camera requires HTTPS or localhost connection!";
    return;
  }

  try {
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5Qrcode("interactive");
    }

    idleOverlay.classList.add('hidden');

    const config = {
      fps: 20,
      aspectRatio: 1.0,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
        return {
          width: Math.floor(minDimension * 0.85),
          height: Math.floor(minDimension * 0.55)
        };
      },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ]
    };

    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    );

    isScanning = true;
    btnToggle.innerHTML = `<i class="fa-solid fa-stop"></i><span>Stop Camera</span>`;
    btnToggle.className = "flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2";
    msgEl.className = "scan-msg text-blue-400";
    msgEl.textContent = "Camera active. Center the barcode inside the frame...";

  } catch (err) {
    console.error("Camera access error:", err);
    idleOverlay.classList.remove('hidden');
    msgEl.className = "scan-msg text-red-400 font-semibold";
    
    if (err.name === "NotAllowedError") {
      msgEl.textContent = " Camera permission denied. Allow camera access in browser settings.";
    } else {
      msgEl.textContent = " Failed to launch camera: " + (err.message || err);
    }
  }
}

async function stopCamera() {
  if (!isScanning || !html5QrcodeScanner) return;

  const idleOverlay = document.getElementById('idleOverlay');
  const btnToggle = document.getElementById('btnToggleCamera');

  try {
    await html5QrcodeScanner.stop();
    isScanning = false;
    idleOverlay.classList.remove('hidden');
    btnToggle.innerHTML = `<i class="fa-solid fa-power-off"></i><span>Start Camera</span>`;
    btnToggle.className = "flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2";
  } catch (err) {
    console.error("Stop error:", err);
  }
}

function onScanSuccess(decodedText) {
  playBeep();
  localStorage.setItem('wobs_pending_scan', decodedText.trim());
  window.location.href = "Customer.html";
}

function onScanFailure(error) {
  // Silent fail during scanning attempts
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

window.onload = function() {
  const btnToggle = document.getElementById('btnToggleCamera');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      if (isScanning) stopCamera();
      else startCamera();
    });
  }
};