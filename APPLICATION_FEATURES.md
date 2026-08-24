# Muzhappilangad Drive-In Beach Management System - Application Features

This document provides a comprehensive breakdown of all features available in the **Muzhappilangad Drive-In Beach Management & Verification Application**, organized into three core sections:
1. **User Side Features** (Public Visitors, Local Residents, Services Directory & Logged-In Users)
2. **Admin Side Features** (Gate Security & Verification Officers)
3. **Master Settings & Master Admin Features** (System Administration, Feature Controls, Tab Maintenance & Analytics)

---

## 1. User Side Features

The user interface caters to two types of end users: **Unregistered Public Visitors (Tourists)** and **Registered Local Panchayat Residents**.

### A. Public Visitor (Tourist) Workflow
* **Online Entry Ticket Purchase (`/entry`)**:
  * Select number of visitors with instant fee calculation (Standard rate: ₹20 per visitor).
  * Offline & cash payment mode options with idempotency checks to prevent duplicate orders.
  * Real-time pass status tracking (`/entry/success`) powered by **Server-Sent Events (SSE)** for instant gate approval updates without refreshing.
* **Digital Visitor Entry Pass**:
  * Generates a dynamic QR code upon gate approval.
  * Displays visitor count, pass status badge, timestamp, and gate instructions.
* **Public Incident & Problem Reporting (`/report`)**:
  * Submit beach issues anonymously or as a visitor.
  * Issue categories: *Garbage*, *Overflowing Bin*, *Unsafe Driving*, *Damaged Facility*, *Noise Problem*, *Safety Issue*, *Other*.
  * Device camera photo capture & gallery upload integration (`PhotoPicker.jsx`).
  * Automatic GPS Geolocation capture (Latitude, Longitude & Accuracy) with full browser/device telemetry gathering.

### B. Resident Workflow (`/user/*`)
* **Electoral Database Verification**:
  * Search official Panchayat voter roll records by Name, House Name, or Ward.
  * Claim digital resident pass by linking mobile number and photo ID.
* **Resident Dashboard & Digital Pass (`/user/home`, `/user/my-pass`)**:
  * **Free Beach Access Pass**: Generates dynamic QR code pass for free resident entry.
  * Displays voter ID, ward number, house name, and user profile photo.
  * Real-time pass validity status indicator (*Active* / *Inactive*).
  * Profile photo update directly from the user dashboard.
* **Visit History Logs (`/user/my-visits`)**:
  * Complete log of past beach visits with check-in timestamps and entry gate details.
* **Beach Code of Conduct & Rules (`/user/beach-rules`)**:
  * Informational guide detailing speed limits, parking rules, tide safety advisories, and waste disposal regulations.
  * Direct 1-tap navigation button from the Home screen hero banner.

### C. Services & Beach Directory (`/user/services`)
* **Dynamic 2-Column Responsive Grid (`grid-cols-2`)**:
  * **Auto & Taxi Rides**: Direct driver cards with vehicle photo/avatar, driver name, vehicle type (*Auto Rickshaw*, *4-Seater Cab*, *SUV Taxi*, *Traveller*), vehicle registration number, stand location, and direct 1-tap **"Call Driver"** action.
  * **Beach Restaurants & Live Food Menus**: Browse local eateries, cuisines, pure-veg indicators, operating hours, and total dish counts. Clicking opens the **Interactive Food Menu Modal** showing all dishes with prices, dietary badges (*Veg*, *Non-Veg*, *Seafood*), **In-Stock 🟢 / Sold-Out 🔴** live status, and direct **Call to Order**.
  * **Beachfront Resorts & Stays**: View tariff per night, beach view amenities, and direct reception contact.
* **Category Filters & Instant Search**: Filter by *All Services*, *Auto & Taxi*, *Restaurants*, or *Resorts* with search by name, vehicle number, driver, dish, or location.

### D. Logged-In User Features, Session & Emergency Tools
* **Extended 2-Hour Active Session & Silent Token Refresh**:
  * 2-hour session lifetime with automatic 7-day refresh token rotation.
  * Automatic silent token renewal on `401 Unauthorized` without logging out active users.
* **Unified Aesthetic Hero Banners**:
  * Common `BeachBanner` component with standardized `min-h-[210px]` height, typography hierarchy, and dark gradient overlays across all tabs (*Home, Pass, Visits, Services, Reports, Profile, Rules*).
