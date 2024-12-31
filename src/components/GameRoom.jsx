import { useEffect, useState, useRef } from 'react'
import {
  Box,
  Button,
  Container,
  Grid,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  VStack,
  HStack,
  Badge,
  IconButton,
  Progress,
  Center,
} from '@chakra-ui/react'
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa'
import socket from '../socket'
import useAudio from '../hooks/useAudio'

const TURN_DURATION = 60

function GameRoom({ roomId, username, onLeaveRoom }) {
  const [gameState, setGameState] = useState(() => {
    // localStorage'dan oyun durumunu al
    const savedGameState = localStorage.getItem(`gameState_${roomId}`);
    if (savedGameState) {
      return JSON.parse(savedGameState);
    }
    return {
      players: [],
      team1: [],
      team2: [],
      scores: { team1: 0, team2: 0 },
      currentWord: '',
      currentTeam: null,
      timeRemaining: TURN_DURATION,
      isPlaying: false,
      wordsRemaining: 0,
    };
  });

  // gameState değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (gameState.isPlaying || gameState.scores.team1 > 0 || gameState.scores.team2 > 0) {
      localStorage.setItem(`gameState_${roomId}`, JSON.stringify(gameState));
    }
  }, [gameState, roomId]);

  // Oyun bittiğinde localStorage'dan oyun durumunu temizle
  useEffect(() => {
    if (!gameState.isPlaying && gameState.currentTeam === null) {
      localStorage.removeItem(`gameState_${roomId}`);
    }
  }, [gameState.isPlaying, gameState.currentTeam, roomId]);

  const [guess, setGuess] = useState('')
  const { isRecording, startRecording, stopRecording } = useAudio()
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Socket'i bağla
    if (!socket.connected) {
      socket.connect();
    }

    console.log('Socket bağlantısı kuruldu:', socket.id);
      
    const currentTeam = localStorage.getItem(`team_${roomId}`);
    socket.emit('joinRoom', { 
      roomId, 
      username,
      currentTeam
    });

    if (currentTeam) {
      console.log('Önceki takıma yeniden katılınıyor:', currentTeam);
      socket.emit('selectTeam', { roomId, team: currentTeam });
    }

    // Ses verilerini dinle
    socket.on('audio', async (data) => {
      try {
        console.log('Ses verisi alındı:', {
          from: data.username,
          timestamp: data.timestamp,
          type: data.type
        });

        // Base64'ten ArrayBuffer'a çevir
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Ses verisini oynat
        const blob = new Blob([bytes], { type: data.type || 'audio/webm' });
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        console.log('Ses oynatıldı');

        // Kaynakları temizle
        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
        };
      } catch (error) {
        console.error('Ses oynatma hatası:', error);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket bağlantı hatası:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'Sunucuya bağlanırken bir hata oluştu. Yeniden deneniyor...',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    });

    socket.on('roomUpdate', (updatedState) => {
      console.log('Oda güncellendi:', updatedState);
      setGameState(prev => ({
        ...prev,
        ...updatedState
      }));
    });

    socket.on('gameStarted', (gameData) => {
      console.log('Oyun başladı:', gameData);
      setGameState(prev => ({
        ...prev,
        ...gameData,
        isPreparation: true,
        preparationTime: gameData.preparationTime
      }));

      // Mesajları temizle
      setMessages([]);

      toast({
        title: 'Oyun Başlıyor!',
        description: `${gameData.currentTeam === 'team1' ? 'Takım 1' : 'Takım 2'} hazırlanıyor...`,
        status: 'success',
        duration: 3000,
      });
    });

    socket.on('preparationUpdate', (data) => {
      console.log('Hazırlık süresi güncellendi:', data);
      setGameState(prev => ({
        ...prev,
        preparationTime: data.timeRemaining,
        currentTeam: data.currentTeam,
        isPreparation: data.timeRemaining > 0
      }));
    });

    socket.on('timeUpdate', (data) => {
      console.log('Süre güncellendi:', data);
      setGameState(prev => ({
        ...prev,
        timeRemaining: data.timeRemaining,
        currentTeam: data.currentTeam,
        isPreparation: false
      }));
    });

    socket.on('teamSwitch', (data) => {
      console.log('Takım değişti:', data);
      setGameState(prev => ({
        ...prev,
        currentTeam: data.currentTeam,
        timeRemaining: data.timeRemaining,
        currentWord: data.currentWord,
        scores: data.scores,
        isPreparation: true,
        preparationTime: data.preparationTime
      }));
      toast({
        title: 'Takım Değişiyor!',
        description: `${data.currentTeam === 'team1' ? 'Takım 1' : 'Takım 2'} hazırlanıyor...`,
        status: 'info',
        duration: 2000,
      });
    });

    socket.on('correctGuess', (data) => {
      console.log('Doğru tahmin yapıldı:', data);
      setGameState(prev => ({
        ...prev,
        scores: data.scores,
        currentWord: data.currentWord,
        currentTeam: data.currentTeam,
        timeRemaining: data.timeRemaining,
        wordsRemaining: data.wordsRemaining
      }));

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.guess,
        username: data.guessingPlayer,
        type: 'correct-guess'
      }]);

      toast({
        title: 'Doğru Tahmin!',
        description: `${data.guessingPlayer} doğru tahmin etti! ${data.team === 'team1' ? 'Takım 1' : 'Takım 2'} puan kazandı!`,
        status: 'success',
        duration: 2000,
      });
    });

    socket.on('wordUpdate', (data) => {
      console.log('Yeni kelime alındı:', data.currentWord);
      setGameState(prevState => ({
        ...prevState,
        currentWord: data.currentWord,
        timeRemaining: data.timeRemaining,
        currentTeam: data.currentTeam,
        wordsRemaining: data.wordsRemaining
      }));
    });

    socket.on('gameEnded', (data) => {
      console.log('Oyun bitti:', data);
      setGameState(prev => ({
        ...prev,
        isPlaying: false,
        currentWord: '',
        currentTeam: null,
        timeRemaining: 0,
        scores: data.scores
      }));

      setMessages([]);

      let message = '';
      if (data.winner === 'tie') {
        message = 'Oyun berabere bitti!';
      } else {
        message = `${data.winner === 'team1' ? 'Takım 1' : 'Takım 2'} kazandı!`;
      }

      toast({
        title: 'Oyun Bitti!',
        description: `${message}\nTakım 1: ${data.scores.team1} puan\nTakım 2: ${data.scores.team2} puan`,
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
    });

    return () => {
      console.log('Socket event listeners temizleniyor');
      socket.off('correctGuess');
      socket.off('wordUpdate');
      socket.off('teamSwitch');
      socket.off('gameStarted');
      socket.off('timeUpdate');
      socket.off('gameEnded');
      socket.off('roomUpdate');
      socket.off('preparationUpdate');
    };
  }, [roomId, username, toast]);

  const handleTeamSelect = (team) => {
    if (!socket.connected) {
      console.error('Socket bağlantısı yok')
      return
    }
    console.log('Takım seçiliyor:', team)
    localStorage.setItem(`team_${roomId}`, team);
    socket.emit('selectTeam', { roomId, team })
  }

  const handleStartGame = () => {
    if (!socket.connected) {
      console.error('Socket bağlantısı yok');
      return;
    }
    console.log('Oyun başlatma isteği gönderiliyor');
    socket.emit('startGame', roomId);
  }

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (!socket.connected || !guess.trim()) {
      console.log('Tahmin gönderilemedi:', { socketConnected: socket.connected, guess });
      return;
    }

    if (guess.trim().toLowerCase() !== gameState.currentWord.toLowerCase()) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: guess.trim(),
        username: username,
        type: 'guess'
      }]);
    }

    console.log('Tahmin gönderiliyor:', guess.trim());
    socket.emit('makeGuess', { roomId, guess: guess.trim() });
    setGuess('');
  };

  const isInTeam = (player) => {
    const inTeam1 = gameState.team1.some(p => p.username === player.username)
    const inTeam2 = gameState.team2.some(p => p.username === player.username)
    return inTeam1 || inTeam2
  }

  const getCurrentTeam = () => {
    if (gameState.team1.some(p => p.username === username)) return 'team1'
    if (gameState.team2.some(p => p.username === username)) return 'team2'
    return null
  }

  const isMyTeamsTurn = () => {
    const myTeam = getCurrentTeam()
    return myTeam === gameState.currentTeam
  }

  const handleMicrophoneToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch (error) {
        toast({
          title: 'Mikrofon Hatası',
          description: error.message || 'Mikrofona erişilemiyor.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const canSeeWord = () => {
    if (!socket.connected || !isMyTeamsTurn()) return false;
    const myTeamList = gameState.currentTeam === 'team1' ? gameState.team1 : gameState.team2;
    return myTeamList.length > 0 && myTeamList[0].username === username;
  };

  const canMakeGuess = () => {
    if (!socket.connected || !isMyTeamsTurn()) return false;
    const myTeamList = gameState.currentTeam === 'team1' ? gameState.team1 : gameState.team2;
    return myTeamList.length > 0 && myTeamList[0].username !== username;
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem(`team_${roomId}`);
    localStorage.removeItem(`gameState_${roomId}`);
    onLeaveRoom();
  };

  return (
    <Container maxW="container.xl">
      <Box 
        w="100%"
        bg="gray.50"
        p={4}
        rounded="xl"
        shadow="lg"
      >
        <Box mb={4} display="flex" justifyContent="flex-end">
          <Button
            colorScheme="red"
            variant="outline"
            onClick={handleLeaveRoom}
            leftIcon={<Box as="span">🚪</Box>}
            size="sm"
          >
            Odadan Çık
          </Button>
        </Box>
        
        <Grid 
          templateColumns={gameState.isPlaying ? "auto 400px" : "1fr"}
          gap={8}
          w="100%"
        >
          {/* Ana Oyun Alanı */}
          <Box 
            bg="white"
            p={8} 
            rounded="2xl" 
            shadow="xl"
            borderWidth={2}
            borderColor="gray.100"
          >
            {/* Başlık */}
            <Heading 
              size="xl" 
              mb={8} 
              textAlign="center" 
              bgGradient="linear(to-r, blue.600, purple.600)"
              bgClip="text"
            >
              Kelime Tahmin Oyunu
              <Text fontSize="md" color="gray.500">
                Oda: {roomId}
              </Text>
            </Heading>

            {/* Takımlar Grid */}
            <Grid 
              templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
              gap={4}
              mb={8}
            >
              {/* Takım 1 */}
              <Box 
                borderWidth={2} 
                p={6} 
                rounded="2xl" 
                shadow="lg"
                borderColor="blue.200"
                bg="blue.50"
                position="relative"
                overflow="hidden"
                transition="all 0.3s"
                _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
              >
                <Box 
                  position="absolute" 
                  top={0} 
                  left={0} 
                  right={0} 
                  h={3} 
                  bgGradient="linear(to-r, blue.400, blue.600)" 
                />
                <VStack align="stretch" spacing={4}>
                  <Heading 
                    size="md" 
                    color="blue.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    bgGradient="linear(to-r, blue.700, blue.900)"
                    bgClip="text"
                  >
                    <HStack>
                      <Box as="span">👥</Box>
                      <span>Takım 1</span>
                    </HStack>
                    <Badge 
                      colorScheme="blue" 
                      fontSize="lg" 
                      p={2} 
                      rounded="lg"
                      variant="solid"
                      boxShadow="md"
                    >
                      {gameState.scores.team1} Puan
                    </Badge>
                  </Heading>
                  {gameState.team1.map(player => (
                    <Text 
                      key={player.id}
                      bg={player.username === username ? "blue.200" : "white"}
                      color={player.username === username ? "blue.800" : "gray.700"}
                      p={4}
                      rounded="xl"
                      fontWeight={player.username === username ? "bold" : "medium"}
                      shadow="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      transition="all 0.2s"
                      _hover={{ transform: 'translateX(4px)' }}
                    >
                      <HStack>
                        <Box as="span">{'👤'}</Box>
                        <span>{player.username}</span>
                      </HStack>
                      {player.username === username && (
                        <Badge colorScheme="blue" fontSize="sm" variant="solid">Sen</Badge>
                      )}
                    </Text>
                  ))}
                  {!isInTeam({username}) && !gameState.isPlaying && (
                    <Button
                      colorScheme="blue"
                      size="lg"
                      onClick={() => handleTeamSelect('team1')}
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
                      transition="all 0.2s"
                      leftIcon={<Box as="span">👥</Box>}
                    >
                      Takım 1'e Katıl
                    </Button>
                  )}
                </VStack>
              </Box>

              {/* Takım 2 */}
              <Box 
                borderWidth={2} 
                p={6} 
                rounded="2xl" 
                shadow="lg"
                borderColor="red.200"
                bg="red.50"
                position="relative"
                overflow="hidden"
                transition="all 0.3s"
                _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
              >
                <Box 
                  position="absolute" 
                  top={0} 
                  left={0} 
                  right={0} 
                  h={3} 
                  bgGradient="linear(to-r, red.400, red.600)" 
                />
                <VStack align="stretch" spacing={4}>
                  <Heading 
                    size="md" 
                    color="red.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    bgGradient="linear(to-r, red.700, red.900)"
                    bgClip="text"
                  >
                    <HStack>
                      <Box as="span">👥</Box>
                      <span>Takım 2</span>
                    </HStack>
                    <Badge 
                      colorScheme="red" 
                      fontSize="lg" 
                      p={2} 
                      rounded="lg"
                      variant="solid"
                      boxShadow="md"
                    >
                      {gameState.scores.team2} Puan
                    </Badge>
                  </Heading>
                  {gameState.team2.map(player => (
                    <Text 
                      key={player.id}
                      bg={player.username === username ? "red.200" : "white"}
                      color={player.username === username ? "red.800" : "gray.700"}
                      p={4}
                      rounded="xl"
                      fontWeight={player.username === username ? "bold" : "medium"}
                      shadow="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      transition="all 0.2s"
                      _hover={{ transform: 'translateX(4px)' }}
                    >
                      <HStack>
                        <Box as="span">{'👤'}</Box>
                        <span>{player.username}</span>
                      </HStack>
                      {player.username === username && (
                        <Badge colorScheme="red" fontSize="sm" variant="solid">Sen</Badge>
                      )}
                    </Text>
                  ))}
                  {!isInTeam({username}) && !gameState.isPlaying && (
                    <Button
                      colorScheme="red"
                      size="lg"
                      onClick={() => handleTeamSelect('team2')}
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
                      transition="all 0.2s"
                      leftIcon={<Box as="span">👥</Box>}
                    >
                      Takım 2'ye Katıl
                    </Button>
                  )}
                </VStack>
              </Box>
            </Grid>

            {/* Oyun Kontrolü */}
            <Box maxW="100%" mx="auto">
              {!gameState.isPlaying ? (
                <VStack spacing={8}>
                  <Center w="full">
                    <Button
                      colorScheme="purple"
                      size="lg"
                      isDisabled={gameState.team1.length < 2 || gameState.team2.length < 2}
                      onClick={handleStartGame}
                      rounded="xl"
                      shadow="lg"
                      px={12}
                      py={8}
                      fontSize="2xl"
                      _hover={{ transform: 'translateY(-4px)', shadow: '2xl' }}
                      transition="all 0.3s"
                      leftIcon={<Box as="span" fontSize="2xl">🎮</Box>}
                    >
                      {gameState.scores.team1 > 0 || gameState.scores.team2 > 0 ? 'Yeni Oyun Başlat' : 'Oyunu Başlat'}
                    </Button>
                  </Center>
                </VStack>
              ) : (
                <VStack spacing={6}>
                  {/* Süre Göstergesi */}
                  {gameState.isPlaying && (
                    <Box w="full" bg="white" p={4} rounded="xl" shadow="md" borderWidth={1} borderColor="gray.200">
                      <VStack spacing={2}>
                        <HStack justify="space-between" w="full">
                          <Text fontWeight="bold" color="gray.700">
                            {gameState.isPreparation ? 
                              `Hazırlık: ${gameState.preparationTime} saniye` : 
                              `Süre: ${gameState.timeRemaining} saniye`
                            }
                          </Text>
                          <Badge 
                            colorScheme={gameState.currentTeam === 'team1' ? 'blue' : 'red'} 
                            p={2} 
                            rounded="lg"
                          >
                            {gameState.currentTeam === 'team1' ? 'Takım 1' : 'Takım 2'} Sırası
                          </Badge>
                        </HStack>
                        {gameState.isPreparation ? (
                          <VStack w="full" spacing={3}>
                            <Text fontSize="xl" fontWeight="bold" color={gameState.currentTeam === 'team1' ? 'blue.500' : 'red.500'}>
                              {gameState.currentTeam === 'team1' ? 'Takım 1' : 'Takım 2'} Başlıyor!
                            </Text>
                            <Progress 
                              value={(gameState.preparationTime / 10) * 100} 
                              w="full" 
                              rounded="lg" 
                              size="lg"
                              colorScheme={gameState.currentTeam === 'team1' ? 'blue' : 'red'}
                              hasStripe
                              isAnimated
                            />
                          </VStack>
                        ) : (
                          <Progress 
                            value={(gameState.timeRemaining / TURN_DURATION) * 100} 
                            w="full" 
                            rounded="lg" 
                            size="lg"
                            colorScheme={gameState.currentTeam === 'team1' ? 'blue' : 'red'}
                            hasStripe
                            isAnimated
                          />
                        )}
                      </VStack>
                    </Box>
                  )}

                  {isMyTeamsTurn() && canSeeWord() && (
                    <HStack 
                      bg="green.50" 
                      p={3} 
                      rounded="2xl" 
                      shadow="xl"
                      spacing={6}
                      justify="center"
                      w="full"
                    >
                      <Badge 
                        colorScheme="green" 
                        p={4} 
                        fontSize="2xl"
                        rounded="xl"
                        variant="subtle"
                        boxShadow="md"
                      >
                        <HStack spacing={3}>
                          <Box as="span">🎯</Box>
                          <span>{gameState.currentWord}</span>
                        </HStack>
                      </Badge>
                      <IconButton
                        aria-label={isRecording ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
                        icon={isRecording ? <FaMicrophoneSlash /> : <FaMicrophone />}
                        colorScheme={isRecording ? 'red' : 'green'}
                        onClick={handleMicrophoneToggle}
                        size="lg"
                        rounded="xl"
                        shadow="lg"
                        p={8}
                        fontSize="2xl"
                        _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
                        transition="all 0.2s"
                      />
                    </HStack>
                  )}
                </VStack>
              )}
            </Box>
          </Box>

          {/* Sağ Taraf - Kazanan Gösterimi ve Chat Box */}
          {(gameState.isPlaying || !gameState.isPlaying) && (
            <VStack spacing={4} align="stretch">
              {/* Kazanan Gösterimi - Oyun bittiğinde ve en az bir takımın puanı varsa göster */}
              {!gameState.isPlaying && gameState.currentTeam === null && (gameState.scores.team1 > 0 || gameState.scores.team2 > 0) && (
                <Box
                  bg="white"
                  rounded="xl"
                  shadow="2xl"
                  borderWidth={4}
                  borderColor={gameState.scores.team1 > gameState.scores.team2 ? "blue.400" : 
                              gameState.scores.team2 > gameState.scores.team1 ? "red.400" : "yellow.400"}
                  overflow="hidden"
                  h="fit-content"
                  position="sticky"
                  top={8}
                  p={6}
                >
                  <VStack spacing={4}>
                    <Box
                      w="full"
                      textAlign="center"
                      p={4}
                      bg={gameState.scores.team1 > gameState.scores.team2 ? "blue.100" : 
                          gameState.scores.team2 > gameState.scores.team1 ? "red.100" : "yellow.100"}
                      rounded="xl"
                    >
                      <Heading
                        size="lg"
                        color={gameState.scores.team1 > gameState.scores.team2 ? "blue.700" : 
                               gameState.scores.team2 > gameState.scores.team1 ? "red.700" : "yellow.700"}
                      >
                        {gameState.scores.team1 === gameState.scores.team2 ? "🤝 Berabere!" :
                         gameState.scores.team1 > gameState.scores.team2 ? "🏆 Takım 1 Kazandı!" : 
                         "🏆 Takım 2 Kazandı!"}
                      </Heading>
                      {gameState.scores.team1 === gameState.scores.team2 && (
                        <Text mt={2} color="yellow.700" fontSize="lg">
                          Her iki takım da {gameState.scores.team1} puan aldı!
                        </Text>
                      )}
                    </Box>

                    <Box
                      w="full"
                      p={4}
                      bg="gray.50"
                      rounded="xl"
                      shadow="md"
                    >
                      <VStack spacing={3}>
                        <Text fontSize="xl" fontWeight="bold" color="gray.700">
                          Skor Tablosu
                        </Text>
                        <HStack justify="space-between" w="full" p={2}>
                          <Badge
                            colorScheme="blue"
                            p={3}
                            fontSize="md"
                            variant="subtle"
                            rounded="lg"
                          >
                            Takım 1: {gameState.scores.team1}
                          </Badge>
                          <Badge
                            colorScheme="red"
                            p={3}
                            fontSize="md"
                            variant="subtle"
                            rounded="lg"
                          >
                            Takım 2: {gameState.scores.team2}
                          </Badge>
                        </HStack>
                      </VStack>
                    </Box>

                    {/* Kazanan Takım Oyuncuları - Sadece bir takım kazandıysa veya berabere bittiyse göster */}
                    {((gameState.scores.team1 > 0 || gameState.scores.team2 > 0) && (
                      <Box
                        w="full"
                        p={4}
                        bg={gameState.scores.team1 > gameState.scores.team2 ? "blue.50" : 
                            gameState.scores.team2 > gameState.scores.team1 ? "red.50" : "yellow.50"}
                        rounded="xl"
                        shadow="md"
                      >
                        <VStack spacing={3} align="stretch">
                          <Text fontSize="lg" fontWeight="bold" color="gray.700">
                            {gameState.scores.team1 === gameState.scores.team2 && gameState.scores.team1 > 0 ? "Tüm Oyuncular" : "Kazanan Takım Oyuncuları"}
                          </Text>
                          {(gameState.scores.team1 === gameState.scores.team2 && gameState.scores.team1 > 0 ? (
                            <>
                              <Text fontSize="md" fontWeight="semibold" color="blue.600">Takım 1:</Text>
                              {gameState.team1.map(player => (
                                <Text
                                  key={player.id}
                                  p={2}
                                  bg="white"
                                  rounded="lg"
                                  shadow="sm"
                                  color="gray.700"
                                  fontSize="md"
                                >
                                  👤 {player.username}
                                </Text>
                              ))}
                              <Text fontSize="md" fontWeight="semibold" color="red.600" mt={2}>Takım 2:</Text>
                              {gameState.team2.map(player => (
                                <Text
                                  key={player.id}
                                  p={2}
                                  bg="white"
                                  rounded="lg"
                                  shadow="sm"
                                  color="gray.700"
                                  fontSize="md"
                                >
                                  👤 {player.username}
                                </Text>
                              ))}
                            </>
                          ) : (
                            (gameState.scores.team1 > gameState.scores.team2 ? gameState.team1 : gameState.team2).map(player => (
                              <Text
                                key={player.id}
                                p={2}
                                bg="white"
                                rounded="lg"
                                shadow="sm"
                                color="gray.700"
                                fontSize="md"
                              >
                                👤 {player.username}
                              </Text>
                            ))
                          ))}
                        </VStack>
                      </Box>
                    ))}

                    <Button
                      colorScheme={gameState.scores.team1 > gameState.scores.team2 ? "blue" : 
                                 gameState.scores.team2 > gameState.scores.team1 ? "red" : "yellow"}
                      size="lg"
                      onClick={handleStartGame}
                      rounded="xl"
                      shadow="lg"
                      w="full"
                      leftIcon={<Box as="span">🎮</Box>}
                    >
                      Yeni Oyun Başlat
                    </Button>
                  </VStack>
                </Box>
              )}

              {/* Chat Box - Oyun sırasında göster */}
              {gameState.isPlaying && (
                <Box 
                  bg="white" 
                  rounded="xl" 
                  shadow="lg" 
                  borderWidth={2}
                  borderColor="gray.200"
                  overflow="hidden"
                  h="600px"
                  display="flex"
                  flexDirection="column"
                  position="sticky"
                  top={8}
                >
                  <Box p={4} borderBottom="2px" borderColor="gray.100" bg="gray.50">
                    <Text fontWeight="bold" color="gray.700">Sohbet</Text>
                  </Box>
                  
                  {/* Mesajlar */}
                  <Box 
                    flex={1}
                    overflowY="auto" 
                    p={4}
                    bg="gray.50"
                    css={{
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: '#555',
                      },
                    }}
                  >
                    <VStack align="stretch" spacing={2}>
                      {messages.map(message => (
                        <Box
                          key={message.id}
                          bg={message.type === 'correct-guess' ? 'green.100' : 'white'}
                          color={message.type === 'correct-guess' ? 'green.800' : 'gray.800'}
                          p={3}
                          rounded="lg"
                          shadow="sm"
                        >
                          <Text fontWeight="bold" fontSize="sm" color={message.type === 'correct-guess' ? 'green.600' : 'gray.600'}>
                            {message.username}
                          </Text>
                          <Text>{message.text}</Text>
                        </Box>
                      ))}
                      <div ref={messagesEndRef} />
                    </VStack>
                  </Box>

                  {/* Tahmin Girişi */}
                  {canMakeGuess() && (
                    <form 
                      onSubmit={handleGuessSubmit}
                      style={{ width: '100%' }}
                    >
                      <HStack p={3} bg="white" borderTop="2px" borderColor="gray.100">
                        <Input
                          value={guess}
                          onChange={(e) => setGuess(e.target.value)}
                          placeholder="Tahmininizi yazın..."
                          size="lg"
                          rounded="lg"
                          bg="gray.50"
                          _focus={{ bg: 'white', borderColor: 'purple.400' }}
                          _hover={{ bg: 'white' }}
                        />
                        <Button 
                          type="submit" 
                          colorScheme="purple"
                          size="lg"
                          rounded="lg"
                          px={8}
                          leftIcon={<Box as="span">🎯</Box>}
                        >
                          Gönder
                        </Button>
                      </HStack>
                    </form>
                  )}
                </Box>
              )}
            </VStack>
          )}
        </Grid>
      </Box>
    </Container>
  )
}

export default GameRoom 