// Webhook adapter - POSTs geofence events to configured webhook URL
import { EventAdapter, GeofenceEventData } from "./types"

export class WebhookAdapter implements EventAdapter {
  name = "webhook"
  enabled: boolean
  private webhookUrl: string
  private apiKey: string

  constructor(webhookUrl?: string, apiKey?: string) {
    this.webhookUrl = webhookUrl || process.env.GEOFENCE_WEBHOOK_URL || ""
    this.apiKey = apiKey || process.env.GEOFENCE_WEBHOOK_API_KEY || ""
    this.enabled = !!this.webhookUrl

    if (this.enabled) {
      console.log(`[WebhookAdapter] Enabled with URL: ${this.webhookUrl}`)
      if (this.apiKey) {
        console.log("[WebhookAdapter] API key configured")
      }
    } else {
      console.log("[WebhookAdapter] Disabled - no webhook URL configured")
    }
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.sendWebhook(event)
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.sendWebhook(event)
  }

  private async sendWebhook(event: GeofenceEventData): Promise<void> {
    if (!this.enabled) return

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey
      }

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          app_id: event.appId,
          event_type: event.eventType,
          user_id: event.userId,
          geofence: event.geofence,
          position: event.position,
          timestamp: event.timestamp.toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }

      console.log(
        `[WebhookAdapter] Sent ${event.eventType} event for user ${event.userId} to webhook ${this.webhookUrl}`,
      )
    } catch (error) {
      console.error("[WebhookAdapter] Failed to send webhook:", error)
      // Don't throw - webhook failures shouldn't block other adapters
    }
  }
}
