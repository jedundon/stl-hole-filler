import { useStore } from '../store/useStore'

/**
 * Renders the extruded fill prism for each visible selection as a
 * translucent solid so the user can preview the fill color in 3D.
 */
export function FillPreview() {
  const selections = useStore(s => s.selections)

  return (
    <>
      {selections.filter(s => s.visible && s.fillGeometry).map(sel => (
        <mesh key={sel.id} geometry={sel.fillGeometry!}>
          <meshStandardMaterial
            color={sel.color}
            transparent
            opacity={0.75}
            roughness={0.4}
            metalness={0.0}
          />
        </mesh>
      ))}
    </>
  )
}