* **Resident Incident Reporting & Live Tracking (`/user/report`)**:
  * **Submit Report**: Report issues with category selection, description, photo attachment, and location.
  * **My Reports Tab**: Dedicated list of all user-submitted issues with real-time status badges (*OPEN*, *IN_PROGRESS*, *RESOLVED*).
  * **Live Status Notifications**: SSE listener alerting users instantly when a gate admin updates their issue status.
* **Emergency SOS Alarm System**:
  * One-tap red **Emergency SOS Button** on the user dashboard.
  * Immediately triggers a full-screen emergency audio siren and alert modal on all active Gate Admin and Master Admin screens, transmitting live user profile info and GPS coordinates.
* **Live GPS Location Tracking**:
  * When enabled by Master Admin, streams live GPS location coordinates to the master live tracking map.

---

## 2. Admin Side Features (Gate Security Officers)

The Admin interface is optimized for handheld gate verification officers and security personnel stationed at beach entrance gates (`/admin/*`).

### A. Live Hardware Camera QR Scanner (`/admin/scan`)
* **High-Speed Camera Scanner**:
  * Powered by `html5-qrcode` library with front and rear camera toggle controls.
  * Scans both **Resident Free Access QR Passes** and **General Paid Visitor Passes**.
* **Automated Entry Verification & Audio Feedback**:
  * Instant visual verification banner (*Pass Approved / Valid* vs *Pass Invalid / Expired*).
  * Displays resident profile picture, voter details, and ticket validity immediately upon scan.
  * Audio chime indicators for instant verification feedback.

### B. Live Pending Visitor Approval Queue (`AdminPendingVisitorAlert.jsx`)
* **Real-Time Gate Alerts**:
  * Powered by **Server-Sent Events (SSE)** channel alerting gate admins instantly when a visitor purchases/requests entry at their gate.
  * One-click **Approve Entry** or **Reject Entry** quick-action buttons.

### C. Manual Resident Verification (`/admin/search`)
* **Search Fallback**:
  * Manual search for residents who do not have a smartphone or printed QR pass.
  * Search by Name, SEC ID, or Ward to verify identity and log manual entry into the database.

### D. Recent Entry History (`/admin/recent`)
* Real-time list of recent gate entries (residents and paid visitors) with timestamps and entry stats.

### E. Gate Incident Management (`/admin/reports`)
* **Dual-Tab Architecture**:
  * 👤 **User Reports**: Issues submitted by authenticated residents with user details.
  * 🙈 **Anonymous Reports**: Public/guest submissions.
* **Real-Time SSE Incident Alerts**: Live notification banner whenever a new incident is submitted on the beach.
* **Status Progression Controls**: Action buttons to update report status (*OPEN* ➔ *IN_PROGRESS* ➔ *RESOLVED*), sending automated SSE notifications back to the reporting resident.

### F. Emergency SOS Live Alert Overlay (`AdminEmergencyOverlay.jsx`)
* **Full-Screen Audio & Visual Siren**:
  * Triggered instantly when any user presses the Emergency SOS button.
  * Plays emergency siren sound with browser autoplay unlock handlers.
* **Emergency Detail Card**:
  * Displays reporting user's Name, Phone Number, exact GPS Coordinates, timestamp, and a **Direct Google Maps Location Link** for rapid emergency dispatch.
  * One-click "Claim / Resolve Emergency" button to stop the alarm siren.

---

## 3. Master Settings & Master Admin Features

The Master Admin dashboard (`/master/*`) provides complete system governance, feature flags control, services directory management, tab maintenance locks, live tracking, analytics, and database management.

### A. Tab Maintenance & Working Menu Lock System (`/master/tab-maintenance`)
Master Admins can dynamically suspend or lock specific user tabs during upgrades, routine maintenance, or severe weather emergencies:
* **Target Specific User Tabs**:
  * `My Reports & Issue Reporting` (`/user/report`)
  * `Beach Services & Rides Directory` (`/user/services`)
  * `Digital Resident Gate Pass` (`/user/my-pass`)
  * `My Visits & Access Log` (`/user/my-visits`)
  * `Beach Safety & Guidelines` (`/user/beach-rules`)
