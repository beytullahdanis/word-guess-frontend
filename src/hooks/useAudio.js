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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];

      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('Desteklenen ses formatı bulunamadı');
      }

      console.log('Kullanılan ses formatı:', selectedMimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result.split(',')[1];
              socket.emit('audio', {
                audio: base64Audio,
                type: selectedMimeType,
                username: username,
                timestamp: Date.now()
              });
              console.log('Ses verisi gönderildi');
            };
            reader.readAsDataURL(event.data);
          } catch (error) {
            console.error('Ses verisi gönderme hatası:', error);
          }
        }
      };

      mediaRecorder.start();
      setMediaRecorder(mediaRecorder);
      console.log('Ses kaydı başlatıldı');
    } catch (error) {
      console.error('Ses kaydı başlatma hatası:', error);
      setError(error.message);
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