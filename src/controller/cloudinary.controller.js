const cloudinary = require('../util/cloudinary');
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function uploadImagePicController(req, res) {
  const file = req.file; 
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const eventId = req.body.eventId;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  const base64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${base64}`;

  try {
    // Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(dataUri, {
      folder: 'feelio/post',
      transformation: [{ width: 800, height: 600, crop: 'limit' }],
    });

    const imageURL = cloudinaryResult.secure_url;

    // Save URL to database
    const newIMG = await sql`
      UPDATE events 
      SET "eventIMG" = ${imageURL}
      WHERE "eventId" = ${eventId}
      RETURNING "eventId", "eventIMG"
    `;

    if (newIMG.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.status(200).json({ success: true, image: newIMG[0] });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

module.exports = { uploadImagePicController };