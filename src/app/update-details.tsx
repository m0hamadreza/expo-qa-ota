import { ScrollView, StyleSheet } from 'react-native';
import { BuildInfo } from '../BuildInfo';

export default function UpdateDetailsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <BuildInfo />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fff' },
  content: { padding: 24 },
});
