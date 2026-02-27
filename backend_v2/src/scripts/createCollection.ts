import { CreateCollectionCommand } from "@aws-sdk/client-rekognition";
import { rekognition } from ".././config/aws";

async function createCollection() {
  try {
    const result = await rekognition.send(
      new CreateCollectionCommand({
        CollectionId: process.env.AWS_REKOGNITION_COLLECTION!,
      })
    );

    console.log("Collection created:", result);
  } catch (error: any) {
    if (error.name === "ResourceAlreadyExistsException") {
      console.log("Collection already exists.");
    } else {
      console.error("Error creating collection:", error);
    }
  }
}

createCollection();