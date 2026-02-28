import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionClient } from "@aws-sdk/client-rekognition";

/* ===============================
   Environment Validation
=============================== */

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

if (!region || !accessKeyId || !secretAccessKey) {
  throw new Error("Missing AWS environment variables.");
}

/* ===============================
   AWS Clients
=============================== */

export const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const rekognition = new RekognitionClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/* ===============================
   Shared Constants
=============================== */

export const AWS_BUCKET = process.env.AWS_S3_BUCKET!;
export const AWS_COLLECTION =
  process.env.AWS_REKOGNITION_COLLECTION!;