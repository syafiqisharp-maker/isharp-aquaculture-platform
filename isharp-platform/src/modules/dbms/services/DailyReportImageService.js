/**
 * iSHARP DBMS 2.0 — Daily Report Image Docking & Zoom Service
 * Manages photo docking, FileReader base64 serialization, sessionStorage/localStorage caching,
 * and zoom container toggling for Card 3 (Lab Telemetry) and Card 6 (Whiteboard Schedule).
 */

export const LAB_IMAGE_STORAGE_KEY = "isharp_lab_image_dock";
export const WHITEBOARD_IMAGE_STORAGE_KEY = "isharp_whiteboard_dock_photo";

export class DailyReportImageService {
    /**
     * Converts a File blob into base64 Data URL.
     * @param {File} file 
     * @returns {Promise<string>}
     */
    static readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || !file.type.startsWith("image/")) {
                reject(new Error("Invalid image file"));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Sets docked image elements in Card 3.
     */
    static setLabDockedImage(dataUrl) {
        if (!dataUrl) return;
        const img = document.getElementById("dr-lab-docked-img");
        const placeholder = document.getElementById("dr-lab-image-placeholder");
        const dockedView = document.getElementById("dr-lab-docked-view");
        if (img && placeholder && dockedView) {
            img.src = dataUrl;
            placeholder.style.display = "none";
            dockedView.style.display = "block";
        }
    }

    /**
     * Clears docked image and removes from sessionStorage.
     */
    static clearLabDockedImage() {
        const img = document.getElementById("dr-lab-docked-img");
        const placeholder = document.getElementById("dr-lab-image-placeholder");
        const dockedView = document.getElementById("dr-lab-docked-view");
        const btnZoom = document.getElementById("btn-zoom-lab-img");
        if (img && placeholder && dockedView) {
            img.src = "";
            img.style.width = "100%";
            img.style.minWidth = "auto";
            if (btnZoom) btnZoom.innerText = "🔍 Zoom";
            placeholder.style.display = "block";
            dockedView.style.display = "none";
        }
        try {
            sessionStorage.removeItem(LAB_IMAGE_STORAGE_KEY);
        } catch (e) {}
    }

    /**
     * Toggles zoom view for Card 3 lab screenshot.
     * @param {boolean} currentZoomState 
     * @returns {boolean} New zoom state
     */
    static toggleLabImageZoom(currentZoomState) {
        const img = document.getElementById("dr-lab-docked-img");
        const btnZoom = document.getElementById("btn-zoom-lab-img");
        if (!img) return currentZoomState;
        const nextState = !currentZoomState;
        if (nextState) {
            img.style.width = "auto";
            img.style.minWidth = "180%";
            if (btnZoom) btnZoom.innerText = "🔍 Reset Zoom";
        } else {
            img.style.width = "100%";
            img.style.minWidth = "auto";
            if (btnZoom) btnZoom.innerText = "🔍 Zoom";
        }
        return nextState;
    }

    /**
     * Restores Card 3 image from sessionStorage if present.
     */
    static restoreLabDockedImage() {
        try {
            const savedImg = sessionStorage.getItem(LAB_IMAGE_STORAGE_KEY);
            if (savedImg) {
                this.setLabDockedImage(savedImg);
            }
        } catch (e) {
            console.warn("Could not restore docked lab image:", e);
        }
    }

    /**
     * Toggles whiteboard expanded/collapsed view in Card 6.
     * @param {boolean} currentZoomState 
     * @returns {boolean} New zoom state
     */
    static toggleWhiteboardZoom(currentZoomState) {
        const wrap = document.getElementById("dr-whiteboard-preview-wrap");
        const btn = document.getElementById("btn-toggle-whiteboard-zoom");
        const img = document.getElementById("dr-whiteboard-img");
        if (!wrap || !img) return currentZoomState;
        const nextState = !currentZoomState;
        if (nextState) {
            wrap.style.maxHeight = "540px";
            img.style.maxHeight = "540px";
            if (btn) btn.textContent = "🔍 Collapse View";
        } else {
            wrap.style.maxHeight = "120px";
            img.style.maxHeight = "120px";
            if (btn) btn.textContent = "🔍 Expand View";
        }
        return nextState;
    }

    /**
     * Restores Card 6 whiteboard photo from localStorage.
     */
    static restoreWhiteboardPhoto() {
        try {
            const savedPhoto = localStorage.getItem(WHITEBOARD_IMAGE_STORAGE_KEY);
            if (savedPhoto) {
                const img = document.getElementById("dr-whiteboard-img");
                if (img) img.src = savedPhoto;
            }
        } catch (e) {
            console.warn("Could not restore whiteboard photo:", e);
        }
    }
}
