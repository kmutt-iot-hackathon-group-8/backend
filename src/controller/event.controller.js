import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

export async function createEvent(req, res) {
  let { eventOwner, eventDetail, eventIMG, eventStartDate, eventEndDate
    , eventStartTime, eventEndTime, regisStart, regisEnd, contact, eventtitle
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
        INSERT INTO events ("eventowner", "eventdetail", "eventimg", "eventstartdate", "eventenddate", "eventstarttime", "eventendtime", "regisstart", "regisend", "contact", "eventtitle")
        VALUES (${eventOwner}, ${eventDetail}, ${eventIMG}, ${eventStartDate}, ${eventEndDate}, ${eventStartTime}, ${eventEndTime}, ${regisStart}, ${regisEnd}, ${contact}, ${eventtitle})
        RETURNING *;
    `;
    res.status(201).json({ success: true, event: newEvent[0] });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
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