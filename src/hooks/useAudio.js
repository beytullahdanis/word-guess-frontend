import { useState, useCallback } from 'react'
import socket from '../socket'

const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [error, setError] = useState(null)

  // Tarayıcı desteğini kontrol et
  const checkBrowserSupport = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tarayıcınız mikrofon özelliğini desteklemiyor.');
    }
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      checkBrowserSupport();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket.connected) {
          // Ses verisini blob'a çevir ve socket üzerinden gönder
          const audioBlob = new Blob([e.data], { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.onloadend = () => {
            socket.emit('audio', {
              audio: reader.result,
              timestamp: Date.now()
            });
          };
          
          reader.readAsDataURL(audioBlob);
        }
      };

      recorder.onerror = (event) => {
        console.error('Kayıt hatası:', event.error);
        setError('Kayıt sırasında bir hata oluştu.');
        stopRecording();
      };

      recorder.start(100); // Her 100ms'de bir veri gönder
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error);
      setError(error.message || 'Mikrofona erişilemiyor.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Kayıt durdurma hatası:', error);
      }
      setIsRecording(false);
      setMediaRecorder(null);
    }
  }, [mediaRecorder]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error
  };
};

export default useAudio; 