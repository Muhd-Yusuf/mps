import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("Missing Cloudinary environment variables")
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
})

export function getCloudinary() {
  return cloudinary
}

export async function uploadImageToCloudinary(buffer: Buffer, folder = "mps"): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Failed to upload image"))
      } else {
        resolve(result)
      }
    })

    uploadStream.end(buffer)
  })
}