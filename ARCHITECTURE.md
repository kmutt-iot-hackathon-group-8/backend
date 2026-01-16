# Backend Architecture

## Folder Structure

```
backend/
├── index.js                 # Main application file
├── db.js                    # Database configuration
├── package.json
├── .env.example
├── controllers/
│   ├── eventController.js   # Event CRUD logic
│   ├── attendeeController.js # Attendee management logic
│   ├── userController.js    # User profile logic
│   └── cardController.js    # NFC card scanning logic
├── routes/
│   ├── events.js            # Event routes
│   ├── attendees.js         # Attendee routes
│   └── users.js             # User routes
└── middleware/
    └── (future auth middleware)
```

## File Descriptions

### Core Files

#### `index.js` - Application Entry Point

- Sets up Express server with Socket.io
- Configures BetterAuth OAuth
- Mounts all routes
- Handles socket connections
- Starts HTTP server on PORT

**Key Sections:**

- Middleware setup (CORS, JSON parsing)
- BetterAuth initialization
- Route mounting
- Socket.io connection handling
- Server startup

#### `db.js` - Database Configuration

- Exports Neon database connection
- Simple initialization of SQL client

### Controllers

Controllers contain all business logic for specific domains.

#### `controllers/eventController.js` - Event Operations

**Methods:**

- `getAll()` - Fetch events with optional filtering
- `getById()` - Get single event details
- `create()` - Create new event
- `update()` - Update event fields
- `delete()` - Delete event

**Database Operations:**

- SELECT with LEFT JOINs for attendee counts
- INSERT with RETURNING clause
- UPDATE with dynamic field building
- DELETE with cascade

#### `controllers/attendeeController.js` - Attendee Management

**Methods:**

- `getByEventId()` - List attendees for an event
- `register()` - User self-registers for event
- `add()` - Admin adds attendee
- `updateStatus()` - Change attendee status (present/absent/registered)
- `remove()` - Remove attendee from event

**Status Types:**

- `registered` - User signed up but not checked in
- `present` - User has checked in
- `absent` - User was registered but didn't attend

#### `controllers/userController.js` - User Profile

**Methods:**

- `getProfile()` - Get user profile info
- `updateProfile()` - Update first/last name or email
- `linkCard()` - Link NFC card to user account

**User Data:**

- uid (from BetterAuth)
- fname, lname (names)
- email
- cardId (NFC card ID)

#### `controllers/cardController.js` - NFC Card Operations

**Methods:**

- `scanCard()` - Handle ESP32 card tap
- `registerCard()` - Link card to OAuth user

**Flow:**

1. ESP32 taps card → calls `/api/v1/scan-card/:cardId?eventId=X`
2. If card not in DB → return registration URL
3. If card registered → check event attendance
4. Auto-register if new to event, or update status if existing

### Routes

Routes define API endpoints and map them to controllers.

#### `routes/events.js`

```javascript
GET    /api/v1/events              // Get all events
GET    /api/v1/events/:id          // Get single event
POST   /api/v1/events              // Create event
PUT    /api/v1/events/:id          // Update event
DELETE /api/v1/events/:id          // Delete event
```

#### `routes/attendees.js`

```javascript
GET    /api/v1/events/:eventId/attendees
POST   /api/v1/events/:eventId/attendees/register
POST   /api/v1/events/:eventId/attendees
PUT    /api/v1/attendees/:eventId/:uid/status
DELETE /api/v1/events/:eventId/attendees/:uid
```

#### `routes/users.js`

```javascript
GET    /api/v1/users/profile/:uid
PUT    /api/v1/users/profile/:uid
POST   /api/v1/users/card
```

## Request Flow Example

### Creating an Event

```
POST /api/v1/events
├── express.json() parses request body
├── eventRoutes redirects to eventController.create()
├── controller validates required fields
├── SQL INSERT into events table
├── RETURNING clause returns new event
├── HTTP 201 response with event data
└── (future: Socket.io emit event_created)
```

### Scanning NFC Card

```
GET /api/v1/scan-card/:cardId?eventId=X
├── cardController.scanCard() called
├── Look up user by cardId
│  ├── If not found → return registration URL
│  └── If found → continue
├── Check attendee record for event
│  ├── If not exists → auto-register and emit announcement
│  ├── If present → return already_in message
│  └── If registered → mark present and log to history
└── HTTP response with status message
```

## Error Handling

All controllers follow consistent error pattern:

```javascript
try {
  // business logic
} catch (err) {
  console.error("Error message:", err);
  res.status(500).json({ error: "User-friendly error message" });
}
```

## Socket.io Events

The app emits these events via Socket.io:

```javascript
io.emit("announcement", message); // User check-in announcement
io.emit("event_created", eventData); // New event created
io.emit("event_updated", eventData); // Event details changed
io.emit("event_deleted", { eventId }); // Event deleted
io.emit("user_registered", data); // User registered for event
io.emit("attendee_updated", data); // Attendee status changed
io.emit("attendee_removed", data); // Attendee removed
io.emit("card_registered", data); // Card linked to user
```

## Adding New Features

### Add New Controller

1. Create `controllers/featureController.js`
2. Export object with handler methods
3. Each method: `async (req, res) => {}`

### Add New Routes

1. Create `routes/feature.js`
2. Import controller
3. Define route handlers
4. Export router
5. Mount in `index.js`: `app.use("/api/v1/feature", featureRoutes)`

### Example: Adding a Search Endpoint

```javascript
// controllers/searchController.js
const search = async (req, res) => {
  const { q } = req.query;
  // search logic
  res.json(results);
};
module.exports = { search };

// routes/search.js
router.get("/", searchControllers.search);

// index.js
app.use("/api/v1/search", searchRoutes);
```

## Environment Variables

```
DATABASE_URL              # PostgreSQL connection string
GOOGLE_CLIENT_ID          # Google OAuth credentials
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID       # Microsoft OAuth credentials
MICROSOFT_CLIENT_SECRET
NODE_ENV                  # development or production
FRONTEND_URL             # Frontend domain for OAuth redirects
PORT                     # Server port (default: 3000)
```

## Testing Locally

```bash
# Start backend
npm run dev

# Test event creation
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventOwner": 1,
    "eventDetail": "Test Event",
    "eventStartDate": "2025-02-01",
    "eventEndDate": "2025-02-01",
    "regisURL": "http://example.com"
  }'

# Test card scan
curl http://localhost:3000/api/v1/scan-card/12:34:56:78?eventId=1
```

## Performance Considerations

- Database queries use prepared statements (security)
- Attendee count aggregated with GROUP BY
- Indexes should be on: eventId, uid, cardId, eventOwner
- Consider caching frequent queries (events list)
