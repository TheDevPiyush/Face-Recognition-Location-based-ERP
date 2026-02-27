import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { ListCollectionsCommand } from "@aws-sdk/client-rekognition";
import { s3, rekognition } from "../config/aws";

async function test() {
  const buckets = await s3.send(new ListBucketsCommand({}));
  console.log("S3 OK:", buckets.Buckets?.length);

  const collections = await rekognition.send(
    new ListCollectionsCommand({})
  );
  console.log("Rekognition OK:", collections.CollectionIds);
}

test();