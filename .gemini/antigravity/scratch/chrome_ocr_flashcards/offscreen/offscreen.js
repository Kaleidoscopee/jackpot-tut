console.log("Offscreen document loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Offscreen received message:", request.action);

    if (request.action === "DO_OCR") {
        console.log("Performing OCR with OCR.space API...");
        performOCR(request.imageUrl)
            .then(text => {
                console.log("OCR complete:", text);
                sendResponse({ text: text });
            })
            .catch(error => {
                console.error("OCR error:", error);
                sendResponse({ error: error.message || String(error) });
            });
        return true;
    }
});

async function performOCR(imageDataUrl) {
    try {
        console.log("Sending image to OCR.space API...");

        // Create form data
        const formData = new FormData();
        formData.append('base64Image', imageDataUrl);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('OCREngine', '2');

        // Call OCR.space free API
        const apiResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': 'K87899142388957'
            },
            body: formData
        });

        const result = await apiResponse.json();
        console.log("OCR API response:", result);

        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage || 'OCR processing failed');
        }

        const text = result.ParsedResults?.[0]?.ParsedText || '';
        return text.trim() || "(No text detected)";

    } catch (error) {
        console.error("OCR error:", error);
        throw error;
    }
}
