import { ListFacesCommand, DeleteFacesCommand } from "@aws-sdk/client-rekognition";
import { rekognition } from "../config/aws";

const collectionId = process.env.AWS_REKOGNITION_COLLECTION!;

async function clearCollection() {
    console.log(`🗑️  Clearing Rekognition collection: ${collectionId}\n`);

    let totalDeleted = 0;
    let nextToken: string | undefined = undefined;

    do {
        // List faces in batches of 100 (AWS max)
        const listResult: any = await rekognition.send(
            new ListFacesCommand({
                CollectionId: collectionId,
                MaxResults: 100,
                NextToken: nextToken,
            })
        );

        const faces = listResult.Faces ?? [];

        if (faces.length === 0) {
            console.log("No faces found in collection.");
            break;
        }

        const faceIds = faces.map((f: any) => f.FaceId).filter(Boolean) as string[];

        console.log(`Found ${faceIds.length} faces — deleting...`);
        faces.forEach((f: any) =>
            console.log(`  - FaceId: ${f.FaceId} | ExternalImageId: ${f.ExternalImageId ?? "NONE"}`)
        );

        await rekognition.send(
            new DeleteFacesCommand({
                CollectionId: collectionId,
                FaceIds: faceIds,
            })
        );

        totalDeleted += faceIds.length;
        nextToken = listResult.NextToken;
    } while (nextToken);

    console.log(`\n✅ Done — deleted ${totalDeleted} face(s) from collection "${collectionId}"`);
    process.exit(0);
}

clearCollection().catch((err) => {
    console.error("❌ Failed to clear collection:", err);
    process.exit(1);
});