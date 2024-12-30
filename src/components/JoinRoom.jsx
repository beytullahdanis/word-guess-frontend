import { useState } from 'react'
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  HStack,
} from '@chakra-ui/react'

function JoinRoom({ onJoinRoom }) {
  const [formData, setFormData] = useState(() => {
    // localStorage'dan son kullanılan kullanıcı adını al
    const lastUsername = localStorage.getItem('lastUsername') || '';
    return {
      roomId: '',
      username: lastUsername,
    }
  });
  const toast = useToast()

  const generateRoomId = () => {
    // 4 haneli rastgele sayı oluştur
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, roomId }));
    toast({
      title: 'Oda Oluşturuldu',
      description: `Oda kodunuz: ${roomId}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.username) {
      toast({
        title: 'Hata',
        description: 'Lütfen kullanıcı adınızı girin',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    if (!formData.roomId) {
      toast({
        title: 'Hata',
        description: 'Lütfen bir oda kodu girin veya yeni oda oluşturun',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    // Kullanıcı adını localStorage'a kaydet
    localStorage.setItem('lastUsername', formData.username);
    onJoinRoom(formData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <Container 
    maxW="container.sm"
    >
      <Box bg="white" p={8} rounded="lg" shadow="base">
        <Stack spacing={4}>
          <Heading size="lg" textAlign="center">
            Kelime Tahmin Oyunu
          </Heading>
          <Text textAlign="center" color="gray.600">
            Bir odaya katıl veya yeni bir oda oluştur
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Kullanıcı Adı</FormLabel>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Kullanıcı adınızı girin"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Oda Kodu</FormLabel>
                <Input
                  name="roomId"
                  value={formData.roomId}
                  onChange={handleChange}
                  placeholder="Oda kodunu girin"
                  isReadOnly={false}
                />
              </FormControl>
              <HStack spacing={4}>
                <Button
                  type="button"
                  colorScheme="purple"
                  size="lg"
                  fontSize="md"
                  onClick={generateRoomId}
                  leftIcon={<Box as="span">🎲</Box>}
                  flex={1}
                >
                  Oda Oluştur
                </Button>
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  fontSize="md"
                  leftIcon={<Box as="span">🚪</Box>}
                  flex={1}
                >
                  Odaya Katıl
                </Button>
              </HStack>
            </Stack>
          </form>
        </Stack>
      </Box>
    </Container>
  )
}

export default JoinRoom 