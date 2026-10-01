import React from 'react';
import { View, StyleSheet } from 'react-native';

interface BodyPickerScreenProps {
  selectedOrgan?: any;
  painMarker?: { x: number; y: number } | null;
  [key: string]: any;
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  selectedOrgan,
  painMarker,
  children,
}) => {
  // Hide painMarker visually when an organ is open, without removing it from state/context
  const isOrganOpen = Boolean(selectedOrgan);

  return (
    <View style={styles.container}>
      {/* Main Body Map Container */}
      <View style={styles.mapContainer}>
        {children}
        
        {/* Pain Marker overlay: visually hidden if organ is open */}
        {painMarker && (
          <View
            style={[
              styles.marker,
              {
                left: painMarker.x,
                top: painMarker.y,
                opacity: isOrganOpen ? 0 : 1, // Visually hidden when organ is opened
              },
            ]}
            pointerEvents={isOrganOpen ? 'none' : 'auto'}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
});

export default BodyPickerScreen;
