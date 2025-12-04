import { GeofenceMonitor } from "@geofence/sdk"
import L from "leaflet"

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// State
let monitor = null
let map = null
let currentPositionMarker = null
let geofenceCircles = []
let currentGeofences = new Set()
let currentMode = "manual" // 'manual' or 'gps'

// DOM Elements
const startBtn = document.getElementById("startBtn")
const stopBtn = document.getElementById("stopBtn")
const setPositionBtn = document.getElementById("setPositionBtn")
const useCurrentLocationBtn = document.getElementById("useCurrentLocationBtn")
const refreshGeofencesBtn = document.getElementById("refreshGeofencesBtn")
const clearLogBtn = document.getElementById("clearLogBtn")
const latitudeInput = document.getElementById("latitude")
const longitudeInput = document.getElementById("longitude")
const statusIndicator = document.getElementById("statusIndicator")
const statusText = document.getElementById("statusText")
const eventsLog = document.getElementById("eventsLog")
const geofenceList = document.getElementById("geofenceList")
const manualModeBtn = document.getElementById("manualModeBtn")
const gpsModeBtn = document.getElementById("gpsModeBtn")
const modeDescription = document.getElementById("modeDescription")
const positionControlCard = document.getElementById("positionControlCard")

// Initialize map
function initMap() {
  map = L.map("map").setView([37.7749, -122.4194], 12)

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map)

  // Add click handler to set position
  map.on("click", e => {
    latitudeInput.value = e.latlng.lat.toFixed(6)
    longitudeInput.value = e.latlng.lng.toFixed(6)
    updatePosition()
  })
}

// Initialize SDK
function initSDK(mode = "manual") {
  monitor = new GeofenceMonitor({
    apiUrl: "http://localhost:3000",
    pollingInterval: 1000,
    debug: true,
    testMode: mode === "manual",
  })

  // Event listeners
  monitor.on("enter", geofence => {
    addEventLog("enter", `Entered: ${geofence.name}`)
    currentGeofences.add(geofence.id)
    updateGeofenceList()
    updateGeofenceCircles()
  })

  monitor.on("exit", geofence => {
    addEventLog("exit", `Exited: ${geofence.name}`)
    currentGeofences.delete(geofence.id)
    updateGeofenceList()
    updateGeofenceCircles()
  })

  monitor.on("position", position => {
    const lat = position.coords.latitude.toFixed(6)
    const lng = position.coords.longitude.toFixed(6)
    addEventLog("position", `Position: ${lat}, ${lng}`)
    updatePositionMarker(position.coords.latitude, position.coords.longitude)

    // In GPS mode, always follow the GPS position
    if (currentMode === "gps") {
      // Smooth pan to new position (keeps current zoom level)
      map.panTo([position.coords.latitude, position.coords.longitude], {
        animate: true,
        duration: 0.5,
      })
    }
  })

  monitor.on("error", error => {
    addEventLog("error", `Error: ${error.message}`)
  })
}

// Switch between manual and GPS mode
async function switchMode(newMode) {
  if (newMode === currentMode) {
    return
  }

  const wasRunning = monitor && monitor.getStatus().isRunning

  // Stop current monitor if running
  if (wasRunning) {
    monitor.stop()
    statusIndicator.classList.remove("active")
    statusText.textContent = "Switching mode..."
  }

  // Update mode
  currentMode = newMode

  // Update UI
  if (newMode === "manual") {
    manualModeBtn.classList.add("active")
    gpsModeBtn.classList.remove("active")
    modeDescription.textContent = "Set position manually"
    positionControlCard.classList.remove("disabled")
    setPositionBtn.style.display = "block"
    addEventLog("position", "Switched to Manual mode")
  } else {
    manualModeBtn.classList.remove("active")
    gpsModeBtn.classList.add("active")
    modeDescription.textContent = "Automatic GPS tracking (map follows position)"
    positionControlCard.classList.add("disabled")
    setPositionBtn.style.display = "none"
    addEventLog("position", "Switched to GPS mode")
  }

  // Reinitialize SDK with new mode
  initSDK(newMode)

  // Restart if it was running
  if (wasRunning) {
    try {
      await startMonitoring()
    } catch (error) {
      addEventLog("error", `Failed to restart in ${newMode} mode: ${error.message}`)
    }
  }
}

