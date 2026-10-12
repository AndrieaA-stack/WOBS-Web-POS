
        // State Variables
        let codeReader = null;
        let selectedDeviceId = null;
        let isScanningPaused = false;
        let soundEnabled = true;
        let torchActive = false;
        let currentStreamTrack = null;
        let scanHistory = [];
        let ocrImageSource = null;

        // Smart Navigation Function to return to Admin or Customer Page
        function goBackToApp() {
            if (codeReader) {
                try {
                    codeReader.reset();
                } catch (e) {
                    console.warn("Scanner stop error:", e);
                }
            }

            if (document.referrer && (document.referrer.includes("Admin.html") || document.referrer.includes("Customer.html"))) {
                window.location.href = document.referrer;
            } else {
                window.location.href = "Customer.html";
            }
        }

        // Audio Context Synthesizer for scan beep feedback
        let audioCtx = null;
        function playBeepSound() {
            if (!soundEnabled) return;
            try {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-sky-50', 'text-sky-700', 'border-sky-200');
                btn.classList.add('text-slate-600', 'hover:text-slate-900', 'hover:bg-slate-100');
            });
            const targetBtn = document.getElementById(`tab-${tabId}`);
            if (targetBtn) {
                targetBtn.classList.add('active', 'bg-sky-50', 'text-sky-700', 'border-sky-200');
                targetBtn.classList.remove('text-slate-600', 'hover:text-slate-900', 'hover:bg-slate-100');
            }

            document.querySelectorAll('.tab-content').forEach(view => view.classList.add('hidden'));
            
            const targetView = document.getElementById(`view-${tabId}`);
            if (targetView) targetView.classList.remove('hidden');

            if (tabId === 'camera') {
                if (!codeReader) initCamera();
            }
        }

        async function initCamera() {
            const notice = document.getElementById('cameraStateNotice');
            notice.classList.add('hidden');

            try {
                if (!codeReader) {
                    codeReader = new ZXing.BrowserMultiFormatReader();
                }

                const videoInputDevices = await codeReader.listVideoInputDevices();
                const cameraSelect = document.getElementById('cameraSelect');
                cameraSelect.innerHTML = '';

                if (videoInputDevices.length === 0) {
                    showCameraNotice('No Video Inputs', 'No camera hardware found on this device.');
                    return;
                }

                let backCam = videoInputDevices.find(dev => dev.label.toLowerCase().includes('back') || dev.label.toLowerCase().includes('rear'));
                selectedDeviceId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;

                videoInputDevices.forEach(device => {
                    const opt = document.createElement('option');
                    opt.value = device.deviceId;
                    opt.text = device.label || `Camera ${cameraSelect.length + 1}`;
                    if (device.deviceId === selectedDeviceId) opt.selected = true;
                    cameraSelect.appendChild(opt);
                });

                startContinuousScanning();
            } catch (err) {
                console.error("Camera Init Error:", err);
                showCameraNotice('Camera Access Denied', 'Please allow camera permission in your browser address bar.');
            }
        }

        function startContinuousScanning() {
            if (!codeReader || !selectedDeviceId) return;

            codeReader.decodeFromVideoDevice(selectedDeviceId, 'videoPreview', (result, err) => {
                if (result && !isScanningPaused) {
                    handleSuccessfulScan(result.getText(), result.getBarcodeFormat() || 'BARCODE', 'Live Camera');
                }
            }).then(controls => {
                const videoElem = document.getElementById('videoPreview');
                if (videoElem.srcObject) {
                    const tracks = videoElem.srcObject.getVideoTracks();
                    if (tracks.length > 0) {
                        currentStreamTrack = tracks[0];
                        const capabilities = currentStreamTrack.getCapabilities ? currentStreamTrack.getCapabilities() : {};
                        const torchBtn = document.getElementById('torchToggleBtn');
                        torchBtn.disabled = !capabilities.torch;
                    }
                }
            }).catch(err => {
                console.error("Decode Video error:", err);
            });
        }

        function showCameraNotice(title, message) {
            const notice = document.getElementById('cameraStateNotice');
            document.getElementById('cameraNoticeTitle').innerText = title;
            document.getElementById('cameraNoticeMessage').innerText = message;
            notice.classList.remove('hidden');
        }

        let lastScannedText = "";
        let lastScanTime = 0;

        function handleSuccessfulScan(text, format, source) {
            const now = Date.now();
            if (text === lastScannedText && (now - lastScanTime) < 1500) return;

            lastScannedText = text;
            lastScanTime = now;

            playBeepSound();
            triggerFlashEffect();

            const formatName = typeof format === 'symbol' ? format.toString() : String(format);

            const liveResultCard = document.getElementById('liveResultCard');
            const liveStatusBadge = document.getElementById('liveStatusBadge');
            const liveActionGroup = document.getElementById('liveActionGroup');

            liveStatusBadge.innerText = "DETECTED";
            liveStatusBadge.className = "text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono font-bold border border-emerald-200";

            liveResultCard.innerHTML = `
                <div class="space-y-1">
                    <span class="text-[10px] uppercase font-mono tracking-wider text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded border border-sky-200">
                        ${formatName}
                    </span>
                    <p class="text-base font-mono font-bold text-slate-800 break-all mt-1">${escapeHtml(text)}</p>
                    <p class="text-[10px] text-slate-400">${new Date().toLocaleTimeString()}</p>
                </div>
            `;

            liveActionGroup.classList.remove('hidden');

            document.getElementById('liveCopyBtn').onclick = () => copyToClipboard(text);
            document.getElementById('liveSearchBtn').onclick = () => openLookupModal(text, formatName);

            addToHistory(text, formatName, source);
            showToast(`Scanned: ${text.substring(0, 18)}...`, "success");
        }

        function triggerFlashEffect() {
            const flash = document.getElementById('flashOverlay');
            flash.classList.remove('flash-success');
            void flash.offsetWidth;
            flash.classList.add('flash-success');
        }

        function initUploadScanner() {
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');

            dropZone.onclick = () => fileInput.click();

            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.classList.add('border-sky-500', 'bg-sky-50/50');
            };

            dropZone.ondragleave = () => {
                dropZone.classList.remove('border-sky-500', 'bg-sky-50/50');
            };

            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-sky-500', 'bg-sky-50/50');
                if (e.dataTransfer.files.length > 0) {
                    handleImageFile(e.dataTransfer.files[0]);
                }
            };

            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    handleImageFile(e.target.files[0]);
                }
            };
        }

        function handleImageFile(file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imgUrl = e.target.result;
                const imgPreview = document.getElementById('uploadImagePreview');
                imgPreview.src = imgUrl;

                document.getElementById('uploadPreviewContainer').classList.remove('hidden');
                
                const outputDiv = document.getElementById('uploadResultOutput');
                outputDiv.innerHTML = `<span class="text-xs text-slate-500"><i class="fa-solid fa-spinner animate-spin"></i> Decoding image barcode...</span>`;

                try {
                    const tempImg = new Image();
                    tempImg.src = imgUrl;
                    await tempImg.decode();

                    const reader = new ZXing.BrowserMultiFormatReader();
                    const result = await reader.decodeFromImageElement(tempImg);

                    if (result) {
                        const format = result.getBarcodeFormat() || 'BARCODE';
                        const text = result.getText();

                        outputDiv.innerHTML = `
                            <p class="text-xs font-mono text-emerald-600 font-semibold"><i class="fa-solid fa-circle-check"></i> Barcode Found (${format})</p>
                            <p class="text-sm font-mono font-bold text-slate-800 break-all">${escapeHtml(text)}</p>
                        `;

                        document.getElementById('uploadActions').classList.remove('hidden');
                        document.getElementById('uploadCopyBtn').onclick = () => copyToClipboard(text);
                        document.getElementById('uploadSearchBtn').onclick = () => openLookupModal(text, format);

                        handleSuccessfulScan(text, format, 'Image File');
                    }
                } catch (err) {
                    console.warn("Upload decode error:", err);
                    outputDiv.innerHTML = `
                        <div class="space-y-2">
                            <p class="text-xs text-rose-600 font-semibold"><i class="fa-solid fa-circle-xmark"></i> No Barcode Detected</p>
                            <p class="text-[11px] text-slate-500">Barcode lines might be damaged or unreadable. Try switching to the <b>Read Digits (OCR)</b> tab to extract the numbers under the barcode.</p>
                        </div>
                    `;
                    document.getElementById('uploadActions').classList.add('hidden');
                }
            };
            reader.readAsDataURL(file);
        }

        function initOCRScanner() {
            const fileInput = document.getElementById('ocrFileInput');
            const snapBtn = document.getElementById('ocrSnapCameraBtn');
            const runOcrBtn = document.getElementById('runOcrBtn');

            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    loadOcrImageFromFile(e.target.files[0]);
                }
            };

            snapBtn.onclick = () => snapCameraFrameForOcr();
            runOcrBtn.onclick = () => executeOcrProcessing();
        }

        function loadOcrImageFromFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    ocrImageSource = img;
                    renderOcrCanvas();
                    document.getElementById('ocrWorkspace').classList.remove('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function snapCameraFrameForOcr() {
            const video = document.getElementById('videoPreview');
            if (!video.srcObject || video.videoWidth === 0) {
                showToast("Live camera must be active to take snapshot", "warning");
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const img = new Image();
            img.onload = () => {
                ocrImageSource = img;
                renderOcrCanvas();
                document.getElementById('ocrWorkspace').classList.remove('hidden');
                showToast("Camera frame captured for OCR", "info");
            };
            img.src = canvas.toDataURL('image/png');
        }

        function renderOcrCanvas() {
            if (!ocrImageSource) return;
            const canvas = document.getElementById('ocrCanvas');
            const ctx = canvas.getContext('2d');

            canvas.width = ocrImageSource.width;
            canvas.height = ocrImageSource.height;

            ctx.drawImage(ocrImageSource, 0, 0);

            const grayscaleChecked = document.getElementById('ocrGrayscale').checked;
            if (grayscaleChecked) {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                    const val = avg > 120 ? 255 : 0;
                    data[i] = val;
                    data[i + 1] = val;
                    data[i + 2] = val;
                }
                ctx.putImageData(imgData, 0, 0);
            }
        }

        document.getElementById('ocrGrayscale').addEventListener('change', () => renderOcrCanvas());

        async function executeOcrProcessing() {
            const canvas = document.getElementById('ocrCanvas');
            const statusText = document.getElementById('ocrProgressStatus');
            const progressBar = document.getElementById('ocrProgressBar');
            const progressFill = document.getElementById('ocrProgressFill');
            const resultBox = document.getElementById('ocrResultBox');
            const actions = document.getElementById('ocrActions');

            statusText.classList.remove('hidden');
            progressBar.classList.remove('hidden');
            progressFill.style.width = "10%";
            resultBox.innerText = "Analyzing text and numbers...";

            try {
                const worker = await Tesseract.createWorker('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789- ',
                });

                const ret = await worker.recognize(canvas);
                await worker.terminate();

                const extractedText = ret.data.text.trim().replace(/\n/g, ' ');
                const cleanDigits = extractedText.replace(/[^0-9]/g, '');

                progressFill.style.width = "100%";
                statusText.innerText = "Complete";

                if (cleanDigits.length > 0) {
                    resultBox.innerHTML = `
                        <p class="text-xs text-slate-500 mb-1">Clean Digits Extracted:</p>
                        <p class="text-lg font-mono font-bold text-sky-700 break-all">${cleanDigits}</p>
                        ${extractedText !== cleanDigits ? `<p class="text-[10px] text-slate-400 mt-2">Raw OCR Text: ${escapeHtml(extractedText)}</p>` : ''}
                    `;
                    actions.classList.remove('hidden');

                    document.getElementById('ocrCopyBtn').onclick = () => copyToClipboard(cleanDigits);
                    document.getElementById('ocrSearchBtn').onclick = () => openLookupModal(cleanDigits, 'OCR Digits');

                    handleSuccessfulScan(cleanDigits, 'OCR-Digits', 'OCR Scanner');
                } else {
                    resultBox.innerText = "No clear digits detected in image. Ensure numbers under the barcode are in focus.";
                    actions.classList.add('hidden');
                }
            } catch (err) {
                console.error("Tesseract OCR Error:", err);
                resultBox.innerText = "Error executing OCR scan. Please try a cleaner image snapshot.";
            } finally {
                setTimeout(() => {
                    progressBar.classList.add('hidden');
                    statusText.classList.add('hidden');
                }, 1000);
            }
        }

        function initBarcodeGenerator() {
            const genBtn = document.getElementById('generateBtn');
            const symbologySelect = document.getElementById('genSymbology');
            const valInput = document.getElementById('genValue');

            genBtn.onclick = () => renderGeneratedBarcode();

            symbologySelect.onchange = () => {
                const val = symbologySelect.value;
                const hint = document.getElementById('genFormatHint');
                if (val === 'EAN13') {
                    valInput.value = "7350053850019";
                    hint.innerText = "EAN-13 requires exactly 12 or 13 numbers.";
                } else if (val === 'UPC') {
                    valInput.value = "012345678905";
                    hint.innerText = "UPC-A requires 12 numeric digits.";
                } else if (val === 'QR') {
                    valInput.value = "https://example.com";
                    hint.innerText = "QR Code accepts any text or Web URL.";
                } else {
                    valInput.value = "SCAN-VISION-123";
                    hint.innerText = "Standard alphanumeric text string.";
                }
                renderGeneratedBarcode();
            };

            document.getElementById('downloadGenBtn').onclick = () => downloadGeneratedBarcode();
            renderGeneratedBarcode();
        }

        function renderGeneratedBarcode() {
            const format = document.getElementById('genSymbology').value;
            const value = document.getElementById('genValue').value.trim();
            const svgElem = document.getElementById('genBarcodeSvg');
            const qrDiv = document.getElementById('genQrDiv');

            if (!value) {
                showToast("Please enter a value to generate barcode", "warning");
                return;
            }

            if (format === 'QR') {
                svgElem.style.display = 'none';
                qrDiv.style.display = 'block';
                qrDiv.innerHTML = '';
                new QRCode(qrDiv, {
                    text: value,
                    width: 160,
                    height: 160,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                qrDiv.style.display = 'none';
                svgElem.style.display = 'block';
                try {
                    JsBarcode("#genBarcodeSvg", value, {
                        format: format,
                        lineColor: "#000000",
                        width: 2,
                        height: 80,
                        displayValue: true,
                        fontSize: 14,
                        font: "monospace"
                    });
                } catch (err) {
                    showToast("Invalid value format for " + format, "error");
                }
            }
        }

        function downloadGeneratedBarcode() {
            const format = document.getElementById('genSymbology').value;
            if (format === 'QR') {
                const img = document.querySelector('#genQrDiv img');
                if (img) {
                    const a = document.createElement('a');
                    a.href = img.src;
                    a.download = `qrcode_${Date.now()}.png`;
                    a.click();
                }
            } else {
                const svg = document.getElementById('genBarcodeSvg');
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
                const URL = window.URL || window.webkitURL || window;
                const blobURL = URL.createObjectURL(svgBlob);
                
                const a = document.createElement('a');
                a.href = blobURL;
                a.download = `barcode_${format}_${Date.now()}.svg`;
                a.click();
            }
        }

        function loadHistory() {
            const saved = localStorage.getItem('scan_vision_history');
            if (saved) {
                try {
                    scanHistory = JSON.parse(saved);
                } catch (e) {
                    scanHistory = [];
                }
            }
            renderHistoryTable();
        }

        function saveHistory() {
            localStorage.setItem('scan_vision_history', JSON.stringify(scanHistory));
            renderHistoryTable();
        }

        function addToHistory(code, format, source) {
            scanHistory.unshift({
                id: Date.now(),
                code: code,
                format: format,
                source: source,
                time: new Date().toLocaleString()
            });

            if (scanHistory.length > 100) scanHistory.pop();
            saveHistory();
        }

        function renderHistoryTable() {
            const tbody = document.getElementById('historyTableBody');
            const badge = document.getElementById('historyBadge');
            badge.innerText = scanHistory.length;

            if (scanHistory.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-slate-400">
                            <i class="fa-solid fa-inbox text-2xl mb-2 opacity-40 block"></i>
                            No scan history recorded yet.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = scanHistory.map(item => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium border border-slate-200">
                            ${escapeHtml(item.source)}
                        </span>
                    </td>
                    <td class="p-3 font-mono text-sky-700 font-semibold">${escapeHtml(item.format)}</td>
                    <td class="p-3 font-mono font-bold text-slate-800 max-w-xs truncate">${escapeHtml(item.code)}</td>
                    <td class="p-3 text-slate-500 text-[11px]">${escapeHtml(item.time)}</td>
                    <td class="p-3 text-right space-x-1">
                        <button onclick="copyToClipboard('${escapeHtml(item.code)}')" title="Copy Code" class="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition border border-slate-200">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button onclick="openLookupModal('${escapeHtml(item.code)}', '${escapeHtml(item.format)}')" title="Lookup Web" class="p-1.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 transition border border-sky-200">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </button>
                        <button onclick="deleteHistoryItem(${item.id})" title="Delete" class="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition border border-rose-200">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function deleteHistoryItem(id) {
            scanHistory = scanHistory.filter(i => i.id !== id);
            saveHistory();
            showToast("Item deleted", "info");
        }

        function clearHistory() {
            if (scanHistory.length === 0) return;
            scanHistory = [];
            saveHistory();
            showToast("Scan history cleared", "info");
        }

        function openLookupModal(code, format) {
            const modal = document.getElementById('lookupModal');
            document.getElementById('modalFormatBadge').innerText = format || 'BARCODE';
            document.getElementById('modalBarcodeText').innerText = code;

            const encoded = encodeURIComponent(code);
            document.getElementById('btnSearchGoogle').href = `https://www.google.com/search?q=${encoded}`;
            document.getElementById('btnSearchOpenFood').href = `https://world.openfoodfacts.org/product/${encoded}`;
            document.getElementById('btnSearchAmazon').href = `https://www.amazon.com/s?k=${encoded}`;

            modal.classList.remove('hidden');
        }

        function closeLookupModal() {
            document.getElementById('lookupModal').classList.add('hidden');
        }

        function copyToClipboard(text) {
            const dummy = document.createElement("textarea");
            document.body.appendChild(dummy);
            dummy.value = text;
            dummy.select();
            document.execCommand("copy");
            document.body.removeChild(dummy);
            showToast("Copied code to clipboard!", "success");
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');

            let bg = "bg-white border-slate-200 text-slate-700";
            let icon = "fa-circle-info text-sky-600";
            if (type === 'success') { bg = "bg-white border-emerald-200 text-emerald-800"; icon = "fa-circle-check text-emerald-600"; }
            if (type === 'warning') { bg = "bg-white border-amber-200 text-amber-800"; icon = "fa-triangle-exclamation text-amber-600"; }
            if (type === 'error') { bg = "bg-white border-rose-200 text-rose-800"; icon = "fa-circle-xmark text-rose-600"; }

            toast.className = `pointer-events-auto px-4 py-3 rounded-xl border ${bg} shadow-lg flex items-center space-x-2 text-xs font-medium transition-all duration-300 transform translate-y-2 opacity-0`;
            toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        window.onload = () => {
            document.getElementById('soundToggleBtn').onclick = () => {
                soundEnabled = !soundEnabled;
                const icon = document.getElementById('soundToggleBtn').querySelector('i');
                icon.className = soundEnabled ? "fa-solid fa-volume-high text-sm" : "fa-solid fa-volume-xmark text-sm text-slate-400";
                showToast(soundEnabled ? "Audio beep enabled" : "Audio muted", "info");
            };

            document.getElementById('torchToggleBtn').onclick = async () => {
                if (!currentStreamTrack) return;
                try {
                    torchActive = !torchActive;
                    await currentStreamTrack.applyConstraints({
                        advanced: [{ torch: torchActive }]
                    });
                    const btn = document.getElementById('torchToggleBtn');
                    btn.classList.toggle('text-amber-500', torchActive);
                } catch (e) {
                    showToast("Flashlight unavailable on this hardware", "warning");
                }
            };

            document.getElementById('cameraSelect').onchange = (e) => {
                selectedDeviceId = e.target.value;
                if (codeReader) {
                    codeReader.reset();
                    startContinuousScanning();
                }
            };

            document.getElementById('toggleScanBtn').onclick = () => {
                isScanningPaused = !isScanningPaused;
                const btn = document.getElementById('toggleScanBtn');

                if (isScanningPaused) {
                    btn.innerHTML = `<i class="fa-solid fa-play text-emerald-600"></i><span>Resume</span>`;
                    showToast("Scanner paused", "info");
                } else {
                    btn.innerHTML = `<i class="fa-solid fa-pause text-sky-600"></i><span>Pause</span>`;
                    showToast("Scanner resumed", "info");
                }
            };

            initCamera();
            initUploadScanner();
            initOCRScanner();
            initBarcodeGenerator();
            loadHistory();
        };
