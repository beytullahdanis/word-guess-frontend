import { useState, useCallback, useRef, useEffect } from 'react'
import socket from '../socket'

const useAudio = (username) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isStartingRef = useRef(false);
  const audioContextRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsRecording(false);
    };
  }, []);

  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Kayıt durduruluyor...');
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setError(null);
    } catch (error) {
      console.error('Kayıt durdurma hatası:', error);
      setError('Kayıt durdurma hatası: ' + error.message);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current || isRecording) {
      console.log('Kayıt zaten başlatılıyor veya devam ediyor');
      return;
    }

    try {
      isStartingRef.current = true;
      setError(null);

      // Önceki kaydı temizle
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      console.log('Mikrofon erişimi isteniyor...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Mikrofon erişimi sağlandı');
      streamRef.current = stream;

      // AudioContext oluştur
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000
      });

      // Ses kaynağını AudioContext'e bağla
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      const mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Desteklenen ses formatı bulunamadı');
      }

      // Ses ayarlarını belirle
      const audioSettings = {
        sampleRate: audioContextRef.current.sampleRate,
        channelCount: 1,
        bitsPerSecond: 32000
      };

      console.log('Kayıt başlatılıyor:', { 
        mimeType,
        ...audioSettings
      });

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: audioSettings.bitsPerSecond
      });

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket.connected) {
          try {
            // Blob'u ArrayBuffer'a çevir
            const arrayBuffer = await event.data.arrayBuffer();
            
            // ArrayBuffer'ı Uint8Array'e çevir
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Chunk'ı base64'e çevir
            const base64Audio = btoa(String.fromCharCode(...uint8Array));

            // Ses verisi meta bilgileri
            const audioData = {
              audio: base64Audio,
              type: mimeType,
              username: username,
              timestamp: Date.now(),
              size: arrayBuffer.byteLength,
              sampleRate: 48000,
              channelCount: 1,
              format: 'opus'
            };

            console.log('Ses verisi gönderiliyor...', { 
              size: audioData.size,
              type: audioData.type,
              sampleRate: audioData.sampleRate,
              channelCount: audioData.channelCount,
              base64Length: base64Audio.length
            });

            socket.emit('audio', audioData);
          } catch (error) {
            console.error('Ses verisi gönderme hatası:', error);
            setError('Ses verisi gönderilemedi: ' + error.message);
          }
        }
      };

      recorder.onstart = () => {
        console.log('Kayıt başladı');
        setIsRecording(true);
        setError(null);
        isStartingRef.current = false;
      };

      recorder.onstop = () => {
        console.log('Kayıt durdu');
        setIsRecording(false);
        isStartingRef.current = false;
        processor.disconnect();
        source.disconnect();
      };

      recorder.onerror = (event) => {
        console.error('Kayıt hatası:', event.error);
        setError('Kayıt hatası: ' + event.error.message);
        stopRecording();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);

    } catch (error) {
      console.error('Ses kaydı başlatma hatası:', error);
      setError(error.message);
      setIsRecording(false);
      isStartingRef.current = false;
      stopRecording();
    }
  }, [username, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error
  };
};

export default useAudio;