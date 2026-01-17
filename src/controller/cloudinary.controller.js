import cloudinary from '../util/cloudinary.js';

export async function uploadImagePicController(req, res) {
  const file = req.file; 
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const base64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${base64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'feelio/post',
      transformation: [{ width: 200, height: 200, crop: 'fill' }],
    });
    

    res.json({ imageUrl: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}