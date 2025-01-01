import { useState, useCallback, useRef, useEffect } from 'react'
import socket from '../socket'

const useAudio = (username, roomId) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const remoteAudioRefs = useRef({});

  // WebRTC yapılandırması
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  // Socket bağlantı durumunu kontrol et
  const checkSocketConnection = useCallback(() => {
    if (!socket.connected) {
      console.error('Socket bağlantısı yok!');
      throw new Error('Socket bağlantısı kurulamadı');
    }
  }, []);

  // Stream kontrolü
  const validateStream = useCallback((stream) => {
    if (!stream || !stream.active) {
      console.error('Stream geçerli değil!');
      throw new Error('Geçerli bir stream alınamadı');
    }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error('Ses track\'i bulunamadı!');
      throw new Error('Ses track\'i bulunamadı');
    }
    return audioTracks[0].enabled;
  }, []);

  // Kaynakları temizleme fonksiyonu
  const cleanupResources = useCallback(() => {
    try {
      console.log('Kaynaklar temizleniyor...');
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Track durduruldu:', track.label);
        });
      }

      Object.entries(peerConnectionsRef.current).forEach(([username, connection]) => {
        if (connection) {
          connection.close();
          console.log('Peer bağlantısı kapatıldı:', username);
        }
      });

      Object.entries(remoteAudioRefs.current).forEach(([username, audio]) => {
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
          console.log('Audio elementi temizlendi:', username);
        }
      });

      peerConnectionsRef.current = {};
      remoteAudioRefs.current = {};
      localStreamRef.current = null;
    } catch (err) {
      console.error('Kaynak temizleme hatası:', err);
    }
  }, []);

  // Yeni peer bağlantısı oluştur
  const createPeerConnection = useCallback(async (mode) => {
    try {
      console.log('Peer bağlantısı oluşturuluyor:', mode);
      checkSocketConnection();

      const peerConnection = new RTCPeerConnection(configuration);

      // Bağlantı durumu değişikliklerini izle
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`Bağlantı durumu:`, state);
        
        if (state === 'connected') {
          console.log('Peer bağlantısı başarılı');
        } else if (state === 'failed' || state === 'disconnected') {
          console.log('Bağlantı yeniden kurulmaya çalışılıyor');
          peerConnection.restartIce();
        }
      };

      // Local stream'i ekle
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          console.log('Audio track ekleniyor:', audioTrack.label);
          const sender = peerConnection.addTrack(audioTrack, localStreamRef.current);
          if (!sender) {
            console.error('Track eklenemedi!');
            throw new Error('Track eklenemedi');
          }
        }
      }

      // Uzak ses akışını al
      peerConnection.ontrack = (event) => {
        console.log('Uzak ses akışı alındı');
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          console.error('Uzak stream alınamadı');
          return;
        }

        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;

        audio.oncanplay = () => {
          console.log('Ses çalmaya hazır');
          audio.play()
            .then(() => console.log('Ses çalınıyor'))
            .catch(error => console.error('Ses çalma hatası:', error));
        };

        remoteAudioRefs.current[mode] = audio;
      };

      // ICE adaylarını gönder
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE adayı bulundu');
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetUsername: mode,
            fromUsername: username
          });
        }
      };

      peerConnectionsRef.current[mode] = peerConnection;
      return peerConnection;
    } catch (err) {
      console.error('Peer bağlantısı oluşturma hatası:', err);
      throw err;
    }
  }, [username, checkSocketConnection]);

  const stopRecording = useCallback(() => {
    try {
      console.log('Kayıt durduruluyor...');
      cleanupResources();
      setIsRecording(false);
      console.log('Kayıt durduruldu');
    } catch (err) {
      console.error('Kayıt durdurma hatası:', err);
      setError(err.message);
    }
  }, [cleanupResources]);

  const startRecording = useCallback(async () => {
    try {
      console.log('Kayıt başlatılıyor...', { username, roomId });
      
      if (!roomId) {
        throw new Error('Oda ID gerekli');
      }

      // Socket bağlantısını kontrol et
      if (!socket.connected) {
        console.log('Socket bağlantısı yok, bağlanmayı deniyorum...');
        socket.connect();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Socket bağlantı zaman aşımı'));
          }, 5000);

          socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      checkSocketConnection();

      // Önceki kaynakları temizle
      cleanupResources();

      // Mikrofon erişimi al
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      console.log('Mikrofon erişimi alındı');
      validateStream(stream);
      localStreamRef.current = stream;

      // Ses iletimini başlat
      return new Promise(async (resolve, reject) => {
        try {
          console.log('Ses iletimi başlatılıyor...');
          
          // Socket bağlantı durumunu kontrol et
          if (!socket.connected) {
            reject(new Error('Socket bağlantısı kopuk'));
            return;
          }

          // AudioContext oluştur
          const audioContext = new AudioContext({
            sampleRate: 44100,
            latencyHint: 'interactive'
          });
          const source = audioContext.createMediaStreamSource(localStreamRef.current);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);

          let lastSendTime = 0;
          const SEND_INTERVAL = 50;

          // Ses verilerini işle
          processor.onaudioprocess = (e) => {
            const now = Date.now();
            if (now - lastSendTime < SEND_INTERVAL) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Ses seviyesini kontrol et
            let maxVolume = 0;
            for (let i = 0; i < inputData.length; i++) {
              maxVolume = Math.max(maxVolume, Math.abs(inputData[i]));
            }
            
            // Ses seviyesi çok düşükse gönderme
            if (maxVolume < 0.01) return;

            // Float32Array'i Int16Array'e dönüştür
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Int16Array'i Base64'e dönüştür
            const base64data = btoa(String.fromCharCode.apply(null, new Uint8Array(pcmData.buffer)));

            // Ses verisini gönder
            socket.emit('audio', {
              audio: base64data,
              username,
              timestamp: now,
              sampleRate: audioContext.sampleRate,
              channels: 1,
              format: 'pcm'
            });

            lastSendTime = now;
          };

          // Ses işleme zincirini bağla
          source.connect(processor);
          processor.connect(audioContext.destination);

          console.log('Ses işleme başlatıldı');
          setIsRecording(true);
          resolve();
        } catch (err) {
          console.error('Ses iletimi başlatma hatası:', err);
          reject(err);
        }
      });
    } catch (err) {
      console.error('Kayıt başlatma hatası:', err);
      setError(err.message);
      cleanupResources();
      setIsRecording(false);
      throw err;
    }
  }, [username, roomId, createPeerConnection, checkSocketConnection, validateStream, cleanupResources]);

  // Socket event listener'ları
  useEffect(() => {
    if (!socket.connected) {
      console.log('Socket bağlantısı bekleniyor...');
      return;
    }

    console.log('Socket event listener\'ları ayarlanıyor');

    const handleOffer = async ({ offer, fromUsername }) => {
      console.log('Offer alındı:', fromUsername);
      try {
        const peerConnection = await createPeerConnection(fromUsername);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
          answer,
          targetUsername: fromUsername,
          fromUsername: username
        });
      } catch (err) {
        console.error('Offer işleme hatası:', err);
      }
    };

    const handleAnswer = async ({ answer, fromUsername }) => {
      try {
        const peerConnection = peerConnectionsRef.current[fromUsername];
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Answer işlendi:', fromUsername);
        }
      } catch (err) {
        console.error('Answer işleme hatası:', err);
      }
    };

    const handleIceCandidate = async ({ candidate, fromUsername }) => {
      try {
        const peerConnection = peerConnectionsRef.current[fromUsername];
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('ICE adayı eklendi:', fromUsername);
        }
      } catch (err) {
        console.error('ICE adayı işleme hatası:', err);
      }
    };

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      cleanupResources();
    };
  }, [username, createPeerConnection, cleanupResources]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error
  };
};

export default useAudio;