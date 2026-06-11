/**
 * useRoutePlanner
 *
 * Beheert de staat van de routeplanner: type keuze, laden, route-data en fouten.
 *
 * Gebruik:
 *   const planner = useRoutePlanner(session.distanceKm);
 *   await planner.planRoute(lat, lon);   // na eerste GPS-fix
 *   planner.route                        // PlannedRoute | null
 */

import { useState, useCallback, useRef } from 'react';
import {
  generateLoopRoute,
  generateOutAndBackRoute,
  PlannedRoute,
} from '../services/routeService';

export type RouteType = 'loop' | 'outAndBack';

export interface UseRoutePlannerReturn {
  routeType:    RouteType;
  setRouteType: (type: RouteType) => void;
  route:        PlannedRoute | null;
  isLoading:    boolean;
  error:        string | null;
  /** Vraagt een route op. Geeft de PlannedRoute terug of null bij fout. */
  planRoute:    (lat: number, lon: number) => Promise<PlannedRoute | null>;
  /** Reset naar begintoestand (wist route en fout) */
  reset:        () => void;
}

export function useRoutePlanner(targetDistanceKm: number): UseRoutePlannerReturn {
  const [routeType, setRouteType] = useState<RouteType>('loop');
  const [route,     setRoute]     = useState<PlannedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Bewaar laatste lat/lon zodat "Andere route" zonder nieuwe GPS-fix werkt
  const lastPos = useRef<{ lat: number; lon: number } | null>(null);

  const planRoute = useCallback(async (
    lat: number,
    lon: number,
  ): Promise<PlannedRoute | null> => {
    lastPos.current = { lat, lon };
    setIsLoading(true);
    setError(null);

    try {
      const planned = routeType === 'loop'
        ? await generateLoopRoute(lat, lon, targetDistanceKm)
        : await generateOutAndBackRoute(lat, lon, targetDistanceKm);

      setRoute(planned);
      return planned;
    } catch (err: any) {
      const msg: string = err?.message ?? 'Route plannen mislukt. Probeer het opnieuw.';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [routeType, targetDistanceKm]);

  /** Herplan met dezelfde positie maar eventueel ander type */
  const replan = useCallback(async (): Promise<PlannedRoute | null> => {
    if (!lastPos.current) return null;
    return planRoute(lastPos.current.lat, lastPos.current.lon);
  }, [planRoute]);

  const reset = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  return {
    routeType,
    setRouteType,
    route,
    isLoading,
    error,
    planRoute,
    reset,
  };
}
