// pages/api/upload.js
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // we’ll handle multipart parsing
  },
};

export default async function handler(req, res) {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      return res.status(500).json({ error: "Form parse failed" });
    }

    try {
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        const metadata = JSON.parse(fields.metadata);

        // 🔹 Upload file to Pinata
        const fileForm = new FormData();
        fileForm.append("file", fs.createReadStream(file.filepath), file.originalFilename);


      const fileRes = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        fileForm,
        {
          maxBodyLength: Infinity,
          headers: {
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
            ...fileForm.getHeaders(),
          },
        }
      );

      const fileCid = fileRes.data.IpfsHash;
console.log("📁 File pinned:", fileCid);

// Use your custom gateway instead of default IPFS URI
const gatewayUrl = `https://beige-magnetic-sheep-465.mypinata.cloud/ipfs/${fileCid}`;

// Build metadata JSON
const metadataJson = {
  ...metadata,
  image: gatewayUrl, // ✅ updated
  properties: {
    files: [{ uri: gatewayUrl, type: metadata.type }], // ✅ updated
  },
};

// Upload metadata to Pinata
const jsonRes = await axios.post(
  "https://api.pinata.cloud/pinning/pinJSONToIPFS",
  metadataJson,
  {
    headers: {
      pinata_api_key: process.env.PINATA_API_KEY,
      pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
    },
  }
);

const metadataCid = jsonRes.data.IpfsHash;
const metadataUrl = `https://beige-magnetic-sheep-465.mypinata.cloud/ipfs/${metadataCid}`;
console.log("📝 Metadata pinned:", metadataUrl);

res.status(200).json({ url: metadataUrl });

    } catch (e) {
      console.error("❌ Upload error:", e.response?.data || e.message);
      res.status(500).json({ error: e.message });
    }
  });
}
