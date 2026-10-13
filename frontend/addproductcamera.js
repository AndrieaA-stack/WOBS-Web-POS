let mediaStream = null;

async function startCamera() {
  const video = document.getElementById('camera-video');
  const placeholder = document.getElementById('camera-placeholder');
  const startBtn = document.getElementById('btn-start-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const imagePreview = document.getElementById('image-preview');

  try {
    // Request camera permissions
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = mediaStream;

    // Display stream UI once video feed begins playing
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
    alert('Unable to access camera. Please make sure camera permissions are allowed in your browser.');
    console.error('Camera Access Error:', err);
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const imagePreview = document.getElementById('image-preview');
  const photoInput = document.getElementById('prod-photo-base64'); // <-- MUST MATCH THIS ID

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Image = canvas.toDataURL('image/jpeg', 0.85);

  // WRITE TO HIDDEN INPUT
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
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

// Clean up camera stream and UI state when modal closes
function closeProductModal() {
  stopCameraStream();

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