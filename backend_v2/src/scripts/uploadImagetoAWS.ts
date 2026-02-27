import { IndexFacesCommand } from "@aws-sdk/client-rekognition";
import { rekognition } from "../config/aws";

async function testIndex() {
  const result = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: "college-attendance",
      Image: {
        Bytes: Buffer.from("dummy"),
      },
    })
  );

  console.log(result);
}

testIndex();