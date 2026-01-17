const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// Helper function to format event dates (YYYY-MM-DD) and times (HH:MM:SS)
function formatEventDates(event) {
  if (!event) return event;
  const formatDate = (val) => {
    if (!val) return val;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'string' && val.includes('T')) return val.split('T')[0];
    return val;
  };
  const formatTime = (val) => {
    if (!val) return val;
    if (val instanceof Date) return val.toISOString().split('T')[1].split('.')[0];
    if (typeof val === 'string' && val.includes('T')) return val.split('T')[1].split('.')[0];
    return val;
  };
  return {
    ...event,
    eventstartdate: formatDate(event.eventstartdate),
    eventenddate: formatDate(event.eventenddate),
    regisstart: formatDate(event.regisstart),
    regisend: formatDate(event.regisend),
    eventstarttime: formatTime(event.eventstarttime),
    eventendtime: formatTime(event.eventendtime),
  };
}

async function createEvent(req, res) {
  let { eventowner, eventdetail, eventimg, eventstartdate, eventenddate
    , eventstarttime, eventendtime, regisstart, regisend, contact, eventtitle, eventlocation
  } = req.body;
  
  console.log('Received data:', req.body);
  
  try {
    // Validate required fields
    if (!eventstartdate || !eventenddate || !eventstarttime || !eventendtime || !regisstart || !regisend) {
      console.log('Missing fields:', {
        eventstartdate, eventenddate, eventstarttime, eventendtime, regisstart, regisend
      });
      return res.status(400).json({ error: 'Missing required date/time fields' });
    }

    // Format dates as YYYY-MM-DD (handle both date strings and ISO datetime strings)
    const startDateObj = new Date(eventstartdate);
    const endDateObj = new Date(eventenddate);
    const regisStartObj = new Date(regisstart);
    const regisEndObj = new Date(regisend);
    
    // Check if dates are valid
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime()) || 
        isNaN(regisStartObj.getTime()) || isNaN(regisEndObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    eventstartdate = startDateObj.toISOString().split('T')[0];
    eventenddate = endDateObj.toISOString().split('T')[0];
    regisstart = regisStartObj.toISOString().split('T')[0];
    regisend = regisEndObj.toISOString().split('T')[0];
    
    // Format times as HH:MM:SS
    // Handle both HH:MM:SS strings and ISO datetime strings
    const startTimeObj = new Date(eventstarttime);
    const endTimeObj = new Date(eventendtime);
    
    if (isNaN(startTimeObj.getTime()) || isNaN(endTimeObj.getTime())) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    eventstarttime = startTimeObj.toISOString().split('T')[1].split('.')[0];
    eventendtime = endTimeObj.toISOString().split('T')[1].split('.')[0];
    
    const newEvent = await sql`
        INSERT INTO events ("eventowner", "eventdetail", "eventimg", "eventstartdate", "eventenddate", "eventstarttime", "eventendtime", "regisstart", "regisend", "contact", "eventtitle", "eventlocation")
        VALUES (${eventowner}, ${eventdetail}, ${eventimg}, ${eventstartdate}, ${eventenddate}, ${eventstarttime}, ${eventendtime}, ${regisstart}, ${regisend}, ${contact}, ${eventtitle}, ${eventlocation})
        RETURNING *;
    `;
    res.status(201).json({ success: true, event: formatEventDates(newEvent[0]) });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

async function updateEvent(req, res) {
  const { eventId } = req.params;
  const { eventowner, eventdetail, eventimg, eventstartdate, eventenddate
    , eventstarttime, eventendtime, regisstart, regisend, contact, eventtitle, eventlocation
  } = req.body;
  
  console.log('Updating event:', eventId, 'with data:', req.body);
  
  try {
    // Fetch the existing event first
    const existingEvent = await sql`
      SELECT * FROM events WHERE "eventid" = ${eventId};
    `;
    
    if (existingEvent.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existing = existingEvent[0];

    // Build update object with only provided fields (fallback to existing values)
    const updates = {
      eventowner: eventowner !== undefined ? eventowner : existing.eventowner,
      eventdetail: eventdetail !== undefined ? eventdetail : existing.eventdetail,
      eventimg: eventimg !== undefined ? eventimg : existing.eventimg,
      contact: contact !== undefined ? contact : existing.contact,
      eventtitle: eventtitle !== undefined ? eventtitle : existing.eventtitle,
      eventlocation: eventlocation !== undefined ? eventlocation : existing.eventlocation,
    };

    // Handle date fields with formatting
    if (eventstartdate) {
      const startDateObj = new Date(eventstartdate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventstartdate format' });
      }
      updates.eventstartdate = startDateObj.toISOString().split('T')[0];
    } else {
      updates.eventstartdate = existing.eventstartdate;
    }

    if (eventenddate) {
      const endDateObj = new Date(eventenddate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventenddate format' });
      }
      updates.eventenddate = endDateObj.toISOString().split('T')[0];
    } else {
      updates.eventenddate = existing.eventenddate;
    }

    if (regisstart) {
      const regisStartObj = new Date(regisstart);
      if (isNaN(regisStartObj.getTime())) {
        return res.status(400).json({ error: 'Invalid regisstart format' });
      }
      updates.regisstart = regisStartObj.toISOString().split('T')[0];
    } else {
      updates.regisstart = existing.regisstart;
    }

    if (regisend) {
      const regisEndObj = new Date(regisend);
      if (isNaN(regisEndObj.getTime())) {
        return res.status(400).json({ error: 'Invalid regisend format' });
      }
      updates.regisend = regisEndObj.toISOString().split('T')[0];
    } else {
      updates.regisend = existing.regisend;
    }

    // Handle time fields with formatting
    if (eventstarttime) {
      // Check if it's already in HH:MM:SS format
      if (typeof eventstarttime === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(eventstarttime)) {
        updates.eventstarttime = eventstarttime.length === 5 ? eventstarttime + ':00' : eventstarttime;
      } else {
        const startTimeObj = new Date(eventstarttime);
        if (isNaN(startTimeObj.getTime())) {
          return res.status(400).json({ error: 'Invalid eventstarttime format' });
        }
        updates.eventstarttime = startTimeObj.toISOString().split('T')[1].split('.')[0];
      }
    } else {
      updates.eventstarttime = existing.eventstarttime;
    }

    if (eventendtime) {
      // Check if it's already in HH:MM:SS format
      if (typeof eventendtime === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(eventendtime)) {
        updates.eventendtime = eventendtime.length === 5 ? eventendtime + ':00' : eventendtime;
      } else {
        const endTimeObj = new Date(eventendtime);
        if (isNaN(endTimeObj.getTime())) {
          return res.status(400).json({ error: 'Invalid eventendtime format' });
        }
        updates.eventendtime = endTimeObj.toISOString().split('T')[1].split('.')[0];
      }
    } else {
      updates.eventendtime = existing.eventendtime;
    }
    
    const updatedEvent = await sql`
        UPDATE events 
        SET "eventowner" = ${updates.eventowner}, 
            "eventdetail" = ${updates.eventdetail}, 
            "eventimg" = ${updates.eventimg}, 
            "eventstartdate" = ${updates.eventstartdate}, 
            "eventenddate" = ${updates.eventenddate}, 
            "eventstarttime" = ${updates.eventstarttime}, 
            "eventendtime" = ${updates.eventendtime}, 
            "regisstart" = ${updates.regisstart}, 
            "regisend" = ${updates.regisend}, 
            "contact" = ${updates.contact}, 
            "eventtitle" = ${updates.eventtitle}, 
            "eventlocation" = ${updates.eventlocation}
        WHERE "eventid" = ${eventId}
        RETURNING *;
    `;
    
    res.status(200).json({ success: true, event: formatEventDates(updatedEvent[0]) });
  } catch (err) {
    console.error('Update event error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update event', details: err.message });
  }
}

async function getEventById(req, res) {
  const { eventId } = req.params;
  try {
    const event = await sql`
      SELECT * FROM events WHERE "eventid" = ${eventId};
    `; 
    if (event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(200).json({ success: true, event: formatEventDates(event[0]) });
  } catch (err) {
    console.error('Get event by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve event' });
  }
}

async function deleteEvent(req, res) {
  const { eventid } = req.params;
  try {
    const deletedEvent = await sql`
      DELETE FROM events WHERE "eventid" = ${eventid} RETURNING *;
    `;
    if (deletedEvent.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(200).json({ success: true, event: formatEventDates(deletedEvent[0]) });
  }
  catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}
async function getAllUserEvents(req, res) {
  const { userId } = req.params;
  try {
    const events = await sql`
      SELECT * FROM events WHERE "eventowner" = ${userId} ORDER BY "eventid" DESC;
    `;
    res.status(200).json({ success: true, events: events.map(formatEventDates) });
  } catch (err) {
    console.error('Get user events error:', err);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
}

module.exports = { createEvent, updateEvent, getEventById, deleteEvent, getAllUserEvents };

