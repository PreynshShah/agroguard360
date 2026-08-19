import { Terrain } from './Terrain'
import { CropRows } from './CropRows'
import { GrassVerges } from './GrassVerges'
import { Treeline } from './Treeline'
import { Farmstead } from './Farmstead'
import { WaterTank } from './WaterTank'
import { Irrigation } from './Irrigation'
import { Equipment } from './Equipment'
import { ZoneOverlay } from './ZoneOverlay'
import { DiagnosticMarkers } from './DiagnosticMarkers'
import { RoutePath } from './RoutePath'
import { ObstacleMarkers } from './ObstacleMarkers'
import { DepotMarker } from './DepotMarker'

/**
 * Farm
 * Assembles the whole environment.
 *
 * Order matters only for the transparent layers: ZoneOverlay draws last so its
 * tint and corner brackets composite over the soil beneath.
 */
export function Farm({
  hoveredZone,
  selectedZone,
  onHoverZone,
  onSelectZone,
  results,
  activeZone,
  route,
  obstacles,
}) {
  return (
    <group>
      <Terrain />
      <CropRows />
      <GrassVerges />

      <Treeline />
      <Farmstead />
      <WaterTank />
      <Irrigation />
      <Equipment />

      <ZoneOverlay
        hoveredId={hoveredZone}
        selectedId={selectedZone}
        onHover={onHoverZone}
        onSelect={onSelectZone}
        results={results}
        activeZone={activeZone}
      />

      <DiagnosticMarkers results={results} />

      <DepotMarker />
      <ObstacleMarkers obstacles={obstacles} />
      <RoutePath route={route} />
    </group>
  )
}
