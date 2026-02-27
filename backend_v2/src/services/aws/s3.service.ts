import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../config/aws";
import crypto from "crypto";

const bucket = process.env.AWS_S3_BUCKET!;
const region = process.env.AWS_REGION!;

/* =========================================
   Upload Image to S3
========================================= */

export async function uploadToS3(
  file: Express.Multer.File,
  folder: string
) {
  if (!file) throw new Error("File not provided");

  const key = `${folder}/${crypto.randomUUID()}-${file.originalname}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    key,
    url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
  };
}

/* =========================================
   Delete Image from S3
========================================= */

export async function deleteFromS3(key: string) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}