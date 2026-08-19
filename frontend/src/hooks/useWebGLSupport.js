import { useEffect, useState } from 'react'

/**
 * useWebGLSupport
 * Checks once, on mount, whether this browser can give us a WebGL context.
 *
 * Without this the canvas mounts and Three.js throws deep inside the renderer,
 * which surfaces to the person as a blank screen. Checking first lets us show
 * a readable explanation instead.
 *
 * @returns {'checking' | 'supported' | 'unsupported'}
 */
export function useWebGLSupport() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let canvas
    try {
      canvas = document.createElement('canvas')
      const context =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')

      setStatus(context ? 'supported' : 'unsupported')

      // Release the probe context immediately; browsers cap how many exist.
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      setStatus('unsupported')
    } finally {
      canvas = null
    }
  }, [])

  return status
}
