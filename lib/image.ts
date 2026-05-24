/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Resizes the image to fit within maxWidth/maxHeight and outputs a compressed JPEG File.
 */
export function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.8): Promise<File> {
    return new Promise((resolve) => {
        // If it's not an image, return the original file
        if (!file || !file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        // If it's an SVG, don't try to compress it (keep vector quality)
        if (file.type === "image/svg+xml") {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Only downscale if the image exceeds the bounds
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(file);
                    return;
                }

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Recreate File object with original name, but jpeg type
                            const newFilename = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                            const compressedFile = new File([blob], newFilename, {
                                type: "image/jpeg",
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = event.target?.result as string;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}
