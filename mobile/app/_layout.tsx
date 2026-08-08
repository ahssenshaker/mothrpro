import { View, Text } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07090f' }}>
        <Text style={{ color: 'white' }}>DIAGNOSTIC BUILD: GestureHandlerRootView OK</Text>
      </View>
    </GestureHandlerRootView>
  )
}
