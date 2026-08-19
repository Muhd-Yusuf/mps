import { NextResponse } from "next/server"

import { uploadImageToCloudinary } from "@/lib/cloudinary"
import { requireAdmin } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const folder = (formData.get("folder") as string) || process.env.CLOUDINARY_FOLDER || "mps"

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const upload = await uploadImageToCloudinary(buffer, folder)

    return NextResponse.json({
      url: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      format: upload.format,
    })
  } catch (error) {
    console.error("[UPLOAD_IMAGE_ERROR]", error)
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
  }
}
