document.addEventListener('DOMContentLoaded', () => {
    const cursors = document.querySelectorAll('.cursor');
    const imageContainers = document.querySelectorAll('.image-container');
    const psnrMasks = document.querySelectorAll('.psnr-mask');
    const ssimMasks = document.querySelectorAll('.ssim-mask');
    const diffMasks = document.querySelectorAll('.diff-mask');
    const originalImages = document.querySelectorAll('.original-image');
    const psnrButtons = document.querySelectorAll('.toggle-psnr');
    const ssimButtons = document.querySelectorAll('.toggle-ssim');
    const diffButtons = document.querySelectorAll('.toggle-diff');
    const originalButtons = document.querySelectorAll('.toggle-original');
    const diffSliders = document.querySelectorAll('.diff-slider');
    const diffInputs = document.querySelectorAll('.diff-input');

    let cursorX = 0;
    let cursorY = 0;
    const psnrValues = [];
    const ssimValues = [];
    const modifiedStates = {};
    const thresholdValues = {}; // Store the last used threshold for each image

    let sliderTimeout;

    const updateCursors = (display, activeIndex) => {
        cursors.forEach((cursor, index) => {
            const container = cursor.parentElement;
            const rect = container.querySelector('img').getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollLeft = container.scrollLeft;
            const scrollTop = container.scrollTop;
            const x = cursorX * rect.width + scrollLeft;
            const y = cursorY * rect.height + scrollTop;

            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                cursor.style.left = `${x}px`;
                cursor.style.top = `${y}px`;
                cursor.style.display = display;
                if (index === activeIndex) {
                    cursor.classList.add('blue-cursor');
                } else {
                    cursor.classList.remove('blue-cursor');
                }
            } else {
                cursor.style.display = 'none';
            }
        });
    };

    document.addEventListener('mousemove', (e) => {
        imageContainers.forEach((container, index) => {
            const rect = container.querySelector('img').getBoundingClientRect();
            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                cursorX = (e.clientX - rect.left) / rect.width;
                cursorY = (e.clientY - rect.top) / rect.height;
                updateCursors('block', index);
            } else {
                updateCursors('block', -1);
            }
        });
    });

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.src = src;
        });
    };

    const calculateDiff = async (imgCanvas, groundtruthCanvas, threshold) => {
        const width = imgCanvas.width;
        const height = imgCanvas.height;
        const imgCtx = imgCanvas.getContext('2d');
        const groundtruthCtx = groundtruthCanvas.getContext('2d');

        const imgData = imgCtx.getImageData(0, 0, width, height);
        const groundtruthData = groundtruthCtx.getImageData(0, 0, width, height);

        const diffCanvas = document.createElement('canvas');
        diffCanvas.width = width;
        diffCanvas.height = height;
        const diffCtx = diffCanvas.getContext('2d');
        const diffImageData = diffCtx.createImageData(width, height);

        for (let i = 0; i < imgData.data.length; i += 4) {
            const rDiff = Math.abs(imgData.data[i] - groundtruthData.data[i]);
            const gDiff = Math.abs(imgData.data[i + 1] - groundtruthData.data[i + 1]);
            const bDiff = Math.abs(imgData.data[i + 2] - groundtruthData.data[i + 2]);

            const norm = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
            const intensity = Math.min(255, norm);

            if (intensity > threshold) {
                diffImageData.data[i] = 255; // Red
                diffImageData.data[i + 1] = 0; // Green
                diffImageData.data[i + 2] = 0; // Blue
                diffImageData.data[i + 3] = 255; // Alpha
            } else {
                diffImageData.data[i] = imgData.data[i];
                diffImageData.data[i + 1] = imgData.data[i + 1];
                diffImageData.data[i + 2] = imgData.data[i + 2];
                diffImageData.data[i + 3] = 255; // Full opacity
            }
        }

        diffCtx.putImageData(diffImageData, 0, 0);
        return diffCanvas.toDataURL();
    };

    const calculatePSNR = (originalData, groundtruthData, width, height) => {
        let mse = 0;
        for (let i = 0; i < originalData.length; i += 4) {
            mse += (originalData[i] - groundtruthData[i]) ** 2;
            mse += (originalData[i + 1] - groundtruthData[i + 1]) ** 2;
            mse += (originalData[i + 2] - groundtruthData[i + 2]) ** 2;
        }
        mse /= (width * height * 3);

        const psnr = 10 * Math.log10((255 * 255) / mse);
        return psnr;
    };

    const calculateSSIM = (originalData, groundtruthData, width, height) => {
        let ssimSum = 0;
        for (let i = 0; i < originalData.length; i += 4) {
            const lOrig = 0.2126 * originalData[i] + 0.7152 * originalData[i + 1] + 0.0722 * originalData[i + 2];
            const lGt = 0.2126 * groundtruthData[i] + 0.7152 * groundtruthData[i + 1] + 0.0722 * groundtruthData[i + 2];

            const cOrig = Math.sqrt((originalData[i] ** 2 + originalData[i + 1] ** 2 + originalData[i + 2] ** 2) / 3);
            const cGt = Math.sqrt((groundtruthData[i] ** 2 + groundtruthData[i + 1] ** 2 + groundtruthData[i + 2] ** 2) / 3);

            const ssim = ((2 * lOrig * lGt + 0.01) * (2 * cOrig * cGt + 0.03)) /
                         ((lOrig ** 2 + lGt ** 2 + 0.01) * (cOrig ** 2 + cGt ** 2 + 0.03));

            ssimSum += ssim;
        }
        const ssim = ssimSum / (width * height);
        return ssim;
    };

    const toggleDiff = async (button, index, threshold = 0) => {
        const imgElement = originalImages[index];
        const originalSrc = imgElement.src;
        const groundtruthSrc = document.getElementById('groundtruth').src;
        const diffSlider = diffSliders[index];
        const diffInput = diffInputs[index];
        const isModified = imgElement.getAttribute('data-modified') === 'true';
        const lastThreshold = thresholdValues[originalSrc] || threshold;

        const hideSliderAfterTimeout = () => {
            clearTimeout(sliderTimeout);
            sliderTimeout = setTimeout(() => {
                diffSlider.style.display = 'none';
                diffInput.style.display = 'none';
            }, 5000);
        };

        diffSlider.style.display = 'block';
        diffInput.style.display = 'block';
        diffSlider.max = 255;
        diffSlider.value = lastThreshold; // Set slider to the last used threshold
        diffInput.value = lastThreshold; // Set input to the last used threshold
        hideSliderAfterTimeout();

        if (!isModified) {
            const img = await loadImage(originalSrc);
            const groundtruthImg = await loadImage(groundtruthSrc);

            const imgCanvas = document.createElement('canvas');
            const ctx = imgCanvas.getContext('2d');
            imgCanvas.width = groundtruthImg.width;
            imgCanvas.height = groundtruthImg.height;
            ctx.drawImage(img, 0, 0, imgCanvas.width, imgCanvas.height);

            const groundtruthCanvas = document.createElement('canvas');
            const gtCtx = groundtruthCanvas.getContext('2d');
            groundtruthCanvas.width = groundtruthImg.width;
            groundtruthCanvas.height = groundtruthImg.height;
            gtCtx.drawImage(groundtruthImg, 0, 0);

            const diffDataURL = await calculateDiff(imgCanvas, groundtruthCanvas, lastThreshold);
            modifiedStates[originalSrc] = diffDataURL; // Save the modified state
            imgElement.src = diffDataURL;
            imgElement.setAttribute('data-modified', 'true');
            thresholdValues[originalSrc] = lastThreshold; // Save the last used threshold

            diffSlider.oninput = async function() {
                hideSliderAfterTimeout();
                const newThreshold = parseInt(this.value);
                const diffDataURL = await calculateDiff(imgCanvas, groundtruthCanvas, newThreshold);
                modifiedStates[originalSrc] = diffDataURL; // Save the modified state
                imgElement.src = diffDataURL;
                thresholdValues[originalSrc] = newThreshold; // Save the last used threshold
                diffInput.value = newThreshold; // Update input value
            };

            diffInput.oninput = async function() {
                hideSliderAfterTimeout();
                const newThreshold = parseInt(this.value);
                if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold <= 255) {
                    const diffDataURL = await calculateDiff(imgCanvas, groundtruthCanvas, newThreshold);
                    modifiedStates[originalSrc] = diffDataURL; // Save the modified state
                    imgElement.src = diffDataURL;
                    thresholdValues[originalSrc] = newThreshold; // Save the last used threshold
                    diffSlider.value = newThreshold; // Update slider value
                }
            };
        } else {
            imgElement.src = modifiedStates[originalSrc] || originalSrc;
            imgElement.setAttribute('data-modified', 'true');
            diffSlider.style.display = 'block';
            diffInput.style.display = 'block';
            hideSliderAfterTimeout();
        }
    };

    const toggleOriginal = (index) => {
        const imgElement = originalImages[index];
        const originalSrc = imgElement.getAttribute('data-original-src');
        const isModified = imgElement.getAttribute('data-modified') === 'true';
        const isHidden = imgElement.style.display === 'none';

        if (isModified) {
            imgElement.src = originalSrc;
            imgElement.removeAttribute('data-modified');
        } else if (isHidden) {
            imgElement.style.display = 'block';
        } else {
            imgElement.style.display = 'none';
        }
    };

    const showTooltip = (element, text) => {
        let tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerText = text;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 5}px`;

        element.addEventListener('mouseleave', () => {
            tooltip.remove();
        });
    };

    const initialize = async () => {
        const groundtruthSrc = document.getElementById('groundtruth').src;
        const groundtruthImg = await loadImage(groundtruthSrc);
        const groundtruthCanvas = document.createElement('canvas');
        const gtCtx = groundtruthCanvas.getContext('2d');
        groundtruthCanvas.width = groundtruthImg.width;
        groundtruthCanvas.height = groundtruthImg.height;
        gtCtx.drawImage(groundtruthImg, 0, 0);
        const groundtruthData = gtCtx.getImageData(0, 0, groundtruthCanvas.width, groundtruthCanvas.height).data;

        for (let i = 0; i < originalImages.length; i++) {
            const imgElement = originalImages[i];
            const originalImg = await loadImage(imgElement.src);

            const originalCanvas = document.createElement('canvas');
            const ctx = originalCanvas.getContext('2d');
            originalCanvas.width = groundtruthCanvas.width;
            originalCanvas.height = groundtruthCanvas.height;
            ctx.drawImage(originalImg, 0, 0, originalCanvas.width, originalCanvas.height);

            const originalData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height).data;

            const psnr = calculatePSNR(originalData, groundtruthData, originalCanvas.width, originalCanvas.height);
            const ssim = calculateSSIM(originalData, groundtruthData, originalCanvas.width, originalCanvas.height);

            psnrValues[i] = psnr;
            ssimValues[i] = ssim;
        }
    };

    psnrButtons.forEach((button, index) => {
        button.addEventListener('click', () => togglePSNR(index));
        button.addEventListener('mouseenter', () => {
            const psnr = psnrValues[index];
            showTooltip(button, `PSNR: ${psnr.toFixed(2)}`);
        });
    });

    ssimButtons.forEach((button, index) => {
        button.addEventListener('click', () => toggleSSIM(index));
        button.addEventListener('mouseenter', () => {
            const ssim = ssimValues[index];
            showTooltip(button, `SSIM: ${ssim.toFixed(4)}`);
        });
    });

    diffButtons.forEach((button, index) => {
        button.addEventListener('click', () => toggleDiff(button, index));
    });

    originalButtons.forEach((button, index) => {
        button.addEventListener('click', () => toggleOriginal(index));
    });

    // Store the original src for each image
    originalImages.forEach((imgElement) => {
        imgElement.setAttribute('data-original-src', imgElement.src);
    });

    // Initialize PSNR and SSIM values
    initialize();
});
