import { createWorker } from 'tesseract.js'

interface OCRResult {
  text: string
  confidence: number
}


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
