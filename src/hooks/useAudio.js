import { useState, useCallback } from 'react'
import socket from '../socket'

const useAudio = (username) => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [error, setError] = useState(null)

  // Tarayıcı desteğini kontrol et
  const checkBrowserSupport = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tarayıcınız mikrofon özelliğini desteklemiyor.');
    }
  };

  const startRecording = async () => {
    try {
      checkBrowserSupport();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });

      // Sabit format kullan
      const mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Tarayıcınız gerekli ses formatını desteklemiyor');
      }

      console.log('Kullanılan ses formatı:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result.split(',')[1];
              if (socket.connected) {
                socket.emit('audio', {
                  audio: base64Audio,
                  type: mimeType,
                  username: username,
                  timestamp: Date.now()
                });
                console.log('Ses verisi gönderildi, boyut:', event.data.size);
              } else {
                console.error('Socket bağlantısı yok, ses verisi gönderilemedi');
              }
            };
            reader.readAsDataURL(event.data);
          } catch (error) {
            console.error('Ses verisi gönderme hatası:', error);
          }
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Kayıt başladı');
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        console.log('Kayıt durdu');
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('Kayıt hatası:', event.error);
        setError(event.error.message);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(500); // Her yarım saniyede bir veri gönder
      setMediaRecorder(mediaRecorder);
      console.log('Ses kaydı başlatıldı');
    } catch (error) {
      console.error('Ses kaydı başlatma hatası:', error);
      setError(error.message);
      setIsRecording(false);
    }
  };

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