* **Visual Icon Picker**: Choose from 13 custom icons (*Wrench* 🛠️, *Construction* 🚧, *Alert* ⚠️, *Shield* 🛡️, *Clock* ⏳, *Lock* 🔒, *Sparkles* ✨, *Bell* 🔔, *Car* 🚗, *Utensils* 🍴, *Info* ℹ️, *Flame* 🔥).
* **Custom Notice Headings & Descriptions**: 1-click presets (*Routine Maintenance, System Upgrade, High Tide Weather Pause, Gate Sync*) and custom text entry.
* **User-Side Glassmorphic Lockout**: When a tab is locked, opening that tab displays a full `backdrop-blur-lg bg-slate-950/80` glassmorphism overlay with the pulsing icon, maintenance title, explanation, and a "Return to Home" button, blocking all actions underneath.
* **Live Socket Synchronization**: Broadcasts changes via Socket.IO instantly to all active devices.

### B. Beach Services & Directory Management (`/master/services`)
* **Auto & Taxi Management**:
  * Add/Edit drivers with photo file upload picker, driver name, phone number, vehicle registration number, vehicle type, and stand location.
* **Restaurant & Food Menu Management**:
  * Add restaurants with cover photo upload, cuisines, operating hours, and pure-veg flags.
  * **Live Food Dish Manager**: Add dishes with dietary tags (*Veg*, *Non-Veg*, *Seafood*), price, today's special tag, and 1-click **In-Stock / Sold-Out** toggle switches.
* **Resorts & Stays Management**:
  * Manage resort listings with tariff rates, amenities checklist, and check-in times.

### C. Master Settings & Feature Control Matrix (`/master/features`)
| Feature Control | Switch Key | Description |
| :--- | :--- | :--- |
| **Emergency SOS Alarm Button** | `emergencySosEnabled` | Shows/hides the red Emergency SOS alarm button on user home. Controls emergency siren capability. |
| **Public Visitor Reporting** | `publicReportEnabled` | Enables or disables issue reporting routes for non-logged-in public/guest visitors. |
| **Logged-In User Reporting** | `userReportEnabled` | Controls the "Report Issue" button and tab for logged-in residents/users. |
| **Track User System (Live GPS)** | `trackUserEnabled` | Toggles live GPS tracking system, permission prompts, and live map streaming. |
| **Order Food & Drinks Online** | `orderFoodEnabled` | Shows or hides the online beach food ordering system. |
| **Resort & Stay Room Booking** | `resortBookingEnabled` | Shows or hides the beach resort/room booking module. |

### D. Live Track User Map System (`/master/track-user`)
* Real-time tracking of active users streaming live GPS locations via Socket.io on Leaflet map with speed, heading, and SOS status markers.

### E. Master Analytics & Executive Dashboard (`/master/dashboard`, `/master/analytics`)
* Real-time KPI metrics (*Total Entries*, *Paid Visitors*, *Resident Free Check-ins*, *Registered Residents*, *Open Reports*), hourly traffic distribution charts, and temporal growth statistics.

### F. Bulk Resident Data Import (`/master/import`)
* Drag-and-drop JSON/CSV Electoral Roll importer with data validation and deduplication.

### G. Electoral Registry & Pass Management (`/master/resident-records`, `/master/registered-residents`)
* Full searchable voter roll database and active resident pass control with 1-click access activation/revocation.

### H. User & Gate Admin Access Control (`/master/admins`, `/master/users`)
* Create/manage gate security admin accounts, assign gate locations, and manage user roles.

### I. Broadcast Notification Center (`/master/notifications`)
* Compose push announcements targeting specific roles (`USER`, `ADMIN`, `MASTER_ADMIN`) or all visitors with notification history.

### J. Master Incident Control & GPS Mapping (`/master/reports`)
* View incident telemetry, evidence photos, high-accuracy GPS coordinates, and Google Maps routing.

### K. System Audit Logs (`/master/activity-logs`)
* Comprehensive audit trail recording all administrative operations with timestamps, actor IDs, and IP metadata.

---

## 4. Architectural & Tech Summary

* **Frontend**: React 19, Vite, React Router v7, Tailwind CSS v4, Lucide React, Leaflet Maps, html5-qrcode.
* **Backend**: Node.js, Express, MongoDB (Mongoose), Cloudinary for media uploads.
* **Authentication**: JWT with 2-Hour access tokens & 7-day refresh token rotation via Axios response interceptors.
* **Real-Time Communication**: Server-Sent Events (SSE) for visitor queue & report status; Socket.IO for live GPS tracking, emergency sirens, and feature/maintenance synchronization.
