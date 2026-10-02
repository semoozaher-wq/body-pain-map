import React from 'react';
import { View, StyleSheet } from 'react-native';

interface PainMarkerProps {
  x: number;
  y: number;
  intensity?: number;
}

export const PainMarker: React.FC<PainMarkerProps> = ({ x, y, intensity = 5 }) => {
  return (
    <View 
      style={[
        styles.marker, 
        { 
          left: `${x}%`, 
          top: `${y}%`,
          backgroundColor: intensity > 7 ? '#ff1744' : '#ff9100',
        }
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    elevation: 5,
  },
});

export default PainMarker;
