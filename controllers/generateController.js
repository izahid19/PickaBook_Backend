const Replicate = require('replicate');
const fs = require('fs');
const User = require('../models/User');

// Replicate setup
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Generate image using Replicate
const generateImage = async (req, res) => {
  try {
    // Check credits
    if (req.user.credits <= 0) {
      return res.status(403).json({ 
        error: 'Insufficient credits', 
        credits: 0,
        message: 'You have no credits remaining. Please contact admin for more credits.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Received file:', req.file.originalname, 'from user:', req.user.email);

    // Read the file and convert to base64 data URI
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype;
    const base64Image = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    // Flux Kontext Pro model on Replicate
    const model = "black-forest-labs/flux-kontext-pro";
    
    console.log('Running Replicate model...');
    const output = await replicate.run(
      model,
      {
        input: {
          input_image: base64Image,
          prompt: "soft 3d render, disney pixar style, cute 3d character, cinematic lighting, 8k, unreal engine 5 render, dreamy background, high quality, detailed texture",
          aspect_ratio: "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
          prompt_upsampling: false
        }
      }
    );

    console.log('Replicate output:', output);
    
    // Deduct credit
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { credits: -1 } },
      { new: true }
    );

    // Replicate returns an array of image URLs
    const imageUrl = Array.isArray(output) ? output[0] : output;

    res.json({ 
      imageUrl,
      credits: updatedUser.credits
    });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error.message });
  }
};

module.exports = {
  generateImage
};
