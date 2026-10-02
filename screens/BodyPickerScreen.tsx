import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface BodyPickerProps {
  selectedOrgan: string | null;
  painMarker: { x: number; y: number } | null;
  onSelectOrgan: (organ: string) => void;
}

export const BodyPickerScreen: React.FC<BodyPickerProps> = ({
  selectedOrgan,
  painMarker,
  onSelectOrgan,
}) => {
  return (
    <View style={styles.container}>
      <Svg height="100%" width="100%" viewBox="0 0 500 1000">
        {/* Layer 1: Organ / Muscle Highlights (zIndex: 1 - الخلفية) */}
        <G id="highlights-layer">
          <Path
            d="M150,200 L250,200 L200,300 Z" // مسار تقريبي للمثال
            fill={selectedOrgan === 'chest' ? 'rgba(255, 0, 0, 0.4)' : 'transparent'}
            stroke={selectedOrgan === 'chest' ? '#ff0000' : '#ccc'}
            strokeWidth="2"
            onPress={() => onSelectOrgan('chest')}
          />
        </G>

        {/* Layer 2: Pain Marker Pin (zIndex: 10 - الطبقة الأمامية) */}
        {painMarker && (
          <G
            id="pain-marker-layer"
            opacity={selectedOrgan ? 0.3 : 1.0} // تقليل الشفافية عند تركيز العضو مع الاحتفاظ به في الـ State
          >
            <Path
              d={`M${painMarker.x},${painMarker.y} m -10, -20 l 10,-20 l 10,20 z`}
              fill="#d9534f"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </G>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
