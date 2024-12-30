import { useState, useCallback } from 'react'

const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // Burada ses verisi stream edilebilir
          // Örneğin: socket.emit('audio', e.data)
        }
      }

      recorder.start(100) // Her 100ms'de bir veri gönder
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
    }
  }, [mediaRecorder])

  return {
    isRecording,
    startRecording,
    stopRecording
  }
}

export default useAudio 