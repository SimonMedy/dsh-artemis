import assert from 'node:assert/strict'
import test from 'node:test'
import { createRouteRegistrationTransaction } from '../src/host/route-registration-transaction.mjs'
import { apply } from '../src/index.mjs'
import {
  EVIDENCE_ROUTE,
  LIVE_ROUTE,
  OVERVIEW_ROUTE,
  SNAPSHOT_ROUTE,
  TRACE_EVIDENCE_ROUTE,
} from '../src/shared/protocol.mjs'

test('route transaction disposes every registration in reverse order and is idempotent', () => {
  const order = []
  const cleanupFailure = new Error('cleanup failed')
  let count = 0
  const transaction = createRouteRegistrationTransaction({
    register() {
      count += 1
      const current = count
      return () => {
        order.push(current)
        if (current === 3) throw cleanupFailure
      }
    },
  })

  transaction.webServer.register({ path: '/one' })
  transaction.webServer.register({ path: '/two' })
  transaction.webServer.register({ path: '/three' })
  const dispose = transaction.commit()

  assert.throws(() => dispose(), (error) => error === cleanupFailure)
  assert.deepEqual(order, [3, 2, 1])
  dispose()
  assert.deepEqual(order, [3, 2, 1])
})

test('route transaction rollback preserves registration errors while attempting all cleanup', () => {
  const primary = new Error('registration failed')
  const cleaned = []
  const transaction = createRouteRegistrationTransaction({
    register(route) {
      if (route.path === '/fail') throw primary
      return () => {
        cleaned.push(route.path)
        if (route.path === '/one') throw new Error('cleanup failed')
      }
    },
  })

  assert.throws(() => {
    try {
      transaction.webServer.register({ path: '/one' })
      transaction.webServer.register({ path: '/two' })
      transaction.webServer.register({ path: '/fail' })
    } catch (error) {
      transaction.rollback()
      throw error
    }
  }, (error) => error === primary)
  assert.deepEqual(cleaned, ['/two', '/one'])
  transaction.rollback()
  assert.deepEqual(cleaned, ['/two', '/one'])
})

test('plugin apply rolls back Host routes when evidence registration fails', () => {
  const primary = new Error('evidence registration failed')
  const disposed = []
  let registrations = 0
  const ctx = {
    connection: { requestRejection() { return undefined } },
    webServer: {
      register(route) {
        registrations += 1
        if (registrations === 4) throw primary
        return () => {
          disposed.push(route.path)
          if (route.path === SNAPSHOT_ROUTE) throw new Error('snapshot cleanup failed')
        }
      },
    },
    effect(register) {
      return register()
    },
  }

  assert.throws(() => apply(ctx), (error) => error === primary)
  assert.deepEqual(disposed, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
})

test('plugin unload attempts all five route disposers once even if one cleanup fails', () => {
  const cleanupFailure = new Error('trace cleanup failed')
  const disposed = []
  const ctx = {
    connection: { requestRejection() { return undefined } },
    webServer: {
      register(route) {
        return () => {
          disposed.push(route.path)
          if (route.path === TRACE_EVIDENCE_ROUTE) throw cleanupFailure
        }
      },
    },
    effect(register) {
      return register()
    },
  }

  const dispose = apply(ctx)
  assert.throws(() => dispose(), (error) => error === cleanupFailure)
  assert.deepEqual(disposed, [
    TRACE_EVIDENCE_ROUTE,
    EVIDENCE_ROUTE,
    LIVE_ROUTE,
    SNAPSHOT_ROUTE,
    OVERVIEW_ROUTE,
  ])
  dispose()
  assert.equal(disposed.length, 5)
})
