// Adapter registry and event dispatcher
import { EventAdapter, GeofenceEventData, AdapterConfig } from "./types"
import { LoggerAdapter } from "./logger"
import { WebhookAdapter } from "./webhook"
import { CDPAdapter } from "./cdp"

export * from "./types"

/**
 * Initialize all configured adapters
 * Adapters are enabled/disabled based on environment variables
 */
export function createAdapterConfig(): AdapterConfig {
  const adapters: EventAdapter[] = []

  // Always include logger (for debugging/audit)
  adapters.push(new LoggerAdapter())

  // Add webhook if configured
  const webhookAdapter = new WebhookAdapter()
  if (webhookAdapter.enabled) {
    adapters.push(webhookAdapter)
  }

  // Add CDP if configured
  const cdpAdapter = new CDPAdapter()
  if (cdpAdapter.enabled) {
    adapters.push(cdpAdapter)
  }

  console.log(
    `[AdapterRegistry] Initialized ${adapters.length} adapters:`,
    adapters.map(a => `${a.name}(${a.enabled ? "enabled" : "disabled"})`).join(", "),
  )

  return { adapters }
}

/**
 * Dispatch geofence event to all enabled adapters
 * Runs adapters in background (non-blocking) with timeout
 */
export function dispatchEvent(eventType: "enter" | "exit", event: GeofenceEventData, config: AdapterConfig): void {
  // Fire and forget - don't await
  const promises = config.adapters
    .filter(adapter => adapter.enabled)
    .map(adapter => {
      const handler = eventType === "enter" ? adapter.onEnter : adapter.onExit

      // Add 5 second timeout to prevent hanging
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Adapter timeout")), 5000),
      )

      return Promise.race([handler.call(adapter, event), timeoutPromise]).catch(error => {
        console.error(`[AdapterDispatcher] ${adapter.name} adapter failed:`, error.message)
        // Continue with other adapters even if one fails
      })
    })

  // Execute in background without blocking
  Promise.all(promises).catch(error => {
    console.error("[AdapterDispatcher] Unexpected error in adapter dispatch:", error)
  })
}
