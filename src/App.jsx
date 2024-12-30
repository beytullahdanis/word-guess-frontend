import { ChakraProvider, Box } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import JoinRoom from './components/JoinRoom'
import GameRoom from './components/GameRoom'

function App() {
  const [gameState, setGameState] = useState(() => {
    // localStorage'dan kayıtlı durumu al
    const savedState = localStorage.getItem('gameState')
    if (savedState) {
      return JSON.parse(savedState)
    }
    return {
      isInRoom: false,
      roomId: null,
      username: '',
    }
  })

  // gameState değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('gameState', JSON.stringify(gameState))
  }, [gameState])

  const handleJoinRoom = (roomData) => {
    setGameState({
      isInRoom: true,
      roomId: roomData.roomId,
      username: roomData.username,
    })
  }

  // Odadan çıkış fonksiyonu
  const handleLeaveRoom = () => {
    setGameState({
      isInRoom: false,
      roomId: null,
      username: '',
    })
    localStorage.removeItem('gameState')
  }

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="mediumslateblue" py={10}>
        {!gameState.isInRoom ? (
          <JoinRoom onJoinRoom={handleJoinRoom} />
        ) : (
          <GameRoom
            roomId={gameState.roomId}
            username={gameState.username}
            onLeaveRoom={handleLeaveRoom}
          />
        )}
      </Box>
    </ChakraProvider>
  )
}

export default App
