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

      console.log('Mikrofon erişimi isteniyor...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      console.log('Mikrofon erişimi başarılı');

      const recorder = new MediaRecorder(stream);
      console.log('MediaRecorder oluşturuldu:', recorder.state);
      
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && socket.connected) {
          console.log('Ses verisi alındı, boyut:', e.data.size);
          
          // Ses verisini doğrudan ArrayBuffer olarak gönder
          const arrayBuffer = await e.data.arrayBuffer();
          const base64Audio = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          console.log('Ses verisi socket üzerinden gönderiliyor...');
          socket.emit('audio', {
            audio: base64Audio,
            timestamp: Date.now(),
            type: e.data.type
          });
        }
      };

      recorder.onstart = () => {
        console.log('Kayıt başladı');
        setIsRecording(true);
      };

      recorder.onstop = () => {
        console.log('Kayıt durdu');
        setIsRecording(false);
      };

      recorder.onerror = (event) => {
        console.error('Kayıt hatası:', event.error);
        setError('Kayıt sırasında bir hata oluştu.');
        stopRecording();
      };

      recorder.start(1000); // Her saniyede bir veri gönder
      setMediaRecorder(recorder);
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error);
      setError(error.message || 'Mikrofona erişilemiyor.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        console.log('Kayıt durduruluyor...');
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => {
          track.stop();
          console.log('Ses kanalı kapatıldı');
        });
      } catch (error) {
        console.error('Kayıt durdurma hatası:', error);
      }
      setIsRecording(false);
      setMediaRecorder(null);
    }
  }, [mediaRecorder]);

  // Socket bağlantısı koptuğunda kaydı durdur
  socket.on('disconnect', () => {
    if (isRecording) {
      console.log('Socket bağlantısı koptu, kayıt durduruluyor...');
      stopRecording();
    }
  });

  return {
    isRecording,
    startRecording,
    stopRecording,
    error
  };
};

export default useAudio; 