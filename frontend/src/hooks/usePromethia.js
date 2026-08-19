import { useCallback, useMemo, useState } from 'react'

import { planRoute, DEPOT } from '../systems/promethia'
import { SITUATIONAL_OBSTACLES, resolveObstacles } from '../systems/promethia/obstacles'

/**
 * usePromethia
 * Route planning state: which zone is targeted, which obstacles are active,
 * and the resulting route.
 *
 * The route is derived with useMemo rather than stored in state and updated by
 * hand. That is what makes the obstacle toggles work: flipping one changes an
 * input, and the route is re-planned on the next render. Storing the route
 * would mean remembering to re-run A* at every point that could invalidate it,
 * and the first one forgotten leaves a stale path drawn across a blocked track.
 *
 * A* takes well under a millisecond on this grid, so recomputing is cheaper
 * than the bookkeeping needed to avoid it.
 */
export function usePromethia() {
  const [targetZone, setTargetZone] = useState(null)
  /** Where the current route is planned from. Defaults to the depot. */
  const [origin, setOrigin] = useState(DEPOT)
  const [obstacleIds, setObstacleIds] = useState([])
  /** Set once the operator has asked for a route, so none is drawn before. */
  const [planned, setPlanned] = useState(false)

  const obstacles = useMemo(() => resolveObstacles(obstacleIds), [obstacleIds])

  const route = useMemo(() => {
    if (!planned || !targetZone) return null
    return planRoute({ start: origin, targetZone, obstacleIds })
  }, [planned, targetZone, obstacleIds, origin])

  /**
   * Plans a route to a zone.
   *
   * The optional origin is what lets the demo chain legs together: after
   * treating one zone the rover sets off from where it is standing, not from
   * the depot, so it never appears to jump home between targets.
   */
  const optimizeRoute = useCallback((zoneId, start = DEPOT) => {
    if (!zoneId) return
    setOrigin(start)
    setTargetZone(zoneId)
    setPlanned(true)
  }, [])

  const clearRoute = useCallback(() => {
    setPlanned(false)
    setTargetZone(null)
    setOrigin(DEPOT)
  }, [])

  const toggleObstacle = useCallback((id) => {
    setObstacleIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    )
  }, [])

  return {
    targetZone,
    route,
    obstacles,
    obstacleIds,
    available: SITUATIONAL_OBSTACLES,
    depot: DEPOT,
    optimizeRoute,
    clearRoute,
    toggleObstacle,
  }
}