// Start monitoring
async function startMonitoring() {
  try {
    startBtn.disabled = true
    statusText.textContent = "Starting..."

    await monitor.start()

    statusIndicator.classList.add("active")
    statusText.textContent = "Running"
    startBtn.disabled = true
    stopBtn.disabled = false
    setPositionBtn.disabled = false

    // Draw geofences on map
    drawGeofences()
    updateGeofenceList()

    addEventLog("position", "Monitor started successfully")
  } catch (error) {
    statusText.textContent = "Error"
    startBtn.disabled = false
    addEventLog("error", `Failed to start: ${error.message}`)
  }
}

// Stop monitoring
function stopMonitoring() {
  monitor.stop()

  statusIndicator.classList.remove("active")
  statusText.textContent = "Stopped"
  startBtn.disabled = false
  stopBtn.disabled = true
  setPositionBtn.disabled = true

  addEventLog("position", "Monitor stopped")
}

// Update position
function updatePosition() {
  if (currentMode === "gps") {
    addEventLog("error", "Manual position control not available in GPS mode")
    return
  }

  const lat = parseFloat(latitudeInput.value)
  const lng = parseFloat(longitudeInput.value)

  if (isNaN(lat) || isNaN(lng)) {
    addEventLog("error", "Invalid coordinates")
    return
  }

  monitor.setTestPosition(lat, lng)
  map.setView([lat, lng], map.getZoom())
}

