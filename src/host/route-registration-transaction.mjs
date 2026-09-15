function disposeAll(disposers, { suppressErrors = false } = {}) {
  let firstError
  for (let index = disposers.length - 1; index >= 0; index -= 1) {
    const dispose = disposers[index]
    if (typeof dispose !== 'function') continue
    try {
      dispose()
    } catch (error) {
      firstError ??= error
    }
  }
  if (!suppressErrors && firstError) throw firstError
}

function makeTrackedDisposer(dispose) {
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    return dispose?.()
  }
}

export function createRouteRegistrationTransaction(webServer) {
  if (!webServer || typeof webServer.register !== 'function') {
    throw new TypeError('A Harness webServer service is required')
  }

  const disposers = []
  let finalized = false
  const transactionalWebServer = Object.freeze({
    register(route) {
      if (finalized) throw new Error('Route registration transaction is finalized')
      const dispose = webServer.register(route)
      if (dispose !== undefined && dispose !== null && typeof dispose !== 'function') {
        throw new TypeError('Route registration disposer must be a function')
      }
      const tracked = makeTrackedDisposer(dispose)
      disposers.push(tracked)
      return tracked
    },
  })

  return Object.freeze({
    webServer: transactionalWebServer,
    rollback() {
      if (finalized) return
      finalized = true
      disposeAll(disposers, { suppressErrors: true })
    },
    commit() {
      if (finalized) throw new Error('Route registration transaction is finalized')
      finalized = true
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        disposeAll(disposers)
      }
    },
  })
}
