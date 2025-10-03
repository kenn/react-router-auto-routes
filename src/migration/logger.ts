export function logInfo(message: string): void {
  console.log(message)
}

export function logWarn(message: string): void {
  console.warn(message)
}

export function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.message)
    return
  }

  console.error(String(error))
}
