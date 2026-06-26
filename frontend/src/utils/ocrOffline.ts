import { createWorker } from 'tesseract.js'

interface OCRResult {
  text: string
  confidence: number
}

/**
 * Performs client-side/offline OCR scanning using Tesseract.js
 * @param file The image file (Blob/File) to read
 * @param onProgress Callback to track percentage progress (0 to 100)
 */
export async function performLocalOCR(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const worker = await createWorker('eng')
  
  try {
    const { data: { text, confidence } } = await worker.recognize(file)
    
    if (onProgress) {
      onProgress(100)
    }

    return {
      text,
      confidence
    }
  } catch (error) {
    console.error("Local Tesseract OCR error:", error)
    throw error;
  } finally {
    await worker.terminate()
  }
}
