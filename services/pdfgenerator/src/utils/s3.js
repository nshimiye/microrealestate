import { Crypto, logger } from '@microrealestate/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import fs from 'fs-extra';

function _initS3(b2Config) {
  return new S3Client({
    credentials: {
      accessKeyId: Crypto.decrypt(b2Config.keyId),
      secretAccessKey: Crypto.decrypt(b2Config.applicationKey)
    },
    endpoint: b2Config.endpoint,
    region: 'us-east-1' // Required by SDK v3, but not used by B2
  });
}

export function isEnabled(b2Config) {
  return !!(
    b2Config?.keyId &&
    b2Config?.applicationKey &&
    b2Config?.endpoint &&
    b2Config?.bucket
  );
}

export async function downloadFile(b2Config, url) {
  logger.debug(`download ${url} from s3`);
  try {
    const s3 = _initS3(b2Config);
    
    const command = new GetObjectCommand({
      Bucket: b2Config.bucket,
      Key: url
    });
    
    const result = await s3.send(command);
    
    return result.Body;
  } catch (error) {
    logger.error(`cannot download file ${url} from s3`, error);
    throw error;
  }
}

export async function uploadFile(b2Config, { file, fileName, url }) {
  logger.debug(`upload ${url} to s3`);
  try {
    const s3 = _initS3(b2Config);
    const fileStream = fs.createReadStream(file.path);
    
    const command = new PutObjectCommand({
      Bucket: b2Config.bucket,
      Key: url,
      Body: fileStream
    });
    
    const result = await s3.send(command);
    
    return {
      fileName,
      key: url,
      versionId: result.VersionId
    };
  } catch (error) {
    logger.error(`cannot upload file ${url} to s3`, error);
    throw error;
  }
}

export async function deleteFiles(b2Config, urlsIds) {
  logger.debug(`delete ${JSON.stringify(urlsIds)} from s3`);
  try {
    const s3 = _initS3(b2Config);
    
    const command = new DeleteObjectsCommand({
      Bucket: b2Config.bucket,
      Delete: {
        Objects: urlsIds.map(({ url, versionId }) => ({
          Key: url,
          VersionId: versionId
        }))
      }
    });
    
    const result = await s3.send(command);
    logger.debug({ data: result });
    
    return result;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
