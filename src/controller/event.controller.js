import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

export async function createEvent(req, res) {
  let { eventOwner, eventDetail, eventIMG, eventStartDate, eventEndDate
    , eventStartTime, eventEndTime, regisStart, regisEnd, contact, eventtitle, eventlocation
  } = req.body;
  
  console.log('Received data:', req.body);
  
  try {
    // Validate required fields
    if (!eventStartDate || !eventEndDate || !eventStartTime || !eventEndTime || !regisStart || !regisEnd) {
      console.log('Missing fields:', {
        eventStartDate, eventEndDate, eventStartTime, eventEndTime, regisStart, regisEnd
      });
      return res.status(400).json({ error: 'Missing required date/time fields' });
    }

    // Format dates as YYYY-MM-DD (handle both date strings and ISO datetime strings)
    const startDateObj = new Date(eventStartDate);
    const endDateObj = new Date(eventEndDate);
    const regisStartObj = new Date(regisStart);
    const regisEndObj = new Date(regisEnd);
    
    // Check if dates are valid
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime()) || 
        isNaN(regisStartObj.getTime()) || isNaN(regisEndObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    eventStartDate = startDateObj.toISOString().split('T')[0];
    eventEndDate = endDateObj.toISOString().split('T')[0];
    regisStart = regisStartObj.toISOString().split('T')[0];
    regisEnd = regisEndObj.toISOString().split('T')[0];
    
    // Format times as HH:MM:SS
    // Handle both HH:MM:SS strings and ISO datetime strings
    const startTimeObj = new Date(eventStartTime);
    const endTimeObj = new Date(eventEndTime);
    
    if (isNaN(startTimeObj.getTime()) || isNaN(endTimeObj.getTime())) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    eventStartTime = startTimeObj.toISOString().split('T')[1].split('.')[0];
    eventEndTime = endTimeObj.toISOString().split('T')[1].split('.')[0];
    
    const newEvent = await sql`
        INSERT INTO events ("eventowner", "eventdetail", "eventimg", "eventstartdate", "eventenddate", "eventstarttime", "eventendtime", "regisstart", "regisend", "contact", "eventtitle", "eventlocation")
        VALUES (${eventOwner}, ${eventDetail}, ${eventIMG}, ${eventStartDate}, ${eventEndDate}, ${eventStartTime}, ${eventEndTime}, ${regisStart}, ${regisEnd}, ${contact}, ${eventtitle}, ${eventlocation})
        RETURNING *;
    `;
    res.status(201).json({ success: true, event: newEvent[0] });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

export async function updateEvent(req, res) {
  const { eventId } = req.params;
  const { eventOwner, eventDetail, eventIMG, eventStartDate, eventEndDate
    , eventStartTime, eventEndTime, regisStart, regisEnd, contact, eventtitle, eventlocation
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
      eventOwner: eventOwner !== undefined ? eventOwner : existing.eventowner,
      eventDetail: eventDetail !== undefined ? eventDetail : existing.eventdetail,
      eventIMG: eventIMG !== undefined ? eventIMG : existing.eventimg,
      contact: contact !== undefined ? contact : existing.contact,
      eventtitle: eventtitle !== undefined ? eventtitle : existing.eventtitle,
      eventlocation: eventlocation !== undefined ? eventlocation : existing.eventlocation,
    };

    // Handle date fields with formatting
    if (eventStartDate) {
      const startDateObj = new Date(eventStartDate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventStartDate format' });
      }
      updates.eventStartDate = startDateObj.toISOString().split('T')[0];
    } else {
      updates.eventStartDate = existing.eventstartdate;
    }

    if (eventEndDate) {
      const endDateObj = new Date(eventEndDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventEndDate format' });
      }
      updates.eventEndDate = endDateObj.toISOString().split('T')[0];
    } else {
      updates.eventEndDate = existing.eventenddate;
    }

    if (regisStart) {
      const regisStartObj = new Date(regisStart);
      if (isNaN(regisStartObj.getTime())) {
        return res.status(400).json({ error: 'Invalid regisStart format' });
      }
      updates.regisStart = regisStartObj.toISOString().split('T')[0];
    } else {
      updates.regisStart = existing.regisstart;
    }

    if (regisEnd) {
      const regisEndObj = new Date(regisEnd);
      if (isNaN(regisEndObj.getTime())) {
        return res.status(400).json({ error: 'Invalid regisEnd format' });
      }
      updates.regisEnd = regisEndObj.toISOString().split('T')[0];
    } else {
      updates.regisEnd = existing.regisend;
    }

    // Handle time fields with formatting
    if (eventStartTime) {
      const startTimeObj = new Date(eventStartTime);
      if (isNaN(startTimeObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventStartTime format' });
      }
      updates.eventStartTime = startTimeObj.toISOString().split('T')[1].split('.')[0];
    } else {
      updates.eventStartTime = existing.eventstarttime;
    }

    if (eventEndTime) {
      const endTimeObj = new Date(eventEndTime);
      if (isNaN(endTimeObj.getTime())) {
        return res.status(400).json({ error: 'Invalid eventEndTime format' });
      }
      updates.eventEndTime = endTimeObj.toISOString().split('T')[1].split('.')[0];
    } else {
      updates.eventEndTime = existing.eventendtime;
    }
    
    const updatedEvent = await sql`
        UPDATE events 
        SET "eventowner" = ${updates.eventOwner}, 
            "eventdetail" = ${updates.eventDetail}, 
            "eventimg" = ${updates.eventIMG}, 
            "eventstartdate" = ${updates.eventStartDate}, 
            "eventenddate" = ${updates.eventEndDate}, 
            "eventstarttime" = ${updates.eventStartTime}, 
            "eventendtime" = ${updates.eventEndTime}, 
            "regisstart" = ${updates.regisStart}, 
            "regisend" = ${updates.regisEnd}, 
            "contact" = ${updates.contact}, 
            "eventtitle" = ${updates.eventtitle}, 
            "eventlocation" = ${updates.eventlocation}
        WHERE "eventid" = ${eventId}
        RETURNING *;
    `;
    
    res.status(200).json({ success: true, event: updatedEvent[0] });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
}

export async function getEventById(req, res) {
  const { eventId } = req.params;
  try {
    const event = await sql`
      SELECT * FROM events WHERE "eventid" = ${eventId};
    `; 
    if (event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(200).json({ success: true, event: event[0] });
  } catch (err) {
    console.error('Get event by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve event' });
  }
}

export async function deleteEvent(req, res) {
  const { eventid } = req.params;
  try {
    const deletedEvent = await sql`
      DELETE FROM events WHERE "eventid" = ${eventid} RETURNING *;
    `;
    if (deletedEvent.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(200).json({ success: true, event: deletedEvent[0] });
  }
  catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}
export async function getAllUserEvents(req, res) {
  const { userId } = req.params;
  try {
    const events = await sql`
      SELECT * FROM events WHERE "eventowner" = ${userId} ORDER BY "eventid" DESC;
    `;
    res.status(200).json({ success: true, events });
  } catch (err) {
    console.error('Get user events error:', err);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
}

