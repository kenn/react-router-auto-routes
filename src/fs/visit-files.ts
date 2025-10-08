import fs from 'node:fs'
import path from 'node:path'

export type VisitFilesOptions = {
  followSymlinks?: boolean
}

export function visitFiles(
  dir: string,
  visitor: (file: string) => void,
  options: VisitFilesOptions = {},
): void {
  const { followSymlinks = true } = options
  const rootDir = dir
  const readStat = followSymlinks ? fs.statSync : fs.lstatSync

  const walk = (currentDir: string) => {
    for (const filename of fs.readdirSync(currentDir)) {
      const file = path.resolve(currentDir, filename)
      const stat = readStat(file)

      if (stat.isDirectory()) {
        walk(file)
      } else if (stat.isFile()) {
        visitor(path.relative(rootDir, file))
      }
    }
  }

  walk(dir)
}
