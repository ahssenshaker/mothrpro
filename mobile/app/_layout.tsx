import { View, Text } from 'react-native'

export default function RootLayout() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07090f' }}>
      <Text style={{ color: 'white' }}>DIAGNOSTIC BUILD OK</Text>
    </View>
  )
}