// Update position marker on map
function updatePositionMarker(lat, lng) {
  if (currentPositionMarker) {
    currentPositionMarker.setLatLng([lat, lng])
  } else {
    // Create custom icon for current position
    const currentIcon = L.divIcon({
      className: "current-position-marker",
      html: '<div style="background: #2196F3; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })

    currentPositionMarker = L.marker([lat, lng], { icon: currentIcon }).addTo(map).bindPopup("Current Position")
  }
}

// Draw geofences on map
function drawGeofences() {
  // Clear existing circles
  geofenceCircles.forEach(circle => circle.remove())
  geofenceCircles = []

  const geofences = monitor.getGeofences()

  geofences.forEach(geofence => {
    const circle = L.circle([geofence.latitude, geofence.longitude], {
      radius: geofence.radius,
      color: "#4CAF50",
      fillColor: "#4CAF50",
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map)

    circle.bindPopup(`
      <strong>${geofence.name}</strong><br>
      Radius: ${geofence.radius}m<br>
      Lat: ${geofence.latitude.toFixed(6)}<br>
      Lng: ${geofence.longitude.toFixed(6)}
    `)

    // Allow clicking on geofence to set position at that point
    circle.on("click", e => {
      latitudeInput.value = e.latlng.lat.toFixed(6)
      longitudeInput.value = e.latlng.lng.toFixed(6)
      updatePosition()
    })

    geofenceCircles.push(circle)
  })

  // Fit map to show all geofences
  if (geofenceCircles.length > 0) {
    const group = L.featureGroup(geofenceCircles)
    map.fitBounds(group.getBounds().pad(0.1))
  }
}

// Update geofence circles to show active state
function updateGeofenceCircles() {
  const geofences = monitor.getGeofences()

  geofenceCircles.forEach((circle, index) => {
    const geofence = geofences[index]
    const isActive = currentGeofences.has(geofence.id)

    circle.setStyle({
      color: isActive ? "#FF5722" : "#4CAF50",
      fillColor: isActive ? "#FF5722" : "#4CAF50",
      fillOpacity: isActive ? 0.3 : 0.2,
      weight: isActive ? 3 : 2,
    })
  })
}

// Update geofence list
function updateGeofenceList() {
  const geofences = monitor.getGeofences()

  if (geofences.length === 0) {
    geofenceList.innerHTML = '<div class="empty-state">No geofences loaded</div>'
    return
  }

  geofenceList.innerHTML = geofences
    .map(geofence => {
      const isActive = currentGeofences.has(geofence.id)
      return `
      <div class="geofence-item ${isActive ? "active" : ""}">
        <strong>${geofence.name}</strong>
        <div style="font-size: 11px; color: #666; margin-top: 2px;">
          ${geofence.latitude.toFixed(6)}, ${geofence.longitude.toFixed(6)} | ${geofence.radius}m
        </div>
      </div>
    `
    })
    .join("")
}

// Add event to log
function addEventLog(type, message) {
  // Clear empty state
  if (eventsLog.querySelector(".empty-state")) {
    eventsLog.innerHTML = ""
  }

  const eventItem = document.createElement("div")
  eventItem.className = `event-item event-${type}`

  const timestamp = new Date().toLocaleTimeString()
  eventItem.textContent = `[${timestamp}] ${message}`

  eventsLog.insertBefore(eventItem, eventsLog.firstChild)

  // Limit to 100 events
  while (eventsLog.children.length > 100) {
    eventsLog.removeChild(eventsLog.lastChild)
  }
}

// Clear event log
function clearEventLog() {
  eventsLog.innerHTML = '<div class="empty-state">No events yet</div>'
}

// Use current browser location
function useCurrentLocation() {
  if (!("geolocation" in navigator)) {
    addEventLog("error", "Geolocation is not supported by your browser")
    return
  }

  useCurrentLocationBtn.disabled = true
  useCurrentLocationBtn.textContent = "⏳ Getting location..."

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude

      latitudeInput.value = lat.toFixed(6)
      longitudeInput.value = lng.toFixed(6)

      addEventLog("position", `Got current location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)

      // Update position in monitor if running
      if (monitor && monitor.getStatus().isRunning) {
        updatePosition()
      }

      // Center map on current location
      map.setView([lat, lng], 14)

      useCurrentLocationBtn.disabled = false
      useCurrentLocationBtn.textContent = "📍 Use Current Location"
    },
    error => {
      let errorMsg = "Failed to get location"
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = "Location permission denied"
          break
        case error.POSITION_UNAVAILABLE:
          errorMsg = "Location information unavailable"
          break
        case error.TIMEOUT:
          errorMsg = "Location request timed out"
          break
      }

      addEventLog("error", errorMsg)
      useCurrentLocationBtn.disabled = false
      useCurrentLocationBtn.textContent = "📍 Use Current Location"
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  )
}

// Refresh geofences from API
async function refreshGeofences() {
  if (!monitor) {
    addEventLog("error", "Monitor not initialized")
    return
  }

  refreshGeofencesBtn.disabled = true
  refreshGeofencesBtn.textContent = "⏳ Refreshing..."

  try {
    await monitor.refreshGeofences()

    addEventLog("position", `Refreshed ${monitor.getGeofences().length} geofences`)

    // Redraw geofences on map
    drawGeofences()
    updateGeofenceList()
  } catch (error) {
    addEventLog("error", `Failed to refresh geofences: ${error.message}`)
  } finally {
    refreshGeofencesBtn.disabled = false
    refreshGeofencesBtn.textContent = "🔄 Refresh Geofences"
  }
}

// Quick position buttons
document.querySelectorAll(".quick-position-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    latitudeInput.value = btn.dataset.lat
    longitudeInput.value = btn.dataset.lng
    if (monitor && monitor.getStatus().isRunning) {
      updatePosition()
    }
  })
})

// Event listeners
startBtn.addEventListener("click", startMonitoring)
stopBtn.addEventListener("click", stopMonitoring)
setPositionBtn.addEventListener("click", updatePosition)
useCurrentLocationBtn.addEventListener("click", useCurrentLocation)
refreshGeofencesBtn.addEventListener("click", refreshGeofences)
clearLogBtn.addEventListener("click", clearEventLog)

// Mode toggle listeners
manualModeBtn.addEventListener("click", () => switchMode("manual"))
gpsModeBtn.addEventListener("click", () => switchMode("gps"))

// Allow Enter key in position inputs
latitudeInput.addEventListener("keypress", e => {
  if (e.key === "Enter" && monitor && monitor.getStatus().isRunning) {
    updatePosition()
  }
})

longitudeInput.addEventListener("keypress", e => {
  if (e.key === "Enter" && monitor && monitor.getStatus().isRunning) {
    updatePosition()
  }
})

// Initialize
initMap()
initSDK(currentMode)

console.log("Geofence SDK Test App initialized")
console.log("Make sure the admin app is running on http://localhost:3000")
