const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { env } = require('../config/env');

const client = new S3Client({
  region: 'auto',
  endpoint: env.r2.endpoint,
  credentials: { accessKeyId: env.r2.accessKeyId, secretAccessKey: env.r2.secretAccessKey }
});

async function upload({ key, body, contentType }) {
  return client.send(new PutObjectCommand({ Bucket: env.r2.bucketName, Key: key, Body: body, ContentType: contentType }));
}
async function getSignedUrlForObject({ key, expiresIn = 60 }) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.r2.bucketName, Key: key }), { expiresIn });
}
async function remove({ key }) {
  return client.send(new DeleteObjectCommand({ Bucket: env.r2.bucketName, Key: key }));
}

module.exports = { upload, getSignedUrl: getSignedUrlForObject, remove };
