// Lets bare Node resolve Vite-style imports: extensionless files and
// directory imports that mean directory/index.js.
import { existsSync, statSync } from 'fs'
import { fileURLToPath } from 'url'

export function resolve(specifier, context, next) {
  if (specifier.startsWith('.')) {
    const base = new URL(specifier, context.parentURL)
    const p = fileURLToPath(base)

    if (!/\.(js|mjs|json|jsx)$/.test(specifier)) {
      for (const ext of ['.js', '.jsx']) {
        if (existsSync(p + ext)) return next(base.href + ext, context)
      }
      if (existsSync(p) && statSync(p).isDirectory()) {
        for (const idx of ['/index.js', '/index.jsx']) {
          if (existsSync(p + idx)) return next(base.href + idx, context)
        }
      }
    }
  }
  return next(specifier, context)
}
