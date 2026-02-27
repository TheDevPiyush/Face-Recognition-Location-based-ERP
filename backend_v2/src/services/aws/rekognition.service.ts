import {
    IndexFacesCommand,
    SearchFacesByImageCommand,
    DeleteFacesCommand,
} from "@aws-sdk/client-rekognition";

import { rekognition } from "../../config/aws";

const collectionId = process.env.AWS_REKOGNITION_COLLECTION!;

export async function registerFace(
    bucket: string,
    key: string,
    userId: string
) {
    const result = await rekognition.send(
        new IndexFacesCommand({
            CollectionId: collectionId,
            Image: {
                S3Object: {
                    Bucket: bucket,
                    Name: key,
                },
            },
            ExternalImageId: userId,
            DetectionAttributes: [],
        })
    );

    const faceId = result.FaceRecords?.[0]?.Face?.FaceId;
    console.log('---', userId)

    if (!faceId) {
        throw new Error("No face detected in the image.");
    }

    return faceId;
}

export async function deregisterFace(faceId: string) {
    await rekognition.send(
        new DeleteFacesCommand({
            CollectionId: collectionId,
            FaceIds: [faceId],
        })
    );
}


export async function compareFace(
    bucket: string,
    key: string
) {
    const result = await rekognition.send(
        new SearchFacesByImageCommand({
            CollectionId: collectionId,
            Image: {
                S3Object: {
                    Bucket: bucket,
                    Name: key,
                },
            },
            MaxFaces: 1,
            FaceMatchThreshold: 90,
        })
    );

    const match = result.FaceMatches?.[0];

    if (!match) {
        return null;
    }

    return {
        faceId: match.Face?.FaceId,
        similarity: match.Similarity,
        externalImageId: match.Face?.ExternalImageId,
    };
}