import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Op Android 12+ toont het OS zelf alleen een klein icoon op een
// achtergrondkleur als native splash. Deze component zorgt voor een fraaie
// fullscreen overgang direct daarna: zodra de native splash verdwijnt,
// verschijnt deze afbeelding naadloos overheen, blijft ze kort staan met een
// subtiele inzoom, en vervaagt daarna vloeiend naar de app zelf.

// Hoe lang de fullscreen afbeelding zichtbaar blijft nadat de native splash
// is verborgen, en hoe lang de daaropvolgende fade-out duurt.
const VISIBLE_DURATION_MS = 1200;
const FADE_OUT_DURATION_MS = 500;

// Veiligheidsnet: als de afbeelding om wat voor reden ook nooit "onLoadEnd"
// meldt, verbergen we de native splash en de overlay alsnog na deze timeout,
// zodat de app nooit permanent achter het opstartscherm blijft hangen.
const SAFETY_TIMEOUT_MS = 4000;

interface AnimatedSplashProps {
  children: React.ReactNode;
}

export function AnimatedSplash({ children }: AnimatedSplashProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Voorkomt dat de afhandeling twee keer start, bijvoorbeeld wanneer zowel
  // onLoadEnd als de veiligheidstimer (bijna) tegelijk afgaan.
  const handledRef = useRef(false);
  const fadeOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReadyToDismiss = () => {
    if (handledRef.current) return;
    handledRef.current = true;

    // De fullscreen afbeelding staat er nu al overheen, dus de native splash
    // kan verborgen worden zonder dat er een "gat" zichtbaar wordt. Best
    // effort: als er (nog) geen native splash actief is, negeren we de fout.
    SplashScreen.hideAsync().catch(() => {});

    // Zichtbare periode: heel lichte, langzame inzoom voor een levend gevoel.
    Animated.timing(scale, {
      toValue: 1.04,
      duration: VISIBLE_DURATION_MS,
      useNativeDriver: true,
    }).start();

    fadeOutTimer.current = setTimeout(() => {
      // Fade-out: overlay vervaagt en zoomt tegelijk verder in, daarna pas
      // volledig unmounten zodat er niets van blijft renderen.
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.08,
          duration: FADE_OUT_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setOverlayVisible(false);
      });
    }, VISIBLE_DURATION_MS);
  };

  useEffect(() => {
    safetyTimer.current = setTimeout(handleReadyToDismiss, SAFETY_TIMEOUT_MS);

    return () => {
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!overlayVisible) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Animated.View style={[styles.overlay, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require('../../assets/splash-full.png')}
          resizeMode="cover"
          style={styles.image}
          onLoadEnd={handleReadyToDismiss}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#0A0F1A',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